// These tests use an actual browser WebSocket and a loopback RFC 6455 server.
// The fixtures deliberately encode protobuf independently of the production codec.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, firefox, webkit } from "playwright";

const browserName = process.env.ALPHAJONG_BROWSER || "chromium";
const browserType = { chromium, firefox, webkit }[browserName];
assert.ok(browserType, `Unsupported browser: ${browserName}`);
const timeoutMs = Number(process.env.ALPHAJONG_UNITY_TEST_TIMEOUT_MS || 10000);
const report = { browser: browserName, total: 0, passed: 0, failed: 0, tests: [] };

function varint(value) {
  const result = [];
  do {
    let next = value % 128;
    value = Math.floor(value / 128);
    if (value) next |= 128;
    result.push(next);
  } while (value);
  return Buffer.from(result);
}

function uint(field, value) {
  return Buffer.concat([varint(field * 8), varint(value)]);
}

function bytes(field, value) {
  const data = Buffer.from(value);
  return Buffer.concat([varint(field * 8 + 2), varint(data.length), data]);
}

function text(field, value) {
  return bytes(field, Buffer.from(value, "utf8"));
}

function rpc(kind, id, method, data = Buffer.alloc(0)) {
  const prefix = kind === 1 ? Buffer.from([kind]) : Buffer.from([kind, id & 255, id >>> 8]);
  return Buffer.concat([prefix, text(1, method), bytes(2, data)]);
}

function auth(id = 7) {
  return rpc(2, id, ".lq.FastTest.authGame",
    Buffer.concat([uint(1, 123), text(3, "browser-fixture-game")]));
}

function operation(id, tile = "1m") {
  return rpc(2, id, ".lq.FastTest.inputOperation", Buffer.concat([uint(1, 1), text(3, tile)]));
}

function response(id) {
  return rpc(3, id, "");
}

function wireId(data) {
  assert.ok(data.length >= 3, "The request has a wire ID");
  return data[1] | data[2] << 8;
}

async function eventually(predicate, message) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out: ${message}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function serverFrame(opcode, data) {
  data = Buffer.from(data);
  let header;
  if (data.length < 126) header = Buffer.from([0x80 | opcode, data.length]);
  else if (data.length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else throw new Error("The loopback fixture only supports small frames");
  return Buffer.concat([header, data]);
}

const channels = new Map();
const rawSockets = new Set();
const serverErrors = [];
const server = createServer((request, result) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/") {
    result.writeHead(404).end();
    return;
  }
  const key = url.searchParams.get("key");
  const binaryType = url.searchParams.get("binaryType") || "arraybuffer";
  const subclass = url.searchParams.get("subclass") === "1";
  const early = url.searchParams.get("early") === "1";
  result.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  result.end(`<!doctype html><meta charset="utf-8"><title>Unity socket fixture</title>
    <canvas id="unity-canvas"></canvas><script>
    window.__pageSawInstalledHook = WebSocket !== window.__nativeWebSocket;
    window.__clientMessages = [];
    window.__clientListenerMessages = [];
    window.__clientEventChecks = [];
    window.__testSocketClass = ${subclass ? "class FixtureSocket extends WebSocket {}" : "WebSocket"};
    window.__socket = new window.__testSocketClass(location.origin.replace('http:', 'ws:') + '/socket?key=' + ${JSON.stringify(key)}, ['lq-test']);
    window.__socket.binaryType = ${JSON.stringify(binaryType)};
    window.__socket.onopen = function(event) {
      window.__openIsNative = this === window.__socket && event.target === this && event instanceof Event;
    };
    window.__socket.onmessage = function(event) {
      window.__clientMessages.push(event.data);
      window.__clientEventChecks.push(this === window.__socket && event.target === this && event instanceof MessageEvent);
      if (window.__attemptSendOnMessage) {
        window.__attemptSendOnMessage = false;
        window.__sendInMessageResult = window.__transport.send('inputOperation', { type: 1, tile: '1m' });
      }
    };
    window.__socket.addEventListener('message', event => window.__clientListenerMessages.push(event.data));
    ${early ? `try { window.__socket.send(new Uint8Array(${JSON.stringify([...auth()])})); }
      catch (error) { window.__earlySendError = error.name; }` : ""}
    </script>`);
});

server.on("connection", socket => {
  rawSockets.add(socket);
  socket.on("close", () => rawSockets.delete(socket));
  socket.on("error", () => {});
});

server.on("upgrade", (request, socket, head) => {
  const accept = createHash("sha1")
    .update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
  const key = new URL(request.url, "http://localhost").searchParams.get("key");
  const subprotocol = String(request.headers["sec-websocket-protocol"] || "").split(",")[0].trim();
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    (subprotocol ? `Sec-WebSocket-Protocol: ${subprotocol}\r\n` : "") + "\r\n");
  const channel = {
    received: [], closed: false, subprotocol,
    send(data, opcode = 2) { socket.write(serverFrame(opcode, data)); },
    close(code = 1000) {
      const data = Buffer.alloc(2);
      data.writeUInt16BE(code);
      socket.write(serverFrame(8, data));
    }
  };
  channels.set(key, channel);
  let pending = Buffer.alloc(0), fragmentOpcode = 0, fragments = [];
  function receive(chunk) {
    try {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 2) {
        const final = (pending[0] & 0x80) !== 0;
        const opcode = pending[0] & 15;
        const masked = (pending[1] & 0x80) !== 0;
        let length = pending[1] & 127, offset = 2;
        assert.ok(masked, "Browser frames must be masked");
        if (length === 126) {
          if (pending.length < 4) return;
          length = pending.readUInt16BE(2);
          offset = 4;
        } else if (length === 127) {
          if (pending.length < 10) return;
          const longLength = pending.readBigUInt64BE(2);
          assert.ok(longLength < 1024n * 1024n, "Unexpected large browser frame");
          length = Number(longLength);
          offset = 10;
        }
        if (pending.length < offset + 4 + length) return;
        const mask = pending.subarray(offset, offset + 4);
        const data = Buffer.from(pending.subarray(offset + 4, offset + 4 + length));
        for (let index = 0; index < data.length; index++) data[index] ^= mask[index % 4];
        pending = pending.subarray(offset + 4 + length);
        if (opcode === 8) {
          channel.closed = true;
          socket.end(serverFrame(8, data));
          continue;
        }
        if (opcode === 9) { socket.write(serverFrame(10, data)); continue; }
        if (opcode === 10) continue;
        if (opcode !== 0) { fragmentOpcode = opcode; fragments = []; }
        fragments.push(data);
        if (final) {
          channel.received.push({ opcode: fragmentOpcode, data: Buffer.concat(fragments) });
          fragmentOpcode = 0;
          fragments = [];
        }
      }
    } catch (error) {
      serverErrors.push(error.message);
      socket.destroy();
    }
  }
  socket.on("data", receive);
  socket.on("close", () => { channel.closed = true; });
  if (head.length) receive(head);
});

const sources = await Promise.all(["unity_protocol", "unity_transport"].map(name =>
  readFile(path.join("src", `${name}.js`), "utf8")));
const initSource = `window.__nativeWebSocket = window.WebSocket;
${sources.join("\n")}
window.__frames = [];
window.__activities = [];
window.__invalidations = [];
window.__statuses = [];
window.__allowSend = false;
window.__guardCurrent = true;
window.__guardCalls = [];
window.__transport = AlphaJongUnityTransport.install({
  scope: window,
  protocol: AlphaJongUnityProtocol,
  onFrame(frame, direction) {
    window.__frames.push({ kind: frame.kind, id: frame.id, method: frame.method, message: frame.message, direction });
    if (window.__throwFrameCallback) throw new Error('fixture observer failure');
  },
  onActivity(reason) {
    window.__activities.push(String(reason));
    if (window.__invalidateGuardOnActivity) window.__guardCurrent = false;
  },
  onInvalidate(reason) {
    window.__invalidations.push(String(reason));
    window.__guardCurrent = false;
  },
  onStatus(status) { window.__statuses.push(status); },
  canSend(method, payload) {
    window.__guardCalls.push({ method, payload });
    return window.__allowSend && window.__guardCurrent;
  }
});`;

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let browser;
let fixtureCounter = 0;
const fixtures = new Set();

async function fixture(options = {}) {
  const key = String(++fixtureCounter);
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript({ content: initSource });
  const query = new URLSearchParams({ key, ...options });
  await page.goto(`${baseUrl}/?${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__socket.readyState === WebSocket.OPEN);
  await eventually(() => channels.has(key), "loopback connection");
  const result = { page, channel: channels.get(key), key, errors };
  fixtures.add(result);
  return result;
}

async function sendClient(test, data) {
  await test.page.evaluate(value => window.__socket.send(new Uint8Array(value)), [...data]);
}

async function authenticate(test, id = 7) {
  const sent = test.channel.received.length;
  await sendClient(test, auth(id));
  await eventually(() => test.channel.received.length === sent + 1, "auth request");
  test.channel.send(response(wireId(test.channel.received[sent].data)));
  await test.page.waitForFunction(value => window.__frames.some(frame =>
    frame.kind === "response" && frame.id === value), id);
}

async function clientBytes(page) {
  return page.evaluate(async () => Promise.all(window.__clientMessages.map(async data =>
    typeof data === "string" ? data : Array.from(new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data)))));
}

async function allowSend(page) {
  await page.evaluate(() => { window.__allowSend = true; window.__guardCurrent = true; });
}

async function attemptSend(page) {
  return page.evaluate(() => window.__transport.send("inputOperation", { type: 1, tile: "1m" }));
}

async function test(name, callback) {
  report.total++;
  const started = Date.now();
  try {
    await callback();
    for (const current of fixtures) assert.deepEqual(current.errors, [], "No browser page errors");
    assert.deepEqual(serverErrors, [], "No fixture server errors");
    report.passed++;
    report.tests.push({ name, passed: true, durationMs: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.failed++;
    report.tests.push({ name, passed: false, durationMs: Date.now() - started, error: error.stack || String(error) });
    console.error(`FAIL ${name}: ${error.stack || error}`);
  } finally {
    for (const current of fixtures) {
      await current.page.close();
      channels.delete(current.key);
    }
    fixtures.clear();
    serverErrors.length = 0;
  }
}

try {
  browser = await browserType.launch({ headless: true });

  await test("document-start interception preserves native constructor, events, and subprotocol", async () => {
    const current = await fixture({ subclass: "1" });
    const native = await current.page.evaluate(() => ({
      hookedBeforePage: window.__pageSawInstalledHook,
      constants: [WebSocket.CONNECTING, WebSocket.OPEN, WebSocket.CLOSING, WebSocket.CLOSED],
      prototype: WebSocket.prototype === window.__nativeWebSocket.prototype,
      instance: window.__socket instanceof WebSocket && window.__socket instanceof window.__nativeWebSocket,
      subclass: window.__socket instanceof window.__testSocketClass,
      protocol: window.__socket.protocol,
      binaryType: window.__socket.binaryType,
      openEvent: window.__openIsNative,
      invalidUrl: (() => { try { new WebSocket('file:///invalid'); } catch (error) { return error.name; } })(),
      requiresNew: (() => { try { WebSocket('ws://127.0.0.1/'); } catch (error) { return error.name; } })()
    }));
    assert.deepEqual(native, { hookedBeforePage: true, constants: [0, 1, 2, 3], prototype: true,
      instance: true, subclass: true, protocol: "lq-test", binaryType: "arraybuffer", openEvent: true,
      invalidUrl: "SyntaxError", requiresNew: "TypeError" });
    assert.equal(current.channel.subprotocol, "lq-test");
  });

  await test("failed native sends are not recorded as successful protocol activity", async () => {
    const current = await fixture({ early: "1" });
    const result = await current.page.evaluate(() => ({ error: window.__earlySendError, frames: window.__frames.length }));
    assert.deepEqual(result, { error: "InvalidStateError", frames: 0 });
    assert.equal(current.channel.received.length, 0);
  });

  await test("Unity heap slices are copied before reuse and sent without prefix or suffix", async () => {
    const current = await fixture();
    const request = auth(19);
    await current.page.evaluate(value => {
      const heap = new Uint8Array(value.length + 12);
      heap.fill(255);
      heap.set(value, 5);
      window.__socket.send(heap.subarray(5, 5 + value.length));
      heap.fill(0); // The Unity allocator may reuse this memory immediately.
    }, [...request]);
    await eventually(() => current.channel.received.length === 1, "typed-array send");
    assert.deepEqual(current.channel.received[0].data, request);
    await current.page.waitForFunction(() => window.__frames.length === 1);
    const observed = await current.page.evaluate(() => window.__frames[0]);
    assert.equal(observed.kind, "request");
    assert.equal(observed.id, 19);
    assert.equal(observed.method, ".lq.FastTest.authGame");
    assert.equal(observed.message.account_id, 123);
  });

  await test("unrelated text and binary traffic reaches native listeners unchanged", async () => {
    const current = await fixture();
    await current.page.evaluate(() => window.__socket.send("opaque outbound"));
    await eventually(() => current.channel.received.length === 1, "text send");
    assert.equal(current.channel.received[0].opcode, 1);
    assert.equal(current.channel.received[0].data.toString(), "opaque outbound");
    current.channel.send(Buffer.from("opaque inbound"), 1);
    current.channel.send(Buffer.from([44, 0, 255, 3]));
    await current.page.waitForFunction(() => window.__clientMessages.length === 2);
    assert.deepEqual(await clientBytes(current.page), ["opaque inbound", [44, 0, 255, 3]]);
    assert.deepEqual(await current.page.evaluate(() => ({ frames: window.__frames.length,
      invalidations: window.__invalidations.length, events: window.__clientEventChecks,
      listeners: window.__clientListenerMessages.length })),
    { frames: 0, invalidations: 0, events: [true, true], listeners: 2 });
  });

  await test("HELP and stale decisions cannot originate requests", async () => {
    const current = await fixture();
    await authenticate(current);
    const before = current.channel.received.length;
    assert.equal(await attemptSend(current.page), false, "HELP gate denies the request");
    await allowSend(current.page);
    await current.page.evaluate(() => { window.__guardCurrent = false; });
    assert.equal(await attemptSend(current.page), false, "A stale decision is denied");
    assert.equal(current.channel.received.length, before);
  });

  await test("bridge responses and duplicates stay private while colliding Unity IDs are restored", async () => {
    const current = await fixture();
    await authenticate(current);
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), true);
    await eventually(() => current.channel.received.length === 2, "bridge operation");
    const ownId = wireId(current.channel.received[1].data);
    const collision = operation(ownId, "9p");
    await sendClient(current, collision);
    await eventually(() => current.channel.received.length === 3, "colliding Unity request");
    const clientWire = current.channel.received[2].data;
    assert.notEqual(wireId(clientWire), ownId, "The outstanding bridge ID cannot be reused");
    assert.deepEqual(clientWire.subarray(3), collision.subarray(3), "Only the correlation ID may change");
    current.channel.send(response(ownId));
    current.channel.send(response(wireId(clientWire)));
    current.channel.send(response(ownId)); // Duplicated or very late replies must remain private.
    await current.page.waitForFunction(() => window.__clientMessages.length >= 2);
    assert.deepEqual(await clientBytes(current.page), [[...response(7)], [...response(ownId)]]);
    assert.equal(await current.page.evaluate(() => window.__clientListenerMessages.length), 2);
    assert.deepEqual(await current.page.evaluate(() => window.__clientEventChecks), [true, true]);
    await sendClient(current, operation(ownId, "2s"));
    await eventually(() => current.channel.received.length === 4, "completed bridge ID collision");
    assert.notEqual(wireId(current.channel.received[3].data), ownId,
      "Completed bridge IDs remain reserved against delayed duplicate replies");
  });

  await test("Blob decoding cannot reorder a later ArrayBuffer and never changes binaryType", async () => {
    const current = await fixture({ binaryType: "blob" });
    await sendClient(current, auth(31));
    await sendClient(current, operation(32));
    await eventually(() => current.channel.received.length === 2, "requests preceding Blob replies");
    await current.page.evaluate(() => {
      const original = Blob.prototype.arrayBuffer;
      let delayed = false;
      Blob.prototype.arrayBuffer = function() {
        if (delayed) return original.call(this);
        delayed = true;
        const blob = this;
        return new Promise(resolve => { window.__releaseBlob = async () => resolve(await original.call(blob)); });
      };
    });
    current.channel.send(response(31));
    await current.page.waitForFunction(() => typeof window.__releaseBlob === "function");
    assert.equal(await current.page.evaluate(() => window.__socket.binaryType), "blob");
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), false, "Blob sockets cannot safely isolate private replies");
    await current.page.evaluate(() => { window.__socket.binaryType = "arraybuffer"; });
    current.channel.send(response(32));
    await current.page.waitForFunction(() => window.__clientMessages.length === 2);
    assert.equal(await current.page.evaluate(() => window.__frames.filter(frame => frame.kind === "response").length), 0,
      "A subsequent ArrayBuffer must wait behind the delayed Blob");
    await current.page.evaluate(() => window.__releaseBlob());
    await current.page.waitForFunction(() => window.__frames.filter(frame => frame.kind === "response").length === 2);
    assert.deepEqual(await current.page.evaluate(() => window.__frames.filter(frame => frame.kind === "response").map(frame => frame.id)), [31, 32]);
    assert.deepEqual(await current.page.evaluate(() => window.__clientMessages.map(data => data instanceof Blob ? "blob" : "arraybuffer")), ["blob", "arraybuffer"]);
    assert.deepEqual(await clientBytes(current.page), [[...response(31)], [...response(32)]]);
  });

  await test("incoming activity invalidates a decision before Unity's message handler runs", async () => {
    const current = await fixture();
    await authenticate(current);
    await sendClient(current, operation(41));
    await eventually(() => current.channel.received.length === 2, "manual operation");
    await current.page.evaluate(() => {
      window.__allowSend = true;
      window.__guardCurrent = true;
      window.__invalidateGuardOnActivity = true;
      window.__attemptSendOnMessage = true;
    });
    current.channel.send(response(wireId(current.channel.received[1].data)));
    await current.page.waitForFunction(() => window.__sendInMessageResult !== undefined);
    assert.equal(await current.page.evaluate(() => window.__sendInMessageResult), false);
    assert.equal(current.channel.received.length, 2, "A decision resolved by a later event cannot send");
  });

  await test("private replies remain hidden behind a slow Blob after binary mode changes", async () => {
    const current = await fixture();
    await authenticate(current);
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), true);
    await eventually(() => current.channel.received.length === 2, "bridge request before mode change");
    const ownId = wireId(current.channel.received[1].data);
    await sendClient(current, operation(49));
    await eventually(() => current.channel.received.length === 3, "client request before mode change");
    await current.page.evaluate(() => {
      const original = Blob.prototype.arrayBuffer;
      let delayed = false;
      Blob.prototype.arrayBuffer = function() {
        if (delayed) return original.call(this);
        delayed = true;
        const blob = this;
        return new Promise(resolve => { window.__releaseBlob = async () => resolve(await original.call(blob)); });
      };
      window.__socket.binaryType = "blob";
    });
    current.channel.send(response(49));
    await current.page.waitForFunction(() => typeof window.__releaseBlob === "function");
    await current.page.evaluate(() => { window.__socket.binaryType = "arraybuffer"; });
    current.channel.send(response(ownId));
    current.channel.send(Buffer.from("mode-change-barrier"), 1);
    await current.page.evaluate(() => window.__releaseBlob());
    await current.page.waitForFunction(() => window.__clientMessages.includes("mode-change-barrier"));
    assert.deepEqual(await clientBytes(current.page), [[...response(7)], [...response(49)], "mode-change-barrier"],
      "Response isolation is still required after automatic play has been paused");
  });

  await test("actual Blob replies isolate private IDs and restore colliding client IDs", async () => {
    const current = await fixture();
    await authenticate(current);
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), true);
    await eventually(() => current.channel.received.length === 2, "bridge operation before Blob reply");
    const ownId = wireId(current.channel.received[1].data);
    await sendClient(current, operation(ownId, "5s"));
    await eventually(() => current.channel.received.length === 3, "colliding request before Blob reply");
    const clientId = wireId(current.channel.received[2].data);
    assert.notEqual(clientId, ownId);
    await current.page.evaluate(() => { window.__socket.binaryType = "blob"; });
    current.channel.send(response(ownId));
    current.channel.send(response(clientId));
    current.channel.send(response(ownId));
    current.channel.send(Buffer.from("blob-replies-complete"), 1);
    await current.page.waitForFunction(() => window.__clientMessages.includes("blob-replies-complete"));
    assert.deepEqual(await clientBytes(current.page), [[...response(7)], [...response(ownId)], "blob-replies-complete"]);
    assert.deepEqual(await current.page.evaluate(() => window.__clientMessages.map(data =>
      typeof data === "string" ? "text" : data instanceof Blob ? "blob" : "arraybuffer")), ["arraybuffer", "blob", "text"]);
    assert.equal(await current.page.evaluate(() => window.__clientListenerMessages.length), 3);
    await current.page.evaluate(() => { window.__socket.binaryType = "arraybuffer"; });
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), false, "A changed binary mode requires a fresh connection");
  });

  await test("disconnect blocks actions and replacement sockets must identify themselves", async () => {
    const current = await fixture();
    await authenticate(current);
    await allowSend(current.page);
    current.channel.close(1001);
    await current.page.waitForFunction(() => window.__socket.readyState === WebSocket.CLOSED);
    assert.ok(await current.page.evaluate(() => window.__invalidations.length > 0));
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), false);
    const replacementKey = `${current.key}-replacement`;
    await current.page.evaluate(key => {
      window.__socket = new WebSocket(location.origin.replace('http:', 'ws:') + '/socket?key=' + key);
      window.__socket.binaryType = "arraybuffer";
    }, replacementKey);
    await current.page.waitForFunction(() => window.__socket.readyState === WebSocket.OPEN);
    await eventually(() => channels.has(replacementKey), "replacement socket");
    assert.equal(await attemptSend(current.page), false, "An unidentified socket cannot receive bot actions");
    const replacement = { ...current, channel: channels.get(replacementKey) };
    await authenticate(replacement, 53);
    await allowSend(current.page);
    assert.equal(await attemptSend(current.page), true);
    await eventually(() => replacement.channel.received.length === 2, "replacement bridge operation");
  });

  await test("queued Blob data from a closed socket cannot revive an obsolete game", async () => {
    const current = await fixture({ binaryType: "blob" });
    await sendClient(current, auth(61));
    await eventually(() => current.channel.received.length === 1, "old socket auth");
    await current.page.evaluate(() => {
      const original = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function() {
        const blob = this;
        return new Promise(resolve => { window.__releaseBlob = async () => resolve(await original.call(blob)); });
      };
    });
    current.channel.send(rpc(1, 0, ".lq.NotifyGamePause", uint(1, 1)));
    await current.page.waitForFunction(() => typeof window.__releaseBlob === "function");
    current.channel.close(1001);
    await current.page.waitForFunction(() => window.__socket.readyState === WebSocket.CLOSED);
    await current.page.evaluate(async () => { await window.__releaseBlob(); await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(await current.page.evaluate(() => window.__frames.filter(frame => frame.kind === "notification").length), 0);
  });

  await test("observer exceptions cannot interrupt Unity's native send or message delivery", async () => {
    const current = await fixture();
    await current.page.evaluate(() => { window.__throwFrameCallback = true; });
    await sendClient(current, auth(71));
    await eventually(() => current.channel.received.length === 1, "send with throwing observer");
    assert.deepEqual(current.channel.received[0].data, auth(71));
    current.channel.send(response(71));
    await current.page.waitForFunction(() => window.__clientMessages.length === 1);
    assert.deepEqual(await clientBytes(current.page), [[...response(71)]]);
  });

  await test("disposing the transport restores construction and stops observation", async () => {
    const current = await fixture();
    await authenticate(current);
    await current.page.evaluate(() => window.__transport.dispose());
    assert.equal(await current.page.evaluate(() => WebSocket === window.__nativeWebSocket), true);
    assert.equal(await attemptSend(current.page), false);
    const observed = await current.page.evaluate(() => window.__frames.length);
    await sendClient(current, operation(81));
    await eventually(() => current.channel.received.length === 2, "native send after dispose");
    current.channel.send(response(81));
    await current.page.waitForFunction(() => window.__clientMessages.length === 2);
    assert.equal(await current.page.evaluate(() => window.__frames.length), observed);
  });
} finally {
  if (browser) await browser.close();
  for (const socket of rawSockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
  await mkdir("test-results", { recursive: true });
  await writeFile(path.join("test-results", `unity-browser-${browserName}.json`), JSON.stringify(report, null, 2));
}

console.log(`Unity browser transport: ${report.passed}/${report.total} passed (${browserName}).`);
if (report.failed) process.exitCode = 1;
