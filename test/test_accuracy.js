// Rules regressions and independent shanten fixtures generated only in CI.
async function runAccuracyRegressionTests() {
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
