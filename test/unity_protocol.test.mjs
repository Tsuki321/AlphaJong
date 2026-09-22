import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile(new URL('../src/unity_protocol.js', import.meta.url), 'utf8'));
const protocol = globalThis.AlphaJongUnityProtocol;
const binary = hex => Uint8Array.from(Buffer.from(hex.replaceAll(' ', ''), 'hex'));
const plain = object => JSON.parse(JSON.stringify(object));

test('independent protobuf bytes decode zero defaults, red fives and negative scores', () => {
  // seat=2, tile=0p, moqie=true, scores packed [-1000, 35000].
  const message = protocol.decodeMessage('ActionDiscardTile', binary('08 02 12 02 30 70 28 01 6a 0d 98 f8 ff ff ff ff ff ff ff 01 b8 91 02'));
  assert.equal(message.seat, 2);
  assert.equal(message.tile, '0p');
  assert.equal(message.moqie, true);
  assert.deepEqual(message.scores, [-1000, 35000]);
  assert.equal(message.is_liqi, false);
  assert.equal(message.operation, null);
  assert.deepEqual(message.doras, []);
});

test('requests match independently specified envelope bytes', () => {
  const actual = protocol.encodeRequest(513, '.lq.FastTest.inputOperation', { type: 1, tile: '1m', moqie: true, timeuse: 2 });
  const name = Buffer.from('.lq.FastTest.inputOperation');
  const expected = Buffer.concat([binary('02 01 02 0a'), Buffer.from([name.length]), name,
    binary('12 0a 08 01 1a 02 31 6d 28 01 30 02')]);
  assert.deepEqual(Buffer.from(actual), expected);
  assert.equal(protocol.decodeFrame(actual).message.tile, '1m');
});

test('request and response ids are little endian and responses need their request method', () => {
  const reply = binary('03 34 12 0a 00 12 04 0a 02 08 07');
  const frame = protocol.decodeFrame(reply, '.lq.FastTest.inputOperation');
  assert.equal(frame.id, 0x1234);
  assert.equal(frame.kind, 'response');
  assert.equal(frame.message.error.code, 7);
  assert.equal(protocol.decodeFrame(reply).message, null);
});

test('legacy-compatible packed and unpacked scores decode identically', () => {
  const packed = protocol.decodeMessage('GameEnd', binary('0a 06 a8 c3 01 b0 ea 01'));
  const unpacked = protocol.decodeMessage('GameEnd', binary('08 a8 c3 01 08 b0 ea 01'));
  assert.deepEqual(packed.scores, [25000, 30000]);
  assert.deepEqual(packed, unpacked);
});

test('public captured restore round uses plain protobuf; live notifications use XOR', () => {
  // Public wire fixture from Akagi parser.rs (MIT), no account or connection data.
  // https://github.com/shinkuan/Akagi/blob/v3/src/bridge/majsoul/parser.rs
  const capture = Buffer.from('CAAQABgAIgI0cCICMW0iAjNwIgI0eiICN3oiAjZ6IgIwcCICM3MiAjBtIgI0cyICMXMiAjlzIgIyejIMqMMBqMMBqMMBqMMBQABYAGhFcgIxenoCCAB6AggBegIIAnoCCAOaAUA1NWQ2NzQ3MTRjNjAzODFhNGJjOTJmYzBmOWIwNWVjNDU4OWZlMzI0NTQ4OWVmOGY3NTc5NTVmMzIzZWIzZTE1qgFAYzFmNmY1YTQwOGFjMzgyZGEyZGE1MTA3OTUzYmUzYTg1N2M5OTdmNGNkMjg2M2JlZjczY2M3ZjE3MDllMDA4Mw==', 'base64');
  const expected = ['4p', '1m', '3p', '4z', '7z', '6z', '0p', '3s', '0m', '4s', '1s', '9s', '2z'];
  const restore = protocol.encodeMessage('ResSyncGame', { game_restore: { actions: [
    { step: 0, name: 'ActionNewRound', data: capture }
  ] } });
  const restored = protocol.decodeFrame(protocol.encodeEnvelope('response', 10, '', restore), '.lq.FastTest.syncGame');
  assert.deepEqual(restored.message.game_restore.actions[0].data.tiles, expected);
  const encrypted = protocol.xorAction(capture);
  assert.notDeepEqual(encrypted, capture);
  const action = protocol.encodeMessage('ActionPrototype', { name: 'ActionNewRound', step: 0, data: encrypted });
  const live = protocol.decodeFrame(protocol.encodeEnvelope('notification', null, '.lq.ActionPrototype', action));
  assert.deepEqual(live.message.data.tiles, expected);
  assert.equal(live.message.data.left_tile_count, 69);
});

test('decoder never retains auth tokens, passwords or opponent private profiles', () => {
  const auth = binary('08 7b 12 06 73 65 63 72 65 74 1a 04 75 75 69 64');
  assert.deepEqual(plain(protocol.decodeMessage('ReqAuthGame', auth)), { account_id: 123 });
  const login = binary('12 06 73 65 63 72 65 74');
  assert.deepEqual(plain(protocol.decodeMessage('Empty', login)), {});
});

test('malformed fields, overflow, wrong wire types and unsupported actions fail explicitly', () => {
  for (const input of ['00', '80', '0a ff ff ff ff 0f', '08 ff ff ff ff ff ff ff ff ff 02', '0d 00 00 00 00']) {
    assert.throws(() => protocol.decodeMessage('GameEnd', binary(input)));
  }
  assert.throws(() => protocol.decodeFrame(binary('03 00')));
  assert.throws(() => protocol.decodeMessage('ActionUnknown', binary('')));
  assert.throws(() => protocol.encodeRequest(-1, '.lq.FastTest.inputOperation', {}));
  assert.throws(() => protocol.encodeRequest(1, '.lq.FastTest.inputOperation', { timeuse: 1.5 }));
});

test('unknown valid game methods and unrelated fields can be observed without fake state', () => {
  const frame = protocol.decodeFrame(protocol.encodeEnvelope('notification', null, '.lq.FutureFeature', binary('08 01')));
  assert.equal(frame.method, '.lq.FutureFeature');
  assert.equal(frame.message, null);
  const withUnknown = binary('0a 03 a8 c3 01 98 06 01');
  assert.deepEqual(protocol.decodeMessage('GameEnd', withUnknown).scores, [25000]);
  const sliced = new Uint8Array([99, 0x08, 0x01, 99]).subarray(1, 3);
  assert.equal(protocol.decodeMessage('ReqSelfOperation', sliced).type, 1);
});
