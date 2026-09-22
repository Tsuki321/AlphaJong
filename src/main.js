//################################
// MAIN
// Main Class, starts the bot and sets up all necessary variables.
//################################

var startupStartedAt = Date.now();
var startupFinished = false;
var startupError = "";
var lobbyLoadTimer = null;
var afkTimer = null;

//GUI can be re-opened by pressing + on the Numpad
if (!isDebug()) {
	if (typeof initUnityClient === "function") initUnityClient();
	initGui();
	window.onkeyup = function (e) {
		var key = e.keyCode ? e.keyCode : e.which;

		if (key == 107 || key == 65) { // Numpad + Key
			toggleGui();
		}
	}

	if (AUTORUN) {
		log("Autorun start");
		run = true;
	}

	log(`crt mode ${AIMODE_NAME[MODE]}`);

	waitForMainLobbyLoad();
}

function toggleRun() {
	if (startupError) {
		return;
	}
	clearCrtStrategyMsg();
	decisionEpoch++;
	oldOps = "";
	if (run) {
		log("AlphaJong deactivated!");
		run = false;
		setAutoCallWin(false);
		startButton.innerHTML = "Start Bot";
	}
	else {
		log("AlphaJong activated!");
		run = true;
		setAutoCallWin(MODE === AIMODE.AUTO);
		startButton.innerHTML = "Stop Bot";
		main();
	}
}

function waitForMainLobbyLoad() {
	clearTimeout(lobbyLoadTimer);
	lobbyLoadTimer = null;
	if (startupFinished || startupError) {
		return;
	}

	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity && isUnityPage()) {
		autorunCheckbox.disabled = true;
		roomCombobox.disabled = true;
		if (!unity.state.isLobbyReady()) {
			var connected = unity.transport.getStatus().connected;
			showCrtActionMsg(connected ? "Waiting for sign-in." : "Connecting to Mahjong Soul.");
			if (Date.now() - startupStartedAt >= 30000) showStartupNotice("Sign in to Mahjong Soul, then enter a standard match. " +
				"If already signed in, reload this page once so AlphaJong can observe the game connection.");
			lobbyLoadTimer = setTimeout(waitForMainLobbyLoad, 1000);
			return;
		}
		showStartupNotice("Unity integration is active. Choose a standard match in Mahjong Soul; Auto plays your turns and Help shows recommendations. " +
			"Matchmaking and in-game tile highlighting are not available here.");
	}
	if (!unity && isUnsupportedUnityClient()) {
		startupError = "This Mahjong Soul page uses Unity WebGL. This version of AlphaJong only supports " +
			"the older JavaScript client and cannot read or play games on this client.";
		run = false;
		decisionEpoch++;
		clearInterval(afkTimer);
		afkTimer = null;
		startButton.textContent = "Start Bot";
		startButton.disabled = true;
		autorunCheckbox.disabled = true;
		roomCombobox.disabled = true;
		showCrtActionMsg("Unsupported game client.");
		showStartupNotice(startupError);
		log(startupError);
		return;
	}

	if (!hasFinishedMainLobbyLoading()) {
		if (Date.now() - startupStartedAt >= 30000) {
			if (hasLegacyClient()) {
				showCrtActionMsg("Waiting for login or lobby.");
				showStartupNotice("Mahjong Soul has not reported a ready lobby. Finish signing in. " +
					"If the lobby is already visible, this client may need a compatibility update. Still checking.");
			} else {
				showCrtActionMsg("Cannot access the game.");
				showStartupNotice("AlphaJong cannot access Mahjong Soul's game data. If the lobby is already open, " +
					"update or reinstall AlphaJong and reload the page. Still checking for the game.");
			}
		} else {
			showCrtActionMsg("Waiting for Mahjong Soul.");
		}
		lobbyLoadTimer = setTimeout(waitForMainLobbyLoad, 2000);
		return;
	}

	startupFinished = true;
	startButton.disabled = false;
	if (!unity) showStartupNotice("");
	refreshRoomSelection();
	if (!unity && AUTORUN && run && afkTimer == null) {
		afkTimer = setInterval(preventAFK, 30000);
	}
	if (isInGame()) { // In case a game is already ongoing after reload
		main();
		return;
	}

	log("Main Lobby loaded!");
	startGame();
	if (run) {
		showCrtActionMsg("Waiting for Game to start.");
		setTimeout(main, 10000);
		log("Main Loop started.");
	} else {
		showCrtActionMsg("Bot is not running.");
	}
}

//Main Loop
function main() {
	if (startupError) {
		return;
	}
	if (!run) {
		showCrtActionMsg("Bot is not running.");
		return;
	}
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) {
		var unityStatus = unity.state.getStatus();
		if (!unity.state.isInGame()) {
			showCrtActionMsg(unityStatus.phase === "lobby" ? "Enter a match in Mahjong Soul." : "Waiting for game state.");
			showStartupNotice(unityStatus.phase === "paused" ? unityStatus.reason : "");
			setTimeout(main, 1000);
			return;
		}
		showStartupNotice("");
	}
	if (!isInGame()) {
		checkForEnd();
		showCrtActionMsg("Waiting for Game to start.");
		log("Game is not running, sleep 2 seconds.");
		errorCounter++;
		if (errorCounter > 90 && AUTORUN) { //3 minutes no game found -> reload page
			goToLobby();
		}
		setTimeout(main, 2000); //Check every 2 seconds if ingame
		return;
	}

	if (isDisconnect()) {
		goToLobby();
	}

	var operations = getOperationList(); //Get possible Operations

	if (operations == null || operations.length == 0) {
		errorCounter++;
		if (getTilesLeft() == lastTilesLeft) { //1 minute no tile drawn
			if (errorCounter > 120) {
				goToLobby();
			}
		}
		else {
			lastTilesLeft = getTilesLeft();
			errorCounter = 0;
		}
		clearCrtStrategyMsg();
		showCrtActionMsg("Waiting for own turn.");
		setTimeout(main, 500);

		if (MODE === AIMODE.HELP) {
			oldOps = "";
		}
		return;
	}

	showCrtActionMsg("Calculating best move...");

	setTimeout(mainOwnTurn, 200 + (Math.random() * 200));
}

var oldOps = "";
function recordPlayerOps() {
	oldOps = getDecisionStateKey();
}

function checkPlayerOpChanged() {
	return getDecisionStateKey() !== oldOps;
}

function getDecisionStateKey() {
	return JSON.stringify([
		getRound(), getRoundWind(), getCurrentPlayer(), getTilesLeft(),
		getDora().map(getTileIdentityKey),
		getPlayerHand().map(tile => [getTileIdentityKey(tile.val), tile.valid !== false]),
		getOperationList().map(operation => [operation.type, operation.combination || []]),
		getTileIdentityKey(getTileForCall()),
		Array.from({ length: getNumberOfPlayers() }, (_, player) => {
			var pond = getDiscardsOfPlayer(player);
			return [getPlayerScore(player), isPlayerRiichi(player), getNumberOfTilesInHand(player),
				getNumberOfKitaOfPlayer(player),
				pond.pais.map(tile => getTileIdentityKey(tile.val)),
				getTileIdentityKey(pond.last_pai && pond.last_pai.val),
				getCallsOfPlayer(player).map(tile => [getTileIdentityKey(tile), tile.from, tile.kan])];
		})
	]);
}

function isDecisionCurrent() {
	return run && isInGame() && getOperationList().length > 0 && activeDecisionState != null &&
		!activeDecisionState.actionSent && activeDecisionState.epoch == decisionEpoch &&
		activeDecisionState.mode == MODE && activeDecisionState.key == getDecisionStateKey();
}

async function mainOwnTurn() {
	if (!run || threadIsRunning) {
		return;
	}
	threadIsRunning = true;
	var mainScheduled = false;
	function scheduleMain(delay) {
		mainScheduled = true;
		setTimeout(main, delay);
	}

	try {
		//HELP MODE, if player not operate, just skip
		if (MODE === AIMODE.HELP) {
			if (!checkPlayerOpChanged()) {
				scheduleMain(1000);
				return;
			}
		}

		setData(); //Set current state of the board to local variables
		clearHandAnalysisCache();
		activeDecisionState = { epoch: decisionEpoch, mode: MODE, key: getDecisionStateKey() };

		var operations = getOperationList();

		log("##### OWN TURN #####");
		log("Debug String: " + getDebugString());
		if (getNumberOfPlayers() == 3) {
			log("Right Player Tenpai Chance: " + Number(isPlayerTenpai(1) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(1).toFixed(0)));
			log("Left Player Tenpai Chance: " + Number(isPlayerTenpai(2) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(2).toFixed(0)));
		}
		else {
			log("Shimocha Tenpai Chance: " + Number(isPlayerTenpai(1) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(1).toFixed(0)));
			log("Toimen Tenpai Chance: " + Number(isPlayerTenpai(2) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(2).toFixed(0)));
			log("Kamicha Tenpai Chance: " + Number(isPlayerTenpai(3) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(3).toFixed(0)));
		}

		determineStrategy(); //Get the Strategy for the current situation. After calls so it does not reset folds

		isConsideringCall = true;
		for (let operation of operations) { //Priority Operations: Should be done before discard on own turn
			if (!isDecisionCurrent()) {
				break;
			}
			switch (operation.type) {
				case getOperations().an_gang: //From Hand
					callAnkan(operation.combination);
					break;
				case getOperations().add_gang: //Add from Hand to Pon
					callShouminkan();
					break;
				case getOperations().zimo:
					callTsumo();
					break;
				case getOperations().rong:
					callRon();
					break;
				case getOperations().babei:
					if (callKita()) {
						scheduleMain(1000);
						return;
					}
					break;
				case getOperations().jiuzhongjiupai:
					callAbortiveDraw();
					break;
			}
		}

		for (let operation of operations) {
			if (!isDecisionCurrent()) {
				break;
			}
			switch (operation.type) {
				case getOperations().dapai:
					isConsideringCall = false;
					await discard();
					break;
				case getOperations().eat:
					await callTriple(operation.combination, getOperations().eat);
					break;
				case getOperations().peng:
					await callTriple(operation.combination, getOperations().peng);
					break;
				case getOperations().ming_gang: //From others
					callDaiminkan();
					break;
			}
		}

		log(" ");

		if (MODE === AIMODE.HELP && isDecisionCurrent()) {
			// An interrupted or failed calculation must be retried for this board.
			recordPlayerOps();
		}

		if (MODE === AIMODE.AUTO) {
			showCrtActionMsg("Own turn completed.");
		}

		if ((getOverallTimeLeft() < 8 && getLastTurnTimeLeft() - getOverallTimeLeft() <= 0) || //Not much overall time left and last turn took longer than the 5 second increment
			(getOverallTimeLeft() < 4 && getLastTurnTimeLeft() - getOverallTimeLeft() <= 1)) {
			timeSave++;
			log("Low performance! Activating time save mode level: " + timeSave);
		}
		if (getOverallTimeLeft() > 15) { //Much time left (new round)
			timeSave = 0;
		}

		scheduleMain(1000);
	}
	catch (error) {
		log("mainOwnTurn failed: " + (error && error.message ? error.message : error));
		if (!mainScheduled) {
			scheduleMain(1000);
		}
	}
	finally {
		activeDecisionState = null;
		isConsideringCall = false;
		threadIsRunning = false;
	}

}

//Set Data from real Game
function setData(mainUpdate = true) {

	dora = getDora();

	ownHand = [];
	for (let tile of getPlayerHand()) { //Get own Hand
		ownHand.push(tile.val);
		ownHand[ownHand.length - 1].valid = tile.valid; //Is valid discard
	}

	if (MARK_TSUMOGIRI && !(typeof getUnityClient === "function" && getUnityClient())) {
		for (var j = 1; j < getNumberOfPlayers(); j++) {
			if (getDiscardsOfPlayer(j).last_pai != null && getDiscardsOfPlayer(j).last_pai.val.tsumogiri) {
				getDiscardsOfPlayer(j).last_pai.GetDefaultColor = function () { return new Laya.Vector4(0.85, 0.85, 0.85, 1); }
				getDiscardsOfPlayer(j).last_pai.ResetShow();
			}
		}
	}

	discards = [];
	for (var j = 0; j < getNumberOfPlayers(); j++) { //Get Discards for all Players
		var temp_discards = [];
		for (var i = 0; i < getDiscardsOfPlayer(j).pais.length; i++) {
			temp_discards.push(getDiscardsOfPlayer(j).pais[i].val);
		}
		if (getDiscardsOfPlayer(j).last_pai != null) {
			temp_discards.push(getDiscardsOfPlayer(j).last_pai.val);
		}
		discards.push(temp_discards);
	}
	if (mainUpdate) {
		updateDiscardedTilesSafety();
	}

	calls = [];
	for (var j = 0; j < getNumberOfPlayers(); j++) { //Get Calls for all Players
		calls.push(getCallsOfPlayer(j));
	}

	isClosed = true;
	for (let tile of calls[0]) { //Is hand closed? Also consider closed Kans
		if (tile.from != localPosition2Seat(0)) {
			isClosed = false;
			break;
		}
	}
	if (tilesLeft < getTilesLeft()) { //Check if new round/reload
		decisionEpoch++;
		setAutoCallWin(run && MODE === AIMODE.AUTO);
		strategy = STRATEGIES.GENERAL;
		strategyAllowsCalls = true;
		initialDiscardedTilesSafety();
		riichiTiles = [null, null, null, null];
		playerDiscardSafetyList = [[], [], [], []];
		var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
		if (unity) {
			for (var event of unity.state.getDiscardEvents()) {
				if (event.player === 0) continue;
				playerDiscardSafetyList[event.player].push(-1);
				if (event.riichi) riichiTiles[event.player] = event.tile;
			}
		}
		extendMJSoulFunctions();
	}

	tilesLeft = getTilesLeft();

	if (!isDebug()) {
		seatWind = getSeatWind(0);
		roundWind = getRoundWind();
	}

	updateAvailableTiles();
}

//Search for Game
function startGame() {
	if (typeof getUnityClient === "function" && getUnityClient()) {
		if (run) showCrtActionMsg("Enter a match in Mahjong Soul.");
		return;
	}
	if (!isInGame() && run && AUTORUN) {
		log("Searching for Game in Room " + ROOM);
		showCrtActionMsg("Searching for Game...");
		searchForGame();
	}
}

//Check if End Screen is shown
function checkForEnd() {
	if (typeof getUnityClient === "function" && getUnityClient()) return;
	if (isEndscreenShown() && AUTORUN) {
		run = false;
		setTimeout(goToLobby, 25000);
	}
}

//Reload Page to get back to lobby
function goToLobby() {
	location.reload(1);
}
