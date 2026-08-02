//################################
// TESTS
// Contains some testcases and a benchmark test
//################################

//TEST PARAMETERS
var TEST_CASES = ["Efficiency", "Defense", "Dora", "Yaku", "Strategy", "Waits", "Call", "Issue", "Example"];
var currentTestcase = 0;
var currentTestStep = 0;
var passes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var overall = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var testCallTile = {};
var testPlayerRiichi = [0, 0, 0, 0];
var testPlayerHand = [13, 13, 13, 13];
var testStartTime = 0;
var expected = [];

// When set (via the headless runner's page.addInitScript), the page skips the slow discard
// loop and reports after only the regression + direct prediction unit tests, for fast iteration.
var FAST_MODE = (typeof window != 'undefined' && window.__ALPHAJONG_FAST === true);
var predictionAssertionsRun = 0;

// Minimal assertion helpers for the direct prediction/regression tests.
function assertEqual(actual, expectedValue, message) {
	predictionAssertionsRun++;
	if (actual !== expectedValue) {
		throw new Error((message || "assertEqual failed") + ": expected '" + expectedValue + "', got '" + actual + "'");
	}
}
function assertTrue(value, message) {
	predictionAssertionsRun++;
	if (!value) {
		throw new Error((message || "assertTrue failed") + ": expected truthy, got '" + value + "'");
	}
}
function assertApprox(actual, expectedValue, epsilon, message) {
	predictionAssertionsRun++;
	if (typeof actual != 'number' || Math.abs(actual - expectedValue) > epsilon) {
		throw new Error((message || "assertApprox failed") + ": expected " + expectedValue + " ± " + epsilon + ", got '" + actual + "'");
	}
}
function assertGreaterThan(actual, threshold, message) {
	predictionAssertionsRun++;
	if (!(typeof actual == 'number' && actual > threshold)) {
		throw new Error((message || "assertGreaterThan failed") + ": expected > " + threshold + ", got '" + actual + "'");
	}
}
function assertLessThan(actual, threshold, message) {
	predictionAssertionsRun++;
	if (!(typeof actual == 'number' && actual < threshold)) {
		throw new Error((message || "assertLessThan failed") + ": expected < " + threshold + ", got '" + actual + "'");
	}
}

function publishTestResult(result) {
	if (typeof window == 'undefined') {
		return;
	}
	window.__ALPHAJONG_TEST_RESULT = result;
	window.__ALPHAJONG_TEST_DONE = result.done === true;
}

publishTestResult({ done: false, failed: 0, total: 0, avgMsPerTest: 0 });

//Only run if debug mode
if (isDebug()) {
	runRegressionTests().then(function () {
		if (FAST_MODE) {
			// Fast path: regression + prediction unit tests already ran; skip the slow discard loop.
			publishTestResult({ done: true, failed: 0, total: predictionAssertionsRun, avgMsPerTest: 0, fast: true });
			log("FAST mode: regression + prediction unit tests passed, discard loop skipped.");
			return;
		}
		testStartTime = new Date();
		runTestcases();
	}).catch(function (error) {
		publishTestResult({
			done: true,
			failed: 1,
			total: 1,
			avgMsPerTest: 0,
			error: error.message
		});
		console.error(error);
		setTimeout(function () { throw error; });
	});
}

async function runRegressionTests() {
	runHandAnalysisCacheTest();
	runBestCombinationRegressionTest();
	runYakumanValueRegressionTest();
	runRyanpeikouRegressionTest();
	runPredictionUnitTests();
	run3PlayerPredictionTests();
	await runCallTripleStateRestoreTest();
}

// -- Prediction unit tests -------------------------------------------------
// Direct assertions against the prediction primitives (shanten, yaku, score,
// tenpai table, flush/yard detection, furiten/suji waits). These exercise the
// "prediction ability" the AI relies on, independently of the slow discard loop.
function baselinePredictionState() {
	resetGlobals();
	dora = [];
	isConsideringCall = false;
	timeSave = 0;
	PERFORMANCE_MODE = 4;
	updateAvailableTiles();
	if (typeof invalidateDefenseRuntimeCache == 'function') {
		invalidateDefenseRuntimeCache();
	}
}

function mkTile(index, type) {
	return { index: index, type: type, dora: false, doraValue: 0 };
}

function runPredictionUnitTests() {
	// === Shanten (calculateShanten) ===
	assertEqual(calculateShanten(4, 1, 0), -1, "Shanten 4 triples +1 pair should be a win (-1)");
	assertEqual(calculateShanten(3, 1, 1), 0, "Shanten 3 triples +1 pair +1 double is tenpai (0)");
	assertEqual(calculateShanten(0, 0, 0), 8, "Shanten with no blocks is 8");
	assertEqual(calculateShanten(2, 1, 2), 1, "Shanten 2 triples +1 pair +2 doubles is 1");
	assertEqual(calculateShanten(3, 0, 3), 1, "Shanten caps extra doubles and needs a pair (1)");

	// === getTriplesAndPairs ===
	var winning = getTriplesAndPairs(getTilesFromString("112233m456p789s11z"));
	assertEqual(winning.triples.length, 12, "Winning hand has 4 triples (12 tiles)");
	assertEqual(winning.pairs.length, 2, "Winning hand has 1 pair (2 tiles)");
	var floatHand = getTriplesAndPairs(getTilesFromString("234m567m234p234s5z"));
	assertEqual(floatHand.triples.length, 12, "Four sequences = 12 triple tiles");
	assertEqual(floatHand.pairs.length, 0, "Single floating honor is not a pair");

	// === getDoubles ===
	assertEqual(getDoubles(getTilesFromString("13m")).length, 2, "Adjacent 1m/3m within two forms a double");
	assertEqual(getDoubles(getTilesFromString("1m9m")).length, 0, "1m/9m do not form a double");
	assertEqual(getDoubles(getTilesFromString("55p")).length, 2, "Pair of 5p is a double");
	assertEqual(getDoubles(getTilesFromString("5z5z")).length, 2, "Pair of honors 5z is a double");

	// === getYaku (exact han for clean hands; p=type0, m=type1, s=type2, z=type3) ===
	baselinePredictionState();
	var yTanyao = getYaku(getTilesFromString("234m456p678s234s55p"));
	assertEqual(yTanyao.open, 1, "Tanyao open han");
	assertEqual(yTanyao.closed, 1, "Tanyao closed han");

	baselinePredictionState();
	var yYakuhai = getYaku(getTilesFromString("555z234m456p789s11p"));
	assertEqual(yYakuhai.open, 1, "Yakuhai (dragon triplet) open han");
	assertEqual(yYakuhai.closed, 1, "Yakuhai closed han");

	baselinePredictionState();
	var yIipeikou = getYaku(getTilesFromString("112233m234p234s55z"));
	assertEqual(yIipeikou.open, 0, "Iipeikou is closed-only");
	assertEqual(yIipeikou.closed, 1, "Iipeikou adds 1 closed han");

	baselinePredictionState();
	var yRyanpeikou = getYaku(getTilesFromString("223344m556677p55z"));
	assertEqual(yRyanpeikou.open, 0, "Ryanpeikou is closed-only");
	assertEqual(yRyanpeikou.closed, 3, "Ryanpeikou adds 3 closed han");

	baselinePredictionState();
	var yIttsuu = getYaku(getTilesFromString("123456789m234p55z"));
	assertEqual(yIttsuu.open, 1, "Ittsuu open han");
	assertEqual(yIttsuu.closed, 2, "Ittsuu closed han");

	baselinePredictionState();
	var ySanshoku = getYaku(getTilesFromString("123m123p123s234m55z"));
	assertEqual(ySanshoku.open, 1, "Sanshoku doujun open han");
	assertEqual(ySanshoku.closed, 2, "Sanshoku doujun closed han");

	// Toitoi hand (4 triplets + pair). Closed => also sanankou (concealed triplets).
	baselinePredictionState();
	isConsideringCall = false;
	var yToiClosed = getYaku(getTilesFromString("555z999m444p333s11z"));
	assertEqual(yToiClosed.open, 5, "Toitoi(2)+yakuhai(1)+sanankou(2) open han, closed hand");
	assertEqual(yToiClosed.closed, 5, "Toitoi(2)+yakuhai(1)+sanankou(2) closed han, closed hand");

	// Same hand but while a call is being considered => sanankou suppressed, isolating toitoi+yakuhai.
	baselinePredictionState();
	isConsideringCall = true;
	var yToiOpen = getYaku(getTilesFromString("555z999m444p333s11z"));
	assertEqual(yToiOpen.open, 3, "Toitoi(2)+yakuhai(1) once sanankou suppressed (open han)");
	assertEqual(yToiOpen.closed, 3, "Toitoi(2)+yakuhai(1) closed han once sanankou suppressed");

	baselinePredictionState();
	assertGreaterThan(getYaku(getTilesFromString("11122233344455z")).closed, 12, "Tsuuiisou is yakuman");
	assertGreaterThan(getYaku(getTilesFromString("222333444666s66z")).closed, 12, "Ryuuiisou is yakuman");
	assertGreaterThan(getYaku(getTilesFromString("111999m111999p11s")).closed, 12, "Chinroutou is yakuman");
	assertGreaterThan(getYaku(getTilesFromString("11122233344z444m")).closed, 12, "Shousuushii is yakuman");
	assertGreaterThan(getYaku(getTilesFromString("1112345678999m5m")).closed, 12, "Chuuren poutou is yakuman");
	assertGreaterThan(getYaku(getTilesFromString("19m19p19s1234567z1m")).closed, 12, "Kokushi musou is yakuman");

	// Yakuman must also be detected on a 13-tile hand: every caller in ai_offense evaluates
	// 13 tiles (ownHand minus one discard), so a 14-only gate makes these unreachable in the bot.
	baselinePredictionState();
	assertGreaterThan(getYaku(getTilesFromString("1112223334445z")).closed, 12, "Tsuuiisou is yakuman at 13 tiles");
	assertGreaterThan(getYaku(getTilesFromString("22233344466s66z")).closed, 12, "Ryuuiisou is yakuman at 13 tiles");
	assertGreaterThan(getYaku(getTilesFromString("111999m111999p1s")).closed, 12, "Chinroutou is yakuman at 13 tiles");
	assertGreaterThan(getYaku(getTilesFromString("11122233344z44m")).closed, 12, "Shousuushii is yakuman at 13 tiles");
	assertGreaterThan(getYaku(getTilesFromString("1112345678999m")).closed, 12, "Chuuren poutou is yakuman at 13 tiles (9-wait tenpai)");
	assertGreaterThan(getYaku(getTilesFromString("19m19p19s1234567z")).closed, 12, "Kokushi musou is yakuman at 13 tiles (13-wait tenpai)");

	// === calculateScore (test env: no dealer bonus, 4-player) ===
	baselinePredictionState();
	assertEqual(calculateScore(1, 1, 30), 960, "Score han1 fu30");
	assertEqual(calculateScore(1, 4, 30), 7680, "Score han4 fu30 (mangan boundary)");
	assertEqual(calculateScore(1, 5, 30), 8000, "Score han5 mangan");
	assertEqual(calculateScore(1, 6, 30), 12000, "Score han6 haneman");
	assertEqual(calculateScore(1, 13, 30), 32000, "Score han13 yakuman");

	// === calculateFu (closed pinfu-style ron = 30 fu) ===
	baselinePredictionState();
	var fuTriples = getTilesFromString("123m456p789s234s");
	var fuPair = getTilesFromString("55p");
	var fuWinTile = mkTile(4, 2); // 4s completes the 234s sequence as a ryanmen wait
	var fu = calculateFu(fuTriples, [], fuPair, [mkTile(1, 2), fuWinTile], fuWinTile, true);
	assertEqual(fu, 30, "Closed all-sequence ron (pinfu) is 30 fu");

	// === isPlayerTenpai table lock (room 4 => 0.9 modifier) ===
	baselinePredictionState();
	assertEqual(isPlayerTenpai(1), 0, "Fresh player (0 calls, 0 discards) is 0% tenpai");

	baselinePredictionState();
	discards[1] = getTilesFromString("2p4p6s8s5p");
	updateAvailableTiles();
	assertApprox(isPlayerTenpai(1), 0.0162, 0.0005, "Tenpai table [0][5] * 0.9 room modifier");

	baselinePredictionState();
	discards[1] = getTilesFromString("2p4p6s8s5p7s3p9p1p6p");
	updateAvailableTiles();
	assertApprox(isPlayerTenpai(1), 0.0855, 0.0005, "Tenpai table [0][10] * 0.9 room modifier");

	baselinePredictionState();
	testPlayerRiichi[2] = 1;
	assertEqual(isPlayerTenpai(2), 1, "Riichi player is 100% tenpai");

	baselinePredictionState();
	calls[1] = getTilesFromString("234m"); // 1 meld
	discards[1] = getTilesFromString("2p4p6s8s5p"); // 5 discards, none of flush suit m
	testPlayerHand[1] = 10;
	updateAvailableTiles();
	assertApprox(isPlayerTenpai(1), 0.1143, 0.0005, "Tenpai table [1][5] (1 call) * 0.9");

	// === Flush detection (isDoingHonitsu / isDoingChinitsu / ToiToi / Tanyao / Yakuhai) ===
	baselinePredictionState();
	calls[1] = getTilesFromString("234m678m"); // 2 m sequences
	discards[1] = getTilesFromString("2p4p6s8s2p3s"); // no m, no honors kept-dropped
	testPlayerHand[1] = 7;
	updateAvailableTiles();
	assertApprox(isDoingHonitsu(1, 1), 0.5, 0.001, "Honitsu confidence with 2 m melds (no honor discards)");
	assertEqual(isDoingChinitsu(1, 1), 0, "No honor discards => not confident it's chinitsu (keeps honors)");

	baselinePredictionState();
	calls[2] = getTilesFromString("234m678m"); // 2 m sequences
	discards[2] = getTilesFromString("1z3z2p4p6s2s"); // 2 honors dropped early, no m
	testPlayerHand[2] = 7;
	updateAvailableTiles();
	assertApprox(isDoingHonitsu(2, 1), 0.5, 0.001, "Honitsu confidence same regardless of honor discards");
	assertTrue(isDoingChinitsu(2, 1) > 0, "Honor discards => chinitsu confidence > 0");

	baselinePredictionState();
	calls[2] = getTilesFromString("234m555z");
	discards[2] = getTilesFromString("1z3z2p4p6s2s");
	testPlayerHand[2] = 7;
	updateAvailableTiles();
	assertTrue(isDoingHonitsu(2, 1) > 0, "Suit plus honor calls can indicate honitsu");
	assertEqual(isDoingChinitsu(2, 1), 0, "An exposed honor makes chinitsu impossible");

	baselinePredictionState();
	calls[3] = getTilesFromString("555z666z"); // 2 dragon pons (all honors => no sequences)
	testPlayerHand[3] = 7;
	updateAvailableTiles();
	assertApprox(isDoingToiToi(3), 0.3, 0.001, "Toitoi confidence with 2 triplet calls");

	baselinePredictionState();
	calls[1] = getTilesFromString("234p678p"); // 2 inner p sequences
	discards[1] = getTilesFromString("1z9z1m9m9s"); // 5 discards, all terminal/honor
	testPlayerHand[1] = 7;
	updateAvailableTiles();
	assertApprox(isDoingTanyao(1), 0.4, 0.001, "Tanyao confidence with inner calls + terminal discards");

	baselinePredictionState();
	calls[2] = getTilesFromString("555z666z"); // 2 dragon pons
	testPlayerHand[2] = 7;
	updateAvailableTiles();
	assertEqual(isDoingYakuhai(2), 2, "Yakuhai counts 2 dragon triplets");

	// === getExpectedHandValue ordering: chinitsu valued higher than honitsu (the fix) ===
	baselinePredictionState();
	discards[0] = getTilesFromString("0m0s0p"); // surface all 3 aka-dora so dora noise = 0
	calls[1] = getTilesFromString("234m678m"); discards[1] = getTilesFromString("2p4p6s8s2p3s"); testPlayerHand[1] = 7;   // honitsu
	calls[2] = getTilesFromString("234m678m"); discards[2] = getTilesFromString("1z3z2p4p6s2s"); testPlayerHand[2] = 7;   // chinitsu (honors dropped)
	calls[3] = []; discards[3] = []; testPlayerHand[3] = 13; // generic closed
	updateAvailableTiles();
	if (typeof invalidateDefenseRuntimeCache == 'function') invalidateDefenseRuntimeCache();
	var honitsuVal = getExpectedHandValue(1);
	var chinitsuVal = getExpectedHandValue(2);
	var baselineVal = getExpectedHandValue(3);
	assertGreaterThan(chinitsuVal, honitsuVal, "Chinitsu pusher valued HIGHER than equally-open honitsu pusher (new chinitsu detection)");
	assertGreaterThan(honitsuVal, baselineVal, "Open honitsu pusher valued higher than a generic closed hand");
	assertGreaterThan(chinitsuVal, baselineVal * 1.5, "Chinitsu valued >1.5x a generic closed hand");

	// === getWaitScoreForTileAndPlayer: furiten vs not ===
	baselinePredictionState();
	discards[1] = getTilesFromString("4m"); // player 1 discarded 4m => furiten on 4m
	updateAvailableTiles();
	if (typeof invalidateDefenseRuntimeCache == 'function') invalidateDefenseRuntimeCache();
	assertEqual(getWaitScoreForTileAndPlayer(1, mkTile(4, 1), true), 0, "Tile in own discards is furiten (wait score 0)");

	baselinePredictionState();
	updateAvailableTiles();
	if (typeof invalidateDefenseRuntimeCache == 'function') invalidateDefenseRuntimeCache();
	assertGreaterThan(getWaitScoreForTileAndPlayer(1, mkTile(4, 1), true), 30, "Free ryanmen/suji wait on 4m scores > 30");

	// === getTileDangerForPlayer: genbutsu vs dangerous ===
	baselinePredictionState();
	discards[1] = getTilesFromString("4m"); // genbutsu (own discard)
	updateAvailableTiles();
	if (typeof invalidateDefenseRuntimeCache == 'function') invalidateDefenseRuntimeCache();
	assertEqual(getTileDangerForPlayer(mkTile(4, 1), 1, 0), 0, "Tile already in player's pond is safe (danger 0)");

	baselinePredictionState();
	updateAvailableTiles();
	if (typeof invalidateDefenseRuntimeCache == 'function') invalidateDefenseRuntimeCache();
	assertGreaterThan(getTileDangerForPlayer(mkTile(5, 1), 1, 0), 0, "Free middle tile has positive danger");

	// === getExpectedDealInValue: tenpai0 => 0, and cache is stable ===
	baselinePredictionState();
	assertEqual(getExpectedDealInValue(1), 0, "Fresh player (0% tenpai) has 0 expected deal-in value");
	var cached = getExpectedDealInValue(1);
	assertEqual(getExpectedDealInValue(1), cached, "getExpectedDealInValue cached result is stable across calls");
}

// -- 3-player prediction tests ---------------------------------------------
// Verify the 3-player tile model (no 2-8 man, smaller wall, north dora) and the
// 12-field debug string parser, all enabled by opt-in testExcludedSeats.
function run3PlayerPredictionTests() {
	try {
		testExcludedSeats = [3]; // seat 3 missing => 3-player table
		assertEqual(getNumberOfPlayers(), 3, "Excluding seat 3 yields a 3-player game");

		baselinePredictionState();
		testExcludedSeats = [3];
		dora = [];
		updateAvailableTiles();
		assertEqual(getNumberOfTilesAvailable(5, 1), 0, "3p: middles 2-8 man (type 1) are unavailable");
		assertEqual(getNumberOfTilesAvailable(1, 1), 4, "3p: 1 man still has 4 tiles");
		assertEqual(getNumberOfTilesAvailable(9, 1), 4, "3p: 9 man still has 4 tiles");
		assertEqual(getNumberOfTilesAvailable(5, 2), 4, "3p: 5 sou still has 4 tiles");
		assertEqual(getNumberOfTilesAvailable(5, 0), 4, "3p: 5 pin still has 4 tiles");
		assertEqual(getWallSize(), 55, "3p: wall size is 55");
		assertEqual(getTileDoraValue({ index: 4, type: 3, dora: false }), 1, "3p: north (4z) is a dora");
		assertEqual(getTileDoraValue({ index: 4, type: 3, dora: true }), 2, "3p: red... north tile as aka + indicator dora");

		baselinePredictionState();
		testExcludedSeats = [3];
		//Uradora chance scales with dora indicators: 3p uses 0.5 per indicator.
		dora = [{ index: 6, type: 3, dora: false }]; // one indicator
		assertApprox(getUradoraChance(), 0.5, 0.001, "3p: one dora indicator => 0.5 uradora chance");
		dora = [{ index: 6, type: 3, dora: false }, { index: 7, type: 3, dora: false }];
		assertApprox(getUradoraChance(), 1.0, 0.001, "3p: two dora indicators => 1.0 uradora chance");

		// 3-player 12-field debug string dispatch + parse.
		// Dispatch is field-count based: a 12-field string routes to read3PlayerDebugString
		// even when the table is configured as 4-player, so verify both the route and the parse.
		testExcludedSeats = []; // genuinely 4p here
		readDebugString("6z|123456789m234p11s||1m2m3m|4p5p|6s7s||8m9m|1,1,0|3|2|42");
		assertEqual(getNumberOfPlayers(), 4, "4p config unchanged after reading a 12-field (3p) debug string");
		assertEqual(dora[0].index, 6, "read3PlayerDebugString parsed dora index");
		assertEqual(dora[0].type, 3, "read3PlayerDebugString parsed dora type");
		assertEqual(ownHand.length, 14, "read3PlayerDebugString parsed ownHand length (9m+3p+2s)");
		assertEqual(calls[1].length, 3, "read3PlayerDebugString parsed calls[1] (1m2m3m)");
		assertEqual(discards[2].length, 2, "read3PlayerDebugString parsed discards[2] (8m9m)");
		assertEqual(testPlayerHand[1], 10, "read3PlayerDebugString set testPlayerHand from calls (13-3)");
		assertEqual(seatWind, 3, "read3PlayerDebugString parsed seatWind");
		assertEqual(roundWind, 2, "read3PlayerDebugString parsed roundWind");
		assertEqual(tilesLeft, 42, "read3PlayerDebugString parsed tilesLeft");
	}
	finally {
		// Critical: restore 4-player default so subsequent regression/discard tests run in 4p.
		testExcludedSeats = [];
		baselinePredictionState();
	}
}

function runYakumanValueRegressionTest() {
	var hand = getTilesFromString("111m22p");
	var callTiles = getTilesFromString("555666777z");
	var yaku = getYaku(hand, callTiles);

	if (yaku.open < 13 || yaku.closed < 13) {
		throw new Error("Yakuman value regression test failed for Daisangen.");
	}
}

function runRyanpeikouRegressionTest() {
	var hand = getTilesFromString("112233m445566p77s");
	var yaku = getYaku(hand, []);

	if (yaku.closed < 3) {
		throw new Error("Ryanpeikou regression test failed.");
	}
}

function runHandAnalysisCacheTest() {
	var testHand = getTilesFromString("112233m456p789s11z");
	clearHandAnalysisCache();

	var firstResult = getTriplesAndPairs(testHand);
	firstResult.triples.pop(); //Verify cached results are copied and not shared by reference
	var secondResult = getTriplesAndPairs(testHand);

	if (secondResult.triples.length == firstResult.triples.length) {
		throw new Error("Hand analysis cache returned shared result objects.");
	}

	var firstDoubles = getDoubles(testHand);
	firstDoubles.pop(); //Verify cached doubles are copied and not shared by reference
	var secondDoubles = getDoubles(testHand);

	if (secondDoubles.length == firstDoubles.length) {
		throw new Error("Doubles cache returned shared result arrays.");
	}
}

function runBestCombinationRegressionTest() {
	var testHand = getTilesFromString("112233m456p789s11z");
	var bestCombination = getTriplesAndPairs(testHand);

	if (getStringForTiles(sortTiles(bestCombination.triples)) != "456p112233m789s" || getStringForTiles(sortTiles(bestCombination.pairs)) != "11z") {
		throw new Error("Best tile combination regression test failed.");
	}
}

async function runCallTripleStateRestoreTest() {
	resetGlobals();
	ownHand = getTilesFromString("1359m11p067s4477z");
	updateAvailableTiles();
	testCallTile = { index: 1, type: 0, dora: false, doraValue: 0 };

	var originalCalls = calls[0].map(t => ({ ...t }));
	var originalClosed = isClosed;
	var originalGetTilePriorities = getTilePriorities;
	getTilePriorities = async function () {
		throw new Error("callTriple regression");
	};

	try {
		await callTriple(["1p|1p"], 0);
		throw new Error("callTriple regression test did not throw.");
	}
	catch (error) {
		if (error.message != "callTriple regression") {
			throw error;
		}
	}
	finally {
		getTilePriorities = originalGetTilePriorities;
	}

	if (isClosed != originalClosed) {
		throw new Error("callTriple did not restore isClosed after an error.");
	}
	if (calls[0].length != originalCalls.length ||
		calls[0].some(function (tile, index) { return !isSameTile(tile, originalCalls[index], true); })) {
		throw new Error("callTriple did not restore simulated calls after an error.");
	}
}

//Test Main
async function runTestcases() {
	await runTestcase(TEST_CASES[currentTestcase]);
	if (currentTestcase >= TEST_CASES.length) {
		showEndResult();
		return;
	}
	setTimeout(runTestcases, 100); //Loop needs to be delayed, otherwise browser crashes
}

//Show the final result
function showEndResult() {
	var time = new Date() - testStartTime;
	var totalTests = overall.reduce((pv, cv) => pv + cv, 0);
	var failedTests = totalTests - passes.reduce((pv, cv) => pv + cv, 0);
	var avgMsPerTest = totalTests > 0 ? (time / totalTests) : 0;
	log("#################");
	log("TESTRESULTS");
	for (var i = 0; i < TEST_CASES.length; i++) {
		if (passes[i] == overall[i]) {
			log("<span style='color: green;'>" + TEST_CASES[i] + ": " + passes[i] + "/" + overall[i] + " passed!</span>");
		}
		else {
			log("<b style='color: red;'>" + TEST_CASES[i] + ": " + passes[i] + "/" + overall[i] + " failed!</b>");
		}
	}
	log("Time needed: " + time + "ms, or " + avgMsPerTest + "ms per test.");
	log("#################");
	publishTestResult({
		done: true,
		failed: failedTests,
		total: totalTests,
		avgMsPerTest: avgMsPerTest,
		timeMs: time
	});
}

//List of testcases
async function runTestcase(testcase) {
	resetGlobals();
	currentTestStep++;

	switch (testcase) {
		case "Efficiency":
			runEfficiencyTestcase();
			break;
		case "Defense":
			runDefenseTestcase();
			break;
		case "Dora":
			runDoraTestcase();
			break;
		case "Yaku":
			runYakuTestcase();
			break;
		case "Strategy":
			runStrategyTestcase();
			break;
		case "Waits":
			runWaitsTestcase();
			break;
		case "Call":
			await runCallTestcase();
			break;
		case "Issue":
			runIssueTestcase();
			break;
		case "Example":
			runExampleTestcase();
			break;
		default:
			log("Testcase doesn't exist! " + testcase);
			return;
	}
	if (currentTestStep == 0) {
		return;
	}

	initialDiscardedTilesSafety();
	updateAvailableTiles();
	determineStrategy();

	await checkDiscard();
}

//Discard a tile and check if it meets the expectation
async function checkDiscard() {
	await discard().then(function (tile) {
		log("Expected Discards:");
		overall[currentTestcase]++;
		for (let ex of expected) {
			log(ex);
			if (ex == tile.index + getNameForType(tile.type)) {
				log("<span style='color: green;'>" + TEST_CASES[currentTestcase] + " Testcase " + currentTestStep + " passed!</span>");
				passes[currentTestcase]++;
				log(" ");
				return;
			}
		}
		log("<b style='color: red;'>" + TEST_CASES[currentTestcase] + " testcase " + currentTestStep + " failed!</b>");
	});
}

function logTestcase(title) {
	log("<b>" + TEST_CASES[currentTestcase] + " " + currentTestStep + ": " + title + "</b>");
}

function nextTestcase() {
	currentTestcase++;
	currentTestStep = 0;
}

//Offensive Testcases
function runEfficiencyTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Standard Hand");
			ownHand = getTilesFromString("1239p22456m44468s");
			expected = ["9p"];
			break;

		case 2:
			logTestcase("Standard Hand 2");
			ownHand = getTilesFromString("1239p22456m44469s");
			expected = ["9p", "9s"];
			break;

		case 3:
			logTestcase("Keep Pair");
			ownHand = getTilesFromString("12367p22456m4578s");
			expected = ["4s", "5s", "7s", "8s"];
			break;

		case 4:
			logTestcase("Keep Kanchan");
			ownHand = getTilesFromString("12379p11456m2346s");
			expected = ["6s"];
			break;

		case 5:
			logTestcase("Throw away fake Kanchan");
			ownHand = getTilesFromString("12679p22456m2346s");
			expected = ["9p"];
			break;

		case 6:
			logTestcase("Keep Ryanmen over Penchan");
			ownHand = getTilesFromString("2389p22456m23489s");
			expected = ["9p"];
			break;

		case 7:
			logTestcase("Check Chi Pair Overlap");
			ownHand = getTilesFromString("456p11234677m345s");
			expected = ["7m"];
			break;

		case 8:
			logTestcase("Check Chi Pair Overlap 2");
			ownHand = getTilesFromString("456p1123556m345s6m");
			expected = ["1m"];
			break;

		case 9:
			logTestcase("Check Chi Triple Overlap");
			ownHand = getTilesFromString("456p11123567m346s");
			expected = ["6s"];
			break;

		case 10:
			logTestcase("Check Chi Triple Overlap 2");
			ownHand = getTilesFromString("456p111234567m34s");
			expected = ["1m", "4m", "7m"];
			break;

		case 11:
			logTestcase("Keep Pair instead of triple");
			ownHand = getTilesFromString("111456m2256p123s2p");
			expected = ["1m", "2p"];
			break;

		case 12:
			logTestcase("Open Hand");
			ownHand = getTilesFromString("2256p234s2p");
			calls[0] = getTilesFromString("222444m");
			isClosed = false;
			expected = ["2p"];
			break;

		case 13:
			logTestcase("Open Hand 2");
			ownHand = getTilesFromString("66734s");
			calls[0] = getTilesFromString("111333555m");
			isClosed = false;
			expected = ["3s", "4s", "7s"];
			break;

		case 14:
			logTestcase("Chi Pair Overlap 2");
			ownHand = getTilesFromString("11123455m25677p7s");
			expected = ["2p", "7s"];
			break;

		case 15:
			logTestcase("Chi Pair Overlap 3");
			ownHand = getTilesFromString("1112345578999m2p");
			expected = ["2p"];
			break;

		case 16:
			logTestcase("Ukeire vs. fastest Tenpai"); //8s has highest ukeire, but 1s is fastest way to tenpai
			ownHand = getTilesFromString("12588m27789p1889s");
			expected = ["1s"];
			break;

		case 17:
			logTestcase("Keep Kanchan over Penchan");
			ownHand = getTilesFromString("124m233678p11368s");
			expected = ["1m"];
			break;

		case 18:
			logTestcase("Prefer Shanpon Tenpai");
			// 123m+5m(iso)+456p+234s+11z(pair)+77z(pair): discard 5m → shanpon tenpai on 1z/7z (both yakuhai)
			ownHand = getTilesFromString("1235m456p234s1177z");
			expected = ["5m"];
			break;

		case 19:
			logTestcase("Prefer Tanyao-Compatible Wait");
			// 4 seqs (234m+567m+234p+234s) leaving 5s and 9m: discard terminal 9m → inner tanki 5s (tanyao)
			ownHand = getTilesFromString("234567m234p2345s9m");
			expected = ["9m"];
			break;

		case 20:
			logTestcase("Discard Isolated Honor to Reach Tenpai");
			// 3 m seqs + 2-3p (ryanmen on 1p/4p) + 5-5s (pair) + 7z (isolated honor)
			// Discard 7z → tenpai waiting on 1p or 4p
			ownHand = getTilesFromString("123m456m789m23p55s7z");
			expected = ["7z"];
			break;

		case 21:
			logTestcase("Keep Dora Tile Over Terminal");
			// 4 complete seqs + 1s (terminal) + 7s (dora): discard terminal 1s, keep dora 7s as tanki
			dora = getTilesFromString("6s");
			ownHand = getTilesFromString("234m567m789p234s17s");
			expected = ["1s"];
			break;

		case 22:
			logTestcase("Discard Isolated Tile Preserving Pair and Partial Group");
			// 3 seqs + 2-3s (ryanmen) + 9m-9m (pair) + 9p (isolated): discard 9p → tenpai on 1s or 4s
			ownHand = getTilesFromString("123m456p789s23s99m9p");
			expected = ["9p"];
			break;

		default:
			nextTestcase();
			return;
	}
}

function runDefenseTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Should Fold Tenpai");
			ownHand = getTilesFromString("11345m57p2347s111z");
			discards = [[], getTilesFromString("1223369m2p"), getTilesFromString("567567999m2p4z"), getTilesFromString("134999p4z")];
			testPlayerRiichi = [0, 0, 0, 1];
			expected = ["1z"];
			break;

		case 2:
			logTestcase("Should Fold 1 Shanten");
			ownHand = getTilesFromString("2367m2257p234s111z");
			discards = [[], getTilesFromString("13369m2p"), getTilesFromString("567567999s2p4z"), getTilesFromString("346688p14z")];
			testPlayerRiichi = [0, 0, 0, 1];
			expected = ["1z"];
			break;

		case 3:
			logTestcase("Should Fold 2 Shanten");
			dora = getTilesFromString("4z");
			ownHand = getTilesFromString("2367m2267p246s111z");
			discards = [[], getTilesFromString("5669m2p"), getTilesFromString("2p4z"), getTilesFromString("34p14z")];
			testPlayerRiichi = [0, 0, 0, 1];
			expected = ["1z"];
			break;

		case 4:
			logTestcase("Should Fold 3 Shanten");
			dora = getTilesFromString("4z");
			ownHand = getTilesFromString("369m2267p2469s111z");
			discards = [[], getTilesFromString("5669m2p"), getTilesFromString("23m99p4z"), getTilesFromString("578m14z")];
			calls = [[], [], getTilesFromString("666z"), getTilesFromString("111444m777z")];
			expected = ["1z"];
			break;

		case 5:
			logTestcase("Should Push 1 Shanten");
			ownHand = getTilesFromString("123m236p677s11777z");
			discards = [[], getTilesFromString("1133699m2p"), getTilesFromString("567567567m2p"), getTilesFromString("2567567m")];
			testPlayerRiichi = [0, 0, 0, 1];
			expected = ["6p"];
			break;

		case 6:
			logTestcase("Should Push 2 Shanten");
			ownHand = getTilesFromString("2378m22456p258s77z");
			discards = [[], getTilesFromString("1133699m2p"), getTilesFromString("567567567m2p"), getTilesFromString("25678p7z")];
			calls = [[], [], [], getTilesFromString("555z")];
			expected = ["2s", "5s", "8s"];
			break;

		case 7:
			logTestcase("Should Push 3 Shanten");
			ownHand = getTilesFromString("2589m22456p258s55z");
			discards = [[], getTilesFromString("11m2p"), getTilesFromString("367m2p5z"), getTilesFromString("25677p")];
			calls = [[], [], getTilesFromString("666z"), []];
			expected = ["2m", "5m", "2s", "5s", "8s"];
			break;

		case 8:
			logTestcase("Should Throw Semi-Safe tile");
			dora = getTilesFromString("4z");
			ownHand = getTilesFromString("2367m2267p246s111z");
			discards = [[], getTilesFromString("13369m2p"), getTilesFromString("567567999m2p4z"), getTilesFromString("3466788p14z")];
			testPlayerRiichi = [0, 0, 0, 1];
			expected = ["6p", "7p", "7m"];
			break;

		case 9:
			logTestcase("Sakigiri");
			ownHand = getTilesFromString("112445999m5559p9s");
			discards = [getTilesFromString("999p"), getTilesFromString("3333p9s"), getTilesFromString("222s9s"), getTilesFromString("111p9s")];
			expected = ["9p"];
			break;

		case 10:
			logTestcase("Keep Safetile");
			ownHand = getTilesFromString("11245699m23s559p4z");
			KEEP_SAFETILE = true;
			discards = [[], getTilesFromString("333"), getTilesFromString("222s"), getTilesFromString("111p9s")];
			expected = ["9p"];
			break;

		case 11:
			logTestcase("Fold Against Two Riichi");
			ownHand = getTilesFromString("34567m2356p2347s1z");
			discards = [[], getTilesFromString("1z2356m"), getTilesFromString("567m567p"), getTilesFromString("1z456m2p")];
			testPlayerRiichi = [0, 1, 0, 1];
			expected = ["1z"];
			break;

		default:
			nextTestcase();
			return;
	}
}

function runDoraTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Keep dora in Kanchan");
			dora = getTilesFromString("1p");
			ownHand = getTilesFromString("2468p11555m23467s");
			expected = ["8p"];
			break;

		case 2:
			tilesLeft = 40;
			logTestcase("Throw dora for better hand");
			dora = getTilesFromString("7p");
			ownHand = getTilesFromString("4568p22456m23467s");
			expected = ["8p"];
			break;

		case 3:
			logTestcase("Keep dora for pair");
			dora = getTilesFromString("8p");
			ownHand = getTilesFromString("4569p123467m3458s");
			expected = ["1m", "8s"];
			break;

		case 4:
			logTestcase("Choose wait for expected Dora");
			dora = getTilesFromString("7p");
			ownHand = getTilesFromString("579p123567m11144s");
			expected = ["5p"];
			break;

		case 5:
			logTestcase("Throw Dora for better Wait");
			dora = getTilesFromString("4p");
			ownHand = getTilesFromString("578p123567m11144s");
			expected = ["5p"];
			break;

		default:
			nextTestcase();
			return;
	}
}

function runYakuTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Yakuhai");
			ownHand = getTilesFromString("111234m5688p23s11z");
			expected = ["5p", "8p"];
			break;

		case 2:
			logTestcase("Tanyao");
			ownHand = getTilesFromString("23469m222488p345s");
			expected = ["9m"];
			break;

		case 3:
			logTestcase("Yaku: Single Yakuhai");
			ownHand = getTilesFromString("111222m5588p39s13z");
			expected = ["1z", "3z"];
			break;

		case 4:
			logTestcase("Yaku: Two from Tanyao");
			ownHand = getTilesFromString("222444m145679p33s");
			expected = ["1p"];
			break;

		case 5:
			logTestcase("Yaku: One from Tanyao");
			ownHand = getTilesFromString("222456m1366p3368s");
			expected = ["1p"];
			break;

		case 6:
			logTestcase("Test Iipeikou");
			ownHand = getTilesFromString("111222m4455667p5s");
			discards = [[{ index: 6, type: 0, dora: false, doraValue: 0 }], [], [], []];
			expected = ["5s"];
			break;

		case 7:
			logTestcase("Test Honitsu");
			ownHand = getTilesFromString("111222555789m5s7z");
			expected = ["5s"];
			break;

		case 8:
			logTestcase("Test Ittsuu");
			ownHand = getTilesFromString("12345689m579s777z");
			expected = ["5s", "7s", "9s"];
			break;

		case 9:
			logTestcase("Test Sanankou");
			ownHand = getTilesFromString("22233368m2488p88s");
			expected = ["6m", "8m", "2p", "4p"];
			break;

		case 10:
			isClosed = false;
			logTestcase("Test Toitoi");
			ownHand = getTilesFromString("333666m688p88s");
			discards = [[], [{ index: 8, type: 0, dora: false, doraValue: 0 }, { index: 6, type: 0, dora: false, doraValue: 0 }], [{ index: 9, type: 0, dora: false, doraValue: 0 }], []];
			calls = [[{ index: 1, type: 1, dora: false, doraValue: 0 }, { index: 1, type: 1, dora: false, doraValue: 0 }, { index: 1, type: 1, dora: false, doraValue: 0 }], [], [], []];
			expected = ["6p"];
			break;

		case 11:
			logTestcase("Test Chinitsu");
			ownHand = getTilesFromString("111222333469m34z");
			expected = ["3z", "4z"];
			break;

		case 12:
			logTestcase("Sanshoku Douko");
			ownHand = getTilesFromString("11156m11199p1167s");
			expected = ["6s", "7s", "5m", "6m", "9p"];
			break;

		case 13:
			logTestcase("Sanshoku Doujun");
			ownHand = getTilesFromString("12389m12399p1289s");
			expected = ["8m", "9m", "8s", "9s"];
			break;

		case 14:
			logTestcase("Chanta");
			ownHand = getTilesFromString("123m123999p579s22z");
			discards = [[], [{ index: 3, type: 2, dora: false, doraValue: 0 }], [], []];
			expected = ["5s"];
			break;

		case 15:
			logTestcase("Honrou");
			ownHand = getTilesFromString("111m111999p112s55z");
			expected = ["2s"];
			break;

		case 16:
			logTestcase("Shousangen");
			dora = getTilesFromString("1m");
			ownHand = getTilesFromString("23556p79s5556667z");
			expected = ["6p"];
			break;

		case 17:
			logTestcase("Daisangen");
			ownHand = getTilesFromString("456s246p55566677z");
			expected = ["2p", "4p", "6p"];
			break;

		case 18:
			logTestcase("Junchan");
			ownHand = getTilesFromString("123m123999p11579s");
			discards = [[], [{ index: 3, type: 2, dora: false, doraValue: 0 }], [], []];
			expected = ["5s"];
			break;

		case 19:
			logTestcase("Pinfu");
			dora = getTilesFromString("7s");
			ownHand = getTilesFromString("123m123789p11568s");
			expected = ["8s"];
			break;

		case 20:
			logTestcase("Preserve Ryanpeikou Structure");
			// 123m+123m(iipeikou)+123p+12p(ryanmen)+67s(ryanmen)+1z(iso): discard 1z keeps both ryanmen
			ownHand = getTilesFromString("112233m11223p67s1z");
			expected = ["1z"];
			break;

		case 21:
			logTestcase("Honroutou tenpai path");
			// 111m+999p+111s+55z(pair)+99m(partial 4th group)+5m(simples intruder):
			// discard 5m keeps all-terminal/honor structure → Honroutou tenpai on 9m (4 han)
			ownHand = getTilesFromString("111m999p111s55z99m5m");
			expected = ["5m"];
			break;

		case 22:
			logTestcase("Open Tanyao: Discard Terminal");
			// Open hand with calls; 9m (terminal) breaks tanyao while 8m tanki is inner and tanyao-compatible
			ownHand = getTilesFromString("2345678m345p9m");
			calls[0] = getTilesFromString("234s");
			isClosed = false;
			expected = ["9m"];
			break;

		default:
			nextTestcase();
			return;
	}
}

function runStrategyTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Chiitoitsu");
			ownHand = getTilesFromString("1122m5588p234s114z");
			discards = [getTilesFromString("1z"), [], [], []];

			expected = ["2s", "3s", "4s"];
			break;

		case 2:
			logTestcase("Thirteen Orphans");
			ownHand = getTilesFromString("1559m19s1234567z5m");
			expected = ["5m"];
			break;

		case 3:
			logTestcase("Thirteen Orphans - safest discard");
			ownHand = getTilesFromString("159m159p19s12345z5s");
			discards = [[], getTilesFromString("46m456p"), getTilesFromString("456m456p"), getTilesFromString("222m5p")];
			calls = [[], getTilesFromString("777888p"), getTilesFromString("777888m"), getTilesFromString("777888s")];
			expected = ["5p"];
			break;

		case 4:
			logTestcase("Thirteen Orphans - abandon strategy"); //6z all gone -> change strategy
			ownHand = getTilesFromString("159m159p19s12345z5s");
			discards = [[], getTilesFromString("12345z66z"), getTilesFromString("34566z"), getTilesFromString("222m55p5z")];
			expected = ["5z"];
			break;

		default:
			nextTestcase();
			return;
	}
}

function runWaitsTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Test Furiten");
			dora = getTilesFromString("1m");
			ownHand = getTilesFromString("11122233344m45p5s");
			discards = [getTilesFromString("6p"), [], [], []];
			expected = ["4p", "5p"];
			break;

		case 2:
			logTestcase("Test Pair Furiten");
			readDebugString("6z|1m33p406777s77z|576m||231m|999s|93p261z1s|8s2z91s2p|1s9p51z2p|35z1m94p|0,0,0,0|1|1|48");
			expected = ["3p", "4s"];
			break;

		case 3:
			logTestcase("Test Complex Furiten");
			ownHand = getTilesFromString("1113456m666999s1z"); // 3 tile wait (2m, 3m, 6m) in furiten
			discards = [[{ index: 2, type: 1, dora: false, doraValue: 0 }], [], [], []];
			expected = ["3m", "6m"];
			break;

		case 4:
			logTestcase("Test Wait Quality 2");
			ownHand = getTilesFromString("111333555789m5s4z");
			expected = ["5s"];
			break;

		case 5:
			logTestcase("Test Dora Wait 1"); //Should keep dora over better wait
			dora = getTilesFromString("4p");
			ownHand = getTilesFromString("111333555m5p123s4z");
			expected = ["4z"];
			break;

		case 6:
			logTestcase("Switch Dead Wait");
			dora = getTilesFromString("4p");
			ownHand = getTilesFromString("111333555m225ps44z");
			discards = [[], getTilesFromString("22p44z"), [], []];
			expected = ["2p", "4z"];
			break;

		case 7:
			logTestcase("Maintain Shanpon Wait After Draw");
			// 3 m seqs + 2-2p (pair) + 5-5s (pair) already forms shanpon tenpai structure; drew 9z
			// Discard 9z to preserve the shanpon tenpai on 2p or 5s
			ownHand = getTilesFromString("123m456m789m22p55s9z");
			expected = ["9z"];
			break;

		default:
			nextTestcase();
			return;
	}
}

async function runCallTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Test Pon Call");
			ownHand = getTilesFromString("222444m22678p367s");
			updateAvailableTiles();
			testCallTile = { index: 8, type: 0, dora: false, doraValue: 0 };
			var callResult = await callTriple(["6p|7p"], 0);
			expected = ["3s"];
			if (callResult) { //Should decline
				expected = ["0z"];
			}
			break;

		case 2:
			logTestcase("Test Chi Call with Options");
			ownHand = getTilesFromString("222444m2223457p3s");
			updateAvailableTiles();
			testCallTile = { index: 4, type: 0, dora: false, doraValue: 0 };
			var callResult = await callTriple(["2p|3p", "3p|5p"], 0);
			expected = ["3s"];
			if (callResult) { //Should decline
				expected = ["0z"];
			}
			break;

		case 3:
			logTestcase("Test Yakuhai Pon");
			readDebugString("6m|44789m2469p30s66z|||||22z9s44z|9m4z7s8m1z|1s1z65s6z|9s2z9m4p|0,0,0,0|1|1|51");
			updateAvailableTiles();
			testCallTile = { index: 6, type: 3, dora: false, doraValue: 0 };
			var callResult = await callTriple(["6z|6z"], 0);
			expected = ["9p"];
			if (!callResult) { //Should accept
				expected = ["0z"];
			}
			break;

		case 4:
			logTestcase("Test Shanten Reduce Call");
			ownHand = getTilesFromString("1359m11p067s4477z");
			updateAvailableTiles();
			testCallTile = { index: 1, type: 0, dora: false, doraValue: 0 };
			var callResult = await callTriple(["1p|1p"], 0);
			expected = ["9m"];
			if (!callResult) { //Should accept
				expected = ["0z"];
			}
			break;

		case 5:
			logTestcase("Test Call for Tenpai at end of game");
			ownHand = getTilesFromString("123569m11p567s44z");
			updateAvailableTiles();
			testCallTile = { index: 1, type: 0, dora: false, doraValue: 0 };
			strategyAllowsCalls = false;
			tilesLeft = 3;
			var callResult = await callTriple(["1p|1p"], 0);
			ownHand = ownHand.concat(getTileFromString("1p"));
			expected = ["9m"];
			if (!callResult) { //Should accept
				expected = ["0z"];
			}
			break;

		case 6:
			logTestcase("Test Call with unsure Yaku");
			ownHand = getTilesFromString("3m45p22345s77z");
			calls[0] = getTilesFromString("999m");
			isClosed = false;
			updateAvailableTiles();
			testCallTile = { index: 2, type: 2, dora: false, doraValue: 0 };
			var callResult = await callTriple(["2s|2s"], 0);
			expected = ["3m"];
			if (callResult) { //Should decline
				expected = ["0z"];
			}
			break;

		case 7:
			logTestcase("Test Call with Chanta Yaku");
			ownHand = getTilesFromString("3406m237899p789s");
			isClosed = true;
			updateAvailableTiles();
			testCallTile = { index: 9, type: 0, dora: false, doraValue: 0 };
			var callResult = await callTriple(["7p|8p","9p|9p"], 0);
			expected = ["9p"];
			if (callResult) { //Should decline
				expected = ["0z"];
			}
			break;

		case 8:
			logTestcase("Accept Yakuhai Pon for Tenpai");
			// 234m+456p+789s+5z(Haku)+6z(Hatsu)+7z+7z: pon on 7z(Chun) → tenpai on 5z(Haku) or 6z(Hatsu)
			ownHand = getTilesFromString("234m456p789s5677z");
			isClosed = true;
			updateAvailableTiles();
			testCallTile = { index: 7, type: 3, dora: false, doraValue: 0 };
			var callResult = await callTriple(["7z|7z"], 0);
			ownHand = ownHand.concat(getTileFromString("7z"));
			expected = ["5z", "6z"];
			if (!callResult) { //Should accept
				expected = ["0z"];
			}
			break;

		default:
			nextTestcase();
			return;
	}
}

function runIssueTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Issue #12-1"); // https://github.com/Jimboom7/AlphaJong/issues/12#issuecomment-1045805246
			readDebugString("1m|012234567m68p6s57z|||||3z1p4s3z|7m21z9p|32z9m3z9m|1p9s9p7z5s|0,0,0,0|2|1|70");
			expected = ["6s", "7z", "5z"];
			break;

		case 2:
			logTestcase("Issue #12-2"); // https://github.com/Jimboom7/AlphaJong/issues/12#issuecomment-1045805246
			readDebugString("1m|12234567m68p68s57z||456m||555z|4z1p4s3z|7m21z97p|42z9m3z9m|1p9s9p7z5s7p|0,0,0,0|2|1|70");
			expected = ["7z", "5z"];
			break;

		case 3:
			logTestcase("Issue #12-4"); // https://github.com/Jimboom7/AlphaJong/issues/12#issuecomment-1046320488
			readDebugString("1m|4447788m6p222344s||123m|034p999s666z||38p1s255z|5m479p9s36z|19m24788p6s44z|1m9p1s122337z|0,0,0,0|2|1|20");
			expected = ["6p"];
			break;

		case 4:
			logTestcase("Issue #15-1"); // https://github.com/Jimboom7/AlphaJong/issues/15#issuecomment-1047236697
			readDebugString("1m|12234550678p477z|||678p444s||6m368s23z|245m4z|1138m1s2z|5m19s236z|0,0,0,0|2|1|40");
			expected = ["4z"];
			break;

		case 5:
			logTestcase("Issue #36 - Dangerous Discard"); // https://github.com/Jimboom7/AlphaJong/issues/36
			readDebugString("6s|345666m334677p33s|||||515z9p199m|5z1m12z9p64z7p|6z21m26z1p7z2p|437z9m45s3m4p|0,0,0,1|4|2|38");
			SAFETY_VALUE = 1; //Doesn't work without changing parameters
			riichiTiles = [null, null, null, getTileFromString("4p")];
			expected = ["4p"];
			break;

		default:
			nextTestcase();
			return;
	}
}

function runExampleTestcase() {
	switch (currentTestStep) {
		case 1:
			logTestcase("Example 1");
			ownHand = getTilesFromString("113m223457p12379s");
			expected = ["3m", "7p"];
			break;

		case 2:
			logTestcase("Example 2");
			ownHand = getTilesFromString("2339m34559p11459s");
			expected = ["9m", "9p", "9s"];
			break;

		case 3:
			logTestcase("Example 3");
			ownHand = getTilesFromString("3m35569p12s12477z7s");
			expected = ["1z", "2z", "4z"];
			break;

		case 4:
			logTestcase("Example 4");
			ownHand = getTilesFromString("356778m2348p145s2z");
			expected = ["2z"];
			break;

		case 5:
			logTestcase("Example 5");
			ownHand = getTilesFromString("12456m12567p5s244z");
			expected = ["2z"];
			break;

		case 6:
			logTestcase("Example 6");
			ownHand = getTilesFromString("1237m4569p1267s33z");
			expected = ["9p"];
			break;

		case 7:
			logTestcase("Example 7");
			ownHand = getTilesFromString("112668m5p4479s245z");
			expected = ["2z", "4z", "5z"];
			break;

		default:
			nextTestcase();
			return;
	}
}
