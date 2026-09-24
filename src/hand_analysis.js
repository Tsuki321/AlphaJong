// Exact structural hand distance and visible-tile-aware draw estimates.
// Tile types follow the client: pin=0, man=1, sou=2, honors=3.
var suitCompletionCache = new Map();
var exactShantenCache = new Map();

// A suit state records melds, a head, and sequence tiles carried into the next
// two ranks. Legal transitions depend only on that state, not on the hand.
var suitCompletionTransitions = [false, true].map(sequencesAllowed => {
	var transitions = Array.from({ length: 250 }, () => []);
	for (var melds = 0; melds <= 4; melds++) {
		for (var pair = 0; pair <= 1; pair++) {
			for (var next = 0; next <= 4; next++) {
				for (var later = 0; later <= next; later++) {
					var entries = transitions[(melds * 2 + pair) * 25 + next * 5 + later];
					for (var sequence = 0; sequence <= (sequencesAllowed ? 4 - melds : 0); sequence++) {
						for (var triplet = 0; triplet <= 1 && melds + sequence + triplet <= 4; triplet++) {
							for (var head = 0; head <= 1 - pair; head++) {
								var needed = next + sequence + triplet * 3 + head * 2;
								if (needed > 4 || later + sequence > 4) continue;
								entries.push(needed, ((melds + sequence + triplet) * 2 + pair + head) * 25 +
									(later + sequence) * 5 + sequence);
							}
						}
					}
				}
			}
		}
	}
	return transitions;
});

function clearExactHandAnalysisCache() {
	suitCompletionCache.clear();
	exactShantenCache.clear();
}

function getTileCounts(tiles) {
	var counts = Array(34).fill(0);
	for (let tile of tiles) {
		if (tile && tile.type >= 0 && tile.type <= 3 && tile.index >= 1 &&
			tile.index <= (tile.type == 3 ? 7 : 9)) {
			counts[tile.type * 9 + tile.index - 1]++;
		}
	}
	return counts;
}

function getMelds(meldTiles = [], includeKans = true) {
	if (!includeKans) {
		// A concealed decomposition already consists of three-tile groups.
		// In particular, 111 + 123 must never be read as a kan of 1s.
		var groups = [];
		for (var index = 0; index + 2 < meldTiles.length; index += 3) {
			groups.push(meldTiles.slice(index, index + 3));
		}
		return groups;
	}
	function split(index) {
		if (index == meldTiles.length) return [];
		var triple = meldTiles.slice(index, index + 3);
		if (triple.length < 3) return null;
		var fourth = meldTiles[index + 3];
		var sorted = triple.slice().sort((a, b) => a.index - b.index);
		var isTriple = triple.every(tile => isSameTile(tile, triple[0])) ||
			(sorted[0].type < 3 && sorted.every(tile => tile.type == sorted[0].type) &&
				sorted[1].index == sorted[0].index + 1 && sorted[2].index == sorted[0].index + 2);
		if (isTriple && !(fourth && fourth.kan)) {
			var rest = split(index + 3);
			if (rest != null) return [triple].concat(rest);
		}
		// Live calls mark the fourth tile. Legacy debug strings need inference,
		// but it is valid only if the entire remaining list also splits into melds.
		if (fourth && fourth.kan !== false &&
			triple.every(tile => isSameTile(tile, fourth))) {
			var rest = split(index + 4);
			if (rest != null) return [triple.concat(fourth)].concat(rest);
		}
		return null;
	}
	return split(0) || [];
}

function getMeldCount(meldTiles = calls[0] || []) {
	return getMelds(meldTiles).length;
}

function isConcealedKan(meld) {
	return meld.length == 4 && meld.every(tile => tile.from == localPosition2Seat(0));
}

// For each possible number of melds (0..4) and heads (0..1), find the
// minimum number of missing tiles in this suit. Enumerate target shapes,
// rather than greedily removing groups from the current hand. Incoming
// sequence tiles are carried to the next two ranks; no target may need a
// fifth copy, including copies already committed to an exposed meld.
function getSuitCompletionCosts(counts, limits, sequencesAllowed) {
	// Counts and limits are base-five digits. Even nine ranks fit exactly in a
	// JavaScript integer, avoiding two string arrays on every cache lookup.
	var key = counts.length;
	for (var rank = 0; rank < counts.length; rank++) key = key * 25 + counts[rank] * 5 + limits[rank];
	key = key * 2 + (sequencesAllowed ? 1 : 0);
	var cached = suitCompletionCache.get(key);
	if (cached !== undefined) return cached;
	// Four melds and a head need at most fourteen tiles; 255 denotes an
	// unreachable state without storing floating-point Infinity in each cell.
	var costs = new Uint8Array(10).fill(255);
	costs[0] = 0;
	if (!sequencesAllowed) {
		// Honors (and sanma manzu) have no sequence carries. Descending updates
		// use each rank once, so a triplet and a head cannot require five copies.
		for (var rank = 0; rank < counts.length; rank++) {
			var pairCost = Math.max(0, 2 - counts[rank]);
			var tripletCost = Math.max(0, 3 - counts[rank]);
			for (var state = 9; state >= 0; state--) {
				var cost = costs[state];
				if (cost == 255) continue;
				if (limits[rank] >= 3 && state < 8 && cost + tripletCost < costs[state + 2]) {
					costs[state + 2] = cost + tripletCost;
				}
				if (limits[rank] >= 2 && state % 2 == 0 && cost + pairCost < costs[state + 1]) {
					costs[state + 1] = cost + pairCost;
				}
			}
		}
	}
	else {
		var states = new Uint8Array(250).fill(255);
		var nextStates = new Uint8Array(250);
		var active = new Uint8Array(250);
		var nextActive = new Uint8Array(250);
		var activeCount = 1;
		states[0] = 0;
		for (var rank = 0; rank < counts.length; rank++) {
			nextStates.fill(255);
			var nextCount = 0;
			var transitions = suitCompletionTransitions[rank < 7 ? 1 : 0];
			for (var current = 0; current < activeCount; current++) {
				var state = active[current];
				var cost = states[state];
				var entries = transitions[state];
				for (var entry = 0; entry < entries.length; entry += 2) {
					var needed = entries[entry];
					if (needed > limits[rank]) continue;
					var index = entries[entry + 1];
					var candidate = cost + (needed > counts[rank] ? needed - counts[rank] : 0);
					if (candidate >= nextStates[index]) continue;
					if (nextStates[index] == 255) nextActive[nextCount++] = index;
					nextStates[index] = candidate;
				}
			}
			var swap = states;
			states = nextStates;
			nextStates = swap;
			swap = active;
			active = nextActive;
			nextActive = swap;
			activeCount = nextCount;
		}
		for (var state = 0; state < 10; state++) costs[state] = states[state * 25];
	}
	var result = Array.from({ length: 5 }, (_, melds) => [
		costs[melds * 2] == 255 ? Infinity : costs[melds * 2],
		costs[melds * 2 + 1] == 255 ? Infinity : costs[melds * 2 + 1]
	]);
	suitCompletionCache.set(key, result);
	return result;
}

function getHandAnalysisContext(meldTiles) {
	var committed = getTileCounts(meldTiles);
	var meldsNeeded = 4 - getMeldCount(meldTiles);
	var threePlayer = getNumberOfPlayers() == 3;
	return { committed: committed, meldsNeeded: meldsNeeded, threePlayer: threePlayer,
		hasCalls: meldTiles.length > 0,
		cacheKey: committed.join("") + "|" + meldsNeeded + "|" + threePlayer };
}

function getStandardShantenFromCounts(counts, context) {
	var committed = context.committed;
	var meldsNeeded = context.meldsNeeded;
	var key = counts.join("") + "|" + context.cacheKey;
	var cached = exactShantenCache.get(key);
	if (cached !== undefined) return cached;
	if (meldsNeeded < 0 || counts.some((count, i) => count + committed[i] > 4)) return Infinity;
	var best = Array(10).fill(Infinity);
	var combined = Array(10).fill(Infinity);
	best[0] = 0;
	for (var type = 0; type <= 3; type++) {
		var length = type == 3 ? 7 : 9;
		var suit = counts.slice(type * 9, type * 9 + length);
		var limits = committed.slice(type * 9, type * 9 + length).map((count, rank) =>
			context.threePlayer && type == 1 && rank > 0 && rank < 8 ? 0 : 4 - count);
		var costs = getSuitCompletionCosts(suit, limits, type != 3 && !(context.threePlayer && type == 1));
		combined.fill(Infinity);
		for (var melds = 0; melds <= meldsNeeded; melds++) {
			var withoutHead = best[melds * 2];
			var withHead = best[melds * 2 + 1];
			if (withoutHead == Infinity && withHead == Infinity) continue;
			for (var add = 0; add + melds <= meldsNeeded; add++) {
				var index = (melds + add) * 2;
				combined[index] = Math.min(combined[index], withoutHead + costs[add][0]);
				combined[index + 1] = Math.min(combined[index + 1], withoutHead + costs[add][1], withHead + costs[add][0]);
			}
		}
		var swap = best;
		best = combined;
		combined = swap;
	}
	var shanten = best[meldsNeeded * 2 + 1] - 1;
	exactShantenCache.set(key, shanten);
	return shanten;
}

function getStandardShanten(hand, meldTiles = calls[0] || []) {
	return getStandardShantenFromCounts(getTileCounts(hand), getHandAnalysisContext(meldTiles));
}

function getSevenPairsShantenFromCounts(counts) {
	var pairs = 0;
	var kinds = 0;
	for (var i = 0; i < counts.length; i++) {
		if (counts[i] >= 2) pairs++;
		if (counts[i] > 0) kinds++;
	}
	return 6 - pairs + Math.max(0, 7 - kinds);
}

function getSevenPairsShanten(hand, meldTiles = calls[0] || []) {
	if (meldTiles.length > 0) return Infinity;
	return getSevenPairsShantenFromCounts(getTileCounts(hand));
}

function getThirteenOrphansShantenFromCounts(counts) {
	var orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
	var kinds = 0;
	var pair = 0;
	for (var i = 0; i < orphans.length; i++) {
		if (counts[orphans[i]] > 0) kinds++;
		if (counts[orphans[i]] >= 2) pair = 1;
	}
	return 13 - kinds - pair;
}

function getThirteenOrphansShanten(hand, meldTiles = calls[0] || []) {
	if (meldTiles.length > 0) return Infinity;
	return getThirteenOrphansShantenFromCounts(getTileCounts(hand));
}

function getShantenForStrategy(hand, handStrategy = strategy, meldTiles = calls[0] || []) {
	if (handStrategy == STRATEGIES.CHIITOITSU) return getSevenPairsShanten(hand, meldTiles);
	if (handStrategy == STRATEGIES.THIRTEEN_ORPHANS) return getThirteenOrphansShanten(hand, meldTiles);
	return getStandardShanten(hand, meldTiles);
}

// Probability of seeing at least one of a FIXED set of useful unseen tiles.
// This assumes exchangeable unseen tiles, including opponents' hands and the
// dead wall. It is not a calibrated win probability or a wall prediction.
function getDrawHitProbability(unseen, useful, draws = 1) {
	if (unseen <= 0 || useful <= 0 || draws <= 0) return 0;
	useful = Math.min(unseen, useful);
	var miss = 1;
	for (var i = 0; i < Math.min(draws, unseen); i++) {
		miss *= Math.max(0, unseen - useful - i) / (unseen - i);
	}
	return 1 - miss;
}

function getImprovingTileAnalysis(hand, discardedTile, handStrategy = strategy) {
	var context = getHandAnalysisContext(calls[0] || []);
	var counts = getTileCounts(hand);
	function shantenFromCounts() {
		if (handStrategy == STRATEGIES.CHIITOITSU) return context.hasCalls ? Infinity : getSevenPairsShantenFromCounts(counts);
		if (handStrategy == STRATEGIES.THIRTEEN_ORPHANS) return context.hasCalls ? Infinity : getThirteenOrphansShantenFromCounts(counts);
		return getStandardShantenFromCounts(counts, context);
	}
	var shanten = shantenFromCounts();
	var improvingTiles = [];
	var structuralWaits = [];
	var ukeire = 0;
	for (var type = 0; type <= 3; type++) {
		for (var index = 1; index <= (type == 3 ? 7 : 9); index++) {
			if (context.threePlayer && type == 1 && index > 1 && index < 9) continue;
			var countIndex = type * 9 + index - 1;
			if (counts[countIndex] + context.committed[countIndex] >= 4) continue;
			var available = getNumberOfTilesAvailable(index, type);
			// Dead waits still matter for furiten, even though they add no ukeire.
			if (available == 0 && shanten != 0) continue;
			counts[countIndex]++;
			var improvedShanten = shantenFromCounts();
			counts[countIndex]--;
			if (improvedShanten >= shanten) continue;
			var tile = { index: index, type: type, dora: false };
			if (shanten == 0) structuralWaits.push(tile);
			if (available > 0) {
				improvingTiles.push({ tile: tile, count: available });
				ukeire += available;
			}
		}
	}
	var furiten = structuralWaits.some(tile => isSameTile(tile, discardedTile) || isTileFuriten(tile.index, tile.type));
	return {
		shanten: shanten, ukeire: ukeire, improvingTiles: improvingTiles,
		structuralWaits: structuralWaits, furiten: furiten,
		improvementChance: getDrawHitProbability(availableTiles.length, ukeire),
		improvementChanceTwoDraws: getDrawHitProbability(availableTiles.length, ukeire, 2)
	};
}
