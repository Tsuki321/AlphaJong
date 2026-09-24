// Legal, public-information-only snapshots. The exact wait fixtures are shared
// in spirit with hand_analysis_optimization.test.mjs; no hidden hands are used.
export const curatedFixtures = [
	{ id: "closed-balanced", tags: ["closed", "kanchan"], hand: "234m456p345s77z68s9m" },
	{ id: "closed-overlap", tags: ["closed", "overlapping-sequences"], hand: "1122334567889m7p" },
	{ id: "red-five", tags: ["closed", "red-five"], hand: "234m340568p456s22z" },
	{ id: "open-yakuhai", tags: ["open", "yaku"], hand: "234m456p67s22z9m", melds: [["555z"]] },
	{ id: "open-no-yaku", tags: ["open", "no-yaku"], hand: "234m456p89s22z9m", melds: [["678m"]] },
	{ id: "concealed-kan", tags: ["kan", "closed"], hand: "123p456s79p22z8s", melds: [["1111m"]], concealedKans: true },
	{ id: "three-kans", tags: ["kan", "open"], hand: "45s77z8p", melds: [["1111m", "2222p", "3333z"]] },
	{ id: "chiitoitsu", tags: ["chiitoitsu", "closed"], hand: "1122m3344p5566s7z9p", analysisStrategy: "Chiitoitsu" },
	{ id: "kokushi", tags: ["kokushi", "closed"], hand: "19m19p19s1234567z5p", analysisStrategy: "Thirteen_Orphans" },
	{ id: "sanma", tags: ["sanma", "closed"], hand: "19m234456p34789s5z", players: 3 },
	{ id: "sanma-kokushi", tags: ["sanma", "kokushi"], hand: "19m19p19s1234567z5p", players: 3, analysisStrategy: "Thirteen_Orphans" },
	{ id: "dead-side-furiten", tags: ["furiten", "dead-wait"], hand: "123m456p123s77z45s9m", ponds: ["333s"] },
	{ id: "dead-single-wait", tags: ["furiten", "dead-wait"], hand: "123m456p789s111z2z9m", ponds: ["2z", "22z"] },
	{ id: "two-riichi-defense", tags: ["defense", "riichi", "genbutsu"], hand: "13579m2468p258s77z", indicators: "5p", tilesLeft: 12,
		ponds: ["1z9p", "9m1p1s2z3z7z", "9m9s6z4z2p", "9m6p8s7z"], riichi: [0, 1, 1, 0], riichiTiles: [null, "7z", "2p"] },
	{ id: "restricted-discard", tags: ["legality", "closed"], hand: "123m456p789s77z12s9m", invalidTiles: ["9m"] },
];

// Explicit structural expectations, derived by completing the written shapes.
// A visible dora indicator is part of the public count (kokushi has 38 live
// copies because its 6z indicator uses one of the otherwise 39 orphan tiles).
export const analysisExpectations = {
	"closed-balanced": { shanten: 0, ukeire: 4, structuralWaits: ["7s"], furiten: false },
	"closed-overlap": { shanten: 0, ukeire: 2, structuralWaits: ["8m"], furiten: false },
	"open-yakuhai": { shanten: 0, ukeire: 8, structuralWaits: ["5s", "8s"], furiten: false },
	"open-no-yaku": { shanten: 0, ukeire: 4, structuralWaits: ["7s"], furiten: false },
	"concealed-kan": { shanten: 0, ukeire: 4, structuralWaits: ["8p"], furiten: false },
	"three-kans": { shanten: 0, ukeire: 8, structuralWaits: ["3s", "6s"], furiten: false },
	"chiitoitsu": { shanten: 0, ukeire: 3, structuralWaits: ["7z"], furiten: false },
	"kokushi": { shanten: 0, ukeire: 38, structuralWaits: ["1p", "9p", "1m", "9m", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"], furiten: false },
	"sanma-kokushi": { shanten: 0, ukeire: 38, structuralWaits: ["1p", "9p", "1m", "9m", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"], furiten: false },
	"dead-side-furiten": { shanten: 0, ukeire: 4, structuralWaits: ["3s", "6s"], furiten: true },
	"dead-single-wait": { shanten: 0, ukeire: 0, structuralWaits: ["2z"], furiten: true },
	"restricted-discard": { shanten: 0, ukeire: 4, structuralWaits: ["3s"], furiten: false },
};

export function seededRandom(seed) {
	let state = seed >>> 0;
	return limit => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state % limit;
	};
}

export function parseTiles(text = "") {
	const tiles = [];
	for (const [, digits, suit] of text.matchAll(/([0-9]+)([pmsz])/g)) {
		for (const digit of digits) tiles.push({ type: "pmsz".indexOf(suit), index: Number(digit) || 5,
			dora: digit === "0", doraValue: digit === "0" ? 1 : 0, valid: true });
	}
	if (tiles.some(tile => tile.type === 3 && tile.index > 7)) throw new Error(`Invalid fixture tiles: ${text}`);
	return tiles;
}

export function tileName(tile) { return `${tile.dora ? 0 : tile.index}${"pmsz"[tile.type]}`; }

function tileString(tiles) { return tiles.map(tileName).join(""); }

export function randomFixtures(seed, count) {
	const random = seededRandom(seed);
	const result = [];
	for (let n = 0; n < count; n++) {
		const players = n % 3 === 0 ? 3 : 4;
		const pool = [];
		for (let type = 0; type < 4; type++) {
			for (let index = 1; index <= (type === 3 ? 7 : 9); index++) {
				if (players === 3 && type === 1 && index > 1 && index < 9) continue;
				for (let copy = 0; copy < 4; copy++) pool.push({ type, index, dora: type < 3 && index === 5 && copy === 0 });
			}
		}
		const draw = () => pool.splice(random(pool.length), 1)[0];
		const melds = [];
		if (n % 4 === 1 || n % 4 === 2) {
			const rank = random(7) + 1;
			const size = n % 4 === 2 ? 4 : 3;
			const group = [];
			for (let copy = 0; copy < size; copy++) group.push(pool.splice(pool.findIndex(tile => tile.type === 3 && tile.index === rank), 1)[0]);
			melds.push(tileString(group));
		}
		const hand = Array.from({ length: 14 - melds.length * 3 }, draw);
		const indicator = draw();
		const ponds = Array.from({ length: 4 }, (_, player) => player < players ?
			tileString(Array.from({ length: 2 + n % 7 }, draw)) : "");
		const riichi = [0, n % 4 === 3 ? 1 : 0, 0, 0];
		result.push({ id: `seed-${seed >>> 0}-${n}`, tags: ["seeded", players === 3 ? "sanma" : "yonma", melds.length ? "open" : "closed"],
			players, hand: tileString(hand), indicators: tileString([indicator]), ponds, melds: [melds], riichi,
			tilesLeft: Math.max(8, (players === 3 ? 54 : 70) - ponds.reduce((total, pond) => total + parseTiles(pond).length, 0)) });
	}
	return result;
}

export function materializeFixture(fixture) {
	const players = fixture.players ?? 4;
	const hand = parseTiles(fixture.hand);
	for (const tile of hand) if (fixture.invalidTiles?.includes(tileName(tile))) tile.valid = false;
	const calls = Array.from({ length: 4 }, (_, player) => (fixture.melds?.[player] ?? []).flatMap(group =>
		parseTiles(group).map((tile, index, all) => ({ ...tile, from: index === 0 && !(player === 0 && fixture.concealedKans && all.length === 4) ? (player + 1) % players : player,
			...(all.length === 4 && index === 3 ? { kan: true } : {}) }))));
	const discards = Array.from({ length: 4 }, (_, player) => parseTiles(fixture.ponds?.[player]));
	const dora = parseTiles(fixture.indicators ?? "6z");
	const counts = Array(34).fill(0);
	for (const tile of [...hand, ...calls.flat(), ...discards.flat(), ...dora]) {
		if (players === 3 && tile.type === 1 && tile.index > 1 && tile.index < 9) throw new Error(`${fixture.id}: unavailable sanma tile`);
		const index = tile.type * 9 + tile.index - 1;
		if (++counts[index] > 4) throw new Error(`${fixture.id}: fifth visible copy of ${tileName(tile)}`);
	}
	if (hand.length !== 14 - 3 * (fixture.melds?.[0]?.length ?? 0)) throw new Error(`${fixture.id}: wrong concealed hand length ${hand.length}`);
	if (!hand.some(tile => tile.valid)) throw new Error(`${fixture.id}: no legal discards`);
	return { players, ownHand: hand, calls, discards, dora, tilesLeft: fixture.tilesLeft ?? 50,
		seatWind: fixture.seatWind ?? 2, roundWind: fixture.roundWind ?? 1,
		isClosed: calls[0].length === 0 || !!fixture.concealedKans,
		riichi: Array.from({ length: 4 }, (_, index) => fixture.riichi?.[index] ?? 0),
		riichiTiles: Array.from({ length: 4 }, (_, index) => fixture.riichiTiles?.[index] ? parseTiles(fixture.riichiTiles[index])[0] : null),
		analysisStrategy: fixture.analysisStrategy ?? "General" };
}
