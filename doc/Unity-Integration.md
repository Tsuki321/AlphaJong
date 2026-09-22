# Unity integration

The Unity adapter observes the existing page WebSocket at `document-start`,
decodes the local player's game messages, and reconstructs the board consumed by
the original AlphaJong AI. It never reads WebAssembly memory or creates another
game login. Login tokens, passwords, and other players' private hand identities
are not retained in the reconstructed state.

## Client evidence

The [official English entry page](https://mahjongsoul.game.yo-star.com/) inspected
on September 18, 2026 loaded `en-WebGL-release-4.0.10(11)`. Its
[framework](https://mahjongsoul.game.yo-star.com/Build/en-WebGL-release-4.0.10(11).framework.js.gz)
uses `new WebSocket` in `_WS_Create`, sets `binaryType` to `arraybuffer`, copies
received bytes into the runtime, and sends `HEAPU8.subarray(...)` in
`_WS_Send_Binary`. The adapter copies outgoing slices synchronously so reused
runtime buffers do not corrupt observed messages.

The field subset in `src/unity_protocol.js` was checked against the
[Unity-extracted protocol descriptors](https://github.com/shinkuan/Akagi/blob/v3/src/bridge/majsoul/proto/liqi.proto).
Their [extractor](https://github.com/shinkuan/Akagi/blob/v3/scripts/extract_liqi.py)
reads the game's public Unity TextAssets. The
[protocol implementation](https://github.com/shinkuan/Akagi/blob/v3/src/bridge/majsoul/parser.rs)
also documents little-endian request IDs, protobuf envelopes, the live action XOR
transform, and the different untransformed action replay encoding. A public
round fixture from that implementation is used to test the decoder independently.

No third-party executable library is downloaded at runtime. The small codec and
state reducer are included in the userscript. Unknown messages unrelated to the
board pass through; unknown game actions invalidate the reconstructed state.

## Implemented behavior

- Login and game authentication establish the local seat.
- Standard 3P/4P draws, discards, chi/pon/kan, North extraction, riichi, win/draw
  results, dora, scores, and operation timers update the existing AI API.
- Help mode computes suggestions without sending game actions. Auto checks the
  current decision, legal operations, mode, and connection immediately before
  sending one action.
- Independent request IDs are reserved per connection. Client collisions are
  remapped and restored before responses reach Unity; AlphaJong replies are
  consumed by the bridge. Response tombstones prevent duplicate delivery.
- Missing sequence steps, malformed data, disconnection, and unsupported game
  modes pause decisions. Complete action replays can restore state.
- The legacy JavaScript client takes precedence when its objects are available.

## Limits and validation

Matchmaking, next-round confirmation buttons, and tile coloring remain under the
Unity game's UI. The user chooses a match and starts the bot. Raw snapshots that
cannot establish the full public discard history are not used to invent state.
Event modes and observer/replay seats are unsupported. The public account-free
smoke test does not test a signed-in lobby or live turns.

Operation countdowns use milliseconds. Outgoing `timeuse` retains the existing
AlphaJong seconds convention; manual Unity input timing needs further live
verification. Restored elapsed time is handled conservatively so an expired
operation is never resurrected.

GitHub Actions builds the userscript and runs the existing AI regression and API
checks, protocol/state tests, native WebSocket tests on Chromium/Firefox/WebKit,
and the assembled 3P/4P integration test. A manual workflow run additionally
checks the current public page, loader, and native WebSocket plugin without
loading WASM or making gameplay connections.
