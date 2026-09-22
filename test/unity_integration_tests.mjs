// Exercises the Actions-built userscript with its real protocol/state/API/decision code.
// No account or external game endpoint is used.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const bundle = await readFile(process.env.ALPHAJONG_UNITY_BUNDLE || 'AlphaJong.user.js', 'utf8');
assert.match(bundle, /@run-at\s+document-start/);
assert.match(bundle, /AlphaJongUnityProtocol/);
// Playwright scopes each init script inside a function. Inject this test function
// in that same scope so it can exercise the userscript without exporting its
// production internals onto the game page.
const runScenario = async players => {
      var checks = 0;
      function check(value, message) { checks++; if (!value) throw new Error(message); }
      var codec = AlphaJongUnityProtocol, socket = fixtureSocket;
      var deliveries = [];
      socket.addEventListener('message', event => deliveries.push(codec.decodeEnvelope(event.data).id));
      function incoming(kind, id, method, type, message) {
        var body = codec.encodeMessage(type, message);
        socket.dispatchEvent(new MessageEvent('message', { data: codec.encodeEnvelope(kind, id, method, body).buffer }));
      }
      function action(step, name, data) {
        incoming('notification', null, '.lq.ActionPrototype', 'ActionPrototype', {
          step, name, data: codec.xorAction(codec.encodeMessage(name, data))
        });
      }
      function hand(value) {
        return Array.from(value.matchAll(/([0-9]+)([mpsz])/g)).flatMap(match => [...match[1]].map(number => number + match[2]));
      }
      // Account login observed from the existing connection, with no credentials retained.
      socket.send(codec.encodeRequest(1, '.lq.Lobby.login', {}));
      incoming('response', 1, '', 'ResLogin', { account_id: 101 });
      waitForMainLobbyLoad();
      check(guiDiv.isConnected && !startButton.disabled, 'Unity login completes the visible startup');
      check(!startupError, 'Unity is no longer reported unsupported');
      check(autorunCheckbox.disabled && roomCombobox.disabled, 'Unity matchmaking is left to the game UI');
      socket.send(codec.encodeRequest(2, '.lq.FastTest.authGame', { account_id: 101 }));
      var seats = players === 4 ? [101, 202, 303, 404] : [101, 202, 303];
      incoming('response', 2, '', 'ResAuthGame', { seat_list: seats, game_config: {
        mode: { mode: players === 4 ? 1 : 11, detail_rule: { dora_count: 3, time_fixed: 5, time_add: 20 } }, meta: { mode_id: 2 }
      } });
      action(0, 'ActionMJStart', {});
      var initial = players === 4 ? hand('123m456p789s11223z') : hand('19m123p789s112233z');
      action(1, 'ActionNewRound', { ju: 0, chang: 0, ben: 0, tiles: initial,
        scores: seats.map(() => players === 4 ? 25000 : 35000), left_tile_count: players === 4 ? 69 : 54,
        doras: ['7z'], operation: { seat: 0, time_add: 20000, time_fixed: 5000, operation_list: [{ type: 1 }] } });
      check(isInGame(), 'A complete authenticated Unity round becomes playable: ' + JSON.stringify(alphaJongUnityClient.state.getStatus()));
      check(getNumberOfPlayers() === players, 'Unity player count matches the AI adapter');
      check(getPlayerHand().length === 14, 'The local hand is available to the existing AI');
      check(getCallsOfPlayer(0).length === 0, 'Initial melds are empty');
      check(getPlayerHand()[0].val.toString() === initial[0], 'Tile identity is preserved');
      check(getDora()[0].toString() === '7z', 'Dora reaches the decision engine');
      setData();
      check(ownHand.every(tile => Number.isFinite(tile.doraValue)), 'Tile values are initialized by the real AI utilities');
      run = true;
      MODE = AIMODE.HELP;
      PERFORMANCE_MODE = 0;
      var activityBefore = alphaJongUnityClient.transport.getStatus().pending;
      await mainOwnTurn();
      check(hintPanelContent.textContent.includes('Discard:'), 'The real AI calculates a Unity discard hint');
      check(alphaJongUnityClient.transport.getStatus().pending === activityBefore, 'HELP sends no game action');
      check(threadIsRunning === false, 'The decision finishes without leaving its lock set');
      // Arm a current AUTO decision using the real guards and send one legal discard.
      MODE = AIMODE.AUTO;
      activeDecisionState = { epoch: decisionEpoch, mode: MODE, key: getDecisionStateKey() };
      var tileName = getPlayerHand()[0].val.toString();
      check(callDiscard(0) === true, 'A current AUTO decision sends a Unity discard');
      check(activeDecisionState.actionSent === true, 'Sending consumes the decision exactly once');
      var sent = alphaJongUnityClient.transport.getStatus().pending;
      callDiscard(1);
      check(alphaJongUnityClient.transport.getStatus().pending === sent, 'The consumed decision cannot send again');
      action(2, 'ActionDiscardTile', { seat: 0, tile: tileName, moqie: false });
      check(getPlayerHand().length === 13, 'The server-confirmed discard updates the hand');
      check(getDiscardsOfPlayer(0).last_pai.val.toString() === tileName, 'The discard reaches public board data');
      action(3, 'ActionDealTile', { seat: 1, left_tile_count: players === 4 ? 68 : 53 });
      action(4, 'ActionDiscardTile', { seat: 1, tile: '5s', moqie: true });
      check(getDiscardsOfPlayer(1).last_pai.val.toString() === '5s', 'Opponent discards reach the existing defense model');
      check(playerDiscardSafetyList[1].length >= 1, 'Unity discard observation updates defense history');
      // Sequence gap invalidates the board rather than allowing plausible stale advice.
      action(6, 'ActionDealTile', { seat: 2, left_tile_count: players === 4 ? 67 : 52 });
      check(!isInGame() && getOperationList().length === 0, 'Missing game action pauses stale decisions');
      check(alphaJongUnityClient.send('inputOperation', { type: 1, tile: '1m' }) === false, 'Paused game state cannot act');
      run = false;
      clearTimeout(lobbyLoadTimer);
      return { players, checks, hint: hintPanelContent.textContent, phase: alphaJongUnityClient.state.getStatus().phase };
};

const browser = await chromium.launch({ headless: true });
const report = { passed: false, results: [] };
try {
  for (const players of [4, 3]) {
    const context = await browser.newContext();
    const errors = [];
    try {
      await context.route('https://unity.test/**', route => route.fulfill({ contentType: 'text/html',
        body: '<!doctype html><html><head></head><body><canvas id="unity-canvas"></canvas><script>function createUnityInstance(){}</script></body></html>' }));
      let received = 0;
      await context.routeWebSocket('wss://unity.test/game', socket => socket.onMessage(() => { received++; }));
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript({ content: `${bundle}\nwindow.__runUnityScenario = ${runScenario.toString()};` });
      await page.goto('https://unity.test/');
      assert.deepEqual(errors, [], 'The userscript starts without page errors');
      await page.evaluate(async () => {
        window.fixtureSocket = new WebSocket('wss://unity.test/game');
        fixtureSocket.binaryType = 'arraybuffer';
        await new Promise(resolve => fixtureSocket.addEventListener('open', resolve, { once: true }));
      });
      const result = await page.evaluate(players => window.__runUnityScenario(players), players);
      assert.deepEqual(errors, []);
      assert.ok(received >= 3, 'Native connection received login/auth/action packets');
      report.results.push(result);
    } catch (error) {
      report.failure = { players, error: error.stack || String(error), pageErrors: errors };
      throw error;
    } finally {
      await context.close();
    }
  }
  report.passed = true;
} finally {
  await browser.close();
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/unity-integration.json', JSON.stringify(report, null, 2));
}
console.log(`Unity assembled integration passed: ${report.results.reduce((sum, result) => sum + result.checks, 0)} checks across 3P and 4P.`);
