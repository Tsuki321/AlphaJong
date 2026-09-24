import assert from "node:assert/strict";
import test from "node:test";
import { makeWall } from "./rollout_engine.mjs";
import { parseTiles, tileName } from "./fixtures.mjs";
import { oracleShanten, oracleDiscardOptions, tileCounts } from "./rollout_oracle.mjs";

test("rollout walls contain distinct physical tiles and keep initial hand, indicator and draws disjoint", () => {
	for (const players of [3, 4]) for (const seed of [0, 1, 20260923, 0xffffffff]) {
		const wall = makeWall(seed, players);
		assert.deepEqual(wall, makeWall(seed, players));
		assert.notDeepEqual(wall, makeWall((seed + 1) >>> 0, players));
		assert.equal(wall.length, players === 3 ? 108 : 136);
		assert.equal(new Set(wall.map(tile => tile.id)).size, wall.length);
		assert.equal(wall.filter(tile => tile.dora).length, players === 3 ? 2 : 3);
		assert.ok(tileCounts(wall).every(count => count === 0 || count === 4));
		const publicTiles = wall.slice(0, 32), unopened = wall.slice(32);
		assert.ok(unopened.every(tile => publicTiles.every(other => other.id !== tile.id)));
		if (players === 3) assert.ok(wall.every(tile => tile.type !== 1 || tile.index === 1 || tile.index === 9));
	}
});

test("independent rollout oracle respects complete hands, copy-limited waits and distinct special hands", () => {
	const known = [
		["123m456p789s11122z", -1], ["123m456p789s1112z", 0],
		["222333444m1111z", 1], ["1111222233344z", 2],
		["1122m3344p5566s77z", -1], ["1122m3344p5566s7z", 0],
		["19m19p19s1234567z", 0], ["119m19p19s1234567z", -1],
	];
	for (const [hand, expected] of known) assert.equal(oracleShanten(tileCounts(parseTiles(hand))), expected, hand);
	assert.equal(oracleShanten(tileCounts(parseTiles("11111m123p456s77z"))), Infinity);
	assert.equal(oracleShanten(tileCounts(parseTiles("123m456p789s1112z")), 3), Infinity);
	assert.equal(oracleShanten(tileCounts(parseTiles("111999m123p55566z")), 3), -1);
	const indicator = parseTiles("6z")[0];
	const deadSide = oracleDiscardOptions(parseTiles("123m456p123s77z45s9m"), parseTiles("333s"), indicator, 4);
	assert.deepEqual(deadSide.find(option => option.tile === "9m"), { tile: "9m", shanten: 0, ukeire: 4 });
	const deadSingle = oracleDiscardOptions(parseTiles("123m456p789s111z2z9m"), parseTiles("222z"), indicator, 4);
	assert.deepEqual(deadSingle.find(option => option.tile === "9m"), { tile: "9m", shanten: 0, ukeire: 0 });
	const orphans = oracleDiscardOptions(parseTiles("19m19p19s1234567z5p"), [], indicator, 3);
	assert.deepEqual(orphans.find(option => option.tile === "5p"), { tile: "5p", shanten: 0, ukeire: 38 });
});

// Separate completion checker removes actual triplets/sequences from the input;
// it does not enumerate target shapes or compute missing-copy distances.
function winning(counts, players) {
	if (counts.reduce((sum, n) => sum + n, 0) !== 14) return false;
	if (counts.filter(n => n === 2).length === 7) return true;
	const orphanIndices = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
	if (orphanIndices.every(index => counts[index] > 0) && orphanIndices.some(index => counts[index] === 2)) return true;
	function melds() {
		const index = counts.findIndex(n => n > 0);
		if (index === -1) return true;
		if (counts[index] >= 3) {
			counts[index] -= 3; const result = melds(); counts[index] += 3;
			if (result) return true;
		}
		if (index < 27 && index % 9 <= 6 && !(players === 3 && index >= 9 && index < 18) && counts[index + 1] > 0 && counts[index + 2] > 0) {
			counts[index]--; counts[index + 1]--; counts[index + 2]--;
			const result = melds();
			counts[index]++; counts[index + 1]++; counts[index + 2]++;
			if (result) return true;
		}
		return false;
	}
	for (let index = 0; index < 34; index++) if (counts[index] >= 2) {
		counts[index] -= 2; const result = melds(); counts[index] += 2;
		if (result) return true;
	}
	return false;
}

test("reference zero shanten agrees with a separate win recognizer on constructed and wall-drawn hands", () => {
	const constructed = ["1122334455667m", "222333444m1111z", "123m456p789s1112z", "111999m123p5556z", "1111222233344z"];
	for (const players of [3, 4]) {
		const hands = [...constructed.map(parseTiles).filter(hand => players === 4 || hand.every(tile => tile.type !== 1 || tile.index === 1 || tile.index === 9)),
			...Array.from({ length: 12 }, (_, seed) => makeWall(seed, players).slice(1, 14))];
		for (const hand of hands) {
			const counts = tileCounts(hand);
			let canWin = false;
			for (let index = 0; index < 34; index++) {
				if (counts[index] === 4 || (players === 3 && index > 9 && index < 17)) continue;
				counts[index]++;
				const complete = winning(counts, players);
				assert.equal(oracleShanten(counts, players) === -1, complete, hand.map(tileName).join(""));
				canWin ||= complete;
				counts[index]--;
			}
			assert.equal(oracleShanten(counts, players) === 0, canWin, hand.map(tileName).join(""));
		}
	}
});
