var MODE = 0;
var AIMODE = { AUTO: 0, HELP: 1 };
var calls = [[], [], [], []];
var testFailures = [];

function getCorrectPlayerNumber(player) { return player; }
function localPosition2Seat(player) { return player; }
function log() {}

function assertApiEqual(actual, expected, message) {
	if (actual !== expected) {
		testFailures.push(message + ": expected " + expected + ", got " + actual);
	}
}

function runApiContractTests() {
	globalThis.view = {
		DesktopMgr: {
			player_link_state: [1, 0, 1, 1],
			Inst: {
				players: [{ hand: [] }, { hand: [] }, { hand: [] }, { hand: [] }]
			}
		}
	};

	assertApiEqual(getPlayerLinkState(1), 0, "Disconnected link state is preserved");
	assertApiEqual(getPlayerLinkState(2), 1, "Connected link state is preserved");
	view.DesktopMgr.player_link_state[2] = undefined;
	assertApiEqual(getPlayerLinkState(2), 1, "Missing link state uses the connected fallback");
	assertApiEqual(doesPlayerExist(3), true, "Existing desktop player is detected");
	assertApiEqual(doesPlayerExist(4), false, "Missing desktop player is rejected");

	globalThis.__ALPHAJONG_TEST_RESULT = {
		done: true,
		failed: testFailures.length,
		total: 5,
		avgMsPerTest: 0,
		errors: testFailures
	};
	globalThis.__ALPHAJONG_TEST_DONE = true;
}
