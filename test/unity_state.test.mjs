import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// Run actual decoded protobuf packets through the reducer, including proto3
// defaults, packed arrays, signed scores and the live action XOR wrapper.
const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer });
vm.runInContext(await readFile(new URL("../src/unity_protocol.js", import.meta.url), "utf8"), context);
vm.runInContext(await readFile(new URL("../src/unity_state.js", import.meta.url), "utf8"), context);
const protocol = vm.runInContext("AlphaJongUnityProtocol", context);
const State = vm.runInContext("AlphaJongUnityState", context);
const plain = value => JSON.parse(JSON.stringify(value));
const identities = entries => Array.from(entries, entry => entry.val.toString());
const HAND4 = ["1m", "2m", "3m", "2p", "3p", "4p", "6s", "7s", "8s", "1z", "1z", "2z", "3z"];
const HAND3 = ["1m", "1m", "9m", "2p", "3p", "4p", "6s", "7s", "8s", "1z", "1z", "2z", "3z"];
function operation(seat, list = [{ type: 1 }], timing = {}) {
	return { seat, operation_list: list, time_add: 20000, time_fixed: 5000, ...timing };
}
function response(state, method, type, data) {
	const name = ".lq.FastTest." + method;
	return state.consume(protocol.decodeFrame(protocol.encodeEnvelope("response", 1, "", protocol.encodeMessage(type, data)), name), "in");
}
function request(state, method, data = {}) {
	return state.consume(protocol.decodeFrame(protocol.encodeRequest(1, ".lq.FastTest." + method, data)), "out");
}
function notification(state, name, data) {
	return state.consume(protocol.decodeFrame(protocol.encodeEnvelope("notification", null, ".lq." + name,
		protocol.encodeMessage(name, data))), "in");
}
function liveAction(state, name, data, step) {
	return notification(state, "ActionPrototype", { name, step, data: protocol.xorAction(protocol.encodeMessage(name, data)) });
}
function fixture({ self = 2, count = 4, dealer = 0, hand, rules = {}, options = {}, start = true } = {}) {
	let clock = 100000, step = 0;
	const changes = [], observed = [], state = State.create({ now: () => clock,
		onChange: event => changes.push(event), onDiscard: event => observed.push(event), ...options });
	const seatList = Array.from({ length: count }, (_, index) => 100 + index);
	assert.equal(request(state, "authGame", { account_id: seatList[self] }), true);
	const config = { mode: { mode: count === 3 ? 12 : 2, detail_rule: { dora_count: 3, ...rules } }, meta: { mode_id: 9 } };
	assert.equal(response(state, "authGame", "ResAuthGame", { seat_list: seatList, game_config: config }), true);
	const history = [];
	const f = { state, history, changes, observed, self, count,
		manager: () => state.getManager(),
		player: absoluteSeat => state.getManager().players[state.getManager().seat2LocalPosition(absoluteSeat)],
		advance: milliseconds => { clock += milliseconds; },
		send(name, data, actionStep = step++) {
			history.push({ name, step: actionStep, data: protocol.encodeMessage(name, data) });
			return liveAction(state, name, data, actionStep);
		},
		act(name, data) {
			assert.equal(f.send(name, data), true, `${name}: ${state.getStatus().reason}`);
		},
		restore(actions = history, extra = {}) {
			return response(state, "syncGame", "ResSyncGame", { step: actions.at(-1).step + 1,
				game_restore: { actions, passed_waiting_time: 0 }, ...extra });
		}
	};
	if (start) {
		f.act("ActionMJStart", {});
		f.act("ActionNewRound", { ju: dealer, scores: Array(count).fill(count === 3 ? 35000 : 25000),
			tiles: hand || [...(count === 3 ? HAND3 : HAND4), ...(self === dealer ? ["4z"] : [])],
			doras: ["9p"], left_tile_count: count === 3 ? 55 : 70,
			operation: self === dealer ? operation(self) : null });
	}
	return f;
}
function untilSelfDraw(f, drawn = "5s", ops = operation(f.self)) {
	f.act("ActionDiscardTile", { seat: 0, tile: "5m" });
	f.act("ActionDealTile", { seat: 1, left_tile_count: 69 });
	f.act("ActionDiscardTile", { seat: 1, tile: "9s", moqie: true });
	f.act("ActionDealTile", { seat: 2, tile: drawn, left_tile_count: 68, operation: ops });
}

test("authenticated seats map to legacy display positions for every 3p/4p seat", () => {
	for (const count of [3, 4]) for (let self = 0; self < count; self++) {
		const f = fixture({ self, count });
		assert.equal(f.state.isInGame(), true);
		assert.equal(f.state.isLobbyReady(), true);
		assert.equal(f.state.getSeat(), self);
		assert.equal(f.state.getPlayerCount(), count);
		assert.equal(f.manager().mainrole.seat, self);
		for (let relative = 0; relative < count; relative++) {
			const display = count === 3 && relative === 2 ? 3 : relative;
			const absolute = (self + relative) % count;
			assert.equal(f.manager().seat2LocalPosition(absolute), display);
			assert.equal(f.manager().localPosition2Seat(display), absolute);
			assert.equal(f.manager().players[display].seat, absolute);
		}
		if (count === 3) assert.equal(f.manager().players[2], null);
	}
});

test("login becomes ready without copying tokens or treating viewed profiles as self", () => {
	const state = State.create();
	state.consume({ kind: "response", method: ".lq.Lobby.login", message: { account_id: 17, access_token: "private" } }, "in");
	assert.equal(state.isLobbyReady(), true);
	assert.equal(state.getAccountId(), 17);
	assert.equal(state.getStatus().phase, "lobby");
	assert.equal(state.consume({ kind: "response", method: ".lq.Lobby.fetchAccountInfo", message: { account: { account_id: 18 } } }, "in"), false);
	assert.equal(state.getAccountId(), 17);
	assert.equal(JSON.stringify(state.getStatus()).includes("private"), false);
	assert.equal(state.isInGame(), false);
});

test("authentication and special modes fail closed, including non-player spectators", () => {
	for (const bad of [
		{ seat_list: [10, 11, 12, 13], game_config: { mode: { mode: 2 } } },
		{ seat_list: [100, 11], game_config: { mode: { mode: 2 } } },
		{ seat_list: [100, 11, 12], game_config: { mode: { mode: 2 } } },
		{ seat_list: [100, 11, 12, 13], game_config: { mode: { mode: 3 } } },
		{ seat_list: [100, 11, 12, 13], game_config: { mode: { mode: 2, detail_rule: { amusement_switches: [1] } } } },
		{ error: { code: 1003 } }
	]) {
		const state = State.create();
		request(state, "authGame", { account_id: 100 });
		response(state, "authGame", "ResAuthGame", bad);
		assert.equal(state.isInGame(), false);
		assert.equal(state.getStatus().phase, "paused");
	}
	// The actual decoder supplies [] for absent amusement_switches.
	assert.equal(fixture().state.isInGame(), true);
});

test("initial hand, negative scores, round counters and tile identity survive actual codec", () => {
	const f = fixture({ start: false });
	f.act("ActionNewRound", { chang: 1, ju: 1, ben: 2, liqibang: 3, tiles: HAND4,
		dora: "0s", scores: [40000, 50000, -1000, 11000], left_tile_count: 70 });
	assert.equal(f.manager().mainrole.score, -1000);
	assert.deepEqual([f.manager().index_change, f.manager().index_ju, f.manager().index_ben, f.manager().liqibang], [1, 1, 2, 3]);
	assert.deepEqual(identities(f.manager().mainrole.hand), HAND4);
	const red = f.manager().dora[0];
	assert.deepEqual([red.toString(), red.index, red.type, red.dora], ["0s", 5, 2, true]);
	assert.deepEqual([State.tile("2p").type, State.tile("2m").type, State.tile("2s").type, State.tile("2z").type], [0, 1, 2, 3]);
	assert.throws(() => State.tile("0z"));
	assert.throws(() => State.tile("10m"));
});

test("opponent draws use public counts and never retain an offered hidden tile identity", () => {
	const f = fixture();
	f.act("ActionDiscardTile", { seat: 0, tile: "5m" });
	f.act("ActionDealTile", { seat: 1, tile: "7z", left_tile_count: 69 });
	assert.equal(f.player(1).hand.length, 14);
	assert.equal(f.player(1).last_tile.val, null);
	assert.ok(f.player(1).hand.every(entry => entry.val === null));
	assert.equal(JSON.stringify(f.manager()).includes("7z"), false);
	f.act("ActionDiscardTile", { seat: 1, tile: "9s", moqie: true });
	assert.equal(f.player(1).hand.length, 13);
	assert.equal(f.player(1).container_qipai.last_pai.val.tsumogiri, true);
});

test("own draws, forbidden red/normal discard values and pending manual input", () => {
	const f = fixture({ hand: ["5p", "0p", ...HAND4.slice(2)] });
	untilSelfDraw(f, "6p", operation(2, [{ type: 1, combination: ["5p"] }]));
	assert.equal(f.manager().mainrole.hand.length, 14);
	assert.equal(f.manager().mainrole.last_tile.val.toString(), "6p");
	assert.ok(f.manager().mainrole.hand.filter(entry => entry.val.index === 5 && entry.val.type === 0).every(entry => !entry.valid));
	assert.equal(f.manager().mainrole.last_tile.valid, true);
	const before = f.state.getEpoch();
	request(f.state, "inputOperation", { type: 1, tile: "6p", moqie: true });
	assert.ok(f.state.getEpoch() > before);
	assert.equal(f.manager().oplist.length, 0);
	assert.ok(f.manager().mainrole.hand.every(entry => !entry.valid));
	f.act("ActionDiscardTile", { seat: 2, tile: "6p", moqie: true });
	assert.equal(f.manager().mainrole.hand.length, 13);
	assert.equal(f.manager().mainrole.last_tile, null);
	assert.ok(identities(f.manager().mainrole.hand).includes("0p"));
});

test("a normal five discard does not remove the red five", () => {
	const f = fixture({ self: 0, hand: ["0p", "5p", ...HAND4.slice(2), "4z"] });
	f.act("ActionDiscardTile", { seat: 0, tile: "5p", moqie: false });
	assert.ok(identities(f.manager().mainrole.hand).includes("0p"));
	assert.ok(!identities(f.manager().mainrole.hand).includes("5p"));
});

test("discard observations happen before the pond changes, with absolute and local seat mapping", () => {
	let state, observedLength;
	const f = fixture({ self: 2, options: { onDiscard: event => {
		const m = state.getManager();
		observedLength = m.players[m.seat2LocalPosition(event.seat)].container_qipai.pais.length;
		assert.equal(m.lastqipai, null);
		assert.equal(event.player, 2);
		assert.equal(event.seat, 0);
		assert.equal(event.tile.toString(), "7z");
	} } });
	state = f.state;
	f.act("ActionDiscardTile", { seat: 0, tile: "7z", is_liqi: true });
	assert.equal(observedLength, 0);
	assert.equal(f.state.getDiscardEvents().length, 1);
	assert.equal(f.player(0).container_qipai.last_pai.val.toString(), "7z");
	assert.equal(f.player(0).liqibang._activeInHierarchy, true);
});

test("pon removes only the called pond tile, tracks origins, and leaves the right hand size", () => {
	const f = fixture({ hand: ["5p", "0p", ...HAND4.slice(2)] });
	f.act("ActionDiscardTile", { seat: 0, tile: "5p", operation: operation(2, [{ type: 3, combination: ["5p|0p"] }]) });
	f.act("ActionChiPengGang", { seat: 2, type: 1, tiles: ["5p", "0p", "5p"], froms: [2, 2, 0], operation: operation(2) });
	assert.equal(f.player(0).container_qipai.last_pai, null);
	assert.equal(f.manager().mainrole.hand.length, 11);
	assert.equal(f.manager().index_player, 2);
	const meld = f.manager().mainrole.container_ming.mings[0];
	assert.deepEqual(Array.from(meld.pais, value => value.toString()), ["5p", "0p", "5p"]);
	assert.deepEqual(Array.from(meld.from), [2, 2, 0]);
	f.act("ActionDiscardTile", { seat: 2, tile: "3m" });
	assert.equal(f.manager().mainrole.hand.length, 10);
});

test("chi validates sequence and clockwise origin; kuikae restrictions remain invalid", () => {
	const f = fixture({ self: 1, hand: ["4m", "0m", ...HAND4.slice(2)] });
	f.act("ActionDiscardTile", { seat: 0, tile: "3m" });
	f.act("ActionChiPengGang", { seat: 1, type: 0, tiles: ["3m", "4m", "0m"], froms: [0, 1, 1],
		operation: operation(1, [{ type: 1, combination: ["3m", "6m"] }]) });
	assert.equal(f.manager().mainrole.hand.find(entry => entry.val.toString() === "3m").valid, false);
	assert.equal(f.manager().mainrole.hand.length, 11);
});

test("daiminkan, replacement draw and dora updates preserve the public counts", () => {
	const f = fixture({ hand: ["7p", "7p", "7p", ...HAND4.slice(3)] });
	f.act("ActionDiscardTile", { seat: 0, tile: "7p" });
	f.act("ActionChiPengGang", { seat: 2, type: 2, tiles: ["7p", "7p", "7p", "7p"], froms: [2, 2, 2, 0] });
	assert.equal(f.manager().mainrole.hand.length, 10);
	f.act("ActionDealTile", { seat: 2, tile: "5z", left_tile_count: 69, doras: ["9p", "6z"], operation: operation(2) });
	assert.equal(f.manager().mainrole.hand.length, 11);
	assert.deepEqual(Array.from(f.manager().dora, tile => tile.toString()), ["9p", "6z"]);
});

test("concealed kan preserves all four actual red identities and marks every origin as self", () => {
	const f = fixture({ self: 0, hand: ["0p", "5p", "5p", "5p", ...HAND4.slice(4), "4z"] });
	f.act("ActionAnGangAddGang", { seat: 0, type: 3, tiles: "5p" });
	const meld = f.manager().mainrole.container_ming.mings[0];
	assert.equal(f.manager().mainrole.hand.length, 10);
	assert.deepEqual(Array.from(meld.pais, tile => tile.toString()), ["0p", "5p", "5p", "5p"]);
	assert.deepEqual(Array.from(meld.from), [0, 0, 0, 0]);
	f.act("ActionDealTile", { seat: 0, tile: "4z", left_tile_count: 69, doras: ["9p", "6z"], operation: operation(0) });
	assert.equal(f.manager().mainrole.hand.length, 11);
});

test("opponent concealed kan expands its public four tiles using room red-five settings", () => {
	const f = fixture({ rules: { dora_count: 4 } });
	f.act("ActionAnGangAddGang", { seat: 0, type: 3, tiles: "5p" });
	const meld = f.player(0).container_ming.mings[0];
	assert.equal(f.player(0).hand.length, 10);
	assert.equal(meld.pais.filter(tile => tile.dora).length, 2);
	assert.ok(f.player(0).hand.every(entry => entry.val == null));
});

test("kakan adds the fourth tile to an existing pon without creating a second meld", () => {
	const f = fixture({ self: 3 });
	f.act("ActionDiscardTile", { seat: 0, tile: "5p" });
	f.act("ActionChiPengGang", { seat: 1, type: 1, tiles: ["5p", "5p", "5p"], froms: [1, 1, 0], operation: null });
	f.act("ActionAnGangAddGang", { seat: 1, type: 2, tiles: "0p", operation: operation(3, [{ type: 9 }]) });
	assert.equal(f.player(1).container_ming.mings.length, 1);
	assert.equal(f.player(1).container_ming.mings[0].pais.length, 4);
	assert.equal(f.player(1).container_ming.mings[0].pais[3].toString(), "0p");
	assert.equal(f.player(1).hand.length, 10);
	assert.equal(f.manager().lastqipai.val.toString(), "0p");
	assert.equal(f.manager().oplist[0].type, 9);
});

test("sanma north extraction removes only north, then permits the replacement draw", () => {
	const f = fixture({ self: 0, count: 3 });
	f.act("ActionBaBei", { seat: 0, moqie: true });
	assert.equal(f.manager().mainrole.hand.length, 13);
	assert.equal(f.manager().mainrole.container_babei.pais.length, 1);
	assert.equal(f.manager().mainrole.container_ming.mings.length, 0);
	f.act("ActionDealTile", { seat: 0, tile: "4z", left_tile_count: 54, operation: operation(0, [{ type: 1 }, { type: 11 }]) });
	assert.equal(f.manager().mainrole.hand.length, 14);
	assert.equal(f.manager().mainrole.last_tile.val.toString(), "4z");
	assert.ok(f.manager().oplist.some(entry => entry.type === 11));
});

test("riichi acceptance updates scores and only the next drawn tile remains discardable", () => {
	const f = fixture({ self: 0 });
	f.act("ActionDiscardTile", { seat: 0, tile: "4z", is_liqi: true, moqie: true });
	f.act("ActionDealTile", { seat: 1, left_tile_count: 69, liqi: { seat: 0, score: 24000, liqibang: 1 } });
	assert.equal(f.manager().mainrole.score, 24000);
	assert.equal(f.manager().liqibang, 1);
	f.act("ActionDiscardTile", { seat: 1, tile: "9s", moqie: true });
	f.act("ActionDealTile", { seat: 2, left_tile_count: 68 });
	f.act("ActionDiscardTile", { seat: 2, tile: "6p", moqie: true });
	f.act("ActionDealTile", { seat: 3, left_tile_count: 67 });
	f.act("ActionDiscardTile", { seat: 3, tile: "6z", moqie: true });
	f.act("ActionDealTile", { seat: 0, tile: "2p", left_tile_count: 66, operation: operation(0) });
	assert.equal(f.manager().mainrole.hand.filter(entry => entry.valid).length, 1);
	assert.equal(f.manager().mainrole.last_tile.valid, true);
});

test("server furiten filters ron and clears when a subsequent action reports false", () => {
	const f = fixture();
	f.act("ActionDiscardTile", { seat: 0, tile: "7z", zhenting: true, operation: operation(2, [{ type: 9 }]) });
	assert.equal(f.state.isFuriten(), true);
	assert.equal(f.manager().oplist.length, 0);
	f.act("ActionDealTile", { seat: 1, left_tile_count: 69, zhenting: false });
	assert.equal(f.state.isFuriten(), false);
});

test("millisecond wire timers expose seconds and expire operations exactly once", () => {
	const f = fixture({ self: 0 });
	assert.equal(f.manager().time_add, 20);
	assert.equal(f.manager().time_fixed, 5);
	assert.equal(f.state.getStatus().operationDeadline, 125000);
	f.advance(24999);
	assert.equal(f.manager().oplist.length, 1);
	const before = f.state.getEpoch();
	f.advance(1);
	assert.equal(f.manager().oplist.length, 0);
	assert.equal(f.state.getEpoch(), before + 1);
	assert.equal(f.state.getEpoch(), before + 1);
	assert.equal(f.changes.filter(event => event.type === "timeout").length, 1);
});

test("duplicates do not replay a draw or discard and gaps invalidate all decisions", () => {
	const f = fixture();
	f.act("ActionDiscardTile", { seat: 0, tile: "7z" });
	const before = f.state.getEpoch(), old = f.history.at(-1);
	assert.equal(liveAction(f.state, old.name, protocol.decodeMessage(old.name, old.data), old.step), false);
	assert.equal(f.state.getEpoch(), before);
	assert.equal(f.state.getDiscardEvents().length, 1);
	assert.equal(f.send("ActionDealTile", { seat: 1, left_tile_count: 69 }, old.step + 2), false);
	assert.equal(f.state.isInGame(), false);
	assert.equal(f.manager().oplist.length, 0);
	assert.match(f.state.getStatus().reason, /missed/);
	assert.equal(f.send("ActionDealTile", { seat: 1, left_tile_count: 69 }, old.step + 1), false);
});

test("unknown, malformed and impossible updates disable the adapter until a fresh complete round", () => {
	for (const trigger of [
		f => f.state.consume({ kind: "notification", method: ".lq.ActionNewCard", step: 2, message: {} }, "in"),
		f => f.send("ActionDealTile", { seat: 2, tile: "5s", left_tile_count: 69 }),
		f => f.send("ActionDiscardTile", { seat: 0, tile: "0z" }),
		f => f.send("ActionNewRound", { ju: 0, scores: [25000, 25000, 25000, 25000], tiles: ["1m"], doras: ["9p"], left_tile_count: 70 }),
		f => f.state.consume({ kind: "notification", method: ".lq.ActionPrototype", message: { step: 2, name: "ActionDealTile", data: new Uint8Array([1, 2]) } }, "in")
	]) {
		const f = fixture();
		assert.equal(trigger(f), false);
		assert.equal(f.state.isInGame(), false);
		assert.equal(f.manager().oplist.length, 0);
		f.act("ActionNewRound", { ju: 0, ben: 1, scores: [25000, 25000, 25000, 25000], tiles: HAND4, doras: ["6z"], left_tile_count: 70 });
		assert.equal(f.state.isInGame(), true);
	}
});

test("full sync replays MJStart and NewRound, validates the latest step and observes no historical discards", () => {
	const f = fixture();
	untilSelfDraw(f);
	const initial = identities(f.manager().mainrole.hand), priorObservations = f.observed.length;
	f.state.invalidate("socket reset");
	request(f.state, "syncGame", {});
	assert.equal(f.state.isInGame(), false);
	assert.equal(f.restore(), true);
	assert.equal(f.state.isInGame(), true);
	assert.deepEqual(identities(f.manager().mainrole.hand), initial);
	assert.equal(f.manager().oplist[0].type, 1);
	assert.equal(f.observed.length, priorObservations);
	assert.ok(f.state.getDiscardEvents().every(event => event.replaying));
	assert.equal(f.changes.at(-1).type, "restore");
});

test("initial enterGame may have no replay or only MJStart before the first live round", () => {
	for (const initial of [{}, { step: 1, game_restore: { actions: [{ step: 0, name: "ActionMJStart", data: new Uint8Array() }] } }]) {
		const f = fixture({ start: false });
		request(f.state, "enterGame");
		assert.equal(response(f.state, "enterGame", "ResSyncGame", initial), true);
		assert.equal(f.state.getStatus().phase, "authenticated");
		assert.equal(liveAction(f.state, "ActionNewRound", { ju: 0, scores: [25000, 25000, 25000, 25000],
			tiles: HAND4, doras: ["6z"], left_tile_count: 69 }, 1), true);
		assert.equal(f.state.isInGame(), true);
	}
});

test("restored waiting time conservatively expires an already-used operation window", () => {
	const f = fixture();
	untilSelfDraw(f);
	assert.equal(f.restore(f.history, { game_restore: { actions: f.history, passed_waiting_time: 26 } }), true);
	assert.equal(f.manager().oplist.length, 0);
	assert.equal(f.state.isInGame(), true);
});

test("truncated replay, opaque snapshot and conflicting steps never expose stale operations", () => {
	for (const bad of [
		f => ({ step: 8, game_restore: { actions: f.history } }),
		f => ({ step: 7, game_restore: { snapshot: {}, actions: f.history.slice(-1) } }),
		f => ({ step: 7, game_restore: { actions: f.history.filter(action => action.step !== 4) } })
	]) {
		const f = fixture();
		untilSelfDraw(f);
		f.state.invalidate("socket reset");
		response(f.state, "syncGame", "ResSyncGame", bad(f));
		assert.equal(f.state.isInGame(), false);
		assert.equal(f.manager().oplist.length, 0);
	}
});

test("win, exhaustive draw and abortive draw end decisions; game-end notification stops the board", () => {
	for (const [name, data, expected] of [
		["ActionHule", { old_scores: [25000, 25000, 25000, 25000], delta_scores: [-8000, 0, 8000, 0], scores: [17000, 25000, 33000, 25000] }, 33000],
		["ActionNoTile", { scores: [{ old_scores: [25000, 25000, 25000, 25000], delta_scores: [-1000, -1000, 3000, -1000] }] }, 28000],
		["ActionLiuJu", { type: 1 }, 25000]
	]) {
		const f = fixture();
		f.act(name, data);
		assert.equal(f.state.getStatus().phase, "round-ended");
		assert.equal(f.manager().oplist.length, 0);
		assert.equal(f.manager().mainrole.score, expected);
		notification(f.state, "NotifyGameEndResult", {});
		assert.equal(f.state.isInGame(), false);
		assert.equal(f.manager().gameEndResult.ended, true);
	}
});

test("unrelated requests and responses cannot reopen operations; connection/logout invalidation is safe", () => {
	const f = fixture({ self: 0 });
	request(f.state, "inputOperation", { type: 1, tile: "4z" });
	response(f.state, "inputOperation", "ResCommon", {});
	assert.equal(f.manager().oplist.length, 0);
	notification(f.state, "NotifyPlayerConnectionState", { seat: 1, state: 0 });
	assert.equal(f.manager().player_link_state[1], 0);
	f.state.invalidate("Game connection closed.");
	assert.equal(f.state.isInGame(), false);
	assert.equal(f.manager().oplist.length, 0);
});

test("callback failures cannot corrupt the action stream or leak authentication fields", () => {
	const f = fixture({ options: { onChange() { throw new Error("UI unavailable"); }, onDiscard() { throw new Error("UI unavailable"); } } });
	f.act("ActionDiscardTile", { seat: 0, tile: "7z" });
	assert.equal(f.state.isInGame(), true);
	assert.equal(f.player(0).hand.length, 13);
	assert.deepEqual(Object.keys(plain(f.state.getStatus())).sort(), ["epoch", "furiten", "inGame", "lobbyReady", "operationDeadline", "phase", "playerCount", "reason", "seat", "step"].sort());
});
