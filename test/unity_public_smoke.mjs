// Public shell smoke only: no login, account cookies, gameplay connection, or WASM execution.
// Run explicitly with ALPHAJONG_PUBLIC_SMOKE=1 after Actions assembles AlphaJong.user.js.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright";

if (process.env.ALPHAJONG_PUBLIC_SMOKE !== "1") {
  console.log("Public Unity shell smoke skipped; set ALPHAJONG_PUBLIC_SMOKE=1 to run it explicitly.");
  process.exit(0);
}

const origin = "https://mahjongsoul.game.yo-star.com";
const url = `${origin}/`;
const bundlePath = process.env.ALPHAJONG_UNITY_BUNDLE || "AlphaJong.user.js";
const bundle = await readFile(bundlePath, "utf8");
const report = {
  kind: "public-unity-shell-only",
  site: url,
  verifiedAt: new Date().toISOString(),
  scope: "Public HTML, loader and framework only; no account, lobby, WASM, or gameplay validation.",
  bundleSha256: createHash("sha256").update(bundle).digest("hex"),
  blockedWebSockets: 0,
  blockedGameAssets: 0,
  passed: false
};
let browser;

function sameOriginAsset(value) {
  const asset = new URL(value, url);
  assert.equal(asset.origin, origin, "Public smoke only fetches same-origin client assets");
  return asset.href;
}

function decodeResponse(data) {
  // Some hosts label gzip in Content-Encoding; others serve it as a .gz file.
  return (data[0] === 31 && data[1] === 139 ? gunzipSync(data) : data).toString("utf8");
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const htmlResponse = await context.request.get(url, { timeout: 45000 });
  assert.ok(htmlResponse.ok(), `Public root returned HTTP ${htmlResponse.status()}`);
  const html = await htmlResponse.text();
  assert.match(html, /id=["']unity-canvas["']/i);
  assert.match(html, /createUnityInstance\s*\(/);
  const loaderMatch = html.match(/<script[^>]+src=["']([^"']+\.loader\.js(?:\?[^"']*)?)["']/i);
  assert.ok(loaderMatch, "The root exposes a Unity loader URL");
  const frameworkMatch = html.match(/frameworkUrl\s*:\s*(?:buildUrl\s*\+\s*)?["']([^"']+)["']/);
  assert.ok(frameworkMatch, "The root exposes a Unity framework URL");
  const buildUrl = html.match(/(?:var|let|const)\s+buildUrl\s*=\s*["']([^"']+)["']/)?.[1] || "Build";
  const loaderUrl = sameOriginAsset(loaderMatch[1]);
  const frameworkPath = /frameworkUrl\s*:\s*buildUrl\s*\+/.test(html)
    ? `${buildUrl.replace(/\/$/, "")}/${frameworkMatch[1].replace(/^\//, "")}` : frameworkMatch[1];
  const frameworkUrl = sameOriginAsset(frameworkPath);
  const fetched = await Promise.allSettled([
    context.request.get(loaderUrl, { timeout: 45000 }),
    context.request.get(frameworkUrl, { timeout: 45000 })
  ]);
  for (const result of fetched) {
    if (result.status === "rejected") throw result.reason;
    assert.ok(result.value.ok(), `Unity asset returned HTTP ${result.value.status()}`);
  }
  const loader = decodeResponse(await fetched[0].value.body());
  const framework = decodeResponse(await fetched[1].value.body());
  assert.match(loader, /createUnityInstance/);
  assert.match(framework, /function\s+_WS_Create\s*\(/,
    "The supported framework still exposes the inspected native WebSocket plugin");
  assert.match(framework, /new\s+WebSocket\s*\(/);
  assert.match(framework, /binaryType\s*=\s*["']arraybuffer["']/);
  assert.match(framework, /function\s+_WS_Send_Binary\s*\(/);
  assert.match(framework, /HEAPU8\.subarray\s*\(/);
  report.productVersion = html.match(/productVersion\s*:\s*["']([^"']+)["']/)?.[1] || null;
  report.loaderUrl = loaderUrl;
  report.frameworkUrl = frameworkUrl;
  report.frameworkSha256 = createHash("sha256").update(framework).digest("hex");

  await context.routeWebSocket("**/*", socket => {
    report.blockedWebSockets++;
    socket.close({ code: 1000, reason: "Public shell smoke has no gameplay connections" });
  });
  await context.route("**/*", async route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== origin) {
      await route.abort();
      return;
    }
    if (/\.(?:wasm|data)(?:\.gz)?$/i.test(requestUrl.pathname)) {
      report.blockedGameAssets++;
      await route.abort();
      return;
    }
    if (requestUrl.href === url) {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      return;
    }
    if (requestUrl.href === loaderUrl || requestUrl.href === frameworkUrl) {
      await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8",
        body: requestUrl.href === loaderUrl ? loader : framework });
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript({ content: `window.__smokeNativeWebSocket = window.WebSocket;\n${bundle}
    window.__smokeUnityBridgeInstalled = () => typeof AlphaJongUnityTransport === 'object' &&
      alphaJongUnityClient !== null && alphaJongUnityClient.transport.getStatus().installed;
  ` });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => window.__smokeUnityBridgeInstalled?.() &&
    window.WebSocket !== window.__smokeNativeWebSocket, undefined, { timeout: 10000 });
  await page.getByRole("button", { name: /Start Bot|Stop Bot/ }).waitFor({ state: "visible", timeout: 10000 });
  const pageState = await page.evaluate(() => ({
    unityCanvas: document.getElementById("unity-canvas") !== null,
    loaderReady: typeof createUnityInstance === "function",
    hookInstalled: window.WebSocket !== window.__smokeNativeWebSocket,
    hookPrototypePreserved: window.WebSocket.prototype === window.__smokeNativeWebSocket.prototype,
    obsoleteUnsupportedNotice: document.body.textContent.includes("only supports the older JavaScript client"),
    legacyApiAbsent: typeof GameMgr === "undefined"
  }));
  assert.deepEqual(pageState, { unityCanvas: true, loaderReady: true, hookInstalled: true,
    hookPrototypePreserved: true, obsoleteUnsupportedNotice: false, legacyApiAbsent: true });
  // Unity is expected to report failure because the heavy game build is blocked.
  const unexpectedErrors = errors.filter(message => !/Unity|WebAssembly|wasm|Failed to (?:fetch|download)|Unable to (?:load|parse)|abort\(|network|download|load.*data/i.test(message));
  assert.deepEqual(unexpectedErrors, [], "No userscript/startup page errors");
  report.page = pageState;
  report.expectedAssetErrors = errors;
  report.passed = true;
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: path.join("test-results", "unity-public-shell.png"), fullPage: true });
  console.log(`Public Unity shell smoke passed (${report.productVersion}); gameplay was not exercised.`);
} catch (error) {
  report.error = error.stack || String(error);
  throw error;
} finally {
  if (browser) await browser.close();
  await mkdir("test-results", { recursive: true });
  await writeFile(path.join("test-results", "unity-public-shell.json"), JSON.stringify(report, null, 2));
}
