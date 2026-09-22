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

	resetApiState();
	armApiDecision();
	globalThis.app = undefined;
	assertApiEqual(sendRiichiCall("1m", false), false, "Riichi reports a failed send so discard can continue");
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

async function runApiStartupTests() {
	var timeouts = new Map();
	var intervals = new Map();
	var timerId = 0;
	var matches = [];
	var reloaded = false;
	var unityFixture = document.createElement("div");
	var rooms = [{ id: 2, mode: 1, room: 100, room_name_en: "Casual" }];
	rooms.get = id => rooms.find(room => room.id == id);
	var overrides = {
		GameMgr: undefined, view: undefined, uiscript: undefined, cfg: undefined,
		game: undefined, app: undefined, createUnityInstance: undefined,
		startupStartedAt: Date.now(), startupFinished: false, startupError: "",
		lobbyLoadTimer: null, afkTimer: null, AUTORUN: false, run: false, errorCounter: 0,
		setTimeout: (callback, delay) => { timeouts.set(++timerId, { callback, delay }); return timerId; },
		clearTimeout: id => timeouts.delete(id),
		setInterval: (callback, delay) => { intervals.set(++timerId, { callback, delay }); return timerId; },
		clearInterval: id => intervals.delete(id),
		goToLobby: () => { reloaded = true; }, log: () => {}
	};
	function resetStartup() {
		globalThis.GameMgr = undefined;
		globalThis.view = undefined;
		globalThis.uiscript = undefined;
		globalThis.cfg = undefined;
		globalThis.game = undefined;
		globalThis.app = undefined;
		globalThis.createUnityInstance = undefined;
		startupStartedAt = Date.now();
		startupFinished = false;
		startupError = "";
		lobbyLoadTimer = null;
		afkTimer = null;
		AUTORUN = false;
		run = false;
		errorCounter = 0;
		timeouts.clear();
		intervals.clear();
		matches.length = 0;
		reloaded = false;
		unityFixture.replaceChildren();
		startButton.disabled = true;
		autorunCheckbox.disabled = false;
		currentActionOutput.value = "";
		showStartupNotice("");
	}
	function openLegacyLobby(loadingFlag = true) {
		globalThis.GameMgr = { Inst: { login_loading_end: loadingFlag }, client_language: "en" };
		globalThis.uiscript = {
			UI_Lobby: { Inst: { enabled: true } },
			UI_PiPeiYuYue: { Inst: { addMatch: room => matches.push(room) } }
		};
		globalThis.cfg = { desktop: { matchmode: rooms } };
		globalThis.game = { Tools: { room_mode_desc: () => "East" } };
	}
	function tickTimeout() {
		var [id, timer] = timeouts.entries().next().value;
		timeouts.delete(id);
		timer.callback();
	}

	try {
		await withApiOverrides(overrides, async () => {
			resetStartup();
			assertApiEqual(hasFinishedMainLobbyLoading(), false, "Missing client globals are not a ready lobby");
			for (let manager of [null, {}, { Inst: null }, { Inst: {} }, { Inst: { login_loading_end: false } }]) {
				globalThis.GameMgr = manager;
				assertApiEqual(hasFinishedMainLobbyLoading(), false, "Partially loaded game manager is safe to poll");
				preventAFK();
			}
			openLegacyLobby();
			globalThis.uiscript = undefined;
			assertApiEqual(hasFinishedMainLobbyLoading(), true, "Existing loading flag still recognizes the lobby");
			for (let flag of [false, undefined]) {
				openLegacyLobby(flag);
				if (flag === undefined) delete GameMgr.Inst.login_loading_end;
				assertApiEqual(hasFinishedMainLobbyLoading(), true, "An open lobby works without a current loading flag");
				uiscript.UI_Lobby.Inst.enabled = false;
				uiscript.UI_Lobby.Inst._me = { visible: true };
				assertApiEqual(hasFinishedMainLobbyLoading(), false, "A preloaded but disabled lobby is not ready");
				uiscript.UI_Lobby.Inst = null;
				assertApiEqual(hasFinishedMainLobbyLoading(), false, "A missing lobby instance is safe to poll");
			}

			resetStartup();
			initGui();
			assertApiEqual(guiDiv.isConnected, true, "Controls render even if the client API never appears");
			assertApiEqual(startButton.disabled, true, "Starting is unavailable before the client is ready");
			assertApiEqual(roomCombobox.disabled, true, "Absent room data leaves room selection disabled");
			var controlCount = guiSpan.childElementCount;
			initGui();
			assertApiEqual(guiSpan.childElementCount, controlCount, "GUI initialization cannot duplicate the controls");
			assertApiEqual(guiDiv.style.display, "block", "Repeated initialization does not hide the GUI");
			waitForMainLobbyLoad();
			assertApiEqual(timeouts.size, 1, "An ordinary loading page keeps one pending lobby check");
			assertApiEqual(startupNotice.hidden, true, "Ordinary loading does not report a compatibility problem");
			startupStartedAt -= 31000;
			tickTimeout();
			assertApiEqual(currentActionOutput.value, "Cannot access the game.", "Missing API gets an actionable status after the grace period");
			assertApiEqual(startupNotice.hidden, false, "The missing API explanation is visible");
			assertApiEqual(timeouts.size, 1, "A slow client can still recover after the diagnostic appears");
			openLegacyLobby(false);
			tickTimeout();
			assertApiEqual(startButton.disabled, false, "A late visible lobby enables Start Bot");
			assertApiEqual(startupNotice.hidden, true, "Successful loading clears the earlier diagnostic");
			assertApiEqual(currentActionOutput.value, "Bot is not running.", "A stopped bot no longer displays a loading message");
			assertApiEqual(roomCombobox.options.length, 1, "Late room configuration is populated");
			assertApiEqual(roomCombobox.options[0].value, "2", "Late room configuration replaces the placeholder");
			assertApiEqual(timeouts.size + intervals.size + matches.length, 0, "Loading alone never starts a stopped bot");

			resetStartup();
			globalThis.GameMgr = { Inst: null };
			startupStartedAt -= 31000;
			waitForMainLobbyLoad();
			assertApiEqual(currentActionOutput.value, "Waiting for login or lobby.", "A client still signing in gets a separate status");

			resetStartup();
			AUTORUN = true;
			run = true;
			openLegacyLobby(false);
			waitForMainLobbyLoad();
			waitForMainLobbyLoad();
			assertApiEqual(matches.length, 1, "Autorun searches once when an open lobby has a stale loading flag");
			assertApiEqual(intervals.size, 1, "Heartbeat starts once and only after the client is ready");
			assertApiEqual(timeouts.size, 1, "Repeated startup checks cannot create multiple game loops");
			assertApiEqual(roomCombobox.disabled, false, "Loaded rooms are selectable for Autorun");

			resetStartup();
			resetApiState();
			view.DesktopMgr.Inst.oplist = [];
			assertApiEqual(hasFinishedMainLobbyLoading(), true, "An ongoing game is ready even without GameMgr");
			waitForMainLobbyLoad();
			assertApiEqual(currentActionOutput.value, "Waiting for own turn.", "Reloading in a match enters the real game loop");
			assertApiEqual(timeouts.values().next().value.delay, 500, "An ongoing match uses the turn poll instead of the lobby poll");
			assertApiEqual(roomCombobox.disabled, true, "Absent room data cannot crash a mid-game reload");

			resetStartup();
			document.body.appendChild(unityFixture);
			unityFixture.innerHTML = '<canvas id="unity-canvas"></canvas>';
			assertApiEqual(isUnsupportedUnityClient(), false, "A canvas name alone does not declare a client incompatible");
			// Inert script matches the official Unity entry pages without fetching their assets.
			var loader = document.createElement("script");
			loader.type = "text/plain";
			loader.src = "Build/en-WebGL-release-4.0.10(11).loader.js";
			unityFixture.appendChild(loader);
			assertApiEqual(isUnsupportedUnityClient(), true, "The official Unity page structure is recognized before Unity finishes loading");
			loader.remove();
			globalThis.createUnityInstance = () => {};
			assertApiEqual(isUnsupportedUnityClient(), true, "An initialized Unity loader is also recognized");
			AUTORUN = true;
			run = true;
			var savedAutorun = localStorage.getItem("alphajongAutorun");
			waitForMainLobbyLoad();
			assertApiEqual(guiDiv.isConnected && !startupNotice.hidden, true, "Unity incompatibility is visible without any legacy API");
			assertApiEqual(startupNotice.textContent.includes("Unity WebGL"), true, "The notice explains the actual incompatible client");
			assertApiEqual(run, false, "Unsupported Unity stops a saved Autorun session");
			assertApiEqual(startButton.disabled && autorunCheckbox.disabled && roomCombobox.disabled, true, "Unsupported client controls cannot launch a game loop");
			assertApiEqual(localStorage.getItem("alphajongAutorun"), savedAutorun, "Client detection preserves the user's saved preferences");
			toggleRun();
			main();
			waitForMainLobbyLoad();
			assertApiEqual(currentActionOutput.value, "Unsupported game client.", "Stale callbacks cannot overwrite the compatibility error");
			assertApiEqual(timeouts.size + intervals.size + matches.length, 0, "Unity never starts polling, heartbeats, or matchmaking");
			assertApiEqual(reloaded, false, "Unsupported clients are not sent into a reload loop");
			openLegacyLobby();
			assertApiEqual(isUnsupportedUnityClient(), false, "An available legacy API takes precedence over leftover Unity elements");
		});
	} finally {
		unityFixture.remove();
	}
}

async function runApiContractTests() {
	DEBUG = false; // Keep startup disabled while exercising production action guards.
	try {
		runApiReadTests();
		runApiStateTests();
		runApiActionTests();
		await runApiDecisionLifecycleTests();
		await runApiDiscardObserverTests();
		await runApiStartupTests();
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
