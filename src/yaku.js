//################################
// YAKU
// Contains the yaku calculations
//################################

//Returns the closed and open yaku value of the hand
function getYaku(inputHand, inputCalls = [], triplesAndPairs = null, winningTile = null, ron = true) {
	var callMelds = getMelds(inputCalls);
	var kanCount = callMelds.filter(meld => meld.length == 4).length;

	//Remove 4th tile from Kans, which could lead to false yaku calculation
	var filteredCalls = callMelds.flatMap(meld => meld.slice(0, 3));

	var yakuOpen = 0;
	var yakuClosed = 0;


	// ### 1 Han ###

	if (triplesAndPairs == null) { //Can be set as a parameter to save calculation time if already precomputed
		triplesAndPairs = getTriplesAndPairs(inputHand);
	}
	var concealedGroups = getMelds(triplesAndPairs.triples, false);
	// Two-draw simulations can contain a tile that will be discarded. Once a
	// complete decomposition is chosen, only its tiles can contribute yaku.
	var complete = concealedGroups.length + callMelds.length == 4 && triplesAndPairs.pairs.length == 2;
	if (complete && winningTile && !triplesAndPairs.triples.some(tile => isSameTile(tile, winningTile)) &&
		!triplesAndPairs.pairs.some(tile => isSameTile(tile, winningTile))) return { open: 0, closed: 0 };
	var hand = (complete ? triplesAndPairs.triples.concat(triplesAndPairs.pairs) : inputHand).concat(filteredCalls);
	if (hand.length == 0) return { open: 0, closed: 0 };
	triplesAndPairs = {
		triples: triplesAndPairs.triples.concat(filteredCalls),
		pairs: [...triplesAndPairs.pairs]
	};
	// Keep groups from one decomposition; regrouping their flattened tiles can
	// award mutually incompatible sequence and triplet yaku.
	var groups = concealedGroups.concat(callMelds.map(meld => meld.slice(0, 3)));
	var triplets = groups.filter(meld => meld.every(tile => isSameTile(tile, meld[0]))).flat();
	var sequences = groups.filter(meld => !isSameTile(meld[0], meld[1])).flat();

	//Pinfu is applied in ai_offense when fu is 30, same with Riichi.
	//There's no certain way to check for it here, so ignore it

	//Yakuhai
	//Wind/Dragon Triples
	//Open
	if (strategy != STRATEGIES.CHIITOITSU) {
		var yakuhai = getYakuhai(triplesAndPairs.triples);
		yakuOpen += yakuhai.open;
		yakuClosed += yakuhai.closed;
	}

	//Tanyao
	//Open
	var tanyao = getTanyao(hand, triplesAndPairs, filteredCalls);
	yakuOpen += tanyao.open;
	yakuClosed += tanyao.closed;

	//Iipeikou (Identical Sequences in same type)
	//Closed
	if (strategy != STRATEGIES.CHIITOITSU) {
		var ryanpeikou = getRyanpeikou(sequences);
		if (ryanpeikou.closed > 0) {
			yakuOpen += ryanpeikou.open;
			yakuClosed += ryanpeikou.closed;
		}
		else {
			var iipeikou = getIipeikou(sequences);
			yakuOpen += iipeikou.open;
			yakuClosed += iipeikou.closed;
		}

		// ### 2 Han ###

		//Chiitoitsu
		//7 Pairs
		//Closed
		// -> Not necessary, because own strategy

		//Sanankou
		//3 concealed triplets
		//Open*
		var concealedTriplets = concealedGroups.filter(meld => meld.every(tile => isSameTile(tile, meld[0])));
		var concealedKans = callMelds.filter(isConcealedKan).map(meld => meld.slice(0, 3));
		var canCompleteNonTriplet = concealedGroups.some(meld => !isSameTile(meld[0], meld[1]) &&
			meld.some(tile => isSameTile(tile, winningTile))) || isSameTile(triplesAndPairs.pairs[0], winningTile);
		var sanankou = getSanankou(concealedTriplets.concat(concealedKans).flat(), winningTile, ron, canCompleteNonTriplet);
		yakuOpen += sanankou.open;
		yakuClosed += sanankou.closed;

		//Sankantsu
		//3 Kans
		//Open
		var sankantsu = getSankantsu(kanCount);
		yakuOpen += sankantsu.open;
		yakuClosed += sankantsu.closed;

		//Toitoi
		//All Triplets
		//Open
		var toitoi = getToitoi(triplets);
		yakuOpen += toitoi.open;
		yakuClosed += toitoi.closed;

		//Sanshoku Doukou
		//3 same index triplets in all 3 types
		//Open
		var sanshokuDouko = getSanshokuDouko(triplets);
		yakuOpen += sanshokuDouko.open;
		yakuClosed += sanshokuDouko.closed;

		//Sanshoku Doujun
		//3 same index straights in all types
		//Open/-1 Han after call
		var sanshoku = getSanshokuDoujun(sequences);
		yakuOpen += sanshoku.open;
		yakuClosed += sanshoku.closed;

		//Shousangen
		//Little 3 Dragons (2 Triplets + Pair)
		//Open
		var shousangen = getShousangen(hand);
		yakuOpen += shousangen.open;
		yakuClosed += shousangen.closed;
	}

	//Chanta
	//Half outside Hand (including terminals)
	//Open/-1 Han after call
	var chanta = getChanta(triplets, sequences, triplesAndPairs.pairs);
	yakuOpen += chanta.open;
	yakuClosed += chanta.closed;

	//Honrou
	//All Terminals and Honors (means: Also 4 triplets)
	//Open
	var honrou = getHonrou(triplets, triplesAndPairs.pairs, hand);
	yakuOpen += honrou.open;
	yakuClosed += honrou.closed;

	//Ittsuu
	//Pure Straight
	//Open/-1 Han after call
	var ittsuu = getIttsuu(sequences);
	yakuOpen += ittsuu.open;
	yakuClosed += ittsuu.closed;

	//3 Han

	//Junchan
	//All Terminals
	//Open/-1 Han after call
	var junchan = getJunchan(triplets, sequences, triplesAndPairs.pairs);
	yakuOpen += junchan.open;
	yakuClosed += junchan.closed;

	//Honitsu
	//Half Flush
	//Open/-1 Han after call
	var honitsu = getHonitsu(hand);
	yakuOpen += honitsu.open;
	yakuClosed += honitsu.closed;

	//6 Han

	//Chinitsu
	//Full Flush
	//Open/-1 Han after call
	var chinitsu = getChinitsu(hand);
	yakuOpen += chinitsu.open;
	yakuClosed += chinitsu.closed;

	//Yakuman

	//Daisangen
	//Big Three Dragons
	//Open
	var daisangen = getDaisangen(hand);
	yakuOpen += daisangen.open;
	yakuClosed += daisangen.closed;

	//Tsuuiisou
	//All Honours
	//Open
	var tsuuiisou = getTsuuiisou(hand);
	yakuOpen = Math.max(yakuOpen, tsuuiisou.open);
	yakuClosed = Math.max(yakuClosed, tsuuiisou.closed);

	//Ryuuiisou
	//All Green
	//Open
	var ryuuiisou = getRyuuiisou(hand);
	yakuOpen = Math.max(yakuOpen, ryuuiisou.open);
	yakuClosed = Math.max(yakuClosed, ryuuiisou.closed);

	//Chinroutou
	//All Terminals
	//Open
	var chinroutou = getChinroutou(hand);
	yakuOpen = Math.max(yakuOpen, chinroutou.open);
	yakuClosed = Math.max(yakuClosed, chinroutou.closed);

	//Shousuushii / Daisuushii
	//Open
	var windYakuman = getWindYakuman(hand);
	yakuOpen = Math.max(yakuOpen, windYakuman.open);
	yakuClosed = Math.max(yakuClosed, windYakuman.closed);

	//Suukantsu
	//4 Kans
	//Open
	var suukantsu = getSuukantsu(kanCount);
	yakuOpen = Math.max(yakuOpen, suukantsu.open);
	yakuClosed = Math.max(yakuClosed, suukantsu.closed);

	//Chuuren poutou
	//9 Gates
	//Closed
	var chuuren = getChuurenPoutou(hand, filteredCalls);
	yakuClosed = Math.max(yakuClosed, chuuren.closed);

	//Kokushi musou
	//Thirteen Orphans
	//Closed
	var kokushi = getKokushiMusou(hand, filteredCalls);
	yakuClosed = Math.max(yakuClosed, kokushi.closed);


	return { open: yakuOpen, closed: yakuClosed };
}

//Yakuhai
function getYakuhai(triples) {
	var yakuhai = 0;
	yakuhai = parseInt(triples.filter(tile => tile.type == 3 && (tile.index > 4 || tile.index == seatWind || tile.index == roundWind)).length / 3);
	yakuhai += parseInt(triples.filter(tile => tile.type == 3 && tile.index == seatWind && tile.index == roundWind).length / 3);
	return { open: yakuhai, closed: yakuhai };
}

//Tanyao
function getTanyao(hand, triplesAndPairs, inputCalls) {
	if (hand.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length <= Math.max(0, hand.length - 14) &&
		inputCalls.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length == 0 &&
		triplesAndPairs.pairs.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length == 0 &&
		triplesAndPairs.triples.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length == 0) {
		return { open: 1, closed: 1 };
	}
	return { open: 0, closed: 0 };
}

//Iipeikou
function getSequenceStartCounts(sequenceTiles) {
	var counts = {};
	for (var i = 0; i + 2 < sequenceTiles.length; i += 3) {
		var sequence = sequenceTiles.slice(i, i + 3).sort((a, b) => a.index - b.index);
		if (sequence[0].type == sequence[1].type && sequence[1].type == sequence[2].type &&
			sequence[1].index == sequence[0].index + 1 && sequence[2].index == sequence[0].index + 2) {
			var key = sequence[0].type + "-" + sequence[0].index;
			counts[key] = (counts[key] || 0) + 1;
		}
	}
	return counts;
}

function getIipeikou(sequences) {
	var counts = getSequenceStartCounts(sequences);
	if (Object.values(counts).some(count => count >= 2)) {
		return { open: 0, closed: 1 };
	}
	return { open: 0, closed: 0 };
}

//Ryanpeikou (2x iipeikou), closed only
function getRyanpeikou(sequences) {
	if (!isClosed) {
		return { open: 0, closed: 0 };
	}

	var counts = getSequenceStartCounts(sequences);
	var pairCount = Object.values(counts).reduce((total, count) => total + Math.floor(count / 2), 0);
	if (pairCount >= 2) {
		return { open: 0, closed: 3 };
	}
	return { open: 0, closed: 0 };
}

function getSankantsu(kanCount) {
	if (kanCount >= 3) {
		return { open: 2, closed: 2 };
	}
	return { open: 0, closed: 0 };
}

//Sanankou
function getSanankou(hand, winningTile = null, ron = true, canCompleteNonTriplet = false) {
	// Without a winning tile this remains a prospective estimate. For completed
	// hands, ron opens the triplet it completes; tsumo leaves it concealed. An
	// ambiguous winning tile may instead complete a sequence or the pair.
	var concealedTriples = getTripletsAsArray(hand);
	var count = concealedTriples.length / 3;
	if (winningTile && ron && !canCompleteNonTriplet &&
		concealedTriples.some(tile => isSameTile(tile, winningTile))) count--;
	return count >= 3 ? { open: 2, closed: 2 } : { open: 0, closed: 0 };
}

//Toitoi
function getToitoi(triplets) {
	if (parseInt(triplets.length / 3) >= 4) {
		return { open: 2, closed: 2 };
	}

	return { open: 0, closed: 0 };
}

//Sanshoku Douko
function getSanshokuDouko(triplets) {
	for (var i = 1; i <= 9; i++) {
		if (triplets.filter(tile => tile.index == i && tile.type < 3).length >= 9) {
			return { open: 2, closed: 2 };
		}
	}
	return { open: 0, closed: 0 };
}

//Sanshoku Doujun
function getSanshokuDoujun(sequences) {
	var counts = getSequenceStartCounts(sequences);
	for (var i = 1; i <= 7; i++) {
		if (counts["0-" + i] > 0 && counts["1-" + i] > 0 && counts["2-" + i] > 0) {
			return { open: 1, closed: 2 };
		}
	}
	return { open: 0, closed: 0 };
}

//Shousangen
function getShousangen(hand) {
	var dragon5Count = 0, dragon6Count = 0, dragon7Count = 0;
	for (let tile of hand) {
		if (tile.type == 3) {
			if (tile.index == 5) dragon5Count++;
			else if (tile.index == 6) dragon6Count++;
			else if (tile.index == 7) dragon7Count++;
		}
	}
	if (dragon5Count + dragon6Count + dragon7Count == 8 && dragon5Count < 4 && dragon6Count < 4 && dragon7Count < 4) {
		return { open: 2, closed: 2 };
	}
	return { open: 0, closed: 0 };
}

//Daisangen
function getDaisangen(hand) {
	var d5 = 0, d6 = 0, d7 = 0;
	for (let tile of hand) {
		if (tile.type == 3) {
			if (tile.index == 5) d5++;
			else if (tile.index == 6) d6++;
			else if (tile.index == 7) d7++;
		}
	}
	if (d5 >= 3 && d6 >= 3 && d7 >= 3) {
		return { open: 13, closed: 13 };
	}
	return { open: 0, closed: 0 };
}

//Chanta
function getChanta(triplets, sequences, pairs) {
	if (sequences.length > 0 && (sequences.filter(tile => tile.index == 1 || tile.index == 9).length * 3) == sequences.length &&
		(triplets.concat(pairs)).filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length +
		(sequences.filter(tile => tile.index == 1 || tile.index == 9).length * 3) >= 13) {
		return { open: 1, closed: 2 };
	}
	return { open: 0, closed: 0 };
}

//Honrou
function getHonrou(triplets, pairs, hand = triplets.concat(pairs)) {
	if (strategy == STRATEGIES.CHIITOITSU && hand.length >= 13 && hand.every(isTerminalOrHonor)) {
		return { open: 0, closed: 2 };
	}
	if (triplets.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length >= 12 &&
		pairs.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length >= 2) {
		return { open: 2, closed: 2 };
	}
	return { open: 0, closed: 0 };
}

//Junchan
function getJunchan(triplets, sequences, pairs) {
	if (sequences.length > 0 && (sequences.filter(tile => tile.index == 1 || tile.index == 9).length * 3) == sequences.length &&
		(triplets.concat(pairs)).filter(tile => tile.type != 3 && (tile.index == 1 || tile.index == 9)).length +
		(sequences.filter(tile => tile.index == 1 || tile.index == 9).length * 3) >= 13) {
		return { open: 1, closed: 1 }; // - Added to Chanta
	}
	return { open: 0, closed: 0 };
}

//Ittsuu
function getIttsuu(triples) {
	var counts = getSequenceStartCounts(triples);
	for (var j = 0; j <= 2; j++) {
		if (counts[j + "-1"] > 0 && counts[j + "-4"] > 0 && counts[j + "-7"] > 0) {
			return { open: 1, closed: 2 };
		}
	}
	return { open: 0, closed: 0 };
}

//Honitsu
function getHonitsu(hand) {
	if (hand.length == 0) return { open: 0, closed: 0 };
	var typeCounts = [0, 0, 0, 0]; // counts for types 0, 1, 2, 3
	for (let tile of hand) {
		typeCounts[tile.type]++;
	}
	var honors = typeCounts[3];
	if (honors + typeCounts[0] == hand.length ||
		honors + typeCounts[1] == hand.length ||
		honors + typeCounts[2] == hand.length) {
		return { open: 2, closed: 3 };
	}
	return { open: 0, closed: 0 };
}

//Chinitsu
function getChinitsu(hand) {
	if (hand.length == 0) return { open: 0, closed: 0 };
	var typeCounts = [0, 0, 0];
	for (let tile of hand) {
		if (tile.type < 3) typeCounts[tile.type]++;
	}
	if (typeCounts[0] == hand.length || typeCounts[1] == hand.length || typeCounts[2] == hand.length) {
		return { open: 3, closed: 3 }; //Score gets added to honitsu -> 5/6 han
	}
	return { open: 0, closed: 0 };
}

//The yakuman checks below accept 13 tiles as well as 14: every caller in ai_offense evaluates a
//13-tile hand, so gating on 14 made these unreachable outside the unit tests.
function getTsuuiisou(hand) {
	if (hand.length >= 13 && hand.every(tile => tile.type == 3)) {
		return { open: 13, closed: 13 };
	}
	return { open: 0, closed: 0 };
}

function getRyuuiisou(hand) {
	var allGreen = hand.length >= 13 && hand.every(tile =>
		(tile.type == 2 && [2, 3, 4, 6, 8].includes(tile.index)) ||
		(tile.type == 3 && tile.index == 6));
	return allGreen ? { open: 13, closed: 13 } : { open: 0, closed: 0 };
}

function getChinroutou(hand) {
	if (hand.length >= 13 && hand.every(tile => tile.type < 3 && (tile.index == 1 || tile.index == 9))) {
		return { open: 13, closed: 13 };
	}
	return { open: 0, closed: 0 };
}

function getWindYakuman(hand) {
	var counts = [1, 2, 3, 4].map(index => hand.filter(tile => tile.type == 3 && tile.index == index).length);
	var triplets = counts.filter(count => count >= 3).length;
	if (triplets == 4 || (triplets == 3 && counts.some(count => count == 2))) {
		return { open: 13, closed: 13 };
	}
	return { open: 0, closed: 0 };
}

function getSuukantsu(kanCount) {
	return kanCount >= 4 ? { open: 13, closed: 13 } : { open: 0, closed: 0 };
}

function getChuurenPoutou(hand, calls) {
	if (calls.length > 0 || (hand.length != 13 && hand.length != 14) || hand.some(tile => tile.type == 3 || tile.type != hand[0].type)) {
		return { open: 0, closed: 0 };
	}
	var counts = Array(10).fill(0);
	hand.forEach(tile => counts[tile.index]++);
	if (counts[1] >= 3 && counts[9] >= 3 && [2, 3, 4, 5, 6, 7, 8].every(index => counts[index] >= 1)) {
		return { open: 0, closed: 13 };
	}
	return { open: 0, closed: 0 };
}

function getKokushiMusou(hand, calls) {
	if (calls.length > 0 || (hand.length != 13 && hand.length != 14) || hand.some(tile => !isTerminalOrHonor(tile))) {
		return { open: 0, closed: 0 };
	}
	var uniqueTiles = new Set(hand.map(tile => tile.type + "-" + tile.index));
	return uniqueTiles.size == 13 ? { open: 0, closed: 13 } : { open: 0, closed: 0 };
}
