// Defensive decisions must use the observing seat and leave live board data intact.
function runDefenseQualityRegressionTests() {
	try {
		for (var players of [4, 3]) {
			baselinePredictionState();
			testExcludedSeats = players == 3 ? [3] : [];
			testPlayerRiichi[0] = 1;
			updateAvailableTiles();
			var tile = getTileFromString("5p");
			assertEqual(getCurrentDangerLevel(0), 0, players + "p: opponents have no tenpai evidence yet");
			assertEqual(getTileDanger(tile, 0), 0, players + "p: own riichi is not an opponent threat");
			for (var perspective = 1; perspective < players; perspective++) {
				var rawDanger = 0;
				for (var opponent = 0; opponent < players; opponent++) {
					if (opponent != perspective) rawDanger += getDealInChanceForTileAndPlayer(opponent, tile, perspective);
				}
				var expectedDanger = rawDanger * Math.min(1, getCurrentDangerLevel(perspective) / 2500);
				assertGreaterThan(expectedDanger, 0, players + "p: another player's discard faces our riichi");
				assertApprox(getTileDanger(tile, perspective), expectedDanger, 1e-12,
					players + "p: push observation uses seat " + perspective + "'s threats");
			}

			baselinePredictionState();
			testExcludedSeats = players == 3 ? [3] : [];
			testPlayerRiichi[1] = 1;
			updateAvailableTiles();
			assertGreaterThan(getTileDanger(tile, 0), 0, players + "p: an opponent's riichi remains dangerous to us");
			assertEqual(getTileDanger(tile, 1), 0, players + "p: the observer's own riichi does not imply pushing into danger");
		}

		baselinePredictionState();
		calls[2] = getTilesFromString("555p");
		calls[2].forEach(function (tile, index) { tile.from = localPosition2Seat(index == 0 ? 1 : 2); });
		calls[2][0].numberOfPlayerHandChanges = [0, 0, 3, 2];
		testPlayerHand[2] = 10;
		updateAvailableTiles();
		var beforeCalls = JSON.stringify(calls);
		var lookup = wasTileCalledFromOtherPlayers(1, getTileFromString("5p"));
		assertTrue(lookup !== calls[2][0], "Called-discard lookup returns a snapshot");
		assertTrue(lookup.numberOfPlayerHandChanges !== calls[2][0].numberOfPlayerHandChanges,
			"Called-discard lookup does not share mutable timing metadata");
		assertGreaterThan(lookup.numberOfPlayerHandChanges[3], 2, "A called tile's untracked timing is treated as uncertain");
		lookup.numberOfPlayerHandChanges[3] = 99;
		assertEqual(calls[2][0].numberOfPlayerHandChanges[3], 2, "Changing a lookup cannot mutate a live call");
		assertEqual(getMostRecentDiscardDanger(getTileFromString("5p"), 1, true), 0,
			"A called-away discard remains permanent genbutsu to its discarder");
		assertEqual(getTileDangerForPlayer(getTileFromString("0p"), 1), 0,
			"Red and normal versions of a called-away discard are both genbutsu");
		assertGreaterThan(getMostRecentDiscardDanger(getTileFromString("5p"), 3, true), 2,
			"Old called-discard timing cannot imply temporary safety for another player");
		for (var player = 0; player < 4; player++) {
			getTotalPossibleWaits(player);
			getExpectedDealInValue(player);
		}
		assertEqual(JSON.stringify(calls), beforeCalls, "Defense analysis leaves live called tiles unchanged");

		delete calls[2][0].numberOfPlayerHandChanges;
		beforeCalls = JSON.stringify(calls);
		lookup = wasTileCalledFromOtherPlayers(1, getTileFromString("5p"));
		assertGreaterThan(lookup.numberOfPlayerHandChanges[3], 0, "Missing called-discard timing is not immediate safety");
		assertEqual(getMostRecentDiscardDanger(getTileFromString("5p"), 1, true), 0,
			"Missing timing never erases the original discarder's furiten");
		assertEqual(JSON.stringify(calls), beforeCalls, "Missing timing is not written back onto live calls");
		runDefenseCacheRegressionTests();
	}
	finally {
		baselinePredictionState();
	}
}

function runDefenseCacheRegressionTests() {
	var originalSeatWind = getSeatWind;
	var originalRoundWind = getRoundWind;
	var originalRoom = getCurrentRoom;
	var originalKita = getNumberOfKitaOfPlayer;
	try {
		baselinePredictionState();
		discards[1] = getTilesFromString("1234m5678p1234s");
		playerDiscardSafetyList[1] = [0, 0, 0];
		updateAvailableTiles();
		var foldingValue = getExpectedDealInValue(1);
		playerDiscardSafetyList[1][1] = 0.2;
		playerDiscardSafetyList[1][2] = 0.2;
		var pushingValue = getExpectedDealInValue(1);
		assertGreaterThan(pushingValue, foldingValue, "Corrected push observations refresh the cached threat value");
		assertApprox(pushingValue, isPlayerTenpai(1) * getExpectedHandValue(1), 1e-12,
			"Cached threat agrees with current evidence without a board update");
		playerDiscardSafetyList[1].push(-1, 0, 0);
		assertApprox(getExpectedDealInValue(1), isPlayerTenpai(1) * getExpectedHandValue(1), 1e-12,
			"New observations replace the recent push window in the cache");

		var room = 4;
		getCurrentRoom = function () { return room; };
		var highRoomValue = getExpectedDealInValue(1);
		room = 1;
		assertGreaterThan(highRoomValue, getExpectedDealInValue(1), "A room change cannot retain the previous tenpai modifier");
		assertApprox(getExpectedDealInValue(1), isPlayerTenpai(1) * getExpectedHandValue(1), 1e-12,
			"Room metadata is reflected in cached threat");
		getCurrentRoom = originalRoom;

		baselinePredictionState();
		testPlayerRiichi[1] = 1;
		getSeatWind = function () { return 2; };
		updateAvailableTiles();
		var nonDealerValue = getExpectedDealInValue(1);
		testPlayerHand[1] = 10;
		assertGreaterThan(nonDealerValue, getExpectedDealInValue(1), "Concealed hand-size changes refresh expected hidden dora");
		assertApprox(getExpectedDealInValue(1), getExpectedHandValue(1), 1e-12, "Cached riichi value uses current concealed hand size");
		testPlayerHand[1] = 13;
		getSeatWind = function () { return 1; };
		assertGreaterThan(getExpectedDealInValue(1), nonDealerValue, "Seat wind changes refresh dealer deal-in value");
		getSeatWind = function () { return 2; };

		baselinePredictionState();
		calls[1] = getTilesFromString("333z");
		discards[1] = getTilesFromString("123456789p");
		testPlayerHand[1] = 10;
		updateAvailableTiles();
		var oldWindValue = getExpectedDealInValue(1);
		roundWind = 3;
		assertGreaterThan(getExpectedDealInValue(1), oldWindValue, "Round wind changes refresh exposed yakuhai value");

		baselinePredictionState();
		testExcludedSeats = [3];
		testPlayerRiichi[1] = 1;
		var kita = 0;
		getNumberOfKitaOfPlayer = function (player) { return player == 1 ? kita : 0; };
		updateAvailableTiles();
		var noKitaValue = getExpectedDealInValue(1);
		kita = 1;
		assertGreaterThan(getExpectedDealInValue(1), noKitaValue, "A new extracted north refreshes three-player deal-in value");
		assertApprox(getExpectedDealInValue(1), getExpectedHandValue(1), 1e-12, "Riichi plus kita uses the current hand value");
		getNumberOfKitaOfPlayer = originalKita;

		baselinePredictionState();
		testPlayerHand[1] = 2;
		updateAvailableTiles();
		var middle = getTileFromString("5p");
		var twoTileWait = getWaitScoreForTileAndPlayer(1, middle, true);
		var twoTileDanger = getTileDangerForPlayer(middle, 1);
		getTotalPossibleWaits(1);
		testPlayerHand[1] = 1;
		assertGreaterThan(twoTileWait, getWaitScoreForTileAndPlayer(1, middle, true),
			"A single concealed tile cannot be waiting on a sequence");
		assertGreaterThan(twoTileDanger, getTileDangerForPlayer(middle, 1), "Tile danger refreshes when concealed hand size changes");
		var oneTileTotal = getTotalPossibleWaits(1);
		invalidateDefenseRuntimeCache();
		assertApprox(getTotalPossibleWaits(1), oneTileTotal, 1e-12,
			"Total wait normalization uses the same hand-size metadata as individual waits");

		baselinePredictionState();
		testPlayerRiichi[1] = 1;
		updateAvailableTiles();
		var beforeRiichiTile = getTileDangerForPlayer(middle, 1);
		getTotalPossibleWaits(1);
		riichiTiles[1] = getTileFromString("4p");
		assertApprox(getTileDangerForPlayer(middle, 1), beforeRiichiTile * 1.1, 1e-12,
			"Learning the riichi discard refreshes the nearby-tile adjustment");
		var afterRiichiTotal = getTotalPossibleWaits(1);
		invalidateDefenseRuntimeCache();
		assertApprox(getTotalPossibleWaits(1), afterRiichiTotal, 1e-12, "Riichi metadata also refreshes wait normalization");
		riichiTiles[1].type = 2;
		assertApprox(getTileDangerForPlayer(middle, 1), beforeRiichiTile, 1e-12,
			"Correcting an existing riichi tile refreshes danger without changing an array length");

		baselinePredictionState();
		var liveRound = 1;
		getRoundWind = function () { return liveRound; };
		updateAvailableTiles();
		var west = getTileFromString("3z");
		var ordinaryHonorDanger = getTileDangerForPlayer(west, 1);
		getTotalPossibleWaits(1);
		liveRound = 3;
		assertApprox(getTileDangerForPlayer(west, 1), ordinaryHonorDanger * 1.1, 1e-12,
			"Live round-wind metadata refreshes the yakuhai danger adjustment");
		var roundTotal = getTotalPossibleWaits(1);
		invalidateDefenseRuntimeCache();
		assertApprox(getTotalPossibleWaits(1), roundTotal, 1e-12, "Round-wind danger and normalization refresh together");

		baselinePredictionState();
		updateAvailableTiles();
		var man = getTileFromString("5m");
		assertGreaterThan(getTileDangerForPlayer(man, 1), 0, "Four-player middle manzu are possible waits");
		testExcludedSeats = [3];
		assertEqual(getTileDangerForPlayer(man, 1), 0, "Changing table size cannot reuse four-player manzu waits");
	}
	finally {
		getSeatWind = originalSeatWind;
		getRoundWind = originalRoundWind;
		getCurrentRoom = originalRoom;
		getNumberOfKitaOfPlayer = originalKita;
		baselinePredictionState();
	}
}
