import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/hand_analysis.js", import.meta.url), "utf8");
const createAnalysis = new Function("state", `
	var calls = state.calls;
	var STRATEGIES = { GENERAL: 0, CHIITOITSU: 1, THIRTEEN_ORPHANS: 2 };
	var strategy = STRATEGIES.GENERAL;
	function getNumberOfPlayers() { return state.players; }
	function localPosition2Seat(position) { return position; }
	function isSameTile(a, b) { return !!a && !!b && a.type === b.type && a.index === b.index; }
	function getNumberOfTilesAvailable(index, type) { return state.available[type * 9 + index - 1]; }
	function isTileFuriten(index, type) { return state.discards.some(tile => tile.type === type && tile.index === index); }
	var availableTiles = state.availableTiles;
	${source}
	return { getSuitCompletionCosts, getStandardShanten, getSevenPairsShanten,
		getThirteenOrphansShanten, getImprovingTileAnalysis, getMelds, getMeldCount,
		clearExactHandAnalysisCache };
`);

function tiles(text) {
	const result = [];
	for (const [, digits, suit] of text.matchAll(/([0-9]+)([pmsz])/g)) {
		for (const digit of digits) result.push({ type: "pmsz".indexOf(suit), index: Number(digit) || 5, dora: digit === "0" });
	}
	return result;
}

function countsOf(tiles) {
	const counts = Array(34).fill(0);
	for (const tile of tiles) counts[tile.type * 9 + tile.index - 1]++;
	return counts;
}

function fixture({ players = 4, hand = [], calls = [], discards = [], extraVisible = [] } = {}) {
	const visible = countsOf([...hand, ...calls, ...discards, ...extraVisible]);
	const available = visible.map((count, index) => players === 3 && index > 9 && index < 17 ? 0 : Math.max(0, 4 - count));
	const state = { players, calls: [calls], discards, available, availableTiles: Array(available.reduce((sum, n) => sum + n, 0)) };
	return { state, api: createAnalysis(state) };
}

function randomGenerator(seed) {
	return limit => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed % limit;
	};
}

// Independent oracle: enumerate multisets of actual complete melds, optionally
// add one pair, and measure missing tiles against each legal target directly.
// This has no sequence-carry states or implementation cache keys.
const targetCache = new Map();
function targetShapes(length, sequencesAllowed) {
	const key = `${length}:${sequencesAllowed}`;
	if (targetCache.has(key)) return targetCache.get(key);
	const groups = Array.from({ length }, (_, rank) => [rank, rank, rank]);
	if (sequencesAllowed) for (let rank = 0; rank + 2 < length; rank++) groups.push([rank, rank + 1, rank + 2]);
	const targets = [];
	const counts = Array(length).fill(0);
	function visit(start, melds) {
		targets.push({ counts: counts.slice(), melds, pair: 0 });
		for (let rank = 0; rank < length; rank++) {
			if (counts[rank] > 2) continue;
			counts[rank] += 2;
			targets.push({ counts: counts.slice(), melds, pair: 1 });
			counts[rank] -= 2;
		}
		if (melds === 4) return;
		for (let group = start; group < groups.length; group++) {
			for (const rank of groups[group]) counts[rank]++;
			if (counts.every(n => n <= 4)) visit(group, melds + 1);
			for (const rank of groups[group]) counts[rank]--;
		}
	}
	visit(0, 0);
	targetCache.set(key, targets);
	return targets;
}

function referenceSuitCosts(counts, limits, sequencesAllowed) {
	const best = Array.from({ length: 5 }, () => [Infinity, Infinity]);
	for (const target of targetShapes(counts.length, sequencesAllowed)) {
		let cost = 0;
		if (best[target.melds][target.pair] === 0) continue;
		for (let rank = 0; rank < counts.length; rank++) {
			if (target.counts[rank] > limits[rank]) { cost = Infinity; break; }
			cost += Math.max(0, target.counts[rank] - counts[rank]);
		}
		best[target.melds][target.pair] = Math.min(best[target.melds][target.pair], cost);
	}
	return best;
}

function referenceStandard(hand, calls, meldCount, players) {
	const counts = countsOf(hand), committed = countsOf(calls);
	if (counts.some((count, i) => count + committed[i] > 4)) return Infinity;
	const suits = [];
	for (let type = 0; type < 4; type++) {
		const length = type === 3 ? 7 : 9;
		const current = counts.slice(type * 9, type * 9 + length);
		const limits = committed.slice(type * 9, type * 9 + length).map((count, rank) =>
			players === 3 && type === 1 && rank > 0 && rank < 8 ? 0 : 4 - count);
		suits.push(referenceSuitCosts(current, limits, type !== 3));
	}
	function choose(type, melds, head) {
		if (type === 4) return melds === 4 - meldCount && head === 1 ? 0 : Infinity;
		let best = Infinity;
		for (let add = 0; melds + add <= 4 - meldCount; add++) {
			for (let pair = 0; head + pair <= 1; pair++) {
				best = Math.min(best, suits[type][add][pair] + choose(type + 1, melds + add, head + pair));
			}
		}
		return best;
	}
	return choose(0, 0, 0) - 1;
}

function tileName(tile) { return `${tile.index}${"pmsz"[tile.type]}`; }

test("suit costs match independent complete-shape enumeration with copy limits", () => {
	const { api } = fixture();
	const random = randomGenerator(0x4350574e);
	for (const [length, sequences] of [[9, true], [7, false], [9, false]]) {
		for (let example = 0; example < 64; example++) {
			const limits = Array.from({ length }, () => example < 16 ? 4 : random(5));
			const counts = limits.map(limit => random(limit + 1));
			const expected = referenceSuitCosts(counts, limits, sequences);
			assert.deepEqual(api.getSuitCompletionCosts(counts, limits, sequences), expected,
				`${length} ranks, sequences=${sequences}, counts=${counts}, limits=${limits}`);
			assert.deepEqual(api.getSuitCompletionCosts(counts.slice(), limits.slice(), sequences), expected, "cached result");
		}
	}
});

test("complete and random closed/open/kan hands match independent target enumeration", () => {
	const known = [
		["123m456p789s11122z", "", -1],
		["123m456p789s1112z", "", 0],
		["1122334455667m", "", 0],
		["222333444m1111z", "", 1],
		["1111222233344z", "", 2],
		["456p789s11122z", "123m", -1],
		["456s77z", "1111m2222p3333z", -1],
		["22z", "1111m2222p3333s4444z", -1],
		["222p333s456m77p", "1111z", -1],
	];
	const { api } = fixture();
	for (const [hand, calls, expected] of known) assert.equal(api.getStandardShanten(tiles(hand), tiles(calls)), expected, hand);
	assert.equal(api.getStandardShanten(tiles("11111m123p456s77z"), []), Infinity, "fifth concealed copy");
	assert.equal(api.getStandardShanten(tiles("11m123p456s77z"), tiles("111m")), Infinity, "copies committed to a call also count");
	const random = randomGenerator(0x48414e44);
	const callCases = [[], ["123p"], ["777z"], ["1111m"], ["123p", "444s"],
		["1111m", "2222p", "3333z"], ["111p", "222s", "999m", "555z"], ["406p"]];
	for (const players of [4, 3]) {
		const { api } = fixture({ players });
		for (let example = 0; example < 64; example++) {
			const groups = callCases[example % callCases.length];
			const calls = groups.flatMap(group => tiles(group).map((tile, i) => ({ ...tile, kan: i === 3, from: 0 })));
			const committed = countsOf(calls);
			const pool = [];
			for (let index = 0; index < 34; index++) {
				if (players === 3 && index > 9 && index < 17) continue;
				for (let n = committed[index]; n < 4; n++) pool.push({ type: Math.floor(index / 9), index: index % 9 + 1, dora: false });
			}
			const hand = [];
			for (let n = 0; n < 13 + example % 2 - groups.length * 3; n++) hand.push(pool.splice(random(pool.length), 1)[0]);
			assert.equal(api.getMeldCount(calls), groups.length, "marked chi, pon and kan groups");
			const expected = referenceStandard(hand, calls, groups.length, players);
			assert.equal(api.getStandardShanten(hand, calls), expected, `${players} players, hand ${hand.map(tileName)}, calls ${groups}`);
			assert.equal(api.getStandardShanten(hand.slice().reverse(), calls), expected, "tile order does not change cached result");
		}
	}
});

test("kan grouping preserves ambiguous triplet/sequence boundaries", () => {
	const { api } = fixture();
	assert.deepEqual(api.getMelds(tiles("111123m")).map(group => group.length), [3, 3]);
	assert.deepEqual(api.getMelds(tiles("1111m2222p3333s4444z")).map(group => group.length), [4, 4, 4, 4]);
	const kan = tiles("1111m").map((tile, index) => ({ ...tile, kan: index === 3, from: 0 }));
	assert.deepEqual(api.getMelds([...tiles("123p"), ...kan, ...tiles("234s")]).map(group => group.length), [3, 4, 3]);
	assert.deepEqual(api.getMelds(tiles("111123m"), false).map(group => group.length), [3, 3]);
});

test("draw analysis reuses counts while preserving dead waits, furiten and input tiles", () => {
	const hand = tiles("123m456p123s77z45s");
	const discarded = tiles("9m")[0];
	const { api } = fixture({ hand, discards: tiles("333s9m") });
	const before = JSON.stringify(hand);
	const analysis = api.getImprovingTileAnalysis(hand, discarded);
	assert.equal(analysis.shanten, 0);
	assert.equal(analysis.ukeire, 4);
	assert.deepEqual(analysis.structuralWaits.map(tileName), ["3s", "6s"]);
	assert.deepEqual(analysis.improvingTiles.map(entry => tileName(entry.tile)), ["6s"]);
	assert.equal(analysis.furiten, true);
	assert.equal(JSON.stringify(hand), before, "draw probing must not change the hand or tile objects");
	assert.deepEqual(api.getImprovingTileAnalysis(hand, discarded), analysis, "repeated analysis has no leftover trial draw");
});

test("call mutations and player counts cannot reuse an incompatible shanten cache", () => {
	const hand = tiles("23p567s11122z");
	const calls = tiles("1111m");
	const { api, state } = fixture({ hand, calls });
	assert.deepEqual(api.getImprovingTileAnalysis(hand).structuralWaits.map(tileName), ["1p", "4p"]);
	state.calls[0] = tiles("1111p");
	assert.deepEqual(api.getImprovingTileAnalysis(hand).structuralWaits.map(tileName), ["4p"], "a kan exhausts all four copies");
	state.calls[0] = calls;
	assert.deepEqual(api.getImprovingTileAnalysis(hand).structuralWaits.map(tileName), ["1p", "4p"], "restoring a simulated call restores its waits");
	const sharedHand = tiles("19m123p456s12345z");
	for (const players of [4, 3, 4]) {
		state.players = players;
		assert.equal(api.getStandardShanten(sharedHand, []), referenceStandard(sharedHand, [], 0, players));
	}
	api.clearExactHandAnalysisCache();
	assert.equal(api.getStandardShanten(hand, calls), 0, "cache clearing preserves the result");
});

test("special-hand draw analysis requires distinct pairs and excludes fixed melds", () => {
	const hand = tiles("19m19p19s1234567z");
	const { api } = fixture({ players: 3, hand });
	const orphans = api.getImprovingTileAnalysis(hand, undefined, 2);
	assert.equal(orphans.shanten, 0);
	assert.equal(orphans.structuralWaits.length, 13);
	assert.equal(orphans.ukeire, 39);
	assert.equal(orphans.furiten, false);
	assert.equal(api.getSevenPairsShanten(tiles("111122m334455p6s"), []), 2, "four equal tiles supply only one pair kind");
	assert.equal(api.getSevenPairsShanten(tiles("11223344556p"), tiles("1111z")), Infinity);
	assert.equal(api.getThirteenOrphansShanten(hand, tiles("1111z")), Infinity);
	const pairs = tiles("1122m3344p5566s7z");
	const discarded = tiles("7z")[0];
	const pairAnalysis = fixture({ hand: pairs, discards: [discarded] }).api.getImprovingTileAnalysis(pairs, discarded, 1);
	assert.equal(pairAnalysis.shanten, 0);
	assert.equal(pairAnalysis.ukeire, 2);
	assert.deepEqual(pairAnalysis.structuralWaits.map(tileName), ["7z"]);
	assert.equal(pairAnalysis.furiten, true);
});
