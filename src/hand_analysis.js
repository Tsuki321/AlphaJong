// Exact structural hand distance and visible-tile-aware draw estimates.
// Tile types follow the client: pin=0, man=1, sou=2, honors=3.
var suitCompletionCache = new Map();
var exactShantenCache = new Map();

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

function getMeldCount(meldTiles = calls[0] || []) {
	return Math.floor(meldTiles.filter(tile => !tile.kan).length / 3);
}

// For each possible number of melds (0..4) and heads (0..1), find the
// minimum number of missing tiles in this suit. Enumerate target shapes,
// rather than greedily removing groups from the current hand. Incoming
// sequence tiles are carried to the next two ranks; no target may need a
// fifth copy, including copies already committed to an exposed meld.
function getSuitCompletionCosts(counts, limits, sequencesAllowed) {
	var key = counts.join("") + "|" + limits.join("") + "|" + sequencesAllowed;
	if (suitCompletionCache.has(key)) {
		return suitCompletionCache.get(key);
	}
	function stateIndex(melds, pair, next, later) {
		return ((melds * 2 + pair) * 5 + next) * 5 + later;
	}
	var states = Array(250).fill(Infinity);
	states[0] = 0;
	for (var rank = 0; rank < counts.length; rank++) {
		var nextStates = Array(250).fill(Infinity);
		for (var melds = 0; melds <= 4; melds++) {
			for (var pair = 0; pair <= 1; pair++) {
				for (var next = 0; next <= 4; next++) {
					for (var later = 0; later <= next; later++) {
						var cost = states[stateIndex(melds, pair, next, later)];
						if (!Number.isFinite(cost)) continue;
						var maxSequences = sequencesAllowed && rank < 7 ? 4 - melds : 0;
						for (var sequence = 0; sequence <= maxSequences; sequence++) {
							for (var triplet = 0; triplet <= 1 && melds + sequence + triplet <= 4; triplet++) {
								for (var head = 0; head <= 1 - pair; head++) {
									var needed = next + sequence + triplet * 3 + head * 2;
									if (needed > limits[rank] || later + sequence > 4) continue;
									var index = stateIndex(melds + sequence + triplet, pair + head, later + sequence, sequence);
									var candidate = cost + Math.max(0, needed - counts[rank]);
									if (candidate < nextStates[index]) nextStates[index] = candidate;
								}
							}
						}
					}
				}
			}
		}
		states = nextStates;
	}
	var result = Array.from({ length: 5 }, (_, melds) => [
		states[stateIndex(melds, 0, 0, 0)], states[stateIndex(melds, 1, 0, 0)]
	]);
	suitCompletionCache.set(key, result);
	return result;
}

function getStandardShanten(hand, meldTiles = calls[0] || []) {
	var counts = getTileCounts(hand);
	var committed = getTileCounts(meldTiles);
	var meldsNeeded = 4 - getMeldCount(meldTiles);
	var threePlayer = getNumberOfPlayers() == 3;
	var key = counts.join("") + "|" + committed.join("") + "|" + meldsNeeded + "|" + threePlayer;
	if (exactShantenCache.has(key)) return exactShantenCache.get(key);
	if (meldsNeeded < 0 || counts.some((count, i) => count + committed[i] > 4)) return Infinity;
	var best = Array.from({ length: 5 }, () => [Infinity, Infinity]);
	best[0][0] = 0;
	for (var type = 0; type <= 3; type++) {
		var length = type == 3 ? 7 : 9;
		var suit = counts.slice(type * 9, type * 9 + length);
		var limits = committed.slice(type * 9, type * 9 + length).map((count, rank) =>
			threePlayer && type == 1 && rank > 0 && rank < 8 ? 0 : 4 - count);
		var costs = getSuitCompletionCosts(suit, limits, type != 3);
		var combined = Array.from({ length: 5 }, () => [Infinity, Infinity]);
		for (var melds = 0; melds <= meldsNeeded; melds++) {
			for (var head = 0; head <= 1; head++) {
				for (var add = 0; add + melds <= meldsNeeded; add++) {
					for (var pair = 0; pair + head <= 1; pair++) {
						combined[melds + add][head + pair] = Math.min(combined[melds + add][head + pair],
							best[melds][head] + costs[add][pair]);
					}
				}
			}
		}
		best = combined;
	}
	var shanten = best[meldsNeeded][1] - 1;
	exactShantenCache.set(key, shanten);
	return shanten;
}

function getSevenPairsShanten(hand, meldTiles = calls[0] || []) {
	if (meldTiles.length > 0) return Infinity;
	var counts = getTileCounts(hand);
	var pairs = counts.filter(count => count >= 2).length;
	var kinds = counts.filter(count => count > 0).length;
	return 6 - pairs + Math.max(0, 7 - kinds);
}

function getThirteenOrphansShanten(hand, meldTiles = calls[0] || []) {
	if (meldTiles.length > 0) return Infinity;
	var counts = getTileCounts(hand);
	var orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
	return 13 - orphans.filter(index => counts[index] > 0).length -
		(orphans.some(index => counts[index] >= 2) ? 1 : 0);
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
	var shanten = getShantenForStrategy(hand, handStrategy);
	var improvingTiles = [];
	var structuralWaits = [];
	var ukeire = 0;
	var counts = getTileCounts(hand.concat(calls[0] || []));
	for (var type = 0; type <= 3; type++) {
		for (var index = 1; index <= (type == 3 ? 7 : 9); index++) {
			if (getNumberOfPlayers() == 3 && type == 1 && index > 1 && index < 9) continue;
			if (counts[type * 9 + index - 1] >= 4) continue;
			var available = getNumberOfTilesAvailable(index, type);
			// Dead waits still matter for furiten, even though they add no ukeire.
			if (available == 0 && shanten != 0) continue;
			var tile = { index: index, type: type, dora: false };
			if (getShantenForStrategy(hand.concat(tile), handStrategy) >= shanten) continue;
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
