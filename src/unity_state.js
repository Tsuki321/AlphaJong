// Reconstruct only the local hand and public board from the browser's game
// messages. This module has no network, DOM, Unity, or legacy-client dependency.
// Wire field names: https://mahjongsoul.game.yo-star.com/v0.11.243.w/res/proto/liqi.json
// Unity schema: https://github.com/shinkuan/Akagi/blob/v3/src/bridge/majsoul/proto/liqi.proto
var AlphaJongUnityState = (function () {
	"use strict";

	var OPERATIONS = Object.freeze({ none: 0, dapai: 1, eat: 2, peng: 3, an_gang: 4,
		ming_gang: 5, add_gang: 6, liqi: 7, zimo: 8, rong: 9, jiuzhongjiupai: 10, babei: 11 });
	var SUITS = { p: 0, m: 1, s: 2, z: 3 };
	var ACTIONS = new Set(["ActionMJStart", "ActionNewRound", "ActionDealTile", "ActionDiscardTile",
		"ActionChiPengGang", "ActionAnGangAddGang", "ActionBaBei", "ActionHule",
		"ActionNoTile", "ActionLiuJu"]);
	var SPECIAL_RULES = ["guyi_mode", "dora3_mode", "begin_open_mode", "jiuchao_mode",
		"muyu_mode", "open_hand", "xuezhandaodi", "huansanzhang", "chuanma",
		"reveal_discard", "field_spell_mode", "zhanxing", "tianming_mode", "yongchang_mode",
		"hunzhiyiji_mode", "wanxiangxiuluo_mode", "beishuizhizhan_mode", "amusement_switches"];

	function integer(value, min, max) {
		return Number.isInteger(value) && value >= min && value <= max;
	}
	function requireState(condition, reason) {
		if (!condition) throw new Error(reason);
	}
	function tile(name) {
		requireState(typeof name === "string" && /^(?:[1-9][mps]|0[mps]|[1-7]z)$/.test(name), "Invalid tile identity");
		return { index: name[0] === "0" ? 5 : Number(name[0]), type: SUITS[name[1]], dora: name[0] === "0",
			toString: function () { return name; } };
	}
	function sameValue(a, b) {
		return a != null && b != null && a.type === b.type && a.index === b.index;
	}
	function tileList(names) {
		requireState(Array.isArray(names), "Missing tile list");
		return names.map(tile);
	}
	function wrapper(value) {
		return { val: value, valid: false, old: false };
	}
	function shortName(name) {
		return typeof name === "string" ? name.split(".").pop() : "";
	}
	function outgoing(frame, direction) {
		return direction === "out" || direction === "outbound" || direction === "send" ||
			frame.kind === "request" || frame.kind === 2;
	}
	function response(frame) {
		return frame.kind === "response" || frame.kind === 3;
	}
	function zero(value) {
		return value == null ? 0 : value;
	}
	function hasError(message) {
		return message.error != null && zero(message.error.code) !== 0;
	}
	function fingerprint(value) {
		// Keep bounded duplicate markers, not copies of payloads that may include
		// concealed tiles in a spectator or special-mode packet.
		var text = JSON.stringify(value), first = 2166136261, second = 5381;
		for (var i = 0; i < text.length; i++) {
			first = Math.imul(first ^ text.charCodeAt(i), 16777619);
			second = Math.imul(second, 33) ^ text.charCodeAt(i);
		}
		return text.length + ":" + (first >>> 0) + ":" + (second >>> 0);
	}

	function create(options) {
		options = options || {};
		var now = typeof options.now === "function" ? options.now : Date.now;
		var accountId = null, seat = -1, playerCount = 0, manager = null;
		var phase = "waiting", reason = "Waiting for the game connection.", lobbyReady = false;
		var epoch = 0, lastStep = null, validRound = false, furiten = false, deadline = 0;
		var lastDiscard = null, replaying = false, actionDigests = new Map(), roundDigests = new Set();
		var discardEvents = [], pendingAuth = false, gameConfig = null;
		var syncPending = false;

		function status() {
			return { phase: phase, reason: reason, lobbyReady: lobbyReady,
				inGame: manager != null && manager.active === true, seat: seat, playerCount: playerCount,
				epoch: epoch, step: lastStep, furiten: furiten, operationDeadline: deadline };
		}
		function notify(type, action) {
			if (replaying || typeof options.onChange !== "function") return;
			try { options.onChange(Object.assign({ type: type, action: action || "" }, status())); }
			catch (_) { /* UI observation must never interrupt packet processing. */ }
		}
		function clearOperations() {
			deadline = 0;
			if (manager == null) return;
			manager.oplist = [];
			for (var handTile of manager.mainrole.hand) handTile.valid = false;
		}
		function invalidate(message) {
			epoch++;
			clearOperations();
			validRound = false;
			syncPending = false;
			phase = "paused";
			reason = message || "Waiting for a complete game state.";
			if (manager != null) manager.active = false;
			notify("invalidated");
			return false;
		}
		function pauseForSync() {
			epoch++;
			clearOperations();
			syncPending = true;
			phase = "synchronizing";
			reason = "Waiting for the game to restore the round.";
			if (manager != null) manager.active = false;
			notify("request");
		}
		function positions() { return playerCount === 3 ? [0, 1, 3] : [0, 1, 2, 3]; }
		function getPlayer(absoluteSeat) {
			requireState(manager != null && integer(absoluteSeat, 0, playerCount - 1), "Invalid player seat");
			return manager.players[manager.seat2LocalPosition(absoluteSeat)];
		}
		function makeManager() {
			var count = playerCount, selfSeat = seat, displayPositions = positions();
			var players = [null, null, null, null];
			for (var relative = 0; relative < count; relative++) {
				players[displayPositions[relative]] = {
					seat: (selfSeat + relative) % count, score: 0, hand: [], last_tile: null,
					container_qipai: { pais: [], last_pai: null, last_is_liqi: false },
					container_ming: { mings: [] }, container_babei: { pais: [] },
					liqibang: { _activeInHierarchy: false }
				};
			}
			return { players: players, mainrole: players[0], active: false, gameEndResult: null,
				oplist: [], dora: [], left_tile_count: 0, lastqipai: null,
				index_player: 0, index_ju: 0, index_change: 0, index_ben: 0, liqibang: 0,
				game_config: gameConfig, player_link_state: Array(count).fill(1), time_add: 20, time_fixed: 5,
				localPosition2Seat: function (position) {
					var relativePosition = displayPositions.indexOf(position);
					return relativePosition < 0 ? -1 : (selfSeat + relativePosition) % count;
				},
				seat2LocalPosition: function (absoluteSeat) {
					return integer(absoluteSeat, 0, count - 1) ? displayPositions[(absoluteSeat - selfSeat + count) % count] : -1;
				}
			};
		}
		function authenticate(message) {
			requireState(!hasError(message), "Game authentication failed.");
			requireState(accountId != null && Array.isArray(message.seat_list), "The local account seat is unknown.");
			var seats = message.seat_list;
			requireState((seats.length === 3 || seats.length === 4) && seats.every(id => integer(id, 0, 0xffffffff)), "Unsupported player count.");
			requireState(seats.filter(id => id === accountId).length === 1, "The account is not an active player.");
			var config = message.game_config, mode = config && config.mode;
			requireState(mode && [1, 2, 11, 12].includes(mode.mode), "This game mode is not supported.");
			requireState((mode.mode >= 10 ? 3 : 4) === seats.length, "Inconsistent game mode and seats.");
			var rules = mode.detail_rule || {};
			requireState(!SPECIAL_RULES.some(name => Array.isArray(rules[name]) ? rules[name].length > 0 : !!rules[name]), "This game uses unsupported special rules.");
			requireState(integer(zero(rules.dora_count), 0, 4), "Unsupported red-five configuration.");
			seat = seats.indexOf(accountId);
			playerCount = seats.length;
			// Retain only board configuration; authentication tokens and player profiles
			// are never copied into adapter state, diagnostic events, or fixtures.
			gameConfig = { mode: { mode: mode.mode, detail_rule: {
				dora_count: zero(rules.dora_count), time_add: zero(rules.time_add), time_fixed: zero(rules.time_fixed)
			} }, meta: { mode_id: config.meta ? zero(config.meta.mode_id) : 0 } };
			manager = makeManager();
			lastStep = null;
			validRound = false;
			lastDiscard = null;
			furiten = false;
			actionDigests.clear();
			roundDigests.clear();
			discardEvents = [];
			pendingAuth = false;
			syncPending = false;
			lobbyReady = true;
			phase = "authenticated";
			reason = "Waiting for the round's game state.";
			epoch++;
			notify("auth");
		}
		function setScores(scores) {
			requireState(Array.isArray(scores) && scores.length === playerCount &&
				scores.every(score => Number.isSafeInteger(score)), "Incomplete player scores");
			scores.forEach((score, absoluteSeat) => { getPlayer(absoluteSeat).score = score; });
		}
		function setDora(names) {
			var indicators = tileList(names);
			requireState(indicators.length > 0 && indicators.length <= 5, "Invalid dora indicators");
			manager.dora = indicators;
		}
		function baseHandSize(player) { return 13 - 3 * player.container_ming.mings.length; }
		function checkHand(player, drawn) {
			requireState(player.hand.length === baseHandSize(player) + (drawn ? 1 : 0), "The hand no longer matches the action sequence");
		}
		function checkVisibleTiles() {
			var visible = manager.dora.concat(manager.mainrole.hand.map(entry => entry.val));
			for (var player of manager.players) {
				if (!player) continue;
				visible.push(...player.container_qipai.pais.map(entry => entry.val));
				if (player.container_qipai.last_pai) visible.push(player.container_qipai.last_pai.val);
				visible.push(...player.container_babei.pais.map(entry => entry.val));
				for (var meld of player.container_ming.mings) visible.push(...meld.pais);
			}
			var counts = new Map();
			for (var value of visible) {
				requireState(playerCount !== 3 || value.type !== 1 || value.index === 1 || value.index === 9, "An unavailable manzu tile appeared in a three-player game");
				var key = value.type + ":" + value.index;
				counts.set(key, (counts.get(key) || 0) + 1);
				requireState(counts.get(key) <= 4, "The visible board contains too many copies of a tile");
			}
		}
		function removeOwn(names, tsumogiri) {
			var hand = manager.mainrole.hand, next = hand.slice(), removed = [];
			for (var name of names) {
				var index = tsumogiri ? next.indexOf(manager.mainrole.last_tile) : next.findIndex(entry => entry.val.toString() === name);
				requireState(index >= 0 && next[index].val.toString() === name, "An action uses a tile missing from the local hand");
				removed.push(next.splice(index, 1)[0].val);
			}
			manager.mainrole.hand = next;
			manager.mainrole.last_tile = null;
			return removed;
		}
		function removeHidden(player, count, tsumogiri) {
			requireState(player.hand.length >= count, "Invalid public hand count");
			// Preserve the old/new marker used by defensive hand-change observations.
			player.hand.splice(tsumogiri ? player.hand.length - count : 0, count);
			player.last_tile = null;
		}
		function setOperations(operation) {
			clearOperations();
			if (operation == null) return;
			requireState(integer(zero(operation.seat), 0, playerCount - 1), "Invalid operation seat");
			if (zero(operation.seat) !== seat) return;
			var list = operation.operation_list || [];
			requireState(Array.isArray(list), "Invalid operation list");
			var seen = new Set();
			var operations = list.map(entry => {
				requireState(entry && integer(entry.type, 1, 11) && !seen.has(entry.type), "Unsupported or repeated operation");
				seen.add(entry.type);
				var combination = entry.combination || [];
				requireState(Array.isArray(combination) && combination.every(value => typeof value === "string" && value.length < 80), "Invalid call options");
				for (var option of combination) option.split("|").forEach(tile);
				if ([2, 3, 4, 5, 6, 7].includes(entry.type)) requireState(combination.length > 0, "Missing call options");
				if (entry.type === 11) requireState(playerCount === 3, "North extraction in a four-player game");
				return { type: entry.type, combination: combination.slice() };
			});
			var discard = operations.find(entry => entry.type === OPERATIONS.dapai);
			if (discard) {
				checkHand(manager.mainrole, true);
				var forbidden = discard.combination.flatMap(value => value.split("|")).map(tile);
				var riichi = manager.mainrole.liqibang._activeInHierarchy;
				for (var handTile of manager.mainrole.hand) {
					handTile.valid = (!riichi || handTile === manager.mainrole.last_tile) &&
						!forbidden.some(value => sameValue(value, handTile.val));
				}
				requireState(manager.mainrole.hand.some(entry => entry.valid), "No legal discard is available");
			}
			manager.oplist = operations.filter(entry => !(furiten && entry.type === OPERATIONS.rong));
			requireState(integer(zero(operation.time_add), 0, 3600000) && integer(zero(operation.time_fixed), 0, 3600000), "Invalid operation timer");
			// OptionalOperationList timer fields are milliseconds; the existing API
			// reports seconds. Keep the absolute expiry in milliseconds throughout.
			manager.time_add = zero(operation.time_add) / 1000;
			manager.time_fixed = zero(operation.time_fixed) / 1000;
			var milliseconds = zero(operation.time_add) + zero(operation.time_fixed);
			if (manager.oplist.length) deadline = now() + milliseconds;
		}
		function common(message) {
			if (Array.isArray(message.doras) && message.doras.length) setDora(message.doras);
			if (Object.prototype.hasOwnProperty.call(message, "zhenting")) {
				requireState(typeof message.zhenting === "boolean", "Invalid furiten flag");
				furiten = message.zhenting;
			}
			if (Array.isArray(message.scores) && message.scores.length && typeof message.scores[0] === "number") setScores(message.scores);
			if (integer(message.liqibang, 1, 100)) manager.liqibang = message.liqibang;
			if (message.liqi) {
				var riichiPlayer = getPlayer(zero(message.liqi.seat));
				riichiPlayer.liqibang._activeInHierarchy = message.liqi.failed !== true;
				if (message.liqi.failed) riichiPlayer.container_qipai.last_is_liqi = false;
				if (!message.liqi.failed) {
					requireState(Number.isSafeInteger(zero(message.liqi.score)), "Invalid riichi score");
					riichiPlayer.score = zero(message.liqi.score);
					manager.liqibang = zero(message.liqi.liqibang);
				}
			}
		}
		function newRound(message) {
			requireState(manager != null && seat >= 0, "Waiting for game authentication.");
			var ju = zero(message.ju), chang = zero(message.chang), ben = zero(message.ben);
			requireState(integer(ju, 0, playerCount - 1) && integer(chang, 0, 3) && integer(ben, 0, 100), "Invalid round identity");
			var hand = tileList(message.tiles);
			requireState(hand.length === (seat === ju ? 14 : 13), "The initial local hand is incomplete");
			var counts = new Map();
			for (var entry of hand) {
				requireState(playerCount !== 3 || entry.type !== 1 || entry.index === 1 || entry.index === 9, "An unavailable manzu tile was dealt in a three-player game");
				var key = entry.type + ":" + entry.index;
				counts.set(key, (counts.get(key) || 0) + 1);
				requireState(counts.get(key) <= 4, "Too many copies of a tile in the local hand");
			}
			requireState(integer(message.left_tile_count, 0, playerCount === 3 ? 55 : 70), "Missing or invalid wall count");
			manager = makeManager();
			manager.index_ju = ju;
			manager.index_change = chang;
			manager.index_ben = ben;
			manager.index_player = ju;
			manager.left_tile_count = message.left_tile_count;
			manager.liqibang = zero(message.liqibang);
			setScores(message.scores);
			setDora(message.doras && message.doras.length ? message.doras : [message.dora]);
			for (var absoluteSeat = 0; absoluteSeat < playerCount; absoluteSeat++) {
				var player = getPlayer(absoluteSeat);
				player.hand = absoluteSeat === seat ? hand.map(wrapper) :
					Array.from({ length: absoluteSeat === ju ? 14 : 13 }, () => wrapper(null));
				if (absoluteSeat === seat && hand.length === 14) player.last_tile = player.hand[player.hand.length - 1];
			}
			validRound = true;
			furiten = false;
			lastDiscard = null;
			discardEvents = [];
			manager.active = !syncPending;
			phase = syncPending ? "synchronizing" : "game";
			reason = syncPending ? "Waiting for the game to restore the round." : "";
			setOperations(message.operation);
		}
		function deal(message) {
			var absoluteSeat = zero(message.seat), player = getPlayer(absoluteSeat);
			checkHand(player, false);
			requireState(absoluteSeat === (lastDiscard ? (lastDiscard.seat + 1) % playerCount : manager.index_player), "A draw is out of turn");
			requireState(integer(message.left_tile_count, 0, manager.left_tile_count), "Invalid wall count after drawing");
			// Any tile identity sent for another player is deliberately discarded.
			var drawn = wrapper(absoluteSeat === seat ? tile(message.tile) : null);
			player.hand.push(drawn);
			player.last_tile = drawn;
			manager.index_player = absoluteSeat;
			manager.left_tile_count = message.left_tile_count;
			lastDiscard = null;
			common(message);
			setOperations(message.operation);
		}
		function discard(message, step) {
			var absoluteSeat = zero(message.seat), player = getPlayer(absoluteSeat), value = tile(message.tile);
			checkHand(player, true);
			requireState(manager.index_player === absoluteSeat, "A discard is out of turn");
			var tsumogiri = message.moqie === true, riichi = message.is_liqi === true || message.is_wliqi === true;
			value.tsumogiri = tsumogiri;
			if (absoluteSeat === seat) {
				var matching = tsumogiri ? player.last_tile : player.hand.find(entry => entry.val.toString() === message.tile);
				requireState(matching && matching.val.toString() === message.tile, "The discarded tile is missing from the local hand");
			}
			var event = { epoch: epoch, step: step, seat: absoluteSeat, player: (absoluteSeat - seat + playerCount) % playerCount,
				displayPosition: manager.seat2LocalPosition(absoluteSeat), tile: value, riichi: riichi, tsumogiri: tsumogiri, replaying: replaying };
			if (!replaying && typeof options.onDiscard === "function") {
				try { options.onDiscard(event); } catch (_) { /* Observation is optional. */ }
			}
			discardEvents.push(event);
			if (discardEvents.length > 512) discardEvents.shift();
			if (absoluteSeat === seat) removeOwn([message.tile], tsumogiri);
			else removeHidden(player, 1, tsumogiri);
			var pond = player.container_qipai, discarded = wrapper(value);
			if (pond.last_pai) pond.pais.push(pond.last_pai);
			pond.last_pai = discarded;
			pond.last_is_liqi = riichi;
			if (riichi) player.liqibang._activeInHierarchy = true;
			manager.lastqipai = discarded;
			lastDiscard = { seat: absoluteSeat, tile: discarded };
			common(message);
			setOperations(message.operation);
		}
		function call(message) {
			var absoluteSeat = zero(message.seat), player = getPlayer(absoluteSeat), kind = zero(message.type);
			var values = tileList(message.tiles), froms = message.froms;
			requireState(integer(kind, 0, 2) && values.length === (kind === 2 ? 4 : 3), "Invalid exposed meld");
			requireState(Array.isArray(froms) && froms.length === values.length && froms.every(value => integer(value, 0, playerCount - 1)), "Missing meld origins");
			var calledIndices = froms.map((from, index) => from !== absoluteSeat ? index : -1).filter(index => index >= 0);
			requireState(calledIndices.length === 1 && lastDiscard != null, "The called discard is unknown");
			var calledIndex = calledIndices[0], sourceSeat = froms[calledIndex];
			requireState(lastDiscard.seat === sourceSeat && lastDiscard.tile.val.toString() === values[calledIndex].toString(), "The meld does not match the last discard");
			if (kind === 0) {
				var sorted = values.slice().sort((a, b) => a.index - b.index);
				requireState(playerCount === 4 && sourceSeat === (absoluteSeat + 3) % 4 && sorted[0].type < 3 &&
					sorted.every(value => value.type === sorted[0].type) && sorted[1].index === sorted[0].index + 1 &&
					sorted[2].index === sorted[0].index + 2, "Invalid chi");
			} else requireState(values.every(value => sameValue(value, values[0])), "Invalid pon or kan");
			checkHand(player, false);
			var ownNames = values.filter((_, index) => froms[index] === absoluteSeat).map(value => value.toString());
			if (absoluteSeat === seat) removeOwn(ownNames, false);
			else removeHidden(player, ownNames.length, false);
			var sourcePond = getPlayer(sourceSeat).container_qipai;
			requireState(sourcePond.last_pai === lastDiscard.tile, "The called discard is no longer in the pond");
			sourcePond.last_pai = null;
			sourcePond.last_is_liqi = false;
			player.container_ming.mings.push({ type: kind, pais: values, from: froms.slice() });
			player.last_tile = null;
			manager.index_player = absoluteSeat;
			lastDiscard = null;
			common(message);
			setOperations(message.operation);
		}
		function kan(message) {
			var absoluteSeat = zero(message.seat), player = getPlayer(absoluteSeat), kind = zero(message.type);
			var value = tile(message.tiles);
			requireState(kind === 2 || kind === 3, "Unsupported kan type");
			checkHand(player, true);
			if (kind === 2) {
				var pon = player.container_ming.mings.find(meld => meld.type === 1 && meld.pais.length === 3 && meld.pais.every(entry => sameValue(entry, value)));
				requireState(pon != null, "The added kan has no existing pon");
				if (absoluteSeat === seat) value = removeOwn([message.tiles], false)[0];
				else removeHidden(player, 1, false);
				pon.pais.push(value);
				pon.from.push(absoluteSeat);
				pon.type = 2;
			} else {
				var values;
				if (absoluteSeat === seat) {
					var names = player.hand.filter(entry => sameValue(entry.val, value)).map(entry => entry.val.toString());
					requireState(names.length === 4, "The concealed kan is incomplete");
					values = removeOwn(names, false);
				} else {
					removeHidden(player, 4, false);
					var canonical = String(value.index) + message.tiles[1];
					values = Array.from({ length: 4 }, () => tile(canonical));
					// All four tiles of a standard concealed kan are public. Red fives
					// are determined by the authenticated room's configured tile set.
					var redCount = gameConfig.mode.detail_rule.dora_count;
					if (value.index === 5 && value.type < 3 && redCount > 0) {
						values[3] = tile("0" + message.tiles[1]);
						if (redCount === 4 && value.type === 0) values[2] = tile("0p");
					}
				}
				player.container_ming.mings.push({ type: 3, pais: values, from: Array(4).fill(absoluteSeat) });
			}
			manager.index_player = absoluteSeat;
			manager.lastqipai = wrapper(value); // The exposed tile can be robbed only if the server offers ron.
			lastDiscard = null;
			common(message);
			setOperations(message.operation);
		}
		function kita(message) {
			requireState(playerCount === 3, "North extraction in a four-player game");
			var absoluteSeat = zero(message.seat), player = getPlayer(absoluteSeat), value = tile("4z");
			checkHand(player, true);
			if (absoluteSeat === seat) removeOwn(["4z"], message.moqie === true);
			else removeHidden(player, 1, message.moqie === true);
			player.container_babei.pais.push(wrapper(value));
			manager.index_player = absoluteSeat;
			manager.lastqipai = wrapper(value);
			lastDiscard = null;
			common(message);
			setOperations(message.operation);
		}
		function finishRound(name, message) {
			common(message);
			if (name === "ActionNoTile" && Array.isArray(message.scores) && message.scores.length) {
				var initial = message.scores[0].old_scores, next = initial && initial.slice();
				requireState(Array.isArray(next) && next.length === playerCount, "Missing exhaustive-draw scores");
				for (var result of message.scores) {
					requireState(Array.isArray(result.old_scores) && result.old_scores.length === playerCount &&
						Array.isArray(result.delta_scores) && result.delta_scores.length === playerCount, "Incomplete exhaustive-draw scores");
					requireState(result.old_scores.every((score, index) => score === initial[index]) ||
						result.old_scores.every((score, index) => score === next[index]), "Inconsistent exhaustive-draw scores");
					next = next.map((score, index) => score + result.delta_scores[index]);
				}
				setScores(next);
			} else if ((!message.scores || !message.scores.length) && Array.isArray(message.old_scores) && Array.isArray(message.delta_scores)) {
				requireState(message.old_scores.length === playerCount && message.delta_scores.length === playerCount, "Incomplete win scores");
				setScores(message.old_scores.map((score, index) => score + message.delta_scores[index]));
			}
			clearOperations();
			validRound = false;
			lastDiscard = null;
			phase = "round-ended";
			reason = "Waiting for the next round.";
			if (message.gameend) endGame(message.gameend);
		}
		function endGame(result) {
			clearOperations();
			validRound = false;
			if (manager != null) {
				manager.active = false;
				if (result && Array.isArray(result.scores) && result.scores.length) setScores(result.scores);
				manager.gameEndResult = { ended: true };
			}
			phase = "ended";
			reason = "The game has ended.";
		}
		function actionParts(value) {
			if (!value || typeof value !== "object") return null;
			if (value.action && typeof value.action === "object") {
				return { name: shortName(value.action.name || value.name), data: value.action.data || value.action.message,
					step: value.action.step == null ? value.step : value.action.step };
			}
			return { name: shortName(value.name), data: value.data || value.message, step: value.step };
		}
		function applyAction(action) {
			requireState(action && ACTIONS.has(action.name), "Unsupported game action: " + (action ? action.name : "unknown"));
			requireState(action.data && typeof action.data === "object" && !ArrayBuffer.isView(action.data), "The game action could not be decoded");
			requireState(integer(action.step, 0, 0xffffffff), "Missing game action sequence");
			var digest = fingerprint([action.name, action.data]);
			if (action.name === "ActionMJStart") {
				if (actionDigests.get(action.step) === digest) return false;
				requireState(manager != null && lastStep == null, "Unexpected game-start action");
				epoch++;
				clearOperations();
				lastStep = action.step;
				actionDigests.set(action.step, digest);
				notify("action", action.name);
				return true;
			}
			if (action.name === "ActionNewRound") {
				if (roundDigests.has(digest)) return false;
			} else {
				if (actionDigests.has(action.step) && actionDigests.get(action.step) === digest) return false;
				requireState(validRound, "Waiting for a complete round after an interrupted game update.");
				requireState(lastStep != null && action.step === lastStep + 1, "A game update was missed. Waiting for a fresh round or resynchronization.");
			}
			epoch++;
			clearOperations();
			switch (action.name) {
				case "ActionNewRound": newRound(action.data); actionDigests.clear(); roundDigests.add(digest); break;
				case "ActionDealTile": deal(action.data); break;
				case "ActionDiscardTile": discard(action.data, action.step); break;
				case "ActionChiPengGang": call(action.data); break;
				case "ActionAnGangAddGang": kan(action.data); break;
				case "ActionBaBei": kita(action.data); break;
				default: finishRound(action.name, action.data); break;
			}
			checkVisibleTiles();
			lastStep = action.step;
			actionDigests.set(action.step, digest);
			if (actionDigests.size > 512) actionDigests.delete(actionDigests.keys().next().value);
			if (roundDigests.size > 128) roundDigests.delete(roundDigests.values().next().value);
			notify("action", action.name);
			return true;
		}
		function restore(message, entering) {
			requireState(!hasError(message), "The game could not restore the round.");
			if (message.is_end) { epoch++; endGame(null); notify("end"); return; }
			requireState(manager != null, "Waiting for game authentication.");
			// First entry can be acknowledged before the first round exists. It
			// may contain no replay or only the empty ActionMJStart boundary.
			var initialActions = message.game_restore && message.game_restore.actions;
			if (entering && !validRound && (lastStep == null || lastStep === 0) &&
				(!initialActions || initialActions.length === 0 ||
					(initialActions.length === 1 && shortName(initialActions[0].name) === "ActionMJStart"))) {
				if (initialActions && initialActions.length) applyAction(actionParts(initialActions[0]));
				syncPending = false;
				phase = "authenticated";
				reason = "Waiting for the round's game state.";
				notify("entered");
				return;
			}
			requireState(message.game_restore, "The restored game state is missing.");
			var restoration = message.game_restore, actions = restoration.actions;
			requireState(Array.isArray(actions) && actions.length > 0 && actions.length <= 1024, "The restored round has no usable actions.");
			var parsed = actions.map(actionParts);
			if (parsed[0] && (parsed[0].name === "ActionNewRound" ||
				(parsed[0].name === "ActionMJStart" && parsed[1] && parsed[1].name === "ActionNewRound"))) {
				validRound = false;
				lastStep = null;
				actionDigests.clear();
				roundDigests.clear();
			} else {
				// Partial action replay is safe only when its exact preceding board is
				// already known. Opaque snapshots cannot establish discard chronology.
				requireState(validRound && !restoration.snapshot, "A full round replay is needed to restore this game.");
			}
			replaying = true;
			try { parsed.forEach(applyAction); }
			finally { replaying = false; }
			requireState(integer(message.step, 1, 0xffffffff) && message.step === lastStep + 1, "The restored round is missing its latest action.");
			syncPending = false;
			if (validRound) {
				manager.active = true;
				phase = "game";
				reason = "";
			}
			// The current public bridge records values such as 16 for an elapsed
			// window, but the schema doesn't label the unit. Use seconds here, as
			// the reference implementation does: expiring early cannot send a stale
			// action. A fresh live operation always replaces this restored timer.
			if (deadline && integer(restoration.passed_waiting_time, 0, 3600000)) deadline -= restoration.passed_waiting_time * 1000;
			expireOperations();
			notify("restore");
		}
		function expireOperations() {
			if (deadline && now() >= deadline) {
				epoch++;
				clearOperations();
				notify("timeout");
			}
		}
		function consume(frame, direction) {
			if (!frame || typeof frame !== "object") return false;
			var method = shortName(frame.method), message = frame.message || {}, isOutgoing = outgoing(frame, direction);
			try {
				if (method === "authGame") {
					if (isOutgoing) {
						clearOperations();
						manager = null; seat = -1; playerCount = 0; validRound = false; lastStep = null;
						requireState(integer(message.account_id, 1, 0xffffffff), "The game authentication has no player account.");
						accountId = message.account_id;
						pendingAuth = true;
						phase = "authenticating"; reason = "Waiting for the game seat.";
						epoch++;
						notify("request");
					} else if (response(frame)) authenticate(message);
					return true;
				}
				if (method === "syncGame" || method === "enterGame") {
					if (isOutgoing) pauseForSync();
					else if (response(frame)) restore(message, method === "enterGame");
					return true;
				}
				if (isOutgoing) {
					if (["inputOperation", "inputChiPengGang", "confirmNewRound"].includes(method)) {
						epoch++; clearOperations(); notify("request", method); return true;
					}
					return false;
				}
				if (response(frame) && ["login", "oauth2Login", "emailLogin"].includes(method)) {
					if (hasError(message)) return false;
					var loginAccount = message.account_id || (message.account && message.account.account_id);
					if (!integer(loginAccount, 1, 0xffffffff)) return false;
					if (accountId !== loginAccount && manager != null) invalidate("The logged-in account changed.");
					accountId = loginAccount;
					lobbyReady = true;
					if (manager == null && !pendingAuth) { phase = "lobby"; reason = ""; }
					epoch++; notify("lobby"); return true;
				}
				if (method === "ActionPrototype" || method === "NotifyActionPrototype") return applyAction(actionParts(message));
				if (method.startsWith("Action")) return applyAction({ name: method, data: message, step: frame.step });
				if (["NotifyGameEndResult", "NotifyGameTerminate"].includes(method)) {
					epoch++; endGame(null); notify("end"); return true;
				}
				if (method === "NotifyPlayerConnectionState" && manager != null) {
					var playerSeat = zero(message.seat);
					getPlayer(playerSeat);
					manager.player_link_state[playerSeat] = zero(message.state) === 0 ? 0 : 1;
					epoch++; notify("connection"); return true;
				}
				if (method === "NotifyGamePause") return invalidate(message.paused ? "The game is paused." : "Waiting for the resumed game state.");
				if (response(frame) && ["inputOperation", "inputChiPengGang"].includes(method) && hasError(message)) {
					return invalidate("The game rejected an operation. Waiting for the next complete game state.");
				}
				return false;
			} catch (error) {
				return invalidate(error && error.message ? error.message : "The game state could not be read.");
			}
		}

		return { consume: consume, invalidate: invalidate,
			getManager: function () { expireOperations(); return manager; },
			getStatus: function () { expireOperations(); return status(); },
			getEpoch: function () { expireOperations(); return epoch; },
			getAccountId: function () { return accountId; }, getSeat: function () { return seat; },
			getPlayerCount: function () { return playerCount; }, isLobbyReady: function () { return lobbyReady; },
			isInGame: function () { return manager != null && manager.active === true; },
			isFuriten: function () { return furiten; },
			getDiscardEvents: function (afterEpoch) { return discardEvents.filter(event => afterEpoch == null || event.epoch > afterEpoch); }
		};
	}
	return Object.freeze({ create: create, tile: tile, OPERATIONS: OPERATIONS });
})();
