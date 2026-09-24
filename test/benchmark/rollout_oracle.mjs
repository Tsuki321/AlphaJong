// Independent reference distance: enumerate legal completed suit shapes and
// measure the missing copies. This deliberately shares no production shanten
// code, transition tables, tile counters, or cache keys.
const targets = new Map();
const suitCache = new Map();

function completeTargets(length, sequences) {
	const key = `${length}/${sequences}`;
	if (targets.has(key)) return targets.get(key);
	const groups = Array.from({ length }, (_, rank) => [rank, rank, rank]);
	if (sequences) for (let rank = 0; rank + 2 < length; rank++) groups.push([rank, rank + 1, rank + 2]);
	const result = Array.from({ length: 10 }, () => []), seen = Array.from({ length: 10 }, () => new Set());
	const counts = Array(length).fill(0);
	function add(melds, pair) {
		const bucket = melds * 2 + pair, signature = counts.join("");
		if (seen[bucket].has(signature)) return;
		seen[bucket].add(signature);
		result[bucket].push(Uint8Array.from(counts));
	}
	function visit(start, melds) {
		add(melds, 0);
		for (let rank = 0; rank < length; rank++) {
			if (counts[rank] > 2) continue;
			counts[rank] += 2; add(melds, 1); counts[rank] -= 2;
		}
		if (melds === 4) return;
		for (let group = start; group < groups.length; group++) {
			for (const rank of groups[group]) counts[rank]++;
			if (counts.every(count => count <= 4)) visit(group, melds + 1);
			for (const rank of groups[group]) counts[rank]--;
		}
	}
	visit(0, 0);
	targets.set(key, result);
	return result;
}

function suitCosts(counts, sequences) {
	const key = `${sequences}/${counts.join("")}`;
	if (suitCache.has(key)) return suitCache.get(key);
	const shapeBuckets = completeTargets(counts.length, sequences), total = counts.reduce((sum, value) => sum + value, 0);
	const costs = shapeBuckets.map((shapes, bucket) => {
		if (!shapes.length) return Infinity;
		const targetSize = Math.floor(bucket / 2) * 3 + (bucket % 2) * 2;
		const lowerBound = Math.max(0, targetSize - total);
		let best = targetSize;
		for (const shape of shapes) {
			let missing = 0;
			for (let rank = 0; rank < counts.length; rank++) {
				missing += Math.max(0, shape[rank] - counts[rank]);
				if (missing >= best) break;
			}
			if (missing < best) best = missing;
			if (best === lowerBound) break;
		}
		return best;
	});
	suitCache.set(key, costs);
	return costs;
}

export function tileCounts(tiles) {
	const counts = Array(34).fill(0);
	for (const tile of tiles) counts[tile.type * 9 + tile.index - 1]++;
	return counts;
}

export function oracleShanten(counts, players = 4) {
	if (counts.some((count, index) => count < 0 || count > 4 || !Number.isInteger(count) ||
		(players === 3 && index > 9 && index < 17 && count > 0))) return Infinity;
	const suits = [];
	for (let type = 0; type < 4; type++) {
		const current = counts.slice(type * 9, type * 9 + (type === 3 ? 7 : 9));
		// Sanma has only 1m and 9m; those ranks can only make triplets/pairs.
		suits.push(type === 1 && players === 3 ? suitCosts([current[0], current[8]], false) : suitCosts(current, type !== 3));
	}
	let costs = [0, ...Array(9).fill(Infinity)];
	for (const suit of suits) {
		const next = Array(10).fill(Infinity);
		for (let already = 0; already < 10; already++) {
			if (!Number.isFinite(costs[already])) continue;
			for (let bucket = 0; bucket < 10; bucket++) {
				if (already % 2 + bucket % 2 > 1 || Math.floor(already / 2) + Math.floor(bucket / 2) > 4) continue;
				next[already + bucket] = Math.min(next[already + bucket], costs[already] + suit[bucket]);
			}
		}
		costs = next;
	}
	const pairs = counts.filter(count => count >= 2).length, distinct = counts.filter(count => count > 0).length;
	const sevenPairs = 6 - pairs + Math.max(0, 7 - distinct);
	const orphanIndices = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
	const orphans = 13 - orphanIndices.filter(index => counts[index] > 0).length - Number(orphanIndices.some(index => counts[index] >= 2));
	return Math.min(costs[9] - 1, sevenPairs, orphans);
}

export function oracleDiscardOptions(hand, discarded, indicator, players) {
	const visible = tileCounts([...hand, ...discarded, indicator]);
	const counts = tileCounts(hand), result = [], seen = new Set();
	for (const tile of hand) {
		const key = `${tile.index}/${tile.type}/${tile.dora}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const index = tile.type * 9 + tile.index - 1;
		counts[index]--;
		const shanten = oracleShanten(counts, players);
		let ukeire = 0;
		for (let draw = 0; draw < 34; draw++) {
			if (visible[draw] >= 4 || (players === 3 && draw > 9 && draw < 17)) continue;
			counts[draw]++;
			if (oracleShanten(counts, players) < shanten) ukeire += 4 - visible[draw];
			counts[draw]--;
		}
		counts[index]++;
		result.push({ tile: `${tile.dora ? 0 : tile.index}${"pmsz"[tile.type]}`, shanten, ukeire });
	}
	return result;
}

export function oracleCacheSize() { return { suitStates: suitCache.size, targetKinds: targets.size }; }
