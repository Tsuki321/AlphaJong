//################################
// API (MAHJONG SOUL)
// Returns data from Mahjong Souls Javascript
//################################

function getDesktopManagerInstance() {
	if (typeof view == 'undefined' || view == null || typeof view.DesktopMgr == 'undefined' || view.DesktopMgr == null) {
		return null;
	}
	return view.DesktopMgr.Inst || null;
}

function getDesktopPlayer(player) {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.players) || typeof manager.players[player] == 'undefined') {
		return null;
	}
	return manager.players[player];
}

function getDiscardContainerFallback() {
	return {
		pais: [],
		last_pai: null,
		last_is_liqi: false
	};
}

function sendReq2MJ(method, payload) {
	if (typeof app == 'undefined' || app == null || typeof app.NetAgent == 'undefined' || app.NetAgent == null) {
		return false;
	}
	try {
		app.NetAgent.sendReq2MJ('FastTest', method, payload);
		return true;
	}
	catch {
		return false;
	}
}

function triggerOperationAnimation() {
	var manager = getDesktopManagerInstance();
	if (manager != null && typeof manager.WhenDoOperation == 'function') {
		manager.WhenDoOperation();
	}
}


function preventAFK() {
	if (typeof GameMgr == 'undefined') {
		return;
	}
	if (GameMgr.Inst == null) {
		return;
	}
	GameMgr.Inst._pre_mouse_point.x = Math.floor(Math.random() * 100) + 1;
	GameMgr.Inst._pre_mouse_point.y = Math.floor(Math.random() * 100) + 1;
	GameMgr.Inst.clientHeatBeat(); // Prevent Client-side AFK
	if (typeof app != 'undefined' && app != null && app.NetAgent != null) {
		app.NetAgent.sendReq2Lobby('Lobby', 'heatbeat', { no_operation_counter: 0 }); //Prevent Server-side AFK
	}

	var manager = getDesktopManagerInstance();
	if (manager == null) {
		return;
	}
	manager.hangupCount = 0;
	//uiscript.UI_Hangup_Warn.Inst.locking
}

function hasFinishedMainLobbyLoading() {
	if (typeof GameMgr == 'undefined') {
		return false;
	}
	return GameMgr.Inst.login_loading_end || isInGame();
}

function searchForGame() {
	if (typeof uiscript == 'undefined' || uiscript == null ||
		typeof uiscript.UI_PiPeiYuYue == 'undefined' || uiscript.UI_PiPeiYuYue == null ||
		uiscript.UI_PiPeiYuYue.Inst == null) {
		return;
	}
	uiscript.UI_PiPeiYuYue.Inst.addMatch(ROOM);

	// Direct way to search for a game, without UI:
	// app.NetAgent.sendReq2Lobby('Lobby', 'startUnifiedMatch', {match_sid: 1 + ":" + ROOM, client_version_string: GameMgr.Inst.getClientVersion()});
}

function getOperationList() {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.oplist)) {
		return [];
	}
	return manager.oplist;
}

function getOperations() {
	if (typeof mjcore == 'undefined' || mjcore == null || typeof mjcore.E_PlayOperation == 'undefined') {
		return {};
	}
	return mjcore.E_PlayOperation;
}

function getDora() {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.dora)) {
		return [];
	}
	return manager.dora;
}

function getPlayerHand() {
	var player = getDesktopPlayer(0);
	if (player == null || !Array.isArray(player.hand)) {
		return [];
	}
	return player.hand;
}

function getDiscardsOfPlayer(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || desktopPlayer.container_qipai == null) {
		return getDiscardContainerFallback();
	}
	return desktopPlayer.container_qipai;
}

function getCallsOfPlayer(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || desktopPlayer.container_ming == null || !Array.isArray(desktopPlayer.container_ming.mings)) {
		return [];
	}

	var callArray = [];
	//Mark the tiles with the player who discarded the tile
	for (let ming of desktopPlayer.container_ming.mings) {
		for (var i = 0; i < ming.pais.length; i++) {
			ming.pais[i].from = ming.from[i];
			if (i == 3) {
				ming.pais[i].kan = true;
			}
			else {
				ming.pais[i].kan = false;
			}
			callArray.push(ming.pais[i]);
		}
	}

	return callArray;
}

function getNumberOfKitaOfPlayer(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || desktopPlayer.container_babei == null || !Array.isArray(desktopPlayer.container_babei.pais)) {
		return 0;
	}
	return desktopPlayer.container_babei.pais.length;
}

function getTilesLeft() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.left_tile_count != 'number') {
		return 0;
	}
	return manager.left_tile_count;
}

function localPosition2Seat(player) {
	player = getCorrectPlayerNumber(player);
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.localPosition2Seat != 'function') {
		return player;
	}
	return manager.localPosition2Seat(player);
}

function seat2LocalPosition(playerSeat) {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.seat2LocalPosition != 'function') {
		return playerSeat;
	}
	return manager.seat2LocalPosition(playerSeat);
}

function getCurrentPlayer() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_player != 'number') {
		return 0;
	}
	return manager.index_player;
}

function getSeatWind(player) {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_ju != 'number') {
		return 1;
	}
	if (getNumberOfPlayers() == 3) {
		return ((3 + localPosition2Seat(player) - manager.index_ju) % 3) + 1;
	}
	else {
		return ((4 + localPosition2Seat(player) - manager.index_ju) % 4) + 1;
	}
}

function getRound() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_ju != 'number') {
		return 1;
	}
	return manager.index_ju + 1;
}

function getRoundWind() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_change != 'number') {
		return 1;
	}
	return manager.index_change + 1;
}

function setAutoCallWin(win) {
	if (!isInGame())
		return;
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.setAutoHule != 'function') {
		return;
	}

	manager.setAutoHule(win);
	//view.DesktopMgr.Inst.setAutoNoFulu(true) //Auto No Chi/Pon/Kan
	try {
		uiscript.UI_DesktopInfo.Inst.refreshFuncBtnShow(uiscript.UI_DesktopInfo.Inst._container_fun.getChildByName("btn_autohu"), manager.auto_hule); //Refresh GUI Button
	}
	catch {
		return;
	}
}

function getTileForCall() {
	var manager = getDesktopManagerInstance();
	if (manager == null || manager.lastqipai == null) {
		return { index: 0, type: 0, dora: false, doraValue: 0 };
	}
	var tile = manager.lastqipai.val;
	tile.doraValue = getTileDoraValue(tile);
	return tile;
}

function makeCall(type) {
	if (MODE === AIMODE.AUTO) {
		if (!sendReq2MJ('inputChiPengGang', { type: type, index: 0, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send call request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept: Call ${getCallNameByType(type)};`);
	}
}

function makeCallWithOption(type, option) {
	if (MODE === AIMODE.AUTO) {
		if (!sendReq2MJ('inputChiPengGang', { type: type, index: option, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send call option request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept ${option}: Call ${getCallNameByType(type)};`);
	}
}

function declineCall(operation) {
	if (MODE === AIMODE.AUTO) {
		try {
			if (operation == getOperationList()[getOperationList().length - 1].type) { //Is last operation -> Send decline Command
				if (!sendReq2MJ('inputChiPengGang', { cancel_operation: true, timeuse: 2 })) {
					log("Failed to send decline call request.");
					return;
				}
				triggerOperationAnimation();
			}
		}
		catch {
			log("Failed to decline the Call. Maybe someone else was faster?");
		}
	} else {
		showCrtStrategyMsg(`Decline: Call ${getCallNameByType(operation)};`);
	}
}

function sendRiichiCall(tile, moqie) {
	if (MODE === AIMODE.AUTO) {
		sendReq2MJ('inputOperation', { type: mjcore.E_PlayOperation.liqi, tile: tile, moqie: moqie, timeuse: Math.random() * 2 + 1 }); //Moqie: Throwing last drawn tile (Riichi -> false)
	} else {
		let tileName = getTileEmojiByName(tile);
		showCrtStrategyMsg(`Riichi: ${tileName};`);
	}
}

function sendKitaCall() {
	if (MODE === AIMODE.AUTO) {
		var manager = getDesktopManagerInstance();
		if (manager == null || manager.mainrole == null || manager.mainrole.last_tile == null) {
			return;
		}
		var moqie = manager.mainrole.last_tile.val.toString() == "4z";
		if (!sendReq2MJ('inputOperation', { type: mjcore.E_PlayOperation.babei, moqie: moqie, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send Kita request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept: Kita;`);
	}
}

function sendAbortiveDrawCall() {
	if (MODE === AIMODE.AUTO) {
		if (!sendReq2MJ('inputOperation', { type: mjcore.E_PlayOperation.jiuzhongjiupai, index: 0, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send abortive draw request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept: Kyuushu Kyuuhai;`);
	}
}

function callDiscard(tileNumber) {
	if (MODE === AIMODE.AUTO) {
		try {
			var player = getDesktopPlayer(0);
			if (player != null && Array.isArray(player.hand) && player.hand[tileNumber] != null && player.hand[tileNumber].valid) {
				player._choose_pai = player.hand[tileNumber];
				player.DoDiscardTile();
			}
		}
		catch {
			log("Failed to discard the tile.");
		}
	} else {
		let tileID = ownHand[tileNumber];
		let tileName = getTileName(tileID, false);
		let strategyStr = helpHintContext.strategy || STRATEGIES.GENERAL;
		let shantenStr = helpHintContext.shanten <= 0 ? "Tenpai" : (helpHintContext.shanten + " from tenpai");
		showCrtStrategyMsg(`[${strategyStr} | ${shantenStr}] Discard: ${tileName}`);
		if (CHANGE_RECOMMEND_TILE_COLOR) {
			view.DesktopMgr.Inst.mainrole.hand.forEach(
				tile => tile.val.toString() == tileID ?
					tile._SetColor(new Laya.Vector4(0.5, 0.8, 0.9, 1))
					: tile._SetColor(new Laya.Vector4(1, 1, 1, 1)));
		}
	}
}

function getPlayerLinkState(player) {
	player = getCorrectPlayerNumber(player);
	if (typeof view == 'undefined' || view == null || typeof view.DesktopMgr == 'undefined' || view.DesktopMgr == null || !Array.isArray(view.DesktopMgr.player_link_state)) {
		return 1;
	}
	var linkState = view.DesktopMgr.player_link_state[localPosition2Seat(player)];
	return typeof linkState == 'undefined' ? 1 : linkState;
}

function getNumberOfTilesInHand(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || !Array.isArray(desktopPlayer.hand)) {
		return 0;
	}
	return desktopPlayer.hand.length;
}

function isEndscreenShown() {
	return this != null && view != null && view.DesktopMgr != null &&
		view.DesktopMgr.Inst != null && view.DesktopMgr.Inst.gameEndResult != null;
}

function isDisconnect() {
	return uiscript.UI_Hanguplogout.Inst != null && uiscript.UI_Hanguplogout.Inst._me.visible;
}

function isPlayerRiichi(player) {
	var player_correct = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player_correct);
	if (desktopPlayer == null || desktopPlayer.liqibang == null) {
		return false;
	}
	return desktopPlayer.liqibang._activeInHierarchy || getDiscardsOfPlayer(player).last_is_liqi;
}

function isInGame() {
	try {
		return this != null && view != null && view.DesktopMgr != null &&
			view.DesktopMgr.Inst != null && view.DesktopMgr.player_link_state != null &&
			view.DesktopMgr.Inst.active && !isEndscreenShown()
	}
	catch {
		return false;
	}
}

function doesPlayerExist(player) {
	var desktopPlayer = getDesktopPlayer(player);
	return desktopPlayer != null && typeof desktopPlayer.hand != 'undefined' && desktopPlayer.hand != null;
}

function getPlayerScore(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || typeof desktopPlayer.score != 'number') {
		return 0;
	}
	return desktopPlayer.score;
}

//Needs to be called before calls array is updated
function hasPlayerHandChanged(player) {
	var player_correct = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player_correct);
	if (desktopPlayer == null || !Array.isArray(desktopPlayer.hand)) {
		return false;
	}
	for (let hand of desktopPlayer.hand) {
		if (hand.old != true) {
			return true;
		}
	}
	return getCallsOfPlayer(player).length > calls[player].length;
}

//Sets a variable for each pai in a players hand
function rememberPlayerHand(player) {
	var player_correct = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player_correct);
	if (desktopPlayer == null || !Array.isArray(desktopPlayer.hand)) {
		return;
	}
	for (let tile of desktopPlayer.hand) {
		tile.old = true;
	}
}

function isEastRound() {
	var manager = getDesktopManagerInstance();
	if (manager == null || manager.game_config == null || manager.game_config.mode == null) {
		return true;
	}
	return manager.game_config.mode.mode % 10 == 1;
}

// Is the player able to join a given room
function isInRank(room) {
	var roomData = cfg.desktop.matchmode.get(room);
	try {
		var rank = GameMgr.Inst.account_data[roomData.mode < 10 ? "level" : "level3"].id; // 4 player or 3 player rank
		return (roomData.room == 100) || (roomData.level_limit <= rank && roomData.level_limit_ceil >= rank); // room 100 is casual mode
	}
	catch {
		return roomData.room == 100 || roomData.level_limit > 0; // Display the Casual Rooms and all ranked rooms (no special rooms)
	}
}

// Map of all Rooms
function getRooms() {
	try {
		return cfg.desktop.matchmode;
	}
	catch {
		return null;
	}
}

// Returns the room of the current game as a number: Bronze = 1, Silver = 2 etc.
function getCurrentRoom() {
	try {
		var manager = getDesktopManagerInstance();
		if (manager == null || manager.game_config == null || manager.game_config.meta == null) {
			return 0;
		}
		var currentRoom = manager.game_config.meta.mode_id;
		return getRooms().map_[currentRoom].room;
	}
	catch {
		return 0;
	}
}

// Client language: ["chs", "chs_t", "en", "jp"]
function getLanguage() {
	if (typeof GameMgr == 'undefined' || GameMgr == null) {
		return "en";
	}
	return GameMgr.client_language;
}

// Name of a room in client language
function getRoomName(room) {
	return room["room_name_" + getLanguage()] + " (" + game.Tools.room_mode_desc(room.mode) + ")";
}

//How much seconds left for a turn (base value, 20 at start)
function getOverallTimeLeft() {
	try {
		return uiscript.UI_DesktopInfo.Inst._timecd._add;
	}
	catch {
		return 20;
	}
}

//How much time was left in the last turn?
function getLastTurnTimeLeft() {
	try {
		return uiscript.UI_DesktopInfo.Inst._timecd._pre_sec;
	}
	catch {
		return 25;
	}
}

// Extend some internal MJSoul functions with additional code
function extendMJSoulFunctions() {
	if (functionsExtended) {
		return;
	}
	if (!isInGame()) {
		return;
	}
	trackDiscardTiles();
	functionsExtended = true;
}

// Track which tiles the players discarded (for push/fold judgement and tracking the riichi tile)
function trackDiscardTiles() {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.players)) {
		return;
	}

	for (var i = 1; i < getNumberOfPlayers(); i++) {
		var player = getCorrectPlayerNumber(i);
		var desktopPlayer = getDesktopPlayer(player);
		if (desktopPlayer == null || desktopPlayer.container_qipai == null || typeof desktopPlayer.container_qipai.AddQiPai != 'function') {
			continue;
		}
		if (desktopPlayer.container_qipai.AddQiPai._alphajongWrapped === true) {
			continue;
		}

		desktopPlayer.container_qipai.AddQiPai = (function (_super) { // Extend the MJ-Soul Discard function
			return function () {
				if (arguments[1]) { // Contains true when Riichi
					riichiTiles[seat2LocalPosition(this.player.seat)] = arguments[0]; // Track tile in riichiTiles Variable
				}
				setData(false);
				visibleTiles.push(arguments[0]);
				var danger = getTileDanger(arguments[0], seat2LocalPosition(this.player.seat));
				if (arguments[2] && danger < 0.01) { // Ignore Tsumogiri of a safetile, set it to average danger
					danger = 0.05;
				}
				arguments[0].tsumogiri = arguments[2];
				playerDiscardSafetyList[seat2LocalPosition(this.player.seat)].push(danger);
				return _super.apply(this, arguments); // Call original function
			};
		})(desktopPlayer.container_qipai.AddQiPai);
		desktopPlayer.container_qipai.AddQiPai._alphajongWrapped = true;
	}
}
