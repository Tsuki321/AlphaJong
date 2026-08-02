//################################
// API (TEST)
// Returns test data
//################################


function sendHeatBeat() {

}

function searchForGame() {

}

function getOperationList() {

}

function getOperations() {

}

function getDora() {

}

function getPlayerHand() {

}

function getDiscardsOfPlayer(player) {

}

function getCallsOfPlayer(player) {

}

function getNumberOfKitaOfPlayer(player) {
	return 0;
}

function getTilesLeft() {

}

function localPosition2Seat(player) {
	return player;
}

function seat2LocalPosition(playerSeat) {
	return playerSeat;
}

function getCurrentPlayer() {
	return 0;
}

function getSeatWind(player) {

}

function getRoundWind() {

}

function setAutoCallWin(win) {

}

function getTileForCall() {
	return testCallTile;
}

function makeCall(type) {

}

function getRound() {
	return 3;
}

function makeCallWithOption(type, option) {

}

function declineCall() {

}

function sendRiichiCall(tile, moqie) {

}

function callDiscard(tileNumber) {

}

function getPlayerLinkState(player) {
	return 1;
}

function getNumberOfTilesInHand(player) {
	return testPlayerHand[player];
}

function isEndscreenShown() {
	return false;
}

function isDisconnect() {
	return false;
}

function isPlayerRiichi(player) {
	return testPlayerRiichi[player] == 1;
}

function isInGame() {
	return true;
}

function doesPlayerExist(player) {
	// Opt-in 3-player testing: when testExcludedSeats lists a seat number, that seat is "missing"
	// the way it is in real 3-player Mahjong Soul. Default [] keeps the 4-player behavior.
	if (typeof testExcludedSeats != 'undefined' && testExcludedSeats.includes(player)) {
		return false;
	}
	return true;
}

function getPlayerScore(player) {
	return 25000;
}

function hasPlayerHandChanged(player) {
	return true;
}

function rememberPlayerHand(player) {

}

function isEastRound() {
	return true;
}


function isInRank(room) {

}

function getRooms() {

}

function getCurrentRoom() {
	return 4;
}

function extendMJSoulFunctions() {

}

function trackRiichiDiscardTile() {

}