import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceRoot = path.resolve(process.env.ALPHAJONG_SOURCE_ROOT || fileURLToPath(new URL("../", import.meta.url)));
const sources = await Promise.all(["utils.js", "hand_analysis.js"].map(file => readFile(path.join(sourceRoot, "src", file), "utf8")));
const makeEngine = new Function("state", `
	var visibleTiles = [], ownHand = [], dora = [], calls = [[], [], [], []], discards = [[], [], [], []];
	var availableTiles = [], PERFORMANCE_MODE = 4, timeSave = 0;
	var STRATEGIES = { GENERAL: 0, CHIITOITSU: 1, THIRTEEN_ORPHANS: 2 }, strategy = 0;
	function doesPlayerExist(player) { return player < state.players; }
	function getNumberOfKitaOfPlayer(player) { return state.kita[player] || 0; }
	function invalidateDefenseRuntimeCache() {}
	${sources.join("\n")}
	return {
		getDoubles, getDoubleCount, getTriplesAndPairs, getNumberOfTilesAvailable, getTileCounts, getNumberOfDoras,
		clearHandAnalysisCache, getStandardShanten,
		setVisible: tiles => { visibleTiles = tiles; },
		refresh: function (input) {
			ownHand = input.hand || []; dora = input.dora || [];
			calls = input.calls || [[], [], [], []]; discards = input.discards || [[], [], [], []];
			updateAvailableTiles();
			return { visibleTiles, availableTiles };
		}
	};
`);

function tile(index, type = 0, properties = {}) {
	return { index, type, dora: false, doraValue: 0, ...properties };
}
function fixture(players = 4) {
	const state = { players, kita: [0, 0, 0, 0] };
	return { api: makeEngine(state), state };
}
function tiles(text) {
	const result = [];
	for (const [, digits, suit] of text.matchAll(/([0-9]+)([pmsz])/g)) {
		for (const digit of digits) result.push(tile(Number(digit) || 5, "pmsz".indexOf(suit), { dora: digit === "0", doraValue: digit === "0" ? 1 : 0 }));
	}
	return result;
}

test("visible counts follow board replacement and append/remove observer events", () => {
	const { api, state } = fixture();
	const visible = tiles("05p111m");
	api.setVisible(visible);
	assert.equal(api.getNumberOfTilesAvailable(5, 0), 2, "red and normal fives share copy limits");
	assert.equal(api.getNumberOfTilesAvailable(1, 1), 1);
	visible.push(tile(5));
	assert.equal(api.getNumberOfTilesAvailable(5, 0), 1, "opponent discard appended between board refreshes");
	visible.pop();
	assert.equal(api.getNumberOfTilesAvailable(5, 0), 2);
	api.setVisible(tiles("55s111m"));
	assert.equal(api.getNumberOfTilesAvailable(5, 0), 4, "equal-length new board is distinct");
	assert.equal(api.getNumberOfTilesAvailable(5, 2), 2);
	state.players = 3;
	assert.equal(api.getNumberOfTilesAvailable(5, 1), 0);
	state.players = 4;
	assert.equal(api.getNumberOfTilesAvailable(5, 1), 4);
	for (const [index, type] of [[0, 0], [10, 0], [8, 3], [1, 4], [1, -1]]) assert.equal(api.getNumberOfTilesAvailable(index, type), 0);
});

test("visible count optimization agrees with independent full scans over 300 changing boards", () => {
	const { api, state } = fixture();
	let seed = 0x56495349;
	const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
	let visible = [];
	for (let round = 0; round < 300; round++) {
		state.players = round % 3 === 0 ? 3 : 4;
		if (round % 5 === 0) visible = Array.from({ length: random(120) }, () => {
			const index = random(34); return tile(index % 9 + 1, Math.floor(index / 9));
		});
		else if (round % 2 === 0 && visible.length) visible.pop();
		else { const index = random(34); visible.push(tile(index % 9 + 1, Math.floor(index / 9))); }
		api.setVisible(visible);
		for (let index = 0; index < 34; index++) {
			const rank = index % 9 + 1, type = Math.floor(index / 9);
			const expected = state.players === 3 && type === 1 && rank > 1 && rank < 9 ? 0 :
				Math.max(0, 4 - visible.filter(value => value.type === type && value.index === rank).length);
			assert.equal(api.getNumberOfTilesAvailable(rank, type), expected, `board ${round}, tile ${index}`);
		}
	}
});

test("board refresh includes kita, indicators and newly changed tile identities", () => {
	const { api, state } = fixture(3);
	state.kita = [1, 1, 0, 0];
	const hand = tiles("19m123p456s114z");
	const input = { hand, dora: tiles("4p"), calls: [tiles("777z"), [], [], []], discards: [tiles("1p"), [], [], []] };
	const result = api.refresh(input);
	assert.equal(api.getNumberOfTilesAvailable(4, 3), 1, "two extracted norths and one held north");
	assert.equal(api.getNumberOfTilesAvailable(1, 0), 2, "hand and pond both count");
	assert.equal(api.getNumberOfTilesAvailable(4, 0), 3, "indicator is visible");
	assert.equal(result.availableTiles.filter(value => value.index === 5 && value.type === 0 && value.dora).length, 1);
	assert.equal(result.availableTiles.reduce((total, value) => total + value.doraValue, 0), 7);
	hand.find(value => value.type === 0 && value.index === 1).index = 2;
	api.refresh(input);
	assert.equal(api.getNumberOfTilesAvailable(1, 0), 3, "full board refresh rescans in-place source tile changes");
	assert.equal(api.getNumberOfTilesAvailable(2, 0), 2);
});

test("cached group arrays retain current input tile metadata and physical variants", () => {
	const { api } = fixture();
	for (const method of ["getDoubles", "getTriplesAndPairs"]) {
		api.clearHandAnalysisCache();
		const first = tiles("340567p112233m77z").map((value, index) => ({ ...value, sample: "old", valid: true, id: index }));
		api[method](first);
		const second = first.map(value => ({ ...value, sample: "current", valid: false, doraValue: value.doraValue + 2 }));
		const result = api[method](second);
		const selected = Array.isArray(result) ? result : result.triples.concat(result.pairs);
		assert.ok(selected.length > 0);
		assert.ok(selected.every(value => value.sample === "current" && value.valid === false), `${method} returned stale input metadata`);
		assert.equal(selected.filter(value => value.dora).length, 1, `${method} must use exactly one red five`);
		assert.equal(api.getNumberOfDoras(selected), selected.length * 2 + 1, `${method} dora scores must use the current board`);
		const available = api.getTileCounts(second), used = api.getTileCounts(selected);
		assert.ok(used.every((count, index) => count <= available[index]), "cannot reuse a physical tile");
		const third = second.slice().reverse().map(value => ({ ...value, sample: "same-key", valid: true }));
		const cached = api[method](third);
		const cachedTiles = Array.isArray(cached) ? cached : cached.triples.concat(cached.pairs);
		assert.ok(cachedTiles.every(value => third.includes(value) && value.sample === "same-key" && value.valid),
			`${method} cache hits must return objects from the current input`);
		selected.pop();
		const repeated = api[method](second);
		assert.equal((Array.isArray(repeated) ? repeated : repeated.triples.concat(repeated.pairs)).length, selected.length + 1);
	}
});

test("count-only doubles match an independent neighbor scan for every nine-rank count pattern", () => {
	const { api } = fixture();
	// Every count 0..4 for nine ranks: 5^9 = 1,953,125 patterns. Restrict
	// total size to the 15-tile lookahead limit used by the decision engine.
	const hand = [];
	let checked = 0;
	function visit(rank) {
		if (rank === 10) {
			let expected = 0;
			for (let i = 0; i + 1 < hand.length; i++) {
				if (hand[i + 1].index - hand[i].index <= 2) { expected++; i++; }
			}
			assert.equal(api.getDoubleCount(hand), expected, hand.map(value => value.index).join(""));
			checked++;
			return;
		}
		const size = hand.length;
		for (let count = 0; count <= 4 && hand.length <= 15; count++) {
			visit(rank + 1);
			hand.push(tile(rank));
		}
		hand.length = size;
	}
	visit(1);
	assert.ok(checked > 500000, "cover dense and sparse duplicate/neighbor patterns");
	for (const sample of ["11223344556677z", "13579p2468m1234567z", "1133p1199m5577s11z", "340567p1122m77z"]) {
		const hand = tiles(sample);
		assert.equal(api.getDoubleCount(hand), api.getDoubles(hand).length / 2, sample);
	}
});
