// Rules regressions and independent shanten fixtures generated only in CI.
async function runAccuracyRegressionTests() {
	runMeldScoringRegressionTests();
	runDefenseSafetyRegressionTests();
	baselinePredictionState();
	assertEqual(getStandardShanten(getTilesFromString("123m456p789s11122z")), -1, "Complete regular hand");
	assertEqual(getStandardShanten(getTilesFromString("123m456p789s1112z")), 0, "Single-tile wait");
	assertEqual(getStandardShanten(getTilesFromString("1122334455667m")), 0, "Overlapping sequences preserve tenpai");
	assertEqual(getStandardShanten(getTilesFromString("222333444m1111z")), 1, "A fifth honor cannot complete a pair");
	assertEqual(getStandardShanten(getTilesFromString("1111222233344z")), 2, "Two honor quads need two replacements");
	assertEqual(getSevenPairsShanten(getTilesFromString("111122m334455p6s")), 2, "Seven pairs needs seven distinct tile kinds");
	assertEqual(getStandardShanten(getTilesFromString("456p789s11122z"), getTilesFromString("123m")), -1, "Fixed meld is counted once");
	assertEqual(getSevenPairsShanten(getTilesFromString("11223344556p"), getTilesFromString("1111z")), Infinity, "Kan rules out seven pairs");
	assertEqual(getThirteenOrphansShanten(getTilesFromString("19m19p19s1234567z"), getTilesFromString("1111z")), Infinity, "Kan rules out kokushi");
	for (var mode = 0; mode <= 4; mode++) {
		PERFORMANCE_MODE = mode;
		assertEqual(getStandardShanten(getTilesFromString("1122334455667m")), 0, "Exact shanten is independent of performance mode " + mode);
	}
	PERFORMANCE_MODE = 4;
	assertApprox(getDrawHitProbability(10, 2, 2), 17 / 45, 1e-12, "Draw probability samples without replacement");
	assertEqual(getDrawHitProbability(0, 0, 2), 0, "Empty pool has no improvement chance");
	assertEqual(getDrawHitProbability(3, 1, 5), 1, "Drawing the entire pool finds every useful tile");
	assertEqual(getTileName(removeTilesFromTileArray(getTilesFromString("05m"), getTilesFromString("5m"))[0]), "0m", "Removing a normal five preserves the red five");
	assertEqual(getTileName(removeTilesFromTileArray(getTilesFromString("05m"), getTilesFromString("0m"))[0]), "5m", "Removing a red five preserves the normal five");

	baselinePredictionState();
	var readyHand = getTilesFromString("123m456p123s77z45s");
	ownHand = readyHand.concat(getTileFromString("9m"));
	discards[0] = getTilesFromString("333s");
	updateAvailableTiles();
	var analysis = getImprovingTileAnalysis(readyHand, getTileFromString("9m"));
	assertEqual(analysis.shanten, 0, "Ryanmen hand is tenpai");
	assertEqual(analysis.ukeire, 4, "Dead end of a two-sided wait adds no live copies");
	assertEqual(analysis.structuralWaits.length, 2, "Dead wait is retained for furiten checking");
	assertTrue(analysis.furiten, "A discarded dead wait makes all ron waits furiten");
	assertApprox(analysis.improvementChance, 4 / availableTiles.length, 1e-12, "One-draw estimate uses unseen copies");

	baselinePredictionState();
	ownHand = getTilesFromString("19m19p19s1234567z2m");
	strategy = STRATEGIES.THIRTEEN_ORPHANS;
	updateAvailableTiles();
	var kokushi = thirteenOrphansPriorities().find(candidate => getTileName(candidate.tile) == "2m");
	assertEqual(kokushi.shanten, 0, "Thirteen-sided kokushi wait is tenpai");
	assertEqual(kokushi.ukeire, 39, "Thirteen-sided kokushi wait counts every remaining orphan");
	assertEqual(kokushi.waits, 39, "Thirteen-sided wait does not dereference a missing tile");
	assertTrue(Number.isFinite(kokushi.priority), "Kokushi produces a finite priority");

	baselinePredictionState();
	ownHand = getTilesFromString("1122m3344p5566s77z");
	strategy = STRATEGIES.CHIITOITSU;
	updateAvailableTiles();
	var sevenPairs = chiitoitsuPriorities().find(candidate => getTileName(candidate.tile) == "7z");
	assertEqual(sevenPairs.shanten, 0, "Discard from seven completed pairs leaves tenpai");
	assertTrue(sevenPairs.furiten, "Discarded winning pair is furiten for ron");
	assertGreaterThan(sevenPairs.waits, 0, "Furiten seven pairs retains self-draw potential");

	baselinePredictionState();
	var originalSeatWind = getSeatWind;
	try {
		getSeatWind = () => 2;
		for (let example of [[1, 30, 1000], [3, 70, 8000], [4, 40, 8000], [7, 30, 12000], [10, 30, 16000], [12, 30, 24000], [13, 30, 32000]]) {
			assertEqual(calculateScore(0, example[0], example[1]), example[2], "Legal ron payment for " + example[0] + " han " + example[1] + " fu");
		}
		assertEqual(calculateScore(0, 4.5, 40), 8000, "Interpolation cannot exceed mangan between two mangan hands");
		testExcludedSeats = [3];
		assertEqual(calculateScore(0, 5), 8000, "Sanma ron is not reduced by a tsumo multiplier");
		getSeatWind = () => 1;
		assertEqual(calculateScore(0, 1, 30), 1500, "Dealer rounding applies to the full ron payment");
	}
	finally { getSeatWind = originalSeatWind; }

	baselinePredictionState();
	var originalOperations = getOperationList;
	var originalOperationTypes = getOperations;
	var originalShouldRiichi = shouldRiichi;
	var originalSendRiichi = sendRiichiCall;
	var sentTile = null;
	try {
		ownHand = getTilesFromString("12m");
		getOperationList = () => [{ type: 7, combination: ["1m", "2m"] }];
		getOperations = () => ({ liqi: 7 });
		shouldRiichi = () => true;
		sendRiichiCall = tile => { sentTile = tile; };
		assertTrue(callRiichi([{ tile: ownHand[0], safe: 0 }, { tile: ownHand[1], safe: 1 }]), "Safe riichi option is available");
		assertEqual(sentTile, "2m", "Riichi cannot bypass a discard's safety rejection");
	}
	finally {
		getOperationList = originalOperations;
		getOperations = originalOperationTypes;
		shouldRiichi = originalShouldRiichi;
		sendRiichiCall = originalSendRiichi;
	}

	baselinePredictionState();
	testCallTile = getTileFromString("1p");
	await withSimulatedCallState(getTilesFromString("11p"), async () => {
		strategy = STRATEGIES.FOLD;
		strategyAllowsCalls = false;
	});
	assertEqual(strategy, STRATEGIES.GENERAL, "Call simulation restores strategy");
	assertTrue(strategyAllowsCalls, "Call simulation restores permission to call");
	assertEqual(calls[0].length, 0, "Call simulation restores melds");
	assertTrue(isClosed, "Call simulation restores hand closure");

	baselinePredictionState();
	if (Array.isArray(window.__ALPHAJONG_SHANTEN_REFERENCE)) {
		for (let fixture of window.__ALPHAJONG_SHANTEN_REFERENCE) {
			var hand = getTilesFromString(fixture.hand);
			assertEqual(getStandardShanten(hand, []), fixture.standard, "Reference regular shanten: " + fixture.hand);
			assertEqual(getSevenPairsShanten(hand, []), fixture.sevenPairs, "Reference seven-pairs shanten: " + fixture.hand);
			assertEqual(getThirteenOrphansShanten(hand, []), fixture.kokushi, "Reference kokushi shanten: " + fixture.hand);
		}
	}
	baselinePredictionState();
}

// Rule cases: https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf (fu and yaku).
// Mahjong Soul's double-wind pair uses 4 fu; WRC's 2-fu option is not used here.
function runMeldScoringRegressionTests() {
	baselinePredictionState();
	assertEqual(getMeldCount(getTilesFromString("1111m2222p3333s")), 3, "Three kans are three melds");
	assertEqual(getMeldCount(getTilesFromString("1111m2222p3333s4444z")), 4, "Four kans are four melds");
	assertEqual(getMeldCount(getTilesFromString("111123m")), 2, "A triplet followed by a sequence is not a kan");
	assertEqual(getStandardShanten(getTilesFromString("456s77z"), getTilesFromString("1111m2222p3333z")), -1, "Three fixed kans leave one meld and a pair");
	readDebugString(["6z", "123m456p789s11122z", "", "1111m2222p3333s", "", "", "", "", "", "", "0,0,0,0", "2", "1", "50"].join("|"));
	assertEqual(getNumberOfTilesInHand(1), 4, "Debug hands subtract three concealed tiles per kan");
	baselinePredictionState();

	var liveKan = getTilesFromString("1111m").map((tile, i) => ({ ...tile, kan: i == 3, from: 0 }));
	assertEqual(getMelds(liveKan.concat(getTilesFromString("234p")))[0].length, 4, "A marked kan keeps its fourth tile");
	assertEqual(getMeldCount(getTilesFromString("123m").concat(liveKan)), 2, "A marked kan after a chi preserves both melds");

	var sequences = getTilesFromString("123123123m456p");
	var triplets = getTilesFromString("111222333m456p");
	var pair = getTilesFromString("77s");
	assertEqual(getYaku(sequences.concat(pair), [], { triples: sequences, pairs: pair }).closed, 1, "Sequence interpretation has iipeikou without sanankou");
	assertEqual(getYaku(triplets.concat(pair), [], { triples: triplets, pairs: pair }).closed, 2, "Triplet interpretation has sanankou without iipeikou");
	isClosed = false;
	assertEqual(getYaku(getTilesFromString("456p77s"), getTilesFromString("111222333m")).open, 0, "Fixed pons cannot be rearranged into sequence yaku");
	var dragonTriples = getTilesFromString("234s555666z");
	var dragonPair = getTilesFromString("77z");
	assertEqual(getYaku(dragonTriples.concat(dragonPair, getTileFromString("7z")), getTilesFromString("123m"),
		{ triples: dragonTriples, pairs: dragonPair }).open, 4, "An unused dragon cannot turn shousangen into daisangen");
	assertEqual(getYaku([]).closed, 0, "Empty hand has no yaku");
	assertEqual(getHonitsu([]).open, 0, "Empty hand has no half flush");
	assertEqual(getChinitsu([]).closed, 0, "Empty hand has no full flush");

	baselinePredictionState();
	var flushTriples = getTilesFromString("123456789234m");
	var flushPair = getTilesFromString("55m");
	assertEqual(getYaku(flushTriples.concat(flushPair, getTileFromString("9p")), [],
		{ triples: flushTriples, pairs: flushPair }).closed, 8, "An unused off-suit draw cannot erase chinitsu and ittsuu");
	var honorKan = getTilesFromString("1111z").map((tile, i) => ({ ...tile, kan: i == 3, from: 0 }));
	var kanHand = getTilesFromString("222p333s456m77p");
	assertEqual(getYaku(kanHand, honorKan).closed, 3, "Concealed kan counts toward sanankou plus yakuhai");
	honorKan[0].from = 1;
	isClosed = false;
	assertEqual(getYaku(kanHand, honorKan).open, 1, "Open kan cannot supply the third concealed triplet");

	var terminalTriplets = getTilesFromString("111999m111p111z");
	var honorPair = getTilesFromString("22z");
	assertEqual(getChanta(terminalTriplets, [], honorPair).open, 0, "Chanta requires a sequence");
	assertEqual(getJunchan(terminalTriplets, [], honorPair).closed, 0, "Junchan requires a sequence");
	assertEqual(getHonrou(terminalTriplets, honorPair).open, 2, "All terminals and honors scores honroutou");
	strategy = STRATEGIES.CHIITOITSU;
	assertEqual(getYaku(getTilesFromString("1199m1199p11s2233z")).closed, 2, "Seven pairs can also have honroutou");

	baselinePredictionState();
	var fuSequences = getTilesFromString("123m456p789s234s");
	var fuPair = getTilesFromString("55p");
	assertEqual(calculateFu(fuSequences, [], fuPair, [], getTileFromString("4s")), 30, "Pinfu ron is 30 fu");
	assertEqual(calculateFu(fuSequences, [], fuPair, [], getTileFromString("4s"), false), 20, "Pinfu tsumo stays at 20 fu");
	assertEqual(calculateFu(fuSequences, [], fuPair, [], getTileFromString("7s")), 40, "Edge wait prevents pinfu");
	assertEqual(calculateFu(fuSequences, [], fuPair, [], getTileFromString("7s"), false), 30, "Non-pinfu tsumo receives two fu");
	assertEqual(calculateFu([], [], getTilesFromString("1122m3344p5566s77z"), [], getTileFromString("7z")), 25, "Seven pairs has a fixed 25 fu");
	seatWind = roundWind = 1;
	assertEqual(calculateFu(getTilesFromString("222m345p456s789s"), [], getTilesFromString("11z"), [], getTileFromString("4p")), 40, "Double-wind pair is counted with the middle wait");

	baselinePredictionState();
	honorKan = getTilesFromString("1111z").map((tile, i) => ({ ...tile, kan: i == 3, from: 0 }));
	var fuTriples = getTilesFromString("333m456p789s");
	assertEqual(calculateFu(fuTriples, honorKan, getTilesFromString("22p"), [], getTileFromString("9s")), 70, "Concealed honor kan contributes 32 fu");
	assertEqual(calculateFu(fuTriples, honorKan, getTilesFromString("22p"), [], getTileFromString("9s"), false), 60, "Concealed honor kan on tsumo uses concealed fu");
	honorKan[0].from = 1;
	isClosed = false;
	assertEqual(calculateFu(fuTriples, honorKan, getTilesFromString("22p"), [], getTileFromString("9s")), 40, "Open honor kan contributes 16 fu");
	assertEqual(calculateFu(fuTriples, honorKan, getTilesFromString("22p"), [], getTileFromString("9s"), false), 50, "Open hand tsumo receives its two fu");
	var simpleKan = getTilesFromString("7777s").map((tile, i) => ({ ...tile, kan: i == 3, from: 1 }));
	assertEqual(calculateFu(getTilesFromString("222234m456p"), simpleKan, getTilesFromString("33z"), [], getTileFromString("2m")), 40, "Ambiguous ron can complete the sequence and keep the triplet concealed");

	assertEqual(calculateScoreWithYaku(0, 0, 6), 0, "Six dora cannot make a no-yaku hand legal");
	assertGreaterThan(calculateScoreWithYaku(0, 1, 2), 0, "Dora increases the value of a hand with yaku");
	isClosed = true;
	assertGreaterThan(calculateTilePriority(0.5, { open: 0, closed: 0 }, 0), 0, "Closed progress toward riichi retains decision value");
	var noDoraPriority = calculateTilePriority(0.5, { open: 0, closed: 0, riichi: 1000 }, 0);
	assertGreaterThan(calculateTilePriority(0.5, { open: 0, closed: 0, riichi: 3900 }, 0), noDoraPriority,
		"Equal closed progress preserves dora value through a future riichi");
	isClosed = false;
	assertEqual(calculateTilePriority(0.5, { open: 0, closed: 0, riichi: 3900 }, 0), 0, "Open no-yaku progress cannot borrow riichi value");
	tilesLeft = 1;
	assertGreaterThan(calculateTilePriority(0.5, { open: 0, closed: 0 }, 0), 0, "Exhaustive-draw tenpai remains valuable without a yaku");

	baselinePredictionState();
	isClosed = false;
	calls[0] = getTilesFromString("123m");
	var noYakuHand = getTilesFromString("456p123s77z45s");
	ownHand = noYakuHand.concat(getTileFromString("9m"));
	dora = getTilesFromString("6z");
	updateAvailableTiles();
	var value = getHandValues(noYakuHand, getTileFromString("9m"));
	assertEqual(value.shanten, 0, "No-yaku hand can be structurally tenpai");
	assertGreaterThan(value.ukeire, 0, "Structural waits remain visible without a yaku");
	assertEqual(value.waits, 0, "Dora-only open waits are not winning waits");
	// score estimates improvements over two draws. Drawing 7z and 4s, then
	// discarding 5s, gives 123m 456p 123s 777z 44s with a legal yakuhai.
	assertGreaterThan(value.score.open, 0, "A future dragon triplet can give the hand a legal score");
	for (let wait of ["3s", "6s"]) {
		var completed = noYakuHand.concat(getTileFromString(wait));
		assertEqual(getYaku(completed, calls[0]).open, 0, "Current " + wait + " wait has no yaku");
		assertEqual(calculateScoreWithYaku(0, getYaku(completed, calls[0]).open,
			getNumberOfDoras(completed.concat(calls[0]))), 0, "Dora cannot pay a no-yaku " + wait + " ron");
	}
	// Make both remaining dragons visible so that two draws cannot create
	// yakuhai either. Existing structural waits still have no legal payment.
	discards[1] = getTilesFromString("77z");
	updateAvailableTiles();
	value = getHandValues(noYakuHand, getTileFromString("9m"));
	assertEqual(value.waits, 0, "Dead yakuhai improvements do not create winning waits");
	assertEqual(value.score.open, 0, "No-yaku hand has no future score when its yakuhai tiles are dead");
	baselinePredictionState();
}

function runDefenseSafetyRegressionTests() {
	baselinePredictionState();
	calls[1] = getTilesFromString("1111m2222p3333s");
	discards[1] = getTilesFromString("456789p");
	updateAvailableTiles();
	assertLessThan(isPlayerTenpai(1), 1, "Three kans do not imply four-meld tenpai");
	assertApprox(getConfidenceInYakuPrediction(1), 0.9, 1e-12, "Kan count drives meld confidence once per meld");

	baselinePredictionState();
	discards[1] = getTilesFromString("123456789p12345s");
	updateAvailableTiles();
	var connectedChance = isPlayerTenpai(1);
	var originalLinkState = getPlayerLinkState;
	try {
		getPlayerLinkState = () => 0;
		assertGreaterThan(connectedChance, 0, "Late concealed hand has tenpai risk");
		assertEqual(isPlayerTenpai(1), connectedChance, "Disconnection does not erase tenpai risk");
	}
	finally { getPlayerLinkState = originalLinkState; }

	baselinePredictionState();
	discards[2] = getTilesFromString("5p");
	assertGreaterThan(getMostRecentDiscardDanger(getTileFromString("5p"), 1, true), 0, "Missing discard timing is unknown, not genbutsu");
	discards[2][0].numberOfPlayerHandChanges = [0, 0, 0, 0];
	assertEqual(getMostRecentDiscardDanger(getTileFromString("5p"), 1, true), 0, "Known post-change discard remains safe");
	availableTiles = [];
	assertTrue(Number.isFinite(getExpectedDoraInHand(1)), "Empty unseen pool cannot divide by zero");
	playerDiscardSafetyList[1] = [-1, -1, -1];
	assertEqual(isPlayerPushing(1), 0, "Unknown observations do not imply folding");
	baselinePredictionState();
}
