// Exercise the real API, decision loop, and seat mapping against a fake client.
var testFailures = [];
var apiAssertions = 0;

function assertApiEqual(actual, expected, message) {
	apiAssertions++;
	if (actual !== expected) {
		testFailures.push(message + ": expected " + expected + ", got " + actual);
	}
}

function resetApiState(missingPosition = null) {
	var fixture = { requests: [], discarded: [], animations: 0, autoWins: [] };
	var positions = [0, 1, 2, 3].filter(position => position !== missingPosition);
	var seats = positions.map((_, index) => (index + 2) % positions.length);
	var players = [0, 1, 2, 3].map(position => {
		if (position === missingPosition) return null;
		var player = {
			seat: seats[positions.indexOf(position)], score: 25000,
			hand: Array.from({ length: 13 }, () => ({ old: true })),
			container_ming: { mings: [] }, container_babei: { pais: [] },
			liqibang: { _activeInHierarchy: false },
			DoDiscardTile() { fixture.discarded.push(this._choose_pai); }
		};
		player.container_qipai = {
			player: player, pais: [], last_pai: null, last_is_liqi: false,
			AddQiPai(tile, riichi) {
				if (this.last_pai) this.pais.push(this.last_pai);
				this.last_pai = { val: tile };
				this.last_is_liqi = riichi;
				return "client discard recorded";
			}
		};
		return player;
	});
	players[0].hand = getTilesFromString("123m456p789s11122z").map(tile => ({ val: tile, valid: true, old: true }));
	players[0].last_tile = players[0].hand[players[0].hand.length - 1];
	fixture.manager = {
		players: players, mainrole: players[0], active: true, gameEndResult: null,
		oplist: [{ type: 1 }], dora: getTilesFromString("6z"),
		lastqipai: { val: getTileFromString("3m") }, left_tile_count: 60,
		index_ju: 0, index_change: 0, index_player: seats[0],
		localPosition2Seat(position) { return seats[positions.indexOf(position)]; },
		seat2LocalPosition(seat) { return positions[seats.indexOf(seat)]; },
		WhenDoOperation() { fixture.animations++; },
		setAutoHule(value) { this.auto_hule = value; fixture.autoWins.push(value); }
	};
	globalThis.view = { DesktopMgr: { Inst: fixture.manager, player_link_state: seats.map(() => 1) } };
	globalThis.app = { NetAgent: { sendReq2MJ(service, method, payload) { fixture.requests.push({ service, method, payload }); } } };
	globalThis.mjcore = { E_PlayOperation: {
		dapai: 1, eat: 2, peng: 3, an_gang: 4, ming_gang: 5, add_gang: 6,
		liqi: 7, zimo: 8, rong: 9, jiuzhongjiupai: 10, babei: 11
	} };
	globalThis.uiscript = undefined;
	run = true;
	MODE = AIMODE.AUTO;
	decisionEpoch++;
	activeDecisionState = null;
	threadIsRunning = false;
	oldOps = "";
	calls = [[], [], [], []];
	discards = [[], [], [], []];
	riichiTiles = [null, null, null, null];
	playerDiscardSafetyList = [[], [], [], []];
	tilesLeft = 60;
	strategy = STRATEGIES.GENERAL;
	strategyAllowsCalls = true;
	isConsideringCall = false;
	functionsExtended = false;
	CHANGE_RECOMMEND_TILE_COLOR = false;
	clearCrtStrategyMsg();
	aimodeCombobox.replaceChildren(new Option("Auto", "0"), new Option("Help", "1"));
	setData();
	clearHandAnalysisCache();
	return fixture;
}

function armApiDecision() {
	activeDecisionState = { epoch: decisionEpoch, mode: MODE, key: getDecisionStateKey() };
}

async function withApiOverrides(overrides, callback) {
	var originals = {};
	for (let name of Object.keys(overrides)) {
		originals[name] = globalThis[name];
		globalThis[name] = overrides[name];
	}
	try { return await callback(); }
	finally {
		for (let name of Object.keys(originals)) globalThis[name] = originals[name];
	}
}

function runApiReadTests() {
	var fixture = resetApiState();
	view.DesktopMgr.player_link_state[localPosition2Seat(1)] = 0;
	assertApiEqual(getPlayerLinkState(1), 0, "Disconnected link state is preserved");
	assertApiEqual(getPlayerLinkState(2), 1, "Connected link state is preserved");
	view.DesktopMgr.player_link_state[localPosition2Seat(2)] = undefined;
	assertApiEqual(getPlayerLinkState(2), 1, "Missing link state uses the connected fallback");
	assertApiEqual(doesPlayerExist(3), true, "Existing desktop player is detected");
	assertApiEqual(doesPlayerExist(4), false, "Missing desktop player is rejected");

	for (let missing of [1, 2, 3]) {
		fixture = resetApiState(missing);
		assertApiEqual(getNumberOfPlayers(), 3, "Missing display position " + missing + " gives three players");
		for (var player = 0; player < 3; player++) {
			var expectedSeat = fixture.manager.players[getCorrectPlayerNumber(player)].seat;
			assertApiEqual(localPosition2Seat(player), expectedSeat, "Compact player maps to the client seat");
			assertApiEqual(seat2LocalPosition(expectedSeat), player, "Client seat maps back to the compact player");
			view.DesktopMgr.player_link_state[expectedSeat] = 0;
			assertApiEqual(getPlayerLinkState(player), 0, "Sanma link lookup maps the display position only once");
			view.DesktopMgr.player_link_state[expectedSeat] = 1;
		}
	}

	fixture = resetApiState();
	assertApiEqual(isDisconnect(), false, "Missing disconnect UI is harmless");
	globalThis.uiscript = { UI_Hanguplogout: { Inst: { _me: { visible: true } } } };
	assertApiEqual(isDisconnect(), true, "Visible disconnect UI is detected");
	armApiDecision();
	globalThis.view = undefined;
	assertApiEqual(isInGame(), false, "Absent desktop is not an active game");
	assertApiEqual(isEndscreenShown(), false, "Absent desktop has no end screen");
	assertApiEqual(getOperationList().length, 0, "Absent desktop exposes no operations");
	assertApiEqual(isActionCurrent(), false, "Absent desktop invalidates actions");
}

function runApiStateTests() {
	var mutations = [
		["stop", () => { run = false; }],
		["decision epoch", () => { decisionEpoch++; }],
		["mode", () => { MODE = AIMODE.HELP; }],
		["end of game", m => { m.gameEndResult = {}; }],
		["remaining tiles", m => { m.left_tile_count--; }],
		["round", m => { m.index_ju++; }],
		["turn", m => { m.index_player++; }],
		["dora identity", m => { m.dora[0] = getTileFromString("5z"); }],
		["hand identity", m => { m.players[0].hand[0].val = getTileFromString("9m"); }],
		["red five", m => { m.players[0].hand[4].val.dora = true; }],
		["discard eligibility", m => { m.players[0].hand[0].valid = false; }],
		["call combination", m => { m.oplist[0].combination[0] = "2m|3m"; }],
		["called tile", m => { m.lastqipai.val = getTileFromString("4m"); }],
		["opponent score", m => { m.players[1].score += 1000; }],
		["opponent hand length", m => { m.players[1].hand.pop(); }],
		["opponent riichi", m => { m.players[1].liqibang._activeInHierarchy = true; }],
		["opponent discard", m => { m.players[1].container_qipai.last_pai = { val: getTileFromString("5p") }; }],
		["opponent kita", m => { m.players[1].container_babei.pais.push({}); }],
		["opponent meld", m => { m.players[1].container_ming.mings.push({ pais: getTilesFromString("111p"), from: [2, 3, 3] }); }],
		["operations removed", m => { m.oplist = []; }]
	];
	for (let [name, mutate] of mutations) {
		var fixture = resetApiState();
		fixture.manager.oplist = [{ type: getOperations().eat, combination: ["1m|2m"] }];
		armApiDecision();
		assertApiEqual(isDecisionCurrent(), true, "Decision starts current before " + name);
		mutate(fixture.manager);
		assertApiEqual(isDecisionCurrent(), false, name + " invalidates the decision");
		makeCall(getOperations().eat);
		makeCallWithOption(getOperations().eat, 0);
		declineCall(getOperations().eat);
		sendRiichiCall("1m", false);
		sendKitaCall();
		sendAbortiveDrawCall();
		callDiscard(0);
		sendReq2MJ("inputOperation", {});
		assertApiEqual(fixture.requests.length + fixture.discarded.length, 0, name + " blocks every action path");
		assertApiEqual(hintPanelContent.textContent, "", name + " cannot display a stale hint");
	}

	var fixture = resetApiState();
	MODE = AIMODE.HELP;
	recordPlayerOps();
	assertApiEqual(checkPlayerOpChanged(), false, "Unchanged HELP board is remembered");
	fixture.manager.players[0].hand[0].val = getTileFromString("9m");
	assertApiEqual(checkPlayerOpChanged(), true, "HELP notices a new hand with identical operation types");
	armApiDecision();
	fixture.manager.oplist = [null];
	assertApiEqual(isActionCurrent(), false, "Partially replaced client data cannot send an action");
}

function runApiActionTests() {
	var actions = [
		["call", 3, () => makeCall(3)],
		["call option", 2, () => makeCallWithOption(2, 1)],
		["decline", 3, () => declineCall(3)],
		["riichi", 7, () => sendRiichiCall("1m", false)],
		["kita", 11, () => sendKitaCall()],
		["abortive draw", 10, () => sendAbortiveDrawCall()],
		["discard", 1, () => callDiscard(0)]
	];
	for (let [name, type, act] of actions) {
		var fixture = resetApiState();
		fixture.manager.oplist = [{ type: type }];
		armApiDecision();
		act();
		assertApiEqual(fixture.requests.length + fixture.discarded.length, 1, name + " acts on a current AUTO decision");
		act();
		callDiscard(1);
		assertApiEqual(fixture.requests.length + fixture.discarded.length, 1, name + " consumes the decision only once");

		fixture = resetApiState();
		MODE = AIMODE.HELP;
		fixture.manager.oplist = [{ type: type }];
		armApiDecision();
		act();
		assertApiEqual(hintPanelContent.textContent.length > 0, true, name + " produces a current HELP hint");
		assertApiEqual(sendReq2MJ("inputOperation", {}), false, "Low-level send also respects HELP mode");
		assertApiEqual(fixture.requests.length + fixture.discarded.length, 0, name + " never acts in HELP mode");
	}

	var fixture = resetApiState();
	armApiDecision();
	var client = app;
	globalThis.app = undefined;
	assertApiEqual(sendReq2MJ("inputOperation", {}), false, "Unavailable network reports failure");
	assertApiEqual(isDecisionCurrent(), true, "An unsent request does not consume the decision");
	globalThis.app = client;
	assertApiEqual(sendReq2MJ("inputOperation", { type: 7, tile: "1m" }), true, "Restored network can send a current decision");
	assertApiEqual(fixture.requests[0].service, "FastTest", "Actions use the game service");
	assertApiEqual(fixture.requests[0].payload.tile, "1m", "Action payload is preserved");
}

async function runApiDecisionLifecycleTests() {
	for (let change of ["stop", "mode"]) {
		var fixture = resetApiState();
		var finish;
		await withApiOverrides({
			setTimeout: () => 0, log: () => {}, determineStrategy: () => {},
			getTilePriorities: () => new Promise(resolve => { finish = resolve; })
		}, async () => {
			var pending = mainOwnTurn();
			assertApiEqual(threadIsRunning, true, "An awaited decision owns the simulation state");
			if (change == "stop") toggleRun();
			else {
				aimodeCombobox.value = String(AIMODE.HELP);
				aiModeChange();
			}
			finish([{ tile: ownHand[0] }]);
			await pending;
			assertApiEqual(fixture.requests.length + fixture.discarded.length, 0, change + " cancels an awaited discard");
			assertApiEqual(hintPanelContent.textContent, "", change + " cannot show the interrupted discard");
			assertApiEqual(fixture.manager.auto_hule, false, change + " disables automatic win calls");
			assertApiEqual(threadIsRunning, false, "Cancelled decision releases the lock");
			assertApiEqual(activeDecisionState, null, "Cancelled decision clears its snapshot");
			assertApiEqual(isConsideringCall, false, "Cancelled decision restores call mode");
		});
	}

	resetApiState();
	MODE = AIMODE.HELP;
	var attempts = 0;
	await withApiOverrides({
		setTimeout: () => 0, log: () => {}, determineStrategy: () => {},
		discard: async () => {
			if (++attempts == 1) throw new Error("Interrupted evaluation");
			callDiscard(0);
		}
	}, async () => {
		await mainOwnTurn();
		assertApiEqual(oldOps, "", "Failed HELP evaluation does not cache an unfinished result");
		await mainOwnTurn();
		assertApiEqual(hintPanelContent.textContent.includes("Discard:"), true, "HELP retries and displays the recovered decision");
		await mainOwnTurn();
		assertApiEqual(attempts, 2, "Successful HELP evaluation is reused until the board changes");
	});
}

async function runApiDiscardObserverTests() {
	var fixture = resetApiState(1);
	trackDiscardTiles();
	var pond = fixture.manager.players[getCorrectPlayerNumber(1)].container_qipai;
	var wrapped = pond.AddQiPai;
	trackDiscardTiles();
	assertApiEqual(pond.AddQiPai, wrapped, "Discard tracking is wrapped only once");
	var simulatedMelds = calls[0];
	var unseen = availableTiles;
	var visible = visibleTiles;
	armApiDecision();
	threadIsRunning = true;
	try {
		await withSimulatedCallState(getTilesFromString("12m"), async () => {
			await Promise.resolve();
			var tile = getTileFromString("5p");
			assertApiEqual(pond.AddQiPai(tile, true, true), "client discard recorded", "Observation always forwards to the client");
			assertApiEqual(calls[0], simulatedMelds, "Observation cannot replace a simulated meld array");
			assertApiEqual(calls[0].length, 3, "Observation preserves the in-flight simulated meld");
			assertApiEqual(availableTiles, unseen, "Observation cannot replace simulated unseen tiles");
			assertApiEqual(visibleTiles, visible, "Observation cannot replace simulated visible tiles");
			assertApiEqual(playerDiscardSafetyList[1][0], -1, "Busy observation remains unknown");
			assertApiEqual(riichiTiles[1], tile, "Sanma riichi discard uses the compact player index");
			assertApiEqual(isDecisionCurrent(), false, "Observed discard invalidates the in-flight decision");
		});
	}
	finally { threadIsRunning = false; }
	assertApiEqual(calls[0].length, 0, "Cancelled call simulation restores original melds");
	assertApiEqual(isClosed, true, "Cancelled call simulation restores a closed hand");
	await withApiOverrides({ getTileDanger: () => { throw new Error("Observation failed"); }, log: () => {} }, async () => {
		assertApiEqual(pond.AddQiPai(getTileFromString("6p"), false, false), "client discard recorded", "Observation errors cannot suppress the client's discard");
		assertApiEqual(playerDiscardSafetyList[1].at(-1), -1, "Failed observation does not manufacture a safe discard");
	});
}

async function runApiContractTests() {
	DEBUG = false; // Keep startup disabled while exercising production action guards.
	try {
		runApiReadTests();
		runApiStateTests();
		runApiActionTests();
		await runApiDecisionLifecycleTests();
		await runApiDiscardObserverTests();
	}
	catch (error) { testFailures.push(error.stack || String(error)); }
	finally {
		run = false;
		activeDecisionState = null;
		threadIsRunning = false;
		globalThis.__ALPHAJONG_TEST_RESULT = {
			done: true, failed: testFailures.length, total: apiAssertions,
			avgMsPerTest: 0, errors: testFailures
		};
		globalThis.__ALPHAJONG_TEST_DONE = true;
	}
}
