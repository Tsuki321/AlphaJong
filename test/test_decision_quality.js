// Call restrictions and concealed-triplet scoring. WRC Rules 2025 describes
// kuikae and ron-completed triplets; the Mahjong Soul operation fixture in
// unity_state.test.mjs also supplies 3m/6m as forbidden after calling 3m on 45m.
// https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf
async function runDecisionQualityRegressionTests() {
	runKuikaeRuleRegressionTests();
	runConcealedTripletRegressionTests();
	await runLegalCallDiscardRegressionTest();
	runTsumoOnlyWaitRegressionTest();
	baselinePredictionState();
}

function runKuikaeRuleRegressionTests() {
	baselinePredictionState();
	// Independent oracle: a swap exists exactly when the discarded tile could
	// complete another sequence with the same two tiles taken from the hand.
	for (var type = 0; type < 3; type++) {
		for (var start = 1; start <= 7; start++) {
			var sequence = [0, 1, 2].map(offset => ({ type: type, index: start + offset }));
			for (var calledIndex = 0; calledIndex < 3; calledIndex++) {
				var called = sequence[calledIndex];
				var held = sequence.filter((tile, index) => index != calledIndex);
				for (var reverse = 0; reverse < 2; reverse++) {
					var input = reverse ? held.slice().reverse() : held;
					for (var rank = 1; rank <= 9; rank++) {
						var candidate = { type: type, index: rank };
						var replacement = held.concat(candidate).map(tile => tile.index).sort((a, b) => a - b);
						var expected = rank == called.index ||
							(replacement[0] + 1 == replacement[1] && replacement[1] + 1 == replacement[2]);
						assertEqual(isKuikaeDiscard(candidate, input, called), expected,
							"Kuikae " + type + ":" + start + " call " + called.index + " discard " + rank + " reverse " + reverse);
					}
					assertEqual(isKuikaeDiscard({ type: (type + 1) % 3, index: called.index }, input, called), false,
						"Kuikae never prohibits a different suit");
				}
			}
		}
	}
	assertTrue(isKuikaeDiscard(getTileFromString("0m"), getTilesFromString("67m"), getTileFromString("5m")),
		"A red five cannot evade a normal-five kuikae restriction");
	assertTrue(isKuikaeDiscard(getTileFromString("5m"), getTilesFromString("34m"), getTileFromString("0m")),
		"A normal five cannot evade a red-five kuikae restriction");
	assertTrue(isKuikaeDiscard(getTileFromString("1z"), getTilesFromString("11z"), getTileFromString("1z")),
		"Pon forbids discarding the called honor");
	assertEqual(isKuikaeDiscard(getTileFromString("4z"), getTilesFromString("11z"), getTileFromString("1z")), false,
		"Honor indices cannot form a kuikae sequence");
}

function runConcealedTripletRegressionTests() {
	baselinePredictionState();
	var groups = getTilesFromString("222m444p666s123m");
	var pair = getTilesFromString("77z");
	var hand = groups.concat(pair);
	var decomposition = { triples: groups, pairs: pair };
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("6s")).closed, 0,
		"Ron on the third concealed triplet does not supply sanankou");
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("6s"), false).closed, 2,
		"Self draw of the same tile supplies sanankou");
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("1m")).closed, 2,
		"Ron completing a sequence preserves three concealed triplets");
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("7z")).closed, 2,
		"Ron completing the pair preserves three concealed triplets");
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("2m")).closed, 2,
		"An ambiguous ron may complete the sequence instead of opening the triplet");
	isConsideringCall = true;
	assertEqual(getYaku(hand, [], decomposition).closed, 2,
		"Considering a call preserves the prospective value of already concealed triplets");
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("1m")).closed, 2,
		"A simulated call does not erase concealed triplets unrelated to that call");
	assertEqual(getYaku(hand, [], decomposition, getTileFromString("6s")).closed, 0,
		"Ron context still opens its triplet while considering a call");
	isClosed = false;
	var afterPon = getTilesFromString("222m444p123m77z");
	assertEqual(getYaku(afterPon, getTilesFromString("666s")).open, 0,
		"Calling the third triplet leaves only two concealed triplets and no sanankou");
	assertEqual(getYaku(afterPon, getTilesFromString("666s"), null, getTileFromString("1m")).open, 0,
		"Sequence ron cannot make an already called triplet concealed");

	baselinePredictionState();
	var kan = getTilesFromString("2222m").map((tile, index) => ({ ...tile, kan: index == 3, from: 0 }));
	groups = getTilesFromString("444p666s123p");
	hand = groups.concat(pair);
	decomposition = { triples: groups, pairs: pair };
	assertEqual(getYaku(hand, kan, decomposition, getTileFromString("6s")).closed, 0,
		"Two concealed groups plus a ron-completed triplet do not make sanankou");
	assertEqual(getYaku(hand, kan, decomposition, getTileFromString("6s"), false).closed, 2,
		"A concealed kan contributes to sanankou on self draw");
	assertEqual(getYaku(hand, kan, decomposition, getTileFromString("3p")).closed, 2,
		"A concealed kan contributes to sanankou on a sequence ron");
	kan[0].from = 1;
	isClosed = false;
	assertEqual(getYaku(hand, kan, decomposition, getTileFromString("3p")).open, 0,
		"An open kan cannot supply a missing concealed triplet");

	groups = getTilesFromString("222m444p666s888s");
	hand = groups.concat(pair);
	assertEqual(getYaku(hand, [], { triples: groups, pairs: pair }, getTileFromString("6s")).open, 4,
		"Ron leaves three of four triplets concealed, retaining sanankou and toitoi");

	// A two-draw branch has one extra tile to discard. A tile left outside its
	// selected complete shape cannot be the winner, even when the shape has yaku.
	var unrelated = getTileFromString("9p");
	decomposition = { triples: groups, pairs: pair };
	for (var ron of [true, false]) {
		var impossibleWin = getYaku(hand.concat(unrelated), [], decomposition, unrelated, ron);
		assertEqual(impossibleWin.open, 0, "An unused extra tile cannot complete an open " + (ron ? "ron" : "tsumo"));
		assertEqual(impossibleWin.closed, 0, "An unused extra tile cannot complete a closed " + (ron ? "ron" : "tsumo"));
	}
	assertEqual(getYaku(hand.concat(unrelated), [], decomposition).open, 4,
		"A context-free estimate still recognizes the selected shape's yaku");
	groups = getTilesFromString("111m333s555p");
	pair = getTilesFromString("44z");
	assertEqual(getYaku(groups.concat(pair, getTileFromString("1p")), getTilesFromString("123p"),
		{ triples: groups, pairs: pair }, getTileFromString("1p")).open, 0,
		"A winning tile found only in an already called sequence cannot complete the concealed hand");
}

async function runLegalCallDiscardRegressionTest() {
	baselinePredictionState();
	var originalValues = getHandValues;
	var originalPriorities = getTilePriorities;
	var originalSafety = sortOutUnsafeTiles;
	var originalSend = makeCallWithOption;
	var originalDecline = declineCall;
	var chosenDiscard = null;
	var sentOption = null;
	var declines = 0;
	try {
		ownHand = getTilesFromString("3456m444p666s559p");
		// Out-of-turn permissions belong to the current operation. Simulated
		// future discards need new permissions, without mutating the live tiles.
		ownHand.forEach(tile => { tile.valid = false; });
		var originalHand = JSON.stringify(ownHand);
		testCallTile = getTileFromString("3m");
		getHandValues = (hand, discarded) => {
			if (discarded) chosenDiscard = getTileName(discarded);
			return { shanten: discarded ? 0 : 1, priority: 100, waits: discarded ? 4 : 0,
				score: { open: 8000, closed: 3000, riichi: 4000 }, yaku: { open: 1, closed: 1 } };
		};
		getTilePriorities = async hand => {
			assertTrue(hand.filter(tile => ["3m", "6m"].includes(getTileName(tile))).every(tile => tile.valid === false),
				"Both forbidden ends are excluded before ranking simulated discards");
			var order = ["3m", "6m", "9p"];
			return hand.filter(tile => tile.valid !== false).map(tile => ({ tile: tile, safe: 1,
				yaku: { open: 1 }, priority: 100 - (order.includes(getTileName(tile)) ? order.indexOf(getTileName(tile)) : 10) }))
				.sort((a, b) => b.priority - a.priority);
		};
		sortOutUnsafeTiles = tiles => tiles;
		makeCallWithOption = (operation, option) => { sentOption = option; };
		declineCall = () => { declines++; };
		assertTrue(await callTriple(["4m|5m"], 2), "A favorable call can use its best legal discard");
		assertEqual(chosenDiscard, "9p", "Call simulation chooses the legal alternative to forbidden 3m/6m");
		assertEqual(sentOption, 0, "The legal call option is sent");
		assertEqual(declines, 0, "The call is not declined because an illegal discard ranked first");
		assertEqual(JSON.stringify(ownHand), originalHand, "Call simulation preserves every live tile permission");
		assertEqual(calls[0].length, 0, "Call simulation restores live melds");
		assertTrue(isClosed, "Call simulation restores live hand closure");
	}
	finally {
		getHandValues = originalValues;
		getTilePriorities = originalPriorities;
		sortOutUnsafeTiles = originalSafety;
		makeCallWithOption = originalSend;
		declineCall = originalDecline;
		baselinePredictionState();
	}
}

function runTsumoOnlyWaitRegressionTest() {
	baselinePredictionState();
	var originalQuality = getWaitQuality;
	try {
		getWaitQuality = () => 1;
		isClosed = false;
		calls[0] = getTilesFromString("123p");
		var hand = getTilesFromString("111m333s55p44z");
		var discard = getTileFromString("9m");
		ownHand = hand.concat(discard);
		updateAvailableTiles();
		for (var mode = 0; mode <= 4; mode++) {
			PERFORMANCE_MODE = mode;
			var value = getHandValues(hand, discard);
			assertEqual(value.shanten, 0, "Self-draw-only sanankou is structurally tenpai at mode " + mode);
			assertEqual(value.ukeire, 4, "Both shanpon waits remain structurally live at mode " + mode);
			assertApprox(value.waits, (4 / 6) * 1.05, 1e-12, "Self-draw-only waits receive the tsumo weight at mode " + mode);
			assertEqual(value.shape, 0, "An unused second draw cannot invent a ron improvement at mode " + mode);
			assertTrue(Number.isFinite(value.priority), "Self-draw-only priority remains finite at mode " + mode);
		}
		// One dragon pair supplies yakuhai on ron while the suited triplet wait
		// still relies on self draw. Do not downgrade the legal dragon wait.
		hand = getTilesFromString("111m333s55p77z");
		ownHand = hand.concat(discard);
		updateAvailableTiles();
		var mixed = getHandValues(hand, discard);
		assertApprox(mixed.waits, (2 + 2 / 6) * 1.05, 1e-12, "Only the wait without a ron yaku is discounted");
		assertGreaterThan(mixed.waits, (4 / 6) * 1.05, "A yakuhai ron option improves the same shanpon shape");
	}
	finally {
		getWaitQuality = originalQuality;
		baselinePredictionState();
	}
	runFuritenScoringContextRegressionTests();
}

function runFuritenScoringContextRegressionTests() {
	var originalYaku = getYaku;
	var originalFu = calculateFu;
	var originalQuality = getWaitQuality;
	var yakuContexts = [], fuContexts = [];
	try {
		getWaitQuality = () => 1;
		getYaku = function (hand, melds, decomposition, winningTile, ron = true) {
			var result = originalYaku(hand, melds, decomposition, winningTile, ron);
			if (winningTile) yakuContexts.push({ size: hand.length, winner: getTileName(winningTile), ron: ron, yaku: result.open });
			return result;
		};
		calculateFu = function (triples, melds, pair, wait, winningTile, ron = true) {
			var result = originalFu(triples, melds, pair, wait, winningTile, ron);
			if (getNumberOfTilesInTileArray(triples, 7, 3) == 3 && pair.length == 2 &&
				pair[0].type == 0 && pair[0].index == 5 && winningTile && winningTile.type == 3 && winningTile.index == 7) {
				fuContexts.push({ ron: ron, fu: result });
			}
			return result;
		};

		for (var secondDraw of [false, true]) {
			baselinePredictionState();
			isClosed = false;
			calls[0] = getTilesFromString("123p");
			// 5p/7z shanpon is globally furiten after discarding 5p. Completing
			// 777z by self draw gives sanankou plus yakuhai: 3 han and 50 fu.
			// With one held 5p and an extra 9s, both 5p and 7z must first arrive.
			var hand = getTilesFromString(secondDraw ? "111m333s5p77z9s" : "111m333s55p77z");
			var discard = getTileFromString("9m");
			discards[0] = getTilesFromString("5p");
			ownHand = hand.concat(discard);
			updateAvailableTiles();
			yakuContexts = [];
			fuContexts = [];
			var value = getHandValues(hand, discard);
			var branch = secondDraw ? "second draw" : "first draw";
			assertEqual(value.shanten, secondDraw ? 1 : 0, "Furiten fixture has the intended distance before its " + branch);
			assertTrue(yakuContexts.some(context => context.size == (secondDraw ? 12 : 11) &&
				context.winner == "7z" && context.ron === false && context.yaku == 3),
				"Furiten " + branch + " scores yakuhai together with the self-drawn third concealed triplet");
			assertGreaterThan(fuContexts.length, 0, "The completed dragon triplet is evaluated on the " + branch);
			assertTrue(fuContexts.every(context => context.ron === false && context.fu == 50),
				"Furiten " + branch + " uses the self-draw 50 fu instead of ron 40 fu");
			if (!secondDraw) {
				assertTrue(value.furiten, "Discarding either side of shanpon prevents ron on both sides");
				assertApprox(value.waits, (3 / 6) * 1.05, 1e-12, "Both mixed-yaku waits keep only their self-draw weight when furiten");
			}
		}
	}
	finally {
		getYaku = originalYaku;
		calculateFu = originalFu;
		getWaitQuality = originalQuality;
		baselinePredictionState();
	}
}
