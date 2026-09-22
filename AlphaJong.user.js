// ==UserScript==
// @name         AlphaJong
// @namespace    alphajong
// @version      1.3.13
// @description  A Mahjong Soul Bot.
// @author       Jimboom7
// @grant        none
// @sandbox      raw
// @inject-into  page
// @run-at       document-start
// @match        https://mahjongsoul.game.yo-star.com/*
// @match        https://majsoul.com/*
// @match        https://game.maj-soul.com/*
// @match        https://game.maj-soul.net/*
// @match        https://majsoul.union-game.com/*
// @match        https://game.mahjongsoul.com/*
// @updateURL    https://raw.githubusercontent.com/Tsuki321/AlphaJong/master/AlphaJong.user.js
// @downloadURL  https://raw.githubusercontent.com/Tsuki321/AlphaJong/master/AlphaJong.user.js
// ==/UserScript==


// Mahjong Soul's protobuf wire subset, independent of Unity and third-party runtimes.
// Field numbers checked against the current Unity descriptors; see doc/Unity-Integration.md.
// Authentication secrets and other players' private data are deliberately not decoded.
var AlphaJongUnityProtocol = (function () {
	"use strict";
	var schemas = Object.create(null);
	function define(name, fields) {
		schemas[name] = fields.map(field => {
			var parts = field.split(":");
			return { id: Number(parts[0]), name: parts[1], type: parts[2], repeated: parts[3] === "r" };
		});
	}
	define("Wrapper", ["1:name:s", "2:data:bytes"]);
	define("Empty", []);
	define("Error", ["1:code:u"]);
	define("ResCommon", ["1:error:Error"]);
	define("Account", ["1:account_id:u"]);
	define("ResLogin", ["1:error:Error", "2:account_id:u", "3:account:Account"]);
	define("ReqAuthGame", ["1:account_id:u"]);
	define("ResAuthGame", ["1:error:Error", "3:seat_list:u:r", "4:is_game_start:b", "5:game_config:GameConfig", "6:ready_id_list:u:r"]);
	define("GameConfig", ["1:category:u", "2:mode:GameMode", "3:meta:GameMetaData"]);
	define("GameMode", ["1:mode:u", "4:ai:b", "6:detail_rule:GameDetailRule"]);
	define("GameMetaData", ["1:room_id:u", "2:mode_id:u", "3:contest_uid:u"]);
	define("GameDetailRule", ["1:time_fixed:u", "2:time_add:u", "3:dora_count:u",
		"42:guyi_mode:u", "43:dora3_mode:u", "44:begin_open_mode:u", "45:jiuchao_mode:u",
		"46:muyu_mode:u", "47:open_hand:u", "48:xuezhandaodi:u", "49:huansanzhang:u", "50:chuanma:u",
		"51:reveal_discard:u", "52:field_spell_mode:u", "53:zhanxing:u", "54:tianming_mode:u",
		"70:yongchang_mode:u", "71:hunzhiyiji_mode:u", "72:wanxiangxiuluo_mode:u", "73:beishuizhizhan_mode:u", "74:amusement_switches:u:r"]);
	define("OptionalOperation", ["1:type:u", "2:combination:s:r", "3:change_tiles:s:r", "4:change_tile_states:i:r", "5:gap_type:u"]);
	define("OptionalOperationList", ["1:seat:u", "2:operation_list:OptionalOperation:r", "4:time_add:u", "5:time_fixed:u"]);
	define("LiQiSuccess", ["1:seat:u", "2:score:i", "3:liqibang:u", "4:failed:b"]);
	define("GameEnd", ["1:scores:i:r"]);
	define("ActionPrototype", ["1:step:u", "2:name:s", "3:data:bytes"]);
	define("ActionMJStart", []);
	define("ActionNewRound", ["1:chang:u", "2:ju:u", "3:ben:u", "4:tiles:s:r", "5:dora:s",
		"6:scores:i:r", "7:operation:OptionalOperationList", "8:liqibang:u", "11:al:b", "13:left_tile_count:u", "14:doras:s:r"]);
	define("ActionDealTile", ["1:seat:u", "2:tile:s", "3:left_tile_count:u", "4:operation:OptionalOperationList",
		"5:liqi:LiQiSuccess", "6:doras:s:r", "7:zhenting:b", "9:tile_state:u"]);
	define("ActionDiscardTile", ["1:seat:u", "2:tile:s", "3:is_liqi:b", "4:operation:OptionalOperationList",
		"5:moqie:b", "6:zhenting:b", "8:doras:s:r", "9:is_wliqi:b", "10:tile_state:u", "12:revealed:b", "13:scores:i:r", "14:liqibang:u"]);
	define("ActionChiPengGang", ["1:seat:u", "2:type:u", "3:tiles:s:r", "4:froms:u:r", "5:liqi:LiQiSuccess",
		"6:operation:OptionalOperationList", "7:zhenting:b", "9:tile_states:u:r", "11:scores:i:r", "12:liqibang:u"]);
	define("ActionAnGangAddGang", ["1:seat:u", "2:type:u", "3:tiles:s", "4:operation:OptionalOperationList", "6:doras:s:r", "7:zhenting:b"]);
	define("ActionBaBei", ["1:seat:u", "4:operation:OptionalOperationList", "6:doras:s:r", "7:zhenting:b", "9:moqie:b", "10:tile_state:u"]);
	define("ActionHule", ["2:old_scores:i:r", "3:delta_scores:i:r", "4:wait_timeout:u", "5:scores:i:r", "6:gameend:GameEnd", "7:doras:s:r"]);
	define("NoTileScoreInfo", ["1:seat:u", "2:old_scores:i:r", "3:delta_scores:i:r"]);
	define("ActionNoTile", ["1:liujumanguan:b", "3:scores:NoTileScoreInfo:r", "4:gameend:b"]);
	define("ActionLiuJu", ["1:type:u", "2:gameend:GameEnd", "3:seat:u", "5:liqi:LiQiSuccess"]);
	define("GameSnapshot", []); // Recognized, but not used to manufacture missing action history.
	define("GameRestore", ["1:snapshot:GameSnapshot", "2:actions:ActionPrototype:r", "3:passed_waiting_time:u", "4:game_state:u"]);
	define("ReqSyncGame", ["1:round_id:s", "2:step:u"]);
	define("ResSyncGame", ["1:error:Error", "2:is_end:b", "3:step:u", "4:game_restore:GameRestore"]);
	define("ReqSelfOperation", ["1:type:u", "2:index:u", "3:tile:s", "4:cancel_operation:b", "5:moqie:b", "6:timeuse:u", "7:tile_state:i", "11:auto_operation:b"]);
	define("ReqChiPengGang", ["1:type:u", "2:index:u", "3:cancel_operation:b", "6:timeuse:u"]);
	define("NotifyPlayerConnectionState", ["1:seat:u", "2:state:u"]);
	define("NotifyGamePause", ["1:paused:b"]);
	define("NotifyGameEndResult", []);
	define("NotifyGameTerminate", []);
	define("NotifyAccountLogout", []);
	define("NotifyAnotherLogin", []);
	var methods = {
		".lq.FastTest.authGame": ["ReqAuthGame", "ResAuthGame"],
		".lq.FastTest.enterGame": ["Empty", "ResSyncGame"],
		".lq.FastTest.syncGame": ["ReqSyncGame", "ResSyncGame"],
		".lq.FastTest.finishSyncGame": ["Empty", "ResCommon"],
		".lq.FastTest.inputOperation": ["ReqSelfOperation", "ResCommon"],
		".lq.FastTest.inputChiPengGang": ["ReqChiPengGang", "ResCommon"],
		".lq.FastTest.confirmNewRound": ["Empty", "ResCommon"],
		".lq.FastTest.checkNetworkDelay": ["Empty", "ResCommon"],
		".lq.Lobby.login": ["Empty", "ResLogin"],
		".lq.Lobby.oauth2Login": ["Empty", "ResLogin"],
		".lq.Lobby.emailLogin": ["Empty", "ResLogin"]
	};
	var encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });
	function bytes(value) {
		if (value instanceof ArrayBuffer) return new Uint8Array(value);
		if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
		throw new Error("Expected a binary game message");
	}
	function readVarint(reader) {
		var result = 0n;
		for (var index = 0; index < 10; index++) {
			if (reader.pos >= reader.data.length) throw new Error("Truncated varint");
			var byte = reader.data[reader.pos++];
			if (index === 9 && byte > 1) throw new Error("Varint overflow");
			result |= BigInt(byte & 127) << BigInt(index * 7);
			if (byte < 128) return result;
		}
		throw new Error("Invalid varint");
	}
	function readBytes(reader, count) {
		if (!Number.isSafeInteger(count) || count < 0 || reader.pos + count > reader.data.length) throw new Error("Truncated message");
		var data = reader.data.subarray(reader.pos, reader.pos + count);
		reader.pos += count;
		return data;
	}
	function wireType(type) { return ["u", "i", "b"].includes(type) ? 0 : 2; }
	function readValue(reader, type, depth) {
		if (wireType(type) === 0) {
			var value = readVarint(reader);
			if (type === "b") return value !== 0n;
			return Number(type === "i" ? BigInt.asIntN(32, value) : BigInt.asUintN(32, value));
		}
		var data = readBytes(reader, Number(readVarint(reader)));
		if (type === "s") return decoder.decode(data);
		if (type === "bytes") return data.slice();
		return decodeMessage(type, data, depth + 1);
	}
	function skip(reader, wire) {
		if (wire === 0) readVarint(reader);
		else if (wire === 1) readBytes(reader, 8);
		else if (wire === 2) readBytes(reader, Number(readVarint(reader)));
		else if (wire === 5) readBytes(reader, 4);
		else throw new Error("Unsupported protobuf wire type");
	}
	function typeName(name) { return String(name).replace(/^\.?lq\./, ""); }
	function decodeMessage(name, input, depth) {
		depth = depth || 0;
		if (depth > 24) throw new Error("Game message nesting limit");
		var fields = schemas[typeName(name)];
		if (!fields) throw new Error("Unknown game message type: " + name);
		var data = bytes(input);
		if (data.length > 4194304) throw new Error("Game message size limit");
		var reader = { data: data, pos: 0 }, result = {};
		for (var field of fields) result[field.name] = field.repeated ? [] :
			field.type === "b" ? false : field.type === "s" ? "" : field.type === "bytes" ? new Uint8Array() :
			wireType(field.type) === 0 ? 0 : null;
		while (reader.pos < data.length) {
			var tag = Number(readVarint(reader)), id = Math.floor(tag / 8), wire = tag % 8;
			if (id <= 0 || id > 536870911) throw new Error("Invalid protobuf field");
			var field = fields.find(entry => entry.id === id);
			if (!field) { skip(reader, wire); continue; }
			if (field.repeated && wire === 2 && wireType(field.type) === 0) {
				var packed = { data: readBytes(reader, Number(readVarint(reader))), pos: 0 };
				while (packed.pos < packed.data.length) result[field.name].push(readValue(packed, field.type, depth));
			} else {
				if (wire !== wireType(field.type)) throw new Error("Incorrect game field encoding");
				var value = readValue(reader, field.type, depth);
				if (field.repeated) result[field.name].push(value);
				else result[field.name] = value;
			}
		}
		return result;
	}
	function writeVarint(output, value) {
		value = BigInt.asUintN(64, BigInt(value));
		while (value > 127n) { output.push(Number(value & 127n) | 128); value >>= 7n; }
		output.push(Number(value));
	}
	function append(output, data) { for (var byte of data) output.push(byte); }
	function writeValue(output, type, value) {
		if (wireType(type) === 0) {
			if (type === "b") writeVarint(output, value ? 1 : 0);
			else {
				if (!Number.isInteger(value) || value < (type === "i" ? -2147483648 : 0) || value > (type === "i" ? 2147483647 : 4294967295)) throw new Error("Invalid game integer");
				writeVarint(output, value);
			}
		} else {
			var data = type === "s" ? encoder.encode(value) : type === "bytes" ? bytes(value) : encodeMessage(type, value);
			writeVarint(output, data.length); append(output, data);
		}
	}
	function encodeMessage(name, message) {
		var fields = schemas[typeName(name)];
		if (!fields) throw new Error("Unknown game message type: " + name);
		var output = [];
		for (var field of fields) {
			var value = message[field.name];
			if (value == null) continue;
			if (field.repeated) {
				if (!Array.isArray(value)) throw new Error("Invalid repeated game field");
				if (wireType(field.type) === 0 && value.length) {
					var packed = []; for (var item of value) writeValue(packed, field.type, item);
					writeVarint(output, field.id * 8 + 2); writeVarint(output, packed.length); append(output, packed);
				} else for (var item of value) { writeVarint(output, field.id * 8 + wireType(field.type)); writeValue(output, field.type, item); }
			} else if (value !== false && value !== 0 && value !== "") {
				writeVarint(output, field.id * 8 + wireType(field.type)); writeValue(output, field.type, value);
			}
		}
		return Uint8Array.from(output);
	}
	function decodeEnvelope(input) {
		var data = bytes(input), kind = data[0];
		if (![1, 2, 3].includes(kind) || data.length < (kind === 1 ? 1 : 3)) throw new Error("Invalid game envelope");
		var wrapper = decodeMessage("Wrapper", data.subarray(kind === 1 ? 1 : 3));
		if (kind !== 3 && !/^\.lq\.[A-Za-z][\w.]*$/.test(wrapper.name)) throw new Error("Not a Mahjong Soul message");
		if (kind === 3 && wrapper.name !== "") throw new Error("Unexpected response name");
		return { kind: ["", "notification", "request", "response"][kind], id: kind === 1 ? null : data[1] | data[2] << 8,
			method: wrapper.name, data: wrapper.data };
	}
	function encodeEnvelope(kind, id, method, data) {
		var code = { notification: 1, request: 2, response: 3 }[kind];
		if (!code || (code !== 1 && (!Number.isInteger(id) || id < 0 || id > 65535))) throw new Error("Invalid game envelope");
		var body = encodeMessage("Wrapper", { name: code === 3 ? "" : method, data: data });
		var output = new Uint8Array(body.length + (code === 1 ? 1 : 3));
		output[0] = code;
		if (code !== 1) { output[1] = id & 255; output[2] = id >>> 8; }
		output.set(body, code === 1 ? 1 : 3);
		return output;
	}
	function xorAction(input) {
		var data = bytes(input).slice(), keys = [132, 94, 78, 66, 57, 162, 31, 96, 28], base = 23 ^ data.length;
		for (var index = 0; index < data.length; index++) data[index] ^= (base + 5 * index + keys[index % keys.length]) & 255;
		return data;
	}
	function decodeAction(action, live) {
		return { step: action.step, name: action.name, data: decodeMessage(action.name, live ? xorAction(action.data) : action.data) };
	}
	function decodeFrame(input, requestMethod) {
		var envelope = decodeEnvelope(input), method = envelope.kind === "response" ? requestMethod : envelope.method;
		var route = methods[method], name = envelope.kind === "notification" ? typeName(method) : route && route[envelope.kind === "request" ? 0 : 1];
		var message = name && schemas[name] ? decodeMessage(name, envelope.data) : null;
		if (name === "ActionPrototype") message = decodeAction(message, true);
		if (message && message.game_restore) message.game_restore.actions = message.game_restore.actions.map(action => decodeAction(action, false));
		return { kind: envelope.kind, id: envelope.id, method: method || "", message: message };
	}
	function encodeRequest(id, method, message) {
		var route = methods[method];
		if (!route) throw new Error("Unsupported game request");
		return encodeEnvelope("request", id, method, encodeMessage(route[0], message));
	}
	return Object.freeze({ decodeFrame: decodeFrame, decodeEnvelope: decodeEnvelope, encodeEnvelope: encodeEnvelope,
		encodeRequest: encodeRequest, decodeMessage: decodeMessage, encodeMessage: encodeMessage, xorAction: xorAction });
})();


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


// Observe the same native WebSockets used by Unity's _WS_Create/_WS_Send_Binary.
// Never inspect WASM memory or replace the client connection with a second login.
var AlphaJongUnityTransport = (function () {
	"use strict";
	var installations = new WeakMap();
	var ACTIONS = new Set([".lq.FastTest.inputOperation", ".lq.FastTest.inputChiPengGang"]);
	function install(options) {
		options = options || {};
		var scope = options.scope || window, protocol = options.protocol || AlphaJongUnityProtocol;
		if (installations.has(scope)) return installations.get(scope);
		var NativeSocket = scope.WebSocket, nativeSend = NativeSocket.prototype.send;
		var active = true, sequence = 0, sockets = new Set(), gameSocket = null, reason = "";
		var forwardedEvents = new WeakSet();
		function info(record) { return { id: record.id, game: record.game, currentGame: record === gameSocket, known: record.known, connected: record.socket.readyState === 1 }; }
		function callback(name) {
			if (!active || typeof options[name] !== "function") return;
			try { options[name].apply(null, Array.prototype.slice.call(arguments, 1)); }
			catch (_) { /* Client traffic always continues if an observer fails. */ }
		}
		function status() {
			return { installed: active, connected: Array.from(sockets).some(record => record.known && record.socket.readyState === 1),
				gameConnected: gameSocket != null && gameSocket.socket.readyState === 1,
				pending: gameSocket ? gameSocket.pending.size : 0,
				processing: gameSocket ? gameSocket.queued > 0 : false, reason: reason };
		}
		function invalidate(record, message) {
			reason = message;
			callback("onInvalidate", message, info(record));
			callback("onStatus", status());
		}
		function observe(record, input, direction, method) {
			try {
				var frame = protocol.decodeFrame(input, method);
				if (frame.message != null) callback("onFrame", frame, direction, info(record));
			} catch (_) {
				if (record.game) invalidate(record, "A game message could not be decoded. Waiting for a fresh round or reconnection.");
			}
		}
		function copyBinary(data) {
			if (data instanceof ArrayBuffer) return new Uint8Array(data).slice();
			if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
			return null;
		}
		function rewriteId(data, id) { var copy = data.slice(); copy[1] = id & 255; copy[2] = id >>> 8; return copy; }
		function forward(record, data, event) {
			var clone = new scope.MessageEvent("message", { data: data,
				origin: event ? event.origin : "", lastEventId: event ? event.lastEventId : "" });
			forwardedEvents.add(clone);
			record.socket.dispatchEvent(clone);
		}
		function allocate(record, preferred) {
			if (Number.isInteger(preferred) && !record.pending.has(preferred) && !record.reserved.has(preferred)) return preferred;
			for (var count = 0; count < 65536; count++) {
				var id = record.nextId;
				record.nextId = (record.nextId + 1) & 65535;
				if (!record.pending.has(id) && !record.reserved.has(id)) return id;
			}
			throw new Error("Game request ID capacity reached");
		}
		function clientSend(record, original) {
			// Unity passes a view into reused HEAPU8 memory. Copy before send returns.
			var data = copyBinary(original), envelope;
			if (data == null) {
				if (record.known && original instanceof scope.Blob) {
					record.unsafeSend = true;
					invalidate(record, "Unsupported asynchronous outgoing game data.");
				}
				return nativeSend.call(record.socket, original);
			}
			try { envelope = protocol.decodeEnvelope(data); }
			catch (_) { return nativeSend.call(record.socket, original); }
			if (envelope.kind !== "request") return nativeSend.call(record.socket, original);
			record.known = true;
			if (envelope.method === ".lq.FastTest.authGame") {
				if (gameSocket && gameSocket !== record) invalidate(gameSocket, "The game connection changed.");
				record.game = true;
				gameSocket = record;
				reason = "";
			}
			var wireId;
			try { wireId = allocate(record, envelope.id); }
			catch (_) {
				record.unsafeSend = true;
				invalidate(record, "Too many pending game requests; reconnect before using AlphaJong.");
				return nativeSend.call(record.socket, original);
			}
			record.pending.set(wireId, { method: envelope.method, logicalId: envelope.id, own: false });
			var transmitted = wireId === envelope.id ? original : rewriteId(data, wireId);
			try { nativeSend.call(record.socket, transmitted); }
			catch (error) { record.pending.delete(wireId); throw error; }
			if (record.game) callback("onActivity", "outgoing", info(record));
			observe(record, data, "out");
			callback("onStatus", status());
		}
		function receive(record, data, event, isBlob) {
			if (record.closed) return;
			var envelope;
			try { envelope = protocol.decodeEnvelope(data); }
			catch (_) {
				if (record.game) invalidate(record, "The game connection sent an unreadable message.");
				return;
			}
			record.known = true;
			var pending = envelope.kind === "response" ? record.pending.get(envelope.id) : null;
			var ownsReply = envelope.kind === "response" && record.reserved.has(envelope.id);
			if (envelope.kind === "response" && !pending) {
				if (ownsReply && event) event.stopImmediatePropagation();
				return;
			}
			if (pending) {
				record.pending.delete(envelope.id);
				if (pending.own && event) event.stopImmediatePropagation();
			}
			if (record.queued) queueObservation(record, data, pending && pending.method);
			else observe(record, data, "in", pending && pending.method);
			if (pending && !pending.own && pending.logicalId !== envelope.id) {
				// Unity still sees the ID it allocated. Do not dispatch the wire ID too.
				if (event) event.stopImmediatePropagation();
				var rewritten = rewriteId(data, pending.logicalId);
				forward(record, isBlob ? new scope.Blob([rewritten]) : rewritten.buffer, event);
			}
			callback("onStatus", status());
		}
		function enqueue(record, data, deferredEvent) {
			record.queued++;
			if (deferredEvent) record.deferred++;
			record.queue = record.queue.then(async function () {
				if (record.closed) return;
				var isBlob = data instanceof scope.Blob;
				var binary = isBlob ? new Uint8Array(await data.arrayBuffer()) : copyBinary(data);
				if (record.closed) return;
				var envelope;
				try { if (binary) envelope = protocol.decodeEnvelope(binary); }
				catch (_) {
					if (record.game) invalidate(record, "The game connection sent an unreadable message.");
				}
				if (!envelope) {
					if (deferredEvent) forward(record, isBlob ? data : binary ? binary.buffer : data, deferredEvent);
					return;
				}
				record.known = true;
				var pending = envelope.kind === "response" ? record.pending.get(envelope.id) : null;
				var ownsReply = envelope.kind === "response" && record.reserved.has(envelope.id);
				if (pending) record.pending.delete(envelope.id);
				if (envelope.kind !== "response" || pending) observe(record, binary, "in", pending && pending.method);
				if (deferredEvent && !ownsReply) {
					var delivered = pending && !pending.own && pending.logicalId !== envelope.id
						? rewriteId(binary, pending.logicalId) : binary;
					forward(record, isBlob ? new scope.Blob([delivered]) : delivered.buffer, deferredEvent);
				}
			}).catch(function () {
				if (record.game && !record.closed) invalidate(record, "The game message queue could not be read.");
			}).finally(function () { record.queued--; if (deferredEvent) record.deferred--; });
		}
		function queueObservation(record, data, method) {
			record.queued++;
			record.queue = record.queue.then(function () {
				if (!record.closed) observe(record, data, "in", method);
			}).finally(function () { record.queued--; });
		}
		function hook(socket) {
			var record = { socket: socket, id: ++sequence, known: false, game: false, unsafeSend: false, closed: false,
				pending: new Map(), reserved: new Set(), nextId: 32768, queued: 0, deferred: 0, queue: Promise.resolve() };
			sockets.add(record);
			Object.defineProperty(socket, "send", { configurable: true, writable: true, value: function (data) {
				if (this !== socket) return nativeSend.call(this, data);
				return clientSend(record, data);
			} });
			socket.addEventListener("open", function () { callback("onStatus", status()); });
			socket.addEventListener("close", function () {
				record.closed = true;
				if (record === gameSocket) { invalidate(record, "The game disconnected. Waiting for its reconnection."); gameSocket = null; }
				record.pending.clear(); record.reserved.clear(); sockets.delete(record);
				callback("onStatus", status());
			});
			socket.addEventListener("message", function (event) {
				if (forwardedEvents.has(event)) return;
				if (record.game) callback("onActivity", "incoming", info(record));
				var data = copyBinary(event.data);
				if (record.deferred) {
					// Preserve client event order behind a Blob held for private-ID routing.
					event.stopImmediatePropagation();
					enqueue(record, data || event.data, event);
				} else if (event.data instanceof scope.Blob) {
					var needsRouting = record.reserved.size > 0 || Array.from(record.pending).some(function (entry) {
						return !entry[1].own && entry[1].logicalId !== entry[0];
					});
					// Ordinary Blob observation is passive. A mode change after requests
					// used private IDs requires deferring delivery until IDs can be read.
					if (needsRouting) {
						record.unsafeSend = true;
						invalidate(record, "Game binary mode changed. Reconnect before using automatic play.");
						event.stopImmediatePropagation();
					}
					enqueue(record, event.data, needsRouting ? event : null);
				} else if (data) {
					// Route/suppress responses synchronously even when observation waits
					// behind a Blob, so private wire IDs can never reach Unity callbacks.
					receive(record, data, event, false);
				}
			});
			return socket;
		}
		var WrappedSocket = new Proxy(NativeSocket, {
			construct: function (target, args, newTarget) { return hook(Reflect.construct(target, args, newTarget)); }
		});
		scope.WebSocket = WrappedSocket;
		function send(method, payload) {
			method = method.startsWith(".") ? method : ".lq.FastTest." + method;
			var record = gameSocket;
			if (!active || !ACTIONS.has(method) || !record || record.socket.readyState !== 1 ||
				record.socket.binaryType !== "arraybuffer" || record.queued || record.unsafeSend ||
				typeof options.canSend !== "function" || options.canSend(method, payload) !== true) return false;
			var id;
			try {
				id = allocate(record);
				var frame = protocol.encodeRequest(id, method, payload);
				record.reserved.add(id);
				record.pending.set(id, { method: method, own: true });
				noteAction();
				nativeSend.call(record.socket, frame);
				observe(record, frame, "out");
				return true;
			} catch (_) {
				if (id != null) { record.pending.delete(id); record.reserved.delete(id); }
				return false;
			}
			function noteAction() { callback("onActivity", "action", info(record)); }
		}
		var api = { send: send, getStatus: status, dispose: function () {
			active = false;
			if (scope.WebSocket === WrappedSocket) scope.WebSocket = NativeSocket;
			installations.delete(scope);
			// Existing connections keep their ID routing until closed, including own
			// reply tombstones. Removing these listeners could break the live client.
		} };
		installations.set(scope, api);
		return api;
	}
	return Object.freeze({ install: install });
})();


//################################
// PARAMETERS
// Contains Parameters to change the playstile of the bot. Usually no need to change anything.
//################################

/* PERFORMANCE MODE
* Range 0 to 4. Decrease calculation time at the cost of efficiency (2 equals the time of ai version 1.2.1 and before).
* 4 = Highest Precision and Calculation Time. 0 = Lowest Precision and Calculation Time.
* Note: The bot will automatically decrease the performance mode when it approaches the time limit.
* Note 2: Firefox is usually able to run the script faster than Chrome.
*/
var PERFORMANCE_MODE = 3;

//HAND EVALUATION CONSTANTS
var EFFICIENCY = 1.0; // Lower: Slower and more expensive hands. Higher: Faster and cheaper hands. Default: 1.0, Minimum: 0
var SAFETY = 1.0; // Lower: The bot will not pay much attention to safety. Higher: The bot will try to play safer. Default: 1.0, Minimum: 0
var SAKIGIRI = 1.0; //Lower: Don't place much importance on Sakigiri. Higher: Try to Sakigiri more often. Default: 1.0, Minimum: 0

//CALL CONSTANTS
var CALL_PON_CHI = 1.0; //Lower: Call Pon/Chi less often. Higher: Call Pon/Chi more often. Default: 1.0, Minimum: 0
var CALL_KAN = 1.0; //Lower: Call Kan less often. Higher: Call Kan more often. Default: 1.0, Minimum: 0

//STRATEGY CONSTANTS
var RIICHI = 1.0; //Lower: Call Riichi less often. Higher: Call Riichi more often. Default: 1.0, Minimum: 0
var CHIITOITSU = 5; //Number of Pairs in Hand to go for chiitoitsu. Default: 5
var THIRTEEN_ORPHANS = 10; //Number of Honor/Terminals in hand to go for 13 orphans. Default: 10
var KEEP_SAFETILE = false; //If set to true the bot will keep 1 safetile

//MODEL CALIBRATION
// Tenpai chance multipliers by room rank. Higher room => players are more likely to be tenpai.
var ROOM_TENPAI_MODIFIER = {
	1: 0.60,
	2: 0.70,
	3: 0.80,
	4: 0.90,
	5: 1.00
};

//MISC
var MARK_TSUMOGIRI = false; // Mark the tsumogiri tiles of opponents with grey color
var CHANGE_RECOMMEND_TILE_COLOR = true; // change recommended tile color in help mode
var USE_EMOJI = true; //use EMOJI to show tile
var LOG_AMOUNT = 3; //Amount of Messages to log for Tile Priorities
var DEBUG_BUTTON = false; //Display a Debug Button in the GUI



//### GLOBAL VARIABLES DO NOT CHANGE ###
var run = false; //Is the bot running
var threadIsRunning = false;
var decisionEpoch = 0;
var activeDecisionState = null;
const AIMODE = { //ENUM of AI mode
	AUTO: 0,
	HELP: 1,
}
const AIMODE_NAME = [ //Name of AI mode
	"Auto",
	"Help",
]
const STRATEGIES = { //ENUM of strategies
	GENERAL: 'General',
	CHIITOITSU: 'Chiitoitsu',
	FOLD: 'Fold',
	THIRTEEN_ORPHANS: 'Thirteen_Orphans'
}
var strategy = STRATEGIES.GENERAL; //Current strategy
var strategyAllowsCalls = true; //Does the current strategy allow calls?
var isClosed = true; //Is own hand closed?
var dora = []; //Array of Tiles (index, type, dora)
var ownHand = []; //index, type, dora
var discards = []; //Later: Change to array for each player
var calls = []; //Calls/Melds of each player
var availableTiles = []; //Tiles that are available
var seatWind = 1; //1: East,... 4: North
var roundWind = 1; //1: East,... 4: North
var tilesLeft = 0; //tileCounter
var visibleTiles = []; //Tiles that are visible
var errorCounter = 0; //Counter to check if bot is working
var lastTilesLeft = 0; //Counter to check if bot is working
var isConsideringCall = false;
var riichiTiles = [null, null, null, null]; // Track players discarded tiles on riichi
var functionsExtended = false;
var playerDiscardSafetyList = [[], [], [], []];
var totalPossibleWaits = {};
var timeSave = 0;
var showingStrategy = false; //Current in own turn?
// shanten starts at 8 (the maximum shanten for a 13-tile closed hand with no useful groups)
var helpHintContext = { shanten: 8, strategy: STRATEGIES.GENERAL }; //Context for HELP mode hint display
var runtimeProfiling = {
	discardDurationsMs: [],
	maxSamples: 30,
	slowDiscardThresholdMs: 1500
};

// Display
var tileEmojiList = [
	["red🀝", "🀙", "🀚", "🀛", "🀜", "🀝", "🀞", "🀟", "🀠", "🀡"],
	["red🀋", "🀇", "🀈", "🀉", "🀊", "🀋", "🀌", "🀍", "🀎", "🀏"],
	["red🀔", "🀐", "🀑", "🀒", "🀓", "🀔", "🀕", "🀖", "🀗", "🀘"],
	["", "🀀", "🀁", "🀂", "🀃", "🀆", "🀅", "🀄"]];


//LOCAL STORAGE
var AUTORUN = window.localStorage.getItem("alphajongAutorun") == "true";
var ROOM = window.localStorage.getItem("alphajongRoom");

ROOM = ROOM == null ? 2 : ROOM

var MODE = window.localStorage.getItem("alphajongAIMode")
MODE = MODE == null ? AIMODE.AUTO : parseInt(MODE);


//################################
// GUI
// Adds elements like buttons to control the bot
//################################

var guiDiv = document.createElement("div");
var guiSpan = document.createElement("span");
var startButton = document.createElement("button");
var aimodeCombobox = document.createElement("select");
var autorunCheckbox = document.createElement("input");
var roomCombobox = document.createElement("select");
var currentActionOutput = document.createElement("input");
var debugButton = document.createElement("button");
var hideButton = document.createElement("button");
var hintsButton = document.createElement("button");
var startupNotice = document.createElement("div");

// Floating, draggable hint panel (shown in HELP mode)
var hintPanelDiv = document.createElement("div");
var hintPanelHeader = document.createElement("div");
var hintPanelContent = document.createElement("div");
var hintPanelCloseButton = document.createElement("button");

function initGui() {
	if (guiDiv.isConnected) {
		return;
	}
	// Diagnostics must remain visible even when the game API never loads.
	if (document.body == null) {
		document.addEventListener("DOMContentLoaded", initGui, { once: true });
		return;
	}

	guiDiv.style.position = "absolute";
	guiDiv.style.zIndex = "100001"; //On top of the game
	guiDiv.style.left = "0px";
	guiDiv.style.top = "0px";
	guiDiv.style.width = "100%";
	guiDiv.style.textAlign = "center";
	guiDiv.style.fontSize = "20px";

	guiSpan.style.backgroundColor = "rgba(255,255,255,0.5)";
	guiSpan.style.padding = "5px";

	startButton.innerHTML = "Start Bot";
	if (AUTORUN && !startupError) {
		startButton.innerHTML = "Stop Bot";
	}
	startButton.disabled = !startupFinished || Boolean(startupError);
	startButton.style.marginRight = "15px";
	startButton.onclick = function () {
		toggleRun();
	};
	guiSpan.appendChild(startButton);

	refreshAIMode();
	aimodeCombobox.style.marginRight = "15px";
	aimodeCombobox.onchange = function() {
		aiModeChange();
	};
	guiSpan.appendChild(aimodeCombobox);

	autorunCheckbox.type = "checkbox";
	autorunCheckbox.id = "autorun";
	autorunCheckbox.disabled = Boolean(startupError);
	autorunCheckbox.onclick = function () {
		autorunCheckboxClick();
	};
	if (window.localStorage.getItem("alphajongAutorun") == "true") {
		autorunCheckbox.checked = true;
	}
	guiSpan.appendChild(autorunCheckbox);
	var checkboxLabel = document.createElement("label");
	checkboxLabel.htmlFor = "autorun";
	checkboxLabel.appendChild(document.createTextNode('Autostart'));
	checkboxLabel.style.marginRight = "15px";
	guiSpan.appendChild(checkboxLabel);

	refreshRoomSelection();

	roomCombobox.style.marginRight = "15px";
	roomCombobox.onchange = function () {
		roomChange();
	};

	guiSpan.appendChild(roomCombobox);

	currentActionOutput.readOnly = "true";
	currentActionOutput.size = "20";
	currentActionOutput.style.marginRight = "15px";
	if (!currentActionOutput.value) {
		showCrtActionMsg("Waiting for Mahjong Soul.");
	}
	guiSpan.appendChild(currentActionOutput);

	debugButton.innerHTML = "Debug";
	debugButton.onclick = function () {
		showDebugString();
	};
	if (DEBUG_BUTTON) {
		guiSpan.appendChild(debugButton);
	}

	hintsButton.innerHTML = "Hints";
	hintsButton.style.marginRight = "15px";
	hintsButton.title = "Show/Hide the HELP mode hint panel";
	hintsButton.onclick = function () {
		hintPanelDiv.style.display = hintPanelDiv.style.display === "none" ? "block" : "none";
	};
	guiSpan.appendChild(hintsButton);

	hideButton.innerHTML = "Hide GUI";
	hideButton.onclick = function () {
		toggleGui();
	};
	guiSpan.appendChild(hideButton);

	guiDiv.appendChild(guiSpan);
	startupNotice.setAttribute("role", "status");
	startupNotice.style.cssText = "max-width: 640px; margin: 8px auto; padding: 10px; " +
		"background: #30251b; color: #fff; border: 1px solid #d3a45e; border-radius: 5px; " +
		"font: 14px/1.5 sans-serif; text-align: left; white-space: normal;";
	startupNotice.hidden = !startupNotice.textContent;
	guiDiv.appendChild(startupNotice);
	document.body.appendChild(guiDiv);

	// Build and attach the floating hint panel
	initHintPanel();

	guiDiv.style.display = "block";
}

function toggleGui() {
	if (guiDiv.style.display == "block") {
		guiDiv.style.display = "none";
	}
	else {
		guiDiv.style.display = "block";
	}
}

function showDebugString() {
	alert("If you notice a bug while playing please go to the correct turn in the replay (before the bad discard), press this button, copy the Debug String from the textbox and include it in your issue on github.");
	if (isInGame()) {
		setData();
		showCrtActionMsg(getDebugString());
	}
}

function aiModeChange() {
	decisionEpoch++;
	oldOps = "";
	window.localStorage.setItem("alphajongAIMode", aimodeCombobox.value);
	MODE = parseInt(aimodeCombobox.value);

	setAutoCallWin(run && MODE === AIMODE.AUTO);
}

function roomChange() {
	window.localStorage.setItem("alphajongRoom", roomCombobox.value);
	ROOM = roomCombobox.value;
}

function hideButtonClick() {
	guiDiv.style.display = "none";
}

function autorunCheckboxClick() {
	if (autorunCheckbox.checked) {
		window.localStorage.setItem("alphajongAutorun", "true");
		AUTORUN = true;
	}
	else {
		roomCombobox.disabled = true;
		window.localStorage.setItem("alphajongAutorun", "false");
		AUTORUN = false;
	}
	refreshRoomSelection();
}

// Refresh the AI mode
function refreshAIMode() {
	aimodeCombobox.innerHTML = AIMODE_NAME[MODE];
	for (let i = 0; i < AIMODE_NAME.length; i++) {
		var option = document.createElement("option");
		option.text = AIMODE_NAME[i];
		option.value = i;
		aimodeCombobox.appendChild(option);
	}
	aimodeCombobox.value = MODE;
}

// Refresh the contents of the Room Selection Combobox with values appropiate for the rank
function refreshRoomSelection() {
	roomCombobox.innerHTML = ""; // Clear old entries
	var rooms = getRooms();
	if (rooms == null || typeof rooms.forEach != 'function') {
		roomCombobox.appendChild(new Option(typeof getUnityClient === "function" && getUnityClient() ? "Choose a match in game" : "Waiting for rooms...", ""));
		roomCombobox.disabled = true;
		return;
	}
	rooms.forEach(function (room) {
		if (isInRank(room.id) && room.mode != 0) { // Rooms with mode = 0 are 1 Game only, not sure why they are in the code but not selectable in the UI...
			var option = document.createElement("option");
			option.text = getRoomName(room);
			option.value = room.id;
			roomCombobox.appendChild(option);
		}
	});
	roomCombobox.value = ROOM;
	roomCombobox.disabled = !AUTORUN || Boolean(startupError);
}

function showStartupNotice(message) {
	startupNotice.textContent = message;
	startupNotice.hidden = !message;
}

// Show msg to currentActionOutput
function showCrtActionMsg(msg) {
	currentActionOutput.value = msg;
}

// Show a HELP-mode strategy hint in the floating hint panel
function showCrtStrategyMsg(msg) {
	showingStrategy = true;
	hintPanelContent.textContent = msg;
	hintPanelDiv.style.display = "block";
}

function clearCrtStrategyMsg() {
	showingStrategy = false;
	hintPanelContent.textContent = "";
}

// Create, style and append the floating hint panel
function initHintPanel() {
	var savedPosStr = window.localStorage.getItem("alphajongHintPos");
	var savedPos = null;
	try {
		var parsedPos = savedPosStr !== null ? JSON.parse(savedPosStr) : null;
		if (parsedPos && Number.isFinite(parsedPos.left) && Number.isFinite(parsedPos.top)) savedPos = parsedPos;
	}
	catch { /* Ignore invalid saved layout data. */ }

	hintPanelDiv.style.position = "fixed";
	hintPanelDiv.style.zIndex = "100002";
	hintPanelDiv.style.minWidth = "230px";
	hintPanelDiv.style.maxWidth = "min(560px, 90vw)";
	hintPanelDiv.style.backgroundColor = "rgba(24,24,24,0.88)";
	hintPanelDiv.style.borderRadius = "7px";
	hintPanelDiv.style.boxShadow = "0 3px 14px rgba(0,0,0,0.6)";
	hintPanelDiv.style.overflow = "hidden";
	hintPanelDiv.style.display = "none";
	hintPanelDiv.style.left = (savedPos ? savedPos.left : 20) + "px";
	hintPanelDiv.style.top = (savedPos ? savedPos.top : 60) + "px";

	// Title bar (drag handle)
	hintPanelHeader.style.backgroundColor = "rgba(50,110,190,0.92)";
	hintPanelHeader.style.color = "white";
	hintPanelHeader.style.padding = "4px 8px";
	hintPanelHeader.style.cursor = "move";
	hintPanelHeader.style.userSelect = "none";
	hintPanelHeader.style.fontSize = "13px";
	hintPanelHeader.style.display = "flex";
	hintPanelHeader.style.justifyContent = "space-between";
	hintPanelHeader.style.alignItems = "center";

	var headerTitle = document.createElement("span");
	headerTitle.textContent = "AlphaJong Hints";
	hintPanelHeader.appendChild(headerTitle);

	hintPanelCloseButton.textContent = "\u00d7"; // ×
	hintPanelCloseButton.style.background = "none";
	hintPanelCloseButton.style.border = "none";
	hintPanelCloseButton.style.color = "white";
	hintPanelCloseButton.style.cursor = "pointer";
	hintPanelCloseButton.style.fontSize = "18px";
	hintPanelCloseButton.style.lineHeight = "1";
	hintPanelCloseButton.style.padding = "0 2px";
	hintPanelCloseButton.onclick = function () {
		hintPanelDiv.style.display = "none";
	};
	hintPanelHeader.appendChild(hintPanelCloseButton);
	hintPanelDiv.appendChild(hintPanelHeader);

	// Content area
	hintPanelContent.style.padding = "8px 12px";
	hintPanelContent.style.color = "white";
	hintPanelContent.style.fontSize = "16px";
	hintPanelContent.style.whiteSpace = "normal";
	hintPanelContent.style.fontFamily = "sans-serif";
	hintPanelDiv.appendChild(hintPanelContent);

	document.body.appendChild(hintPanelDiv);

	makeDraggable(hintPanelDiv, hintPanelHeader);
}

// Make an element draggable by holding its handle; saves position to localStorage
function makeDraggable(element, handle) {
	handle.addEventListener("mousedown", function (e) {
		e.preventDefault();
		var dragStartX = e.clientX;
		var dragStartY = e.clientY;
		var elemStartLeft = parseInt(element.style.left, 10) || 0;
		var elemStartTop = parseInt(element.style.top, 10) || 0;

		function onMouseMove(e) {
			element.style.left = (elemStartLeft + e.clientX - dragStartX) + "px";
			element.style.top = (elemStartTop + e.clientY - dragStartY) + "px";
		}

		function onMouseUp() {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			window.localStorage.setItem("alphajongHintPos", JSON.stringify({
				left: parseInt(element.style.left, 10),
				top: parseInt(element.style.top, 10)
			}));
		}

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	});
}


//################################
// API (MAHJONG SOUL)
// Returns data from Mahjong Souls Javascript
//################################

function getDesktopManagerInstance() {
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) return unity.state.getManager();
	if (typeof view == 'undefined' || view == null || typeof view.DesktopMgr == 'undefined' || view.DesktopMgr == null) {
		return null;
	}
	return view.DesktopMgr.Inst || null;
}

function getDesktopPlayer(player) {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.players) || typeof manager.players[player] == 'undefined') {
		return null;
	}
	return manager.players[player];
}

function getDiscardContainerFallback() {
	return {
		pais: [],
		last_pai: null,
		last_is_liqi: false
	};
}

function sendReq2MJ(method, payload) {
	if (MODE !== AIMODE.AUTO || !isActionCurrent()) return false;
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) {
		if (!unity.send(method, payload)) return false;
		markActionSent();
		return true;
	}
	if (typeof app == 'undefined' || app == null || typeof app.NetAgent == 'undefined' || app.NetAgent == null) {
		return false;
	}
	try {
		app.NetAgent.sendReq2MJ('FastTest', method, payload);
		markActionSent();
		return true;
	}
	catch {
		return false;
	}
}

function isActionCurrent() {
	try {
		return typeof isDecisionCurrent == 'function' && isDecisionCurrent();
	}
	catch {
		// The client may be replacing its board objects during a round change.
		return false;
	}
}

function markActionSent() {
	if (activeDecisionState != null) activeDecisionState.actionSent = true;
}

function triggerOperationAnimation() {
	var manager = getDesktopManagerInstance();
	if (manager != null && typeof manager.WhenDoOperation == 'function') {
		manager.WhenDoOperation();
	}
}


function preventAFK() {
	if (typeof getUnityClient === "function" && getUnityClient()) return;
	if (typeof GameMgr == 'undefined' || GameMgr == null || GameMgr.Inst == null) {
		return;
	}
	if (GameMgr.Inst._pre_mouse_point != null) {
		GameMgr.Inst._pre_mouse_point.x = Math.floor(Math.random() * 100) + 1;
		GameMgr.Inst._pre_mouse_point.y = Math.floor(Math.random() * 100) + 1;
	}
	if (typeof GameMgr.Inst.clientHeatBeat == 'function') {
		GameMgr.Inst.clientHeatBeat(); // Prevent Client-side AFK
	}
	if (typeof app != 'undefined' && app != null && app.NetAgent != null &&
		typeof app.NetAgent.sendReq2Lobby == 'function') {
		app.NetAgent.sendReq2Lobby('Lobby', 'heatbeat', { no_operation_counter: 0 }); //Prevent Server-side AFK
	}

	var manager = getDesktopManagerInstance();
	if (manager == null) {
		return;
	}
	manager.hangupCount = 0;
	//uiscript.UI_Hangup_Warn.Inst.locking
}

function hasFinishedMainLobbyLoading() {
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) return unity.state.isLobbyReady() || unity.state.isInGame();
	if (isInGame()) {
		return true;
	}
	if (typeof GameMgr != 'undefined' && GameMgr != null && GameMgr.Inst != null &&
		GameMgr.Inst.login_loading_end) {
		return true;
	}
	// The lobby can be open even when the older loading flag is absent or stale.
	// Inst alone is insufficient: the client also keeps closed UI instances around.
	return typeof uiscript != 'undefined' && uiscript != null && uiscript.UI_Lobby != null &&
		uiscript.UI_Lobby.Inst != null && uiscript.UI_Lobby.Inst.enabled === true;
}

function hasLegacyClient() {
	return (typeof GameMgr != 'undefined' && GameMgr != null) ||
		(typeof view != 'undefined' && view != null && view.DesktopMgr != null) ||
		(typeof uiscript != 'undefined' && uiscript != null && uiscript.UI_Lobby != null);
}

function isUnsupportedUnityClient() {
	// Check the actual client, not the hostname: regional sites can change engines.
	return !hasLegacyClient() && document.getElementById("unity-canvas") != null &&
		(typeof createUnityInstance == 'function' ||
			document.querySelector('script[src*=".loader.js"]') != null);
}

function isUnityPage() {
	return isUnsupportedUnityClient();
}

function searchForGame() {
	if (typeof uiscript == 'undefined' || uiscript == null ||
		typeof uiscript.UI_PiPeiYuYue == 'undefined' || uiscript.UI_PiPeiYuYue == null ||
		uiscript.UI_PiPeiYuYue.Inst == null) {
		return;
	}
	uiscript.UI_PiPeiYuYue.Inst.addMatch(ROOM);

	// Direct way to search for a game, without UI:
	// app.NetAgent.sendReq2Lobby('Lobby', 'startUnifiedMatch', {match_sid: 1 + ":" + ROOM, client_version_string: GameMgr.Inst.getClientVersion()});
}

function getOperationList() {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.oplist)) {
		return [];
	}
	return manager.oplist;
}

function getOperations() {
	if (typeof getUnityClient === "function" && getUnityClient()) return AlphaJongUnityState.OPERATIONS;
	if (typeof mjcore == 'undefined' || mjcore == null || typeof mjcore.E_PlayOperation == 'undefined') {
		return {};
	}
	return mjcore.E_PlayOperation;
}

function getDora() {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.dora)) {
		return [];
	}
	return manager.dora;
}

function getPlayerHand() {
	var player = getDesktopPlayer(0);
	if (player == null || !Array.isArray(player.hand)) {
		return [];
	}
	return player.hand;
}

function getDiscardsOfPlayer(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || desktopPlayer.container_qipai == null) {
		return getDiscardContainerFallback();
	}
	return desktopPlayer.container_qipai;
}

function getCallsOfPlayer(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || desktopPlayer.container_ming == null || !Array.isArray(desktopPlayer.container_ming.mings)) {
		return [];
	}

	var callArray = [];
	//Mark the tiles with the player who discarded the tile
	for (let ming of desktopPlayer.container_ming.mings) {
		for (var i = 0; i < ming.pais.length; i++) {
			ming.pais[i].from = ming.from[i];
			if (i == 3) {
				ming.pais[i].kan = true;
			}
			else {
				ming.pais[i].kan = false;
			}
			callArray.push(ming.pais[i]);
		}
	}

	return callArray;
}

function getNumberOfKitaOfPlayer(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || desktopPlayer.container_babei == null || !Array.isArray(desktopPlayer.container_babei.pais)) {
		return 0;
	}
	return desktopPlayer.container_babei.pais.length;
}

function getTilesLeft() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.left_tile_count != 'number') {
		return 0;
	}
	return manager.left_tile_count;
}

function localPosition2Seat(player) {
	player = getCorrectPlayerNumber(player);
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.localPosition2Seat != 'function') {
		return player;
	}
	return manager.localPosition2Seat(player);
}

function seat2LocalPosition(playerSeat) {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.seat2LocalPosition != 'function') {
		return playerSeat;
	}
	var position = manager.seat2LocalPosition(playerSeat);
	for (var player = 0; player < getNumberOfPlayers(); player++) {
		if (getCorrectPlayerNumber(player) == position) return player;
	}
	return -1;
}

function getCurrentPlayer() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_player != 'number') {
		return 0;
	}
	return manager.index_player;
}

function getSeatWind(player) {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_ju != 'number') {
		return 1;
	}
	if (getNumberOfPlayers() == 3) {
		return ((3 + localPosition2Seat(player) - manager.index_ju) % 3) + 1;
	}
	else {
		return ((4 + localPosition2Seat(player) - manager.index_ju) % 4) + 1;
	}
}

function getRound() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_ju != 'number') {
		return 1;
	}
	return manager.index_ju + 1;
}

function getRoundWind() {
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.index_change != 'number') {
		return 1;
	}
	return manager.index_change + 1;
}

function setAutoCallWin(win) {
	// Unity decisions call wins through the same guarded action path as discards.
	if (typeof getUnityClient === "function" && getUnityClient()) return;
	if (!isInGame())
		return;
	var manager = getDesktopManagerInstance();
	if (manager == null || typeof manager.setAutoHule != 'function') {
		return;
	}

	manager.setAutoHule(win);
	//view.DesktopMgr.Inst.setAutoNoFulu(true) //Auto No Chi/Pon/Kan
	try {
		uiscript.UI_DesktopInfo.Inst.refreshFuncBtnShow(uiscript.UI_DesktopInfo.Inst._container_fun.getChildByName("btn_autohu"), manager.auto_hule); //Refresh GUI Button
	}
	catch {
		return;
	}
}

function getTileForCall() {
	var manager = getDesktopManagerInstance();
	if (manager == null || manager.lastqipai == null) {
		return { index: 0, type: 0, dora: false, doraValue: 0 };
	}
	var tile = manager.lastqipai.val;
	tile.doraValue = getTileDoraValue(tile);
	return tile;
}

function makeCall(type) {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		if (!sendReq2MJ('inputChiPengGang', { type: type, index: 0, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send call request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept: Call ${getCallNameByType(type)};`);
	}
}

function makeCallWithOption(type, option) {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		if (!sendReq2MJ('inputChiPengGang', { type: type, index: option, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send call option request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept ${option}: Call ${getCallNameByType(type)};`);
	}
}

function declineCall(operation) {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		try {
			if (operation == getOperationList()[getOperationList().length - 1].type) { //Is last operation -> Send decline Command
				if (!sendReq2MJ('inputChiPengGang', { cancel_operation: true, timeuse: 2 })) {
					log("Failed to send decline call request.");
					return;
				}
				triggerOperationAnimation();
			}
		}
		catch {
			log("Failed to decline the Call. Maybe someone else was faster?");
		}
	} else {
		showCrtStrategyMsg(`Decline: Call ${getCallNameByType(operation)};`);
	}
}

function sendRiichiCall(tile, moqie) {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		return sendReq2MJ('inputOperation', { type: getOperations().liqi, tile: tile, moqie: moqie, timeuse: Math.random() * 2 + 1 }); //Moqie: Throwing last drawn tile (Riichi -> false)
	} else {
		let tileName = getTileEmojiByName(tile);
		showCrtStrategyMsg(`Riichi: ${tileName};`);
		return true;
	}
}

function sendKitaCall() {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		var manager = getDesktopManagerInstance();
		if (manager == null || manager.mainrole == null || manager.mainrole.last_tile == null) {
			return;
		}
		var moqie = manager.mainrole.last_tile.val.toString() == "4z";
		if (!sendReq2MJ('inputOperation', { type: getOperations().babei, moqie: moqie, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send Kita request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept: Kita;`);
	}
}

function sendAbortiveDrawCall() {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		if (!sendReq2MJ('inputOperation', { type: getOperations().jiuzhongjiupai, index: 0, timeuse: Math.random() * 2 + 1 })) {
			log("Failed to send abortive draw request.");
			return;
		}
		triggerOperationAnimation();
	} else {
		showCrtStrategyMsg(`Accept: Kyuushu Kyuuhai;`);
	}
}

function callDiscard(tileNumber) {
	if (!isActionCurrent()) return false;
	if (MODE === AIMODE.AUTO) {
		try {
			var player = getDesktopPlayer(0);
			if (player != null && Array.isArray(player.hand) && player.hand[tileNumber] != null && player.hand[tileNumber].valid) {
				if (typeof getUnityClient === "function" && getUnityClient()) {
					return sendReq2MJ('inputOperation', { type: getOperations().dapai, tile: player.hand[tileNumber].val.toString(),
						moqie: player.hand[tileNumber] === player.last_tile });
				}
				player._choose_pai = player.hand[tileNumber];
				player.DoDiscardTile();
				markActionSent();
			}
		}
		catch {
			log("Failed to discard the tile.");
		}
	} else {
		let tileID = ownHand[tileNumber];
		let tileName = getTileName(tileID, false);
		let strategyStr = helpHintContext.strategy || STRATEGIES.GENERAL;
		let shantenStr = helpHintContext.shanten <= 0 ? "Tenpai" : (helpHintContext.shanten + " from tenpai");
		let drawStr = Number.isFinite(helpHintContext.ukeire) ?
			` | ${helpHintContext.ukeire} improving unseen tiles (~${(helpHintContext.improvementChance * 100).toFixed(1)}% next draw)` : "";
		let furitenStr = helpHintContext.furiten ? " | Furiten: self-draw only" : "";
		showCrtStrategyMsg(`[${strategyStr} | ${shantenStr}] Discard: ${tileName}${drawStr}${furitenStr}`);
		if (CHANGE_RECOMMEND_TILE_COLOR && !(typeof getUnityClient === "function" && getUnityClient())) {
			view.DesktopMgr.Inst.mainrole.hand.forEach(
				tile => tile.val.toString() == tileID ?
					tile._SetColor(new Laya.Vector4(0.5, 0.8, 0.9, 1))
					: tile._SetColor(new Laya.Vector4(1, 1, 1, 1)));
		}
	}
}

function getPlayerLinkState(player) {
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) {
		var manager = unity.state.getManager();
		return manager ? manager.player_link_state[localPosition2Seat(player)] : 1;
	}
	if (typeof view == 'undefined' || view == null || typeof view.DesktopMgr == 'undefined' || view.DesktopMgr == null || !Array.isArray(view.DesktopMgr.player_link_state)) {
		return 1;
	}
	var linkState = view.DesktopMgr.player_link_state[localPosition2Seat(player)];
	return typeof linkState == 'undefined' ? 1 : linkState;
}

function getNumberOfTilesInHand(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || !Array.isArray(desktopPlayer.hand)) {
		return 0;
	}
	return desktopPlayer.hand.length;
}

function isEndscreenShown() {
	var manager = getDesktopManagerInstance();
	return manager != null && manager.gameEndResult != null;
}

function isDisconnect() {
	if (typeof getUnityClient === "function" && getUnityClient()) return false; // Unity owns reconnects.
	return typeof uiscript != 'undefined' && uiscript != null && uiscript.UI_Hanguplogout != null &&
		uiscript.UI_Hanguplogout.Inst != null && uiscript.UI_Hanguplogout.Inst._me != null &&
		uiscript.UI_Hanguplogout.Inst._me.visible === true;
}

function isPlayerRiichi(player) {
	var player_correct = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player_correct);
	if (desktopPlayer == null || desktopPlayer.liqibang == null) {
		return false;
	}
	return desktopPlayer.liqibang._activeInHierarchy || getDiscardsOfPlayer(player).last_is_liqi;
}

function isInGame() {
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) return unity.state.isInGame();
	try {
		return this != null && view != null && view.DesktopMgr != null &&
			view.DesktopMgr.Inst != null && view.DesktopMgr.player_link_state != null &&
			view.DesktopMgr.Inst.active && !isEndscreenShown()
	}
	catch {
		return false;
	}
}

function doesPlayerExist(player) {
	var desktopPlayer = getDesktopPlayer(player);
	return desktopPlayer != null && typeof desktopPlayer.hand != 'undefined' && desktopPlayer.hand != null;
}

function getPlayerScore(player) {
	player = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player);
	if (desktopPlayer == null || typeof desktopPlayer.score != 'number') {
		return 0;
	}
	return desktopPlayer.score;
}

//Needs to be called before calls array is updated
function hasPlayerHandChanged(player) {
	var player_correct = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player_correct);
	if (desktopPlayer == null || !Array.isArray(desktopPlayer.hand)) {
		return false;
	}
	for (let hand of desktopPlayer.hand) {
		if (hand.old != true) {
			return true;
		}
	}
	return getCallsOfPlayer(player).length > calls[player].length;
}

//Sets a variable for each pai in a players hand
function rememberPlayerHand(player) {
	var player_correct = getCorrectPlayerNumber(player);
	var desktopPlayer = getDesktopPlayer(player_correct);
	if (desktopPlayer == null || !Array.isArray(desktopPlayer.hand)) {
		return;
	}
	for (let tile of desktopPlayer.hand) {
		tile.old = true;
	}
}

function isEastRound() {
	var manager = getDesktopManagerInstance();
	if (manager == null || manager.game_config == null || manager.game_config.mode == null) {
		return true;
	}
	return manager.game_config.mode.mode % 10 == 1;
}

// Is the player able to join a given room
function isInRank(room) {
	var roomData = cfg.desktop.matchmode.get(room);
	try {
		var rank = GameMgr.Inst.account_data[roomData.mode < 10 ? "level" : "level3"].id; // 4 player or 3 player rank
		return (roomData.room == 100) || (roomData.level_limit <= rank && roomData.level_limit_ceil >= rank); // room 100 is casual mode
	}
	catch {
		return roomData.room == 100 || roomData.level_limit > 0; // Display the Casual Rooms and all ranked rooms (no special rooms)
	}
}

// Map of all Rooms
function getRooms() {
	if (typeof getUnityClient === "function" && getUnityClient()) return null;
	try {
		return cfg.desktop.matchmode;
	}
	catch {
		return null;
	}
}

// Returns the room of the current game as a number: Bronze = 1, Silver = 2 etc.
function getCurrentRoom() {
	if (typeof getUnityClient === "function" && getUnityClient()) return 0;
	try {
		var manager = getDesktopManagerInstance();
		if (manager == null || manager.game_config == null || manager.game_config.meta == null) {
			return 0;
		}
		var currentRoom = manager.game_config.meta.mode_id;
		return getRooms().map_[currentRoom].room;
	}
	catch {
		return 0;
	}
}

// Client language: ["chs", "chs_t", "en", "jp"]
function getLanguage() {
	if (typeof GameMgr == 'undefined' || GameMgr == null) {
		return "en";
	}
	return GameMgr.client_language;
}

// Name of a room in client language
function getRoomName(room) {
	return room["room_name_" + getLanguage()] + " (" + game.Tools.room_mode_desc(room.mode) + ")";
}

//How much seconds left for a turn (base value, 20 at start)
function getOverallTimeLeft() {
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) return unity.getTimeLeft();
	try {
		return uiscript.UI_DesktopInfo.Inst._timecd._add;
	}
	catch {
		return 20;
	}
}

//How much time was left in the last turn?
function getLastTurnTimeLeft() {
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) {
		var manager = unity.state.getManager();
		return manager ? manager.time_add + manager.time_fixed : 25;
	}
	try {
		return uiscript.UI_DesktopInfo.Inst._timecd._pre_sec;
	}
	catch {
		return 25;
	}
}

// Extend some internal MJSoul functions with additional code
function extendMJSoulFunctions() {
	if (functionsExtended) {
		return;
	}
	if (!isInGame()) {
		return;
	}
	trackDiscardTiles();
	functionsExtended = true;
}

// Track which tiles the players discarded (for push/fold judgement and tracking the riichi tile)
function trackDiscardTiles() {
	var manager = getDesktopManagerInstance();
	if (manager == null || !Array.isArray(manager.players)) {
		return;
	}

	for (var i = 1; i < getNumberOfPlayers(); i++) {
		var player = getCorrectPlayerNumber(i);
		var desktopPlayer = getDesktopPlayer(player);
		if (desktopPlayer == null || desktopPlayer.container_qipai == null || typeof desktopPlayer.container_qipai.AddQiPai != 'function') {
			continue;
		}
		if (desktopPlayer.container_qipai.AddQiPai._alphajongWrapped === true) {
			continue;
		}

		desktopPlayer.container_qipai.AddQiPai = (function (_super) { // Extend the MJ-Soul Discard function
			return function () {
				decisionEpoch++;
				var player = -1;
				var danger = -1; //Unknown observation while another decision owns the simulation state.
				try {
					player = seat2LocalPosition(this.player.seat);
					if (player >= 0 && !threadIsRunning) {
						setData(false);
						visibleTiles.push(arguments[0]);
						availableTiles = removeTilesFromTileArray(availableTiles, [arguments[0]]);
						invalidateDefenseRuntimeCache();
						danger = getTileDanger(arguments[0], player);
						if (arguments[2] && danger < 0.01) danger = 0.05;
					}
				}
				catch (error) {
					log("Discard observation failed: " + error.message);
				}
				if (player >= 0 && Array.isArray(playerDiscardSafetyList[player])) {
					if (arguments[1]) riichiTiles[player] = arguments[0];
					arguments[0].tsumogiri = arguments[2];
					playerDiscardSafetyList[player].push(danger);
				}
				return _super.apply(this, arguments); // Call original function
			};
		})(desktopPlayer.container_qipai.AddQiPai);
		desktopPlayer.container_qipai.AddQiPai._alphajongWrapped = true;
	}
}


//################################
// UTILS
// Contains utility functions
//################################

var doublesCache = {};
var triplesAndPairsCache = {};

function getTileCacheKey(tiles, sorted = false) {
	var cacheTiles = sorted ? tiles : sortTiles(tiles);
	return cacheTiles.map(tile => tile.type + "-" + tile.index + "-" + (tile.dora ? 1 : 0)).join("|");
}

function clearHandAnalysisCache() {
	doublesCache = {};
	triplesAndPairsCache = {};
	clearExactHandAnalysisCache();
}

function getTileIdentityKey(tile) {
	if (typeof tile == 'undefined' || tile == null) {
		return "x";
	}
	return tile.type + "-" + tile.index + "-" + (tile.dora ? 1 : 0);
}

async function withSimulatedCallState(callTiles, callback) {
	var initialCallLength = calls[0].length;
	var wasClosed = isClosed;
	var originalStrategy = strategy;
	var originalAllowsCalls = strategyAllowsCalls;
	var callTile = getTileForCall();

	try {
		calls[0].push(callTiles[0]);
		calls[0].push(callTiles[1]);
		calls[0].push(callTile);
		isClosed = false;
		return await callback(callTile);
	}
	finally {
		calls[0].splice(initialCallLength);
		isClosed = wasClosed;
		strategy = originalStrategy;
		strategyAllowsCalls = originalAllowsCalls;
		invalidateDefenseRuntimeCache();
	}
}

//Return the number of players in the game (3 or 4)
function getNumberOfPlayers() {
	if (!doesPlayerExist(1) || !doesPlayerExist(2) || !doesPlayerExist(3)) {
		return 3;
	}
	return 4;
}

//Correct the player numbers
//Only necessary for 3 player games
function getCorrectPlayerNumber(player) {
	if (getNumberOfPlayers() == 4) {
		return player;
	}
	if (!doesPlayerExist(1)) {
		if (player > 0) {
			return player + 1;
		}
	}
	if (!doesPlayerExist(2)) {
		if (player > 1) {
			return player + 1;
		}
	}
	return player;
}

function isSameTile(tile1, tile2, checkDora = false) {
	if (tile1 == null || tile2 == null) {
		return false;
	}
	if (checkDora) {
		return tile1.index == tile2.index && tile1.type == tile2.type && tile1.dora == tile2.dora;
	}
	return tile1.index == tile2.index && tile1.type == tile2.type;
}

//Return number of doras in tiles
function getNumberOfDoras(tiles) {
	var dr = 0;
	for (let tile of tiles) {
		dr += tile.doraValue;
	}
	return dr;
}

//Pairs in tiles
function getPairs(tiles) {
	var sortedTiles = sortTiles(tiles);

	var pairs = [];
	var oldIndex = 0;
	var oldType = 0;
	sortedTiles.forEach(function (tile) {
		if (oldIndex != tile.index || oldType != tile.type) {
			var ts = getTilesInTileArray(sortedTiles, tile.index, tile.type);
			if ((ts.length >= 2)) {
				pairs.push({ tile1: ts[0], tile2: ts[1] }); //Grabs highest dora tiles first
			}
			oldIndex = tile.index;
			oldType = tile.type;
		}
	});
	return pairs;
}

//Pairs in tiles as array
function getPairsAsArray(tiles) {
	var pairs = getPairs(tiles);
	var pairList = [];
	pairs.forEach(function (pair) {
		pairList.push(pair.tile1);
		pairList.push(pair.tile2);
	});
	return pairList;
}

//Return doubles in tiles
function getDoubles(tiles) {
	tiles = sortTiles(tiles);
	var cacheKey = getTileCacheKey(tiles, true);
	if (typeof doublesCache[cacheKey] !== 'undefined') {
		return [...doublesCache[cacheKey]];
	}
	var doubles = [];
	for (let i = 0; i < tiles.length - 1; i++) {
		if (tiles[i].type == tiles[i + 1].type && (
			tiles[i].index == tiles[i + 1].index ||
			(tiles[i].type != 3 &&
				tiles[i].index + 2 >= tiles[i + 1].index))) {
			doubles.push(tiles[i]);
			doubles.push(tiles[i + 1]);
			i++;
		}
	}
	doublesCache[cacheKey] = doubles;
	return [...doubles];
}

//Return all triplets/3-sequences and pairs as a tile array
function getTriplesAndPairs(tiles) {
	var cacheKey = getTileCacheKey(tiles) + "|" + (PERFORMANCE_MODE - timeSave) + "|" + strategy;
	if (typeof triplesAndPairsCache[cacheKey] !== 'undefined') {
		var cached = triplesAndPairsCache[cacheKey];
		return { triples: [...cached.triples], pairs: [...cached.pairs], shanten: cached.shanten };
	}
	var sequences = getSequences(tiles);
	var triplets = getTriplets(tiles);
	var pairs = getPairs(tiles);
	var bestCombination = getBestCombinationOfTiles(tiles, sequences.concat(triplets).concat(pairs), { triples: [], pairs: [], shanten: 8 });
	triplesAndPairsCache[cacheKey] = bestCombination;
	return { triples: [...bestCombination.triples], pairs: [...bestCombination.pairs], shanten: bestCombination.shanten };
}

//Return all triplets/3-tile-sequences as a tile array
function getTriples(tiles) {
	var sequences = getSequences(tiles);
	var triplets = getTriplets(tiles);
	return getBestCombinationOfTiles(tiles, sequences.concat(triplets), { triples: [], pairs: [], shanten: 8 }).triples;
}

//Return all triplets in tile array
function getTriplets(tiles) {
	var sortedTiles = sortTiles(tiles);

	var triples = [];
	var oldIndex = 0;
	var oldType = 0;
	sortedTiles.forEach(function (tile) {
		if (oldIndex != tile.index || oldType != tile.type) {
			var ts = getTilesInTileArray(sortedTiles, tile.index, tile.type);
			if ((ts.length >= 3)) {
				triples.push({ tile1: ts[0], tile2: ts[1], tile3: ts[2] }); //Grabs highest dora tiles first because of sorting
			}
			oldIndex = tile.index;
			oldType = tile.type;
		}
	});
	return triples;
}

//Triplets in tiles as array
function getTripletsAsArray(tiles) {
	var triplets = getTriplets(tiles);
	var tripletsList = [];
	triplets.forEach(function (triplet) {
		tripletsList.push(triplet.tile1);
		tripletsList.push(triplet.tile2);
		tripletsList.push(triplet.tile3);
	});
	return tripletsList;
}

//Returns the best combination of sequences. 
//Small Bug: Can return red dora tiles multiple times, but doesn't matter for the current use cases
function getBestSequenceCombination(inputHand) {
	return getBestCombinationOfTiles(inputHand, getSequences(inputHand), { triples: [], pairs: [], shanten: 8 }).triples;
}

//Check if there is already a red dora tile in the tiles array.
//More or less a workaround for a problem with the getBestCombinationOfTiles function...
function pushTileAndCheckDora(tiles, arrayToPush, tile) {
	if (tile.dora && tiles.some(t => t.type == tile.type && t.dora)) {
		var nonDoraTile = { ...tile };
		nonDoraTile.dora = false;
		nonDoraTile.doraValue = getTileDoraValue(nonDoraTile);
		arrayToPush.push(nonDoraTile);
		return nonDoraTile;
	}
	arrayToPush.push(tile);
	return tile;
}

function isBetterCombination(candidate, currentBest, checkShanten = false) {
	if (checkShanten && candidate.shanten != currentBest.shanten) {
		return candidate.shanten < currentBest.shanten;
	}
	if (candidate.triples.length != currentBest.triples.length) {
		return candidate.triples.length > currentBest.triples.length;
	}
	if (candidate.pairs.length != currentBest.pairs.length) {
		return candidate.pairs.length > currentBest.pairs.length;
	}
	return getNumberOfDoras(candidate.triples.concat(candidate.pairs)) > getNumberOfDoras(currentBest.triples.concat(currentBest.pairs));
}

//Return the best combination of 3-tile Sequences, Triplets and pairs in array of tiles
//Recursive Function, weird code that can probably be optimized
function getBestCombinationOfTiles(inputTiles, possibleCombinations, chosenCombinations, startIndex = 0) {
	var originalC = { triples: [...chosenCombinations.triples], pairs: [...chosenCombinations.pairs], shanten: chosenCombinations.shanten };
	for (var i = startIndex; i < possibleCombinations.length; i++) {
		var cs = { triples: [...originalC.triples], pairs: [...originalC.pairs], shanten: originalC.shanten };
		var tiles = possibleCombinations[i];
		var hand = [...inputTiles];
		if (!("tile3" in tiles)) { // Pairs
			if (tiles.tile1.index == tiles.tile2.index && getNumberOfTilesInTileArray(hand, tiles.tile1.index, tiles.tile1.type) < 2) {
				continue;
			}
		}
		else if (getNumberOfTilesInTileArray(hand, tiles.tile1.index, tiles.tile1.type) == 0 ||
			getNumberOfTilesInTileArray(hand, tiles.tile2.index, tiles.tile2.type) == 0 ||
			getNumberOfTilesInTileArray(hand, tiles.tile3.index, tiles.tile3.type) == 0 ||
			(tiles.tile1.index == tiles.tile2.index && getNumberOfTilesInTileArray(hand, tiles.tile1.index, tiles.tile1.type) < 3)) {
			continue;
		}
		if ("tile3" in tiles) {
			var tt = pushTileAndCheckDora(cs.pairs.concat(cs.triples), cs.triples, tiles.tile1);
			hand = removeTilesFromTileArray(hand, [tt]);
			tt = pushTileAndCheckDora(cs.pairs.concat(cs.triples), cs.triples, tiles.tile2);
			hand = removeTilesFromTileArray(hand, [tt]);
			tt = pushTileAndCheckDora(cs.pairs.concat(cs.triples), cs.triples, tiles.tile3);
			hand = removeTilesFromTileArray(hand, [tt]);
		}
		else {
			var tt = pushTileAndCheckDora(cs.pairs.concat(cs.triples), cs.pairs, tiles.tile1);
			hand = removeTilesFromTileArray(hand, [tt]);
			tt = pushTileAndCheckDora(cs.pairs.concat(cs.triples), cs.pairs, tiles.tile2);
			hand = removeTilesFromTileArray(hand, [tt]);
		}

		if (PERFORMANCE_MODE - timeSave <= 3) {
			var anotherChoice = getBestCombinationOfTiles(hand, possibleCombinations, cs, i + 1);
			if (isBetterCombination(anotherChoice, chosenCombinations)) {
				chosenCombinations = anotherChoice;
			}
		}
		else {
			if (cs.triples.length >= chosenCombinations.triples.length) {
				var doubles = getDoubles(hand); //This is costly, so only do it when performance mode is at maximum
				cs.shanten = calculateShanten(parseInt(cs.triples.length / 3), parseInt(cs.pairs.length / 2), parseInt(doubles.length / 2));
			}
			else {
				cs.shanten = 8;
			}

			var anotherChoice = getBestCombinationOfTiles(hand, possibleCombinations, cs, i + 1);
			if (isBetterCombination(anotherChoice, chosenCombinations, true)) {
				chosenCombinations = anotherChoice;
			}
		}
	}

	return chosenCombinations;
}

//Return all 3-tile Sequences in tile array
function getSequences(tiles) {
	var sortedTiles = sortTiles(tiles);
	var sequences = [];
	for (var index = 1; index <= 7; index++) {
		for (var type = 0; type <= 2; type++) {
			var tiles1 = getTilesInTileArray(sortedTiles, index, type);
			var tiles2 = getTilesInTileArray(sortedTiles, index + 1, type);
			var tiles3 = getTilesInTileArray(sortedTiles, index + 2, type);

			var i = 0;
			while (tiles1.length > i && tiles2.length > i && tiles3.length > i) {
				sequences.push({ tile1: tiles1[i], tile2: tiles2[i], tile3: tiles3[i] });
				i++;
			}
		}
	}
	return sequences;
}

//Return tile array without given tiles
function removeTilesFromTileArray(inputTiles, tiles) {
	var tileArray = [...inputTiles];

	for (let tile of tiles) {
		// Preserve the requested physical variant when a red and normal five coexist.
		var index = tileArray.findIndex(candidate => isSameTile(tile, candidate, true));
		if (index < 0) index = tileArray.findIndex(candidate => isSameTile(tile, candidate));
		if (index >= 0) tileArray.splice(index, 1);
	}

	return tileArray;
}

//Sort tiles
function sortTiles(inputTiles) {
	var tiles = [...inputTiles];
	return tiles.sort(function (p1, p2) {
		if (p1.type !== p2.type) return p1.type - p2.type;   // type ascending
		if (p1.index !== p2.index) return p1.index - p2.index; // index ascending
		return p2.doraValue - p1.doraValue;                     // doraValue descending
	});
}

//Return number of specific tiles available
function getNumberOfTilesAvailable(index, type) {
	if (index < 1 || index > 9 || type < 0 || type > 3 || (type == 3 && index > 7)) {
		return 0;
	}
	if (getNumberOfPlayers() == 3 && (index > 1 && index < 9 && type == 1)) {
		return 0;
	}

	return Math.max(0, 4 - visibleTiles.filter(tile => tile.index == index && tile.type == type).length);
}

//Return if a tile is furiten
function isTileFuriten(index, type) {
	for (var i = 1; i < getNumberOfPlayers(); i++) { //Check if melds from other player contain discarded tiles of player 0
		if (calls[i].some(tile => tile.index == index && tile.type == type && tile.from == localPosition2Seat(0))) {
			return true;
		}
	}
	return discards[0].some(tile => tile.index == index && tile.type == type);
}

//Return number of specific non furiten tiles available
function getNumberOfNonFuritenTilesAvailable(index, type) {
	if (isTileFuriten(index, type)) {
		return 0;
	}
	return getNumberOfTilesAvailable(index, type);
}

//Return number of specific tile in tile array
function getNumberOfTilesInTileArray(tileArray, index, type) {
	return getTilesInTileArray(tileArray, index, type).length;
}

//Return specific tiles in tile array
function getTilesInTileArray(tileArray, index, type) {
	return tileArray.filter(tile => tile.index == index && tile.type == type);
}

//Update the available tile pool
function updateAvailableTiles() {
	visibleTiles = dora.concat(ownHand, discards[0], discards[1], discards[2], discards[3], calls[0], calls[1], calls[2], calls[3]);
	visibleTiles = visibleTiles.filter(tile => typeof tile != 'undefined');
	// Extracted norths are public tiles too; they cannot remain in the unseen pool.
	if (getNumberOfPlayers() == 3) {
		for (var player = 0; player < 3; player++) {
			for (var kita = 0; kita < getNumberOfKitaOfPlayer(player); kita++) {
				visibleTiles.push({ index: 4, type: 3, dora: false });
			}
		}
	}

	// Precompute which types already have a red five visible (avoids concat in inner loop)
	var redFiveVisible = [false, false, false]; // indexed by type 0-2
	for (let tile of visibleTiles) {
		if (tile.dora && tile.index == 5 && tile.type < 3) {
			redFiveVisible[tile.type] = true;
		}
	}
	var redFiveAdded = [false, false, false]; // tracks whether we have already assigned the red five for each type

	availableTiles = [];
	for (var i = 0; i <= 3; i++) {
		for (var j = 1; j <= 9; j++) {
			if (i == 3 && j == 8) {
				break;
			}
			for (var k = 1; k <= getNumberOfTilesAvailable(j, i); k++) {
				var isRed = false;
				if (j == 5 && i < 3 && !redFiveVisible[i] && !redFiveAdded[i]) {
					isRed = true;
					redFiveAdded[i] = true;
				}
				availableTiles.push({
					index: j,
					type: i,
					dora: isRed,
					doraValue: getTileDoraValue({ index: j, type: i, dora: isRed })
				});
			}
		}
	}
	for (let vis of visibleTiles) {
		vis.doraValue = getTileDoraValue(vis);
	}
	invalidateDefenseRuntimeCache();
}

//Return sum of red dora/dora indicators for tile
function getTileDoraValue(tile) {
	var dr = 0;

	if (getNumberOfPlayers() == 3) {
		if (tile.type == 3 && tile.index == 4) { //North Tiles
			dr = 1;
		}
	}

	for (let d of dora) {
		if (d.type == tile.type && getHigherTileIndex(d) == tile.index) {
			dr++;
		}
	}

	if (tile.dora) {
		return dr + 1;
	}
	return dr;
}

//Helper function for dora indicators
function getHigherTileIndex(tile) {
	if (tile.type == 3) {
		if (tile.index == 4) {
			return 1;
		}
		return tile.index == 7 ? 5 : tile.index + 1;
	}
	if (getNumberOfPlayers() == 3 && tile.index == 1 && tile.type == 1) {
		return 9; // 3 player mode: 1 man indicator means 9 man is dora
	}
	return tile.index == 9 ? 1 : tile.index + 1;
}

//Returns true if DEBUG flag is set
function isDebug() {
	return typeof DEBUG != 'undefined';
}

//Adds calls of player 0 to the hand
function getHandWithCalls(inputHand) {
	return inputHand.concat(calls[0]);
}

//Adds a tile if not in array
function pushTileIfNotExists(tiles, index, type) {
	if (tiles.findIndex(t => t.index == index && t.type == type) === -1) {
		var tile = { index: index, type: type, dora: false };
		tile.doraValue = getTileDoraValue(tile);
		tiles.push(tile);
	}
}

//Returns true if player can call riichi
function canRiichi() {
	if (isDebug()) {
		return false;
	}
	var operations = getOperationList();
	for (let op of operations) {
		if (op.type == getOperations().liqi) {
			return true;
		}
	}
	return false;
}

function getUradoraChance() {
	if (getNumberOfPlayers() == 4) {
		return dora.length * 0.4;
	}
	else {
		return dora.length * 0.5;
	}
}

//Returns tiles that can form a triple in one turn for a given tile array
function getUsefulTilesForTriple(tileArray) {
	var tiles = [];
	for (let tile of tileArray) {
		var amount = getNumberOfTilesInTileArray(tileArray, tile.index, tile.type);
		if (tile.type == 3 && amount >= 2) {
			pushTileIfNotExists(tiles, tile.index, tile.type);
			continue;
		}

		if (amount >= 2) {
			pushTileIfNotExists(tiles, tile.index, tile.type);
		}

		var amountLower = getNumberOfTilesInTileArray(tileArray, tile.index - 1, tile.type);
		var amountLower2 = getNumberOfTilesInTileArray(tileArray, tile.index - 2, tile.type);
		var amountUpper = getNumberOfTilesInTileArray(tileArray, tile.index + 1, tile.type);
		var amountUpper2 = getNumberOfTilesInTileArray(tileArray, tile.index + 2, tile.type);
		if (tile.index > 1 && (amount == amountLower + 1 && (amountUpper > 0 || amountLower2 > 0))) { //No need to check if index in bounds
			pushTileIfNotExists(tiles, tile.index - 1, tile.type);
		}

		if (tile.index < 9 && (amount == amountUpper + 1 && (amountLower > 0 || amountUpper2 > 0))) {
			pushTileIfNotExists(tiles, tile.index + 1, tile.type);
		}
	}
	return tiles;
}

//Returns tiles that can form at least a double in one turn for a given tile array
function getUsefulTilesForDouble(tileArray) {
	var tiles = [];
	for (let tile of tileArray) {
		pushTileIfNotExists(tiles, tile.index, tile.type);
		if (tile.type == 3) {
			continue;
		}

		if (tile.index - 1 >= 1) {
			pushTileIfNotExists(tiles, tile.index - 1, tile.type);
		}
		if (tile.index + 1 <= 9) {
			pushTileIfNotExists(tiles, tile.index + 1, tile.type);
		}

		if (PERFORMANCE_MODE - timeSave <= 2) {
			continue;
		}
		if (tile.index - 2 >= 1) {
			pushTileIfNotExists(tiles, tile.index - 2, tile.type);
		}
		if (tile.index + 2 <= 9) {
			pushTileIfNotExists(tiles, tile.index + 2, tile.type);
		}
	}
	return tiles;
}

// Returns Tile[], where all are terminal/honors.
function getAllTerminalHonorFromHand(hand) {
	return hand.filter(tile => isTerminalOrHonor(tile));
}

//Honor tile or index 1/9
function isTerminalOrHonor(tile) {
	// Honor tiles
	if (tile.type == 3) {
		return true;
	}

	// 1 or 9.
	if (tile.index == 1 || tile.index == 9) {
		return true;
	}

	return false;
}

// Returns a number how "good" the wait is. An average wait is 1, a bad wait (like a middle tile) is lower, a good wait (like an honor tile) is higher.
function getWaitQuality(tile) {
	var quality = 1.3 - (getDealInChanceForTileAndPlayer(0, tile, 1) * 5);
	quality = quality < 0.7 ? 0.7 : quality;
	return quality;
}

//Calculate the shanten number. Based on this: https://www.youtube.com/watch?v=69Xhu-OzwHM
//Fast and accurate, but original hand needs to have 14 or more tiles.
function calculateShanten(triples, pairs, doubles) {
	if (isWinningHand(triples, pairs)) {
		return -1;
	}
	if ((triples * 3) + (pairs * 2) + (doubles * 2) > 14) {
		doubles = parseInt((13 - ((triples * 3) + (pairs * 2))) / 2);
	}
	var shanten = 8 - (2 * triples) - (pairs + doubles);
	if (triples + pairs + doubles >= 5 && pairs == 0) {
		shanten++;
	}
	if (triples + pairs + doubles >= 6) {
		shanten += triples + pairs + doubles - 5;
	}
	if (shanten < 0) {
		return 0;
	}
	return shanten;
}

// Ron payments before honba/sticks. Sanma has the same ron payments as yonma.
function calculateRonScore(player, han, fu = 30) {
	if (han < 1) return 0;
	var base = han >= 13 ? 8000 : han >= 11 ? 6000 : han >= 8 ? 4000 :
		han >= 6 ? 3000 : han >= 5 ? 2000 : Math.min(2000, fu * Math.pow(2, 2 + han));
	return Math.ceil(base * (getSeatWind(player) == 1 ? 6 : 4) / 100) * 100;
}

// Expected han can be fractional. Interpolate adjacent legal ron payments so
// integer estimates respect rounding and every limit tier (including mangan).
function calculateScore(player, han, fu = 30) {
	var lower = Math.floor(han);
	var fraction = han - lower;
	return calculateRonScore(player, lower, fu) * (1 - fraction) +
		calculateRonScore(player, lower + 1, fu) * fraction;
}

// Dora can increase a legal hand's value, but cannot supply its first yaku.
function calculateScoreWithYaku(player, yaku, dora, fu = 30) {
	return yaku >= 1 ? calculateScore(player, yaku + dora, fu) : 0;
}

// Score the supplied decomposition without regrouping tiles across melds.
// waitTiles is retained for existing callers; possible winning groups determine
// the wait, including ambiguous interpretations of the same winning tile.
function calculateFu(triples, openTiles, pair, waitTiles, winningTile, ron = true) {
	var groups = getMelds(triples, false);
	var openGroups = getMelds(openTiles);
	if (groups.length == 0 && openGroups.length == 0 && pair.length == 14) return 25;
	var triplets = groups.filter(meld => isSameTile(meld[0], meld[1]));
	var winningGroups = groups.filter(meld => meld.some(tile => isSameTile(tile, winningTile)));
	if (isSameTile(pair[0], winningTile)) winningGroups.push(pair);

	function isRyanmen(meld) {
		if (meld.length != 3 || isSameTile(meld[0], meld[1])) return false;
		var sorted = meld.slice().sort((a, b) => a.index - b.index);
		return (isSameTile(sorted[0], winningTile) && sorted[2].index < 9) ||
			(isSameTile(sorted[2], winningTile) && sorted[0].index > 1);
	}

	var pairFu = pair[0] && isValueTile(pair[0]) ? 2 : 0;
	if (pairFu && pair[0].index == seatWind && seatWind == roundWind) pairFu += 2;
	if (isClosed && groups.length == 4 && openGroups.length == 0 &&
		triplets.length == 0 && pairFu == 0 && winningGroups.some(isRyanmen)) {
		return ron ? 30 : 20; //Pinfu is worth more than an alternative two-fu wait.
	}

	var fixedFu = openGroups.reduce((total, meld) => {
		if (!isSameTile(meld[0], meld[1])) return total;
		return total + 2 * (isTerminalOrHonor(meld[0]) ? 2 : 1) *
			(meld.length == 4 ? 4 : 1) * (isConcealedKan(meld) ? 2 : 1);
	}, 0);

	if (winningGroups.length == 0) winningGroups.push(null);
	return Math.max(...winningGroups.map(winningGroup => {
		var fu = 20 + pairFu + fixedFu;
		for (let meld of triplets) {
			fu += 2 * (isTerminalOrHonor(meld[0]) ? 2 : 1) * (ron && meld === winningGroup ? 1 : 2);
		}
		if (winningGroup && (winningGroup.length == 2 ||
			(!isSameTile(winningGroup[0], winningGroup[1]) && !isRyanmen(winningGroup)))) fu += 2;
		if (!ron) fu += 2;
		if (ron && isClosed) fu += 10;
		return Math.max(30, Math.ceil(fu / 10) * 10);
	}));
}

//Is the tile a dragon or valuable wind?
function isValueTile(tile) {
	return tile.type == 3 && (tile.index > 4 || tile.index == seatWind || tile.index == roundWind);
}

//Return a danger value which is the threshold for folding (danger higher than this value -> fold)
function getFoldThreshold(tilePrio, hand) {
	var handScore = tilePrio.score.open * 1.3; // Raise this value a bit so open hands dont get folded too quickly
	if (isClosed) {
		handScore = tilePrio.score.riichi;
	}

	var waits = tilePrio.waits;
	var shape = tilePrio.shape;

	// Formulas are based on this table: https://docs.google.com/spreadsheets/d/172LFySNLUtboZUiDguf8I3QpmFT-TApUfjOs5iRy3os/edit#gid=212618921
	// TODO: Maybe switch to this: https://riichi-mahjong.com/2020/01/28/mahjong-strategy-push-or-fold-4-maximizing-game-ev/
	if (tilePrio.shanten == 0) {
		var foldValue = (waits + shape) * handScore / 38;
		if (tilesLeft < 8) { //Try to avoid no ten penalty
			foldValue += 200 - (parseInt(tilesLeft / 4) * 100);
		}
	}
	else if (tilePrio.shanten == 1 && strategy == STRATEGIES.GENERAL) {
		shape = shape < 0.4 ? shape = 0.4 : shape;
		shape = shape > 2 ? shape = 2 : shape;
		var foldValue = shape * handScore / 45;
	}
	else {
		if (getCurrentDangerLevel() > 3000 && strategy == STRATEGIES.GENERAL) {
			return 0.5; // Small threshold: still allows discarding tiles with negligible danger
		}
		var foldValue = (((6 - (tilePrio.shanten - tilePrio.efficiency)) * 2000) + handScore) / 500;
	}

	if (isLastGame()) { //Fold earlier when first/later when last in last game
		if (getDistanceToLast() > 0) {
			foldValue *= 1.3; //Last Place -> Later Fold
		}
		else if (getDistanceToFirst() < 0) {
			var dist = (getDistanceToFirst() / 30000) > -0.5 ? getDistanceToFirst() / 30000 : -0.5;
			foldValue *= 1 + dist; //First Place -> Easier Fold
		}
	}

	foldValue *= 1 - (((getWallSize() / 2) - tilesLeft) / (getWallSize() * 2)); // up to 25% more/less fold when early/lategame.

	foldValue *= seatWind == 1 ? 1.2 : 1; //Push more as dealer (it's already in the handScore, but because of Tsumo Malus pushing is even better)

	var safeTiles = 0;
	for (let tile of hand) { // How many safe tiles do we currently have?
		if (getTileDanger(tile) < 20) {
			safeTiles++;
		}
		if (safeTiles == 2) {
			break;
		}
	}
	foldValue *= 1 + (0.5 - (safeTiles / 4)); // 25% less likely to fold when only 1 safetile, or 50% when 0 safetiles

	foldValue *= 2 - (hand.length / 14); // Less likely to fold when fewer tiles in hand (harder to defend)

	foldValue /= SAFETY;

	foldValue = foldValue < 0 ? 0 : foldValue;

	return Number(foldValue).toFixed(2);
}

//Return true if danger is too high in relation to the value of the hand
function shouldFold(tile, highestPrio = false) {
	if (tile.shanten * 4 > tilesLeft) {
		if (highestPrio) {
			log("Hand is too far from tenpai before end of game. Fold!");
			strategy = STRATEGIES.FOLD;
			strategyAllowsCalls = false;
		}
		return true;
	}

	var foldThreshold = getFoldThreshold(tile, ownHand);
	if (highestPrio) {
		log("Would fold this hand above " + foldThreshold + " danger for " + getTileName(tile.tile) + " discard.");
	}

	if (tile.danger > foldThreshold) {
		if (highestPrio) {
			log("Tile Danger " + Number(tile.danger).toFixed(2) + " of " + getTileName(tile.tile, false) + " is too dangerous.");
			strategyAllowsCalls = false; //Don't set the strategy to full fold, but prevent calls
		}
		return true;
	}
	return false;
}

//Decide whether to call Riichi
//Based on: https://mahjong.guide/2018/01/28/mahjong-fundamentals-5-riichi/
function shouldRiichi(tilePrio) {
	var badWait = tilePrio.waits < 5 - RIICHI;
	var lotsOfDoraIndicators = dora.length >= 3;

	//Chiitoitsu
	if (strategy == STRATEGIES.CHIITOITSU) {
		if (tilePrio.shape == 0) {
			log("Decline Riichi because of chiitoitsu wait that can be improved!");
			return false;
		}
		badWait = tilePrio.waits < 3 - RIICHI;
	}

	//Thirteen Orphans
	if (strategy == STRATEGIES.THIRTEEN_ORPHANS) {
		log("Decline Riichi because of Thirteen Orphan strategy.");
		return false;
	}

	//Close to end of game
	if (tilesLeft <= 7 - RIICHI) {
		log("Decline Riichi because close to end of game.");
		return false;
	}

	//No waits
	if (tilePrio.waits < 1) {
		log("Decline Riichi because of no waits.");
		return false;
	}

	// Last Place (in last game) and Riichi is enough to get third
	if (isLastGame() && getDistanceToLast() > 0 && getDistanceToLast() < tilePrio.score.riichi) {
		log("Accept Riichi because of last place in last game.");
		return true;
	}

	// Decline if last game and first place (either with 10000 points advantage or with a closed yaku)
	if (isLastGame() && (getDistanceToFirst() < -10000 || (tilePrio.yaku.closed >= 1 && getDistanceToFirst() < 0))) {
		log("Decline Riichi because of huge lead in last game.");
		return false;
	}

	// Not Dealer & bad Wait & Riichi is only yaku
	if (seatWind != 1 && badWait && tilePrio.score.riichi < 4000 - (RIICHI * 1000) && !lotsOfDoraIndicators && tilePrio.shape > 0.4) {
		log("Decline Riichi because of worthless hand, bad waits and not dealer.");
		return false;
	}

	// High Danger and hand not worth much or bad wait
	if (tilePrio.score.riichi < (getCurrentDangerLevel() - (RIICHI * 1000)) * (1 + badWait)) {
		log("Decline Riichi because of worthless hand and high danger.");
		return false;
	}

	// Hand already has enough yaku and high value (Around 6000+ depending on the wait)
	if (tilePrio.yaku.closed >= 1 && tilePrio.score.closed / (seatWind == 1 ? 1.5 : 1) > 4000 + (RIICHI * 1000) + (tilePrio.waits * 500)) {
		log("Decline Riichi because of high value hand with enough yaku.");
		return false;
	}

	// Hand already has high value and no yaku
	if (tilePrio.yaku.closed < 0.9 && tilePrio.score.riichi > 5000 - (RIICHI * 1000)) {
		log("Accept Riichi because of high value hand without yaku.");
		return true;
	}

	// Number of Kans(Dora Indicators) -> more are higher chance for uradora
	if (lotsOfDoraIndicators) {
		log("Accept Riichi because of multiple dora indicators.");
		return true;
	}

	// Don't Riichi when: Last round with bad waits & would lose place with -1000
	if (isLastGame() && badWait && ((getDistanceToPlayer(1) >= -1000 && getDistanceToPlayer(1) <= 0) ||
		(getDistanceToPlayer(2) >= -1000 && getDistanceToPlayer(2) <= 0) ||
		(getNumberOfPlayers() > 3 && getDistanceToPlayer(3) >= -1000 && getDistanceToPlayer(3) <= 0))) {
		log("Decline Riichi because distance to next player is < 1000 in last game.");
		return false;
	}

	// Default: Just do it.
	log("Accept Riichi by default.");
	return true;
}

//Negative number: Distance to second
//Positive number: Distance to first
function getDistanceToFirst() {
	if (getNumberOfPlayers() == 3) {
		return Math.max(getPlayerScore(1), getPlayerScore(2)) - getPlayerScore(0);
	}
	return Math.max(getPlayerScore(1), getPlayerScore(2), getPlayerScore(3)) - getPlayerScore(0);
}

//Negative number: Distance to last
//Positive number: Distance to third
function getDistanceToLast() {
	if (getNumberOfPlayers() == 3) {
		return Math.min(getPlayerScore(1), getPlayerScore(2)) - getPlayerScore(0);
	}
	return Math.min(getPlayerScore(1), getPlayerScore(2), getPlayerScore(3)) - getPlayerScore(0);
}

//Positive: Other player is in front of you
function getDistanceToPlayer(player) {
	if (getNumberOfPlayers() == 3 && player == 3) {
		return 0;
	}
	return getPlayerScore(player) - getPlayerScore(0);
}

//Check if "All Last"
function isLastGame() {
	if (isEastRound()) {
		return getRound() == getNumberOfPlayers() || getRoundWind() > 1; //East 4(3) or South X
	}
	return (getRound() == getNumberOfPlayers() && getRoundWind() == 2) || getRoundWind() > 2; //South 4(3) or West X
}

//Check if Hand is complete
function isWinningHand(numberOfTriples, numberOfPairs) {
	if (strategy == STRATEGIES.CHIITOITSU) {
		return numberOfPairs == 7;
	}
	return numberOfTriples == 4 && numberOfPairs == 1;
}

//Return the number of tiles in the wall at the start of the round
function getWallSize() {
	if (getNumberOfPlayers() == 3) {
		return 55;
	}
	else {
		return 70;
	}
}

function getCallNameByType(type) {
	switch (type) {
		case 1: return "discard";
		case 2: return "chi";
		case 3: return "pon";
		case 4: return "kan(ankan)";
		case 5: return "kan(daiminkan)";
		case 6: return "kan(shouminkan)";
		case 7: return "riichi";
		case 8: return "tsumo";
		case 9: return "ron";
		case 10: return "kyuushu kyuuhai";
		case 11: return "kita";
		default: return type;
	}
}

function getTileEmoji(tileType, tileIdx, dora) {
	if (dora) {
		tileIdx = 0;
	}
	return tileEmojiList[tileType][tileIdx];
}

//Get Emoji str by tile name
function getTileEmojiByName(name) {
	let tile = getTileFromString(name);
	return getTileEmoji(tile.type, tile.index, tile.dora);
}


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


//################################
// LOGGING
// Contains logging functions
//################################

//Print string to HTML or console
function log(t) {
	if (isDebug()) {
		document.body.innerHTML += t + "<br>";
	}
	else {
		console.log(t);
	}
}

//Print all tiles in hand
function printHand(hand) {
	var handString = getStringForTiles(hand);
	log("Hand:" + handString);
}

//Get String for array of tiles
function getStringForTiles(tiles) {
	var tilesString = "";
	var oldType = "";
	tiles.forEach(function (tile) {
		if (getNameForType(tile.type) != oldType) {
			tilesString += oldType;
			oldType = getNameForType(tile.type);
		}
		if (tile.dora == 1) {
			tilesString += "0";
		}
		else {
			tilesString += tile.index;
		}
	});
	tilesString += oldType;
	return tilesString;
}

//Print tile name
function printTile(tile) {
	log(getTileName(tile, false));
}

//Print given tile priorities
function printTilePriority(tiles) {
	log("Overall: Value Open: <" + Number(tiles[0].score.open).toFixed(0) +
		"> Closed Value: <" + Number(tiles[0].score.closed).toFixed(0) +
		"> Riichi Value: <" + Number(tiles[0].score.riichi).toFixed(0) +
		"> Shanten: <" + Number(tiles[0].shanten).toFixed(0) + ">");
	for (var i = 0; i < tiles.length && i < LOG_AMOUNT; i++) {
		log(getTileName(tiles[i].tile, false) +
			": Priority: <" + Number(tiles[i].priority).toFixed(3) +
			"> Efficiency: <" + Number(tiles[i].efficiency).toFixed(3) +
			"> Yaku Open: <" + Number(tiles[i].yaku.open).toFixed(3) +
			"> Yaku Closed: <" + Number(tiles[i].yaku.closed).toFixed(3) +
			"> Dora: <" + Number(tiles[i].dora).toFixed(3) +
			"> Waits: <" + Number(tiles[i].waits).toFixed(3) +
			"> Ukeire: <" + tiles[i].ukeire +
			"> Next draw estimate: <" + Number(tiles[i].improvementChance * 100).toFixed(1) + "%" +
			"> Danger: <" + Number(tiles[i].danger).toFixed(2) + ">");
	}
}

//Input string to get an array of tiles (e.g. "123m456p789s1z")
function getTilesFromString(inputString) {
	var numbers = [];
	var tiles = [];
	for (let input of inputString) {
		var type = 4;
		switch (input) {
			case "p":
				type = 0;
				break;
			case "m":
				type = 1;
				break;
			case "s":
				type = 2;
				break;
			case "z":
				type = 3;
				break;
			default:
				numbers.push(input);
				break;
		}
		if (type != 4) {
			for (let number of numbers) {
				if (parseInt(number) == 0) {
					tiles.push({ index: 5, type: type, dora: true, doraValue: 1, valid: true });
				}
				else {
					tiles.push({ index: parseInt(number), type: type, dora: false, doraValue: 0, valid: true });
				}
			}
			numbers = [];
		}
	}
	return tiles;
}

//Input string to get a tiles (e.g. "1m")
function getTileFromString(inputString) {
	var type = 4;
	var dr = false;
	switch (inputString[1]) {
		case "p":
			type = 0;
			break;
		case "m":
			type = 1;
			break;
		case "s":
			type = 2;
			break;
		case "z":
			type = 3;
			break;
	}
	var index = inputString[0];
	if (inputString[0] == "0") {
		index = "5";
		dr = true;
	}
	if (type != 4) {
		var tile = { index: parseInt(index), type: type, dora: dr, valid: true };
		tile.doraValue = getTileDoraValue(tile);
		return tile;
	}
	return null;
}

//Returns the name for a tile
function getTileName(tile, useRaw = true) {
	let name = "";
	if (tile.dora == true) {
		name = "0" + getNameForType(tile.type);
	} else {
		name = tile.index + getNameForType(tile.type);
	}

	if (!useRaw && USE_EMOJI) {
		return `${getTileEmoji(tile.type, tile.index, tile.dora)}: ${name}`;
	} else {
		return name;
	}
}

//Returns the corresponding char for a type
function getNameForType(type) {
	switch (type) {
		case 0:
			return "p";
		case 1:
			return "m";
		case 2:
			return "s";
		case 3:
			return "z";
		default:
			return "?";
	}
}

//returns a string for the current state of the game
function getDebugString() {
	var debugString = "";
	debugString += getStringForTiles(dora) + "|";
	debugString += getStringForTiles(ownHand) + "|";
	debugString += getStringForTiles(calls[0]) + "|";
	debugString += getStringForTiles(calls[1]) + "|";
	debugString += getStringForTiles(calls[2]) + "|";
	if (getNumberOfPlayers() == 4) {
		debugString += getStringForTiles(calls[3]) + "|";
	}
	debugString += getStringForTiles(discards[0]) + "|";
	debugString += getStringForTiles(discards[1]) + "|";
	debugString += getStringForTiles(discards[2]) + "|";
	if (getNumberOfPlayers() == 4) {
		debugString += getStringForTiles(discards[3]) + "|";
	}
	if (getNumberOfPlayers() == 4) {
		debugString += (isPlayerRiichi(0) * 1) + "," + (isPlayerRiichi(1) * 1) + "," + (isPlayerRiichi(2) * 1) + "," + (isPlayerRiichi(3) * 1) + "|";
	}
	else {
		debugString += (isPlayerRiichi(0) * 1) + "," + (isPlayerRiichi(1) * 1) + "," + (isPlayerRiichi(2) * 1) + "|";
	}
	debugString += seatWind + "|";
	debugString += roundWind + "|";
	debugString += tilesLeft;
	return debugString;
}


//################################
// YAKU
// Contains the yaku calculations
//################################

//Returns the closed and open yaku value of the hand
function getYaku(inputHand, inputCalls = [], triplesAndPairs = null) {
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
		var sanankou = getSanankou(concealedTriplets.concat(concealedKans).flat());
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
function getSanankou(hand) {
	if (!isConsideringCall) {
		var concealedTriples = getTripletsAsArray(hand);
		if (parseInt(concealedTriples.length / 3) >= 3) {
			return { open: 2, closed: 2 };
		}
	}

	return { open: 0, closed: 0 };
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


//################################
// AI OFFENSE
// Offensive part of the AI
//################################

//Look at Hand etc. and decide for a strategy.
function determineStrategy() {

	if (strategy != STRATEGIES.FOLD) {
		var handTriples = parseInt(getTriples(getHandWithCalls(ownHand)).length / 3);
		var pairs = getPairsAsArray(ownHand).length / 2;

		if ((pairs == 6 || (pairs >= CHIITOITSU && handTriples < 2)) && calls[0].length == 0) {
			strategy = STRATEGIES.CHIITOITSU;
			strategyAllowsCalls = false;
		}
		else if (canDoThirteenOrphans()) {
			strategy = STRATEGIES.THIRTEEN_ORPHANS;
			strategyAllowsCalls = false;
		}
		else {
			if (strategy == STRATEGIES.THIRTEEN_ORPHANS ||
				strategy == STRATEGIES.CHIITOITSU) {
				strategyAllowsCalls = true; //Don't reset this value when bot is playing defensively without a full fold
			}
			strategy = STRATEGIES.GENERAL;
		}
	}
	log("Strategy: " + strategy);
}

//Call a Chi/Pon
//combination example: Array ["6s|7s", "7s|9s"]
async function callTriple(combinations, operation) {
	if (!Array.isArray(combinations) || combinations.length == 0) {
		declineCall(operation);
		return false;
	}

	log("Consider call on " + getTileName(getTileForCall()));

	var handValue = getHandValues(ownHand);
	if (isClosed) handValue.score.closed = Math.max(handValue.score.closed, calculateRonScore(0, 1) / 2);

	if (!strategyAllowsCalls && (tilesLeft > 4 || handValue.shanten > 1)) { //No Calls allowed
		log("Strategy allows no calls! Declined!");
		declineCall(operation);
		return false;
	}

	//Find best Combination
	var comb = -1;
	var bestCombShanten = 9;
	var bestDora = 0;

	for (var i = 0; i < combinations.length; i++) {
		var callTiles = combinations[i].split("|");
		callTiles = callTiles.map(t => getTileFromString(t));

		var newHand = removeTilesFromTileArray(ownHand, callTiles);
		var shanten = getStandardShanten(newHand, calls[0].concat(callTiles, getTileForCall()));

		if (shanten < bestCombShanten || (shanten == bestCombShanten && getNumberOfDoras(callTiles) > bestDora)) {
			comb = i;
			bestDora = getNumberOfDoras(callTiles);
			bestCombShanten = shanten;
		}
	}

	log("Best Combination: " + combinations[comb]);

	var callTiles = combinations[comb].split("|");
	callTiles = callTiles.map(t => getTileFromString(t));

	var tilePrios;
	var nextDiscard;
	var newHandValue;
	var newHand;
	var newHandTriples;
	var wouldFold = false;
	await withSimulatedCallState(callTiles, async function () {
		// Evaluate the future discard without changing the live hand's permissions.
		newHand = removeTilesFromTileArray(ownHand, callTiles).map(tile => ({ ...tile, valid: true }));
		tilePrios = await getTilePriorities(newHand);
		if (tilePrios.length == 0 || (!isDebug() && !isDecisionCurrent())) return;
		tilePrios = sortOutUnsafeTiles(tilePrios);
		nextDiscard = getDiscardTile(tilePrios); //Calculate next discard
		newHand = removeTilesFromTileArray(newHand, [nextDiscard]); //Remove discard from hand
		newHandValue = getHandValues(newHand, nextDiscard); //Get Value of that hand
		newHandTriples = getTriplesAndPairs(newHand); //Get Triples, to see if discard would make the hand worse
		wouldFold = strategy == STRATEGIES.FOLD;
	});
	if (!newHandValue || (!isDebug() && !isDecisionCurrent())) return false;

	var newHonorPairs = newHandTriples.pairs.filter(t => t.type == 3).length / 2;
	var newPairs = newHandTriples.pairs.length / 2;

	if (isSameTile(nextDiscard, getTileForCall()) ||
		(callTiles[0].index == getTileForCall().index - 2 && isSameTile(nextDiscard, { index: callTiles[0].index - 1, type: callTiles[0].type })) ||
		(callTiles[1].index == getTileForCall().index + 2 && isSameTile(nextDiscard, { index: callTiles[1].index + 1, type: callTiles[1].type }))) {
		declineCall(operation);
		log("Next discard would be the same tile. Call declined!");
		return false;
	}

	if (wouldFold || strategy == STRATEGIES.FOLD || !tilePrios.some(t => t.safe)) {
		log("Would fold next discard! Declined!");
		declineCall(operation);
		return false;
	}

	if (tilesLeft <= 4 && handValue.shanten == 1 && newHandValue.shanten == 0) { //Call to get tenpai at end of game
		log("Accept call to be tenpai at end of game!");
		makeCallWithOption(operation, comb);
		return true;
	}
	if (newHandValue.shanten == 0 && newHandValue.waits == 0) {
		log("Call would leave no live winning wait with a yaku. Declined!");
		declineCall(operation);
		return false;
	}

	if (newHandValue.yaku.open < 0.15 && //Yaku chance is too bad
		newHandTriples.pairs.filter(t => isValueTile(t) && getNumberOfTilesAvailable(t.index, t.type) >= 2).length < 2) { //And no value honor pair
		log("Not enough Yaku! Declined! " + newHandValue.yaku.open + " < 0.15");
		declineCall(operation);
		return false;
	}

	if (handValue.waits > 0 && newHandValue.waits < handValue.waits + 1) { //Call results in worse waits 
		log("Call would result in less waits! Declined!");
		declineCall(operation);
		return false;
	}

	if (isClosed && newHandValue.score.open < 1500 - (CALL_PON_CHI * 200) && newHandValue.shanten >= 2 + CALL_PON_CHI && seatWind != 1 &&// Hand is worthless and slow and not dealer. Should prevent cheap yakuhai or tanyao calls
		!(newHonorPairs >= 1 && newPairs >= 2)) {
		log("Hand is cheap and slow! Declined!");
		declineCall(operation);
		return false;
	}

	if (seatWind == 1) { //Remove dealer bonus for the following checks
		handValue.score.closed /= 1.5;
		handValue.score.open /= 1.5;
		newHandValue.score.open /= 1.5;
	}

	if (newHandValue.shanten > handValue.shanten) { //Call would make shanten worse
		log("Call would increase shanten! Declined!");
		declineCall(operation);
		return false;
	}
	else if (newHandValue.shanten == handValue.shanten) { //When it does not improve shanten
		if (!isClosed && newHandValue.priority > handValue.priority * 1.5) { //When the call improves the hand
			log("Call accepted because hand is already open and it improves the hand!");
		}
		else {
			declineCall(operation);
			log("Call declined because it does not benefit the hand!");
			return false;
		}
	}
	else { //When it improves shanten
		var isBadWait = (callTiles[0].index == callTiles[1].index || Math.abs(callTiles[0].index - callTiles[1].index) == 2 || // Pon or Kanchan
			callTiles[0].index >= 8 && callTiles[1].index >= 8 || callTiles[0].index <= 2 && callTiles[1].index <= 2); //Penchan

		if (handValue.shanten >= 5 - CALL_PON_CHI && seatWind == 1) { //Very slow hand & dealer? -> Go for a fast win
			log("Call accepted because of slow hand and dealer position!");
		}
		else if (!isClosed && newHandValue.score.open > handValue.score.open * 0.9) { //Hand is already open and it reduces shanten while not much value is lost 
			log("Call accepted because hand is already open!");
		}
		else if (newHandValue.score.open >= 4500 - (CALL_PON_CHI * 500) &&
			newHandValue.score.open > handValue.score.closed * 0.7) { //High value hand? -> Go for a fast win
			log("Call accepted because of high value hand!");
		}
		else if (newHandValue.score.open >= handValue.score.closed * 1.75 && //Call gives additional value to hand
			((newHandValue.score.open >= (2000 - (CALL_PON_CHI * 200) - ((3 - newHandValue.shanten) * 200))) || //And either hand is not extremely cheap...
				newHonorPairs >= 1)) { //Or there are some honor pairs in hand (=can be called easily or act as safe discards)
			log("Call accepted because it boosts the value of the hand!");
		}
		else if (newHandValue.score.open > handValue.score.open * 0.9 && //Call loses not much value
			newHandValue.score.open > handValue.score.closed * 0.7 &&
			((isBadWait && (newHandValue.score.open >= (1000 - (CALL_PON_CHI * 100) - ((3 - newHandValue.shanten) * 100)))) || // And it's a bad wait while the hand is not extremely cheap
				(!isBadWait && (newHandValue.score.open >= (2000 - (CALL_PON_CHI * 200) - ((3 - newHandValue.shanten) * 200)))) || //Or it was a good wait and the hand is at least a bit valuable
				newHonorPairs >= 2) && //Or multiple honor pairs
			((newHandTriples.pairs.filter(t => isValueTile(t) && getNumberOfTilesAvailable(t.index, t.type) >= 1)).length >= 2 && (newPairs >= 2 || newHandValue.shanten > 1))) {//And would open hand anyway with honor call
			log("Call accepted because it reduces shanten!");
		}
		else if (newHandValue.shanten == 0 && newHandValue.score.open > handValue.score.closed * 0.9 &&
			newHandValue.waits > 2 && isBadWait) {// Make hand ready and eliminate a bad wait
			log("Call accepted because it eliminates a bad wait and makes the hand ready!");
		}
		else if (newHandValue.shanten == 0 && newHandValue.yaku.open >= 1 && // Pon achieves confirmed yaku tenpai
			callTiles[0].index == callTiles[1].index) { // Explicit pon check: isBadWait also covers kanchan/penchan
			log("Call accepted because pon achieves yaku tenpai!");
		}
		else if ((0.5 - (tilesLeft / getWallSize())) +
			(0.25 - (newHandValue.shanten / 4)) +
			(newHandValue.shanten > 0 ? ((newPairs - newHandValue.shanten - 0.5) / 2) : 0) +
			((newHandValue.score.open / 3000) - 0.5) +
			(((newHandValue.score.open / handValue.score.closed) * 0.75) - 0.75) +
			((isBadWait / 2) - 0.25) >=
			1 - (CALL_PON_CHI / 2)) { //The call is good in multiple aspects
			log("Call accepted because it's good in multiple aspects");
		}
		else { //Decline
			declineCall(operation);
			log("Call declined because it does not benefit the hand!");
			return false;
		}
	}

	makeCallWithOption(operation, comb);
	return true;
}

//Call Tile for Kan
function callDaiminkan() {
	if (!isClosed) {
		callKan(getOperations().ming_gang, getTileForCall());
	}
	else { //Always decline with closed hand
		declineCall(getOperations().ming_gang);
	}
}

//Add from Hand to existing Pon
function callShouminkan() {
	callKan(getOperations().add_gang, getTileForCall());
}

//Closed Kan
function callAnkan(combination) {
	callKan(getOperations().an_gang, getTileFromString(combination[0]));
}

//Needs a semi good hand to call Kans and other players are not dangerous
function callKan(operation, tileForCall) {
	log("Consider Kan.");
	var tiles = getHandValues(ownHand);

	var newTiles = getHandValues(removeTilesFromTileArray(ownHand, [tileForCall])); //Melds are already included by getHandValues.

	if (isPlayerRiichi(0) ||
		(strategyAllowsCalls &&
			tiles.shanten <= (tilesLeft / (getWallSize() / 2)) + CALL_KAN &&
			getCurrentDangerLevel() < 1000 + (CALL_KAN * 500) &&
			tiles.shanten >= newTiles.shanten &&
			tiles.efficiency * 0.9 <= newTiles.efficiency)) {
		makeCall(operation);
		log("Kan accepted!");
	}
	else {
		if (operation == getOperations().ming_gang) { // Decline call for closed/added Kans is not working, just skip it and discard normally
			declineCall(operation);
		}
		log("Kan declined!");
	}
}

function callRon() {
	makeCall(getOperations().rong);
}

function callTsumo() {
	makeCall(getOperations().zimo);
}

function callKita() { // 3 player only
	if (strategy != STRATEGIES.THIRTEEN_ORPHANS && strategy != STRATEGIES.FOLD) {
		if (getNumberOfTilesInTileArray(ownHand, 4, 3) > 1) { //More than one north tile: Check if it's okay to call kita
			var handValue = getHandValues(ownHand);
			var newHandValue = getHandValues(removeTilesFromTileArray(ownHand, [{ index: 4, type: 3, dora: false }]));
			if (handValue.shanten <= 1 && newHandValue.shanten > handValue.shanten) {
				return false;
			}
		}
		sendKitaCall();
		return true;
	}
	return false;
}

function callAbortiveDraw() { // Kyuushu Kyuuhai, 9 Honors or Terminals in starting Hand
	if (canDoThirteenOrphans()) {
		return;
	}
	var handValue = getHandValues(ownHand);
	if (handValue.shanten >= 4) { //Hand is bad -> abort game
		sendAbortiveDrawCall();
	}
}

function callRiichi(tiles) {
	var operations = getOperationList();
	var combination = [];
	for (let op of operations) {
		if (op.type == getOperations().liqi) { //Get possible tiles for discard in riichi
			combination = op.combination;
		}
	}
	log(JSON.stringify(combination));
	// Pre-process: add the non-dora equivalent for any dora tile (0x -> 5x) so that
	// a non-dora 5-tile can also match. Done once here to avoid mutating combination
	// repeatedly inside the nested loop.
	var normalizedCombination = [];
	for (let comb of combination) {
		normalizedCombination.push(comb);
		if (comb.charAt(0) == "0") { //Fix for Dora Tiles
			normalizedCombination.push("5" + comb.charAt(1));
		}
	}
	for (let tile of tiles) {
		if (tile.tile.valid === false || tile.safe !== 1) continue;
		for (let comb of normalizedCombination) {
			if (getTileName(tile.tile) == comb) {
				if (shouldRiichi(tile)) {
					var moqie = false;
					if (getTileName(tile.tile) == getTileName(ownHand[ownHand.length - 1])) { //Is last tile?
						moqie = true;
					}
					log("Discard: " + getTileName(tile.tile, false));
					return sendRiichiCall(comb, moqie) !== false;
				}
				else {
					return false;
				}
			}
		}
	}
	log("Riichi declined because Combination not found!");
	return false;
}

//Discard the safest tile, but consider slightly riskier tiles with same shanten
function discardFold(tiles) {
	if (strategy != STRATEGIES.FOLD) { //Not in full Fold mode yet: Discard a relatively safe tile with high priority
		var minShanten = Math.min(...tiles.map(t => t.shanten));
		var minDanger = Math.min(...tiles.map(t => t.danger));
		for (let tile of tiles) {
			var foldThreshold = getFoldThreshold(tile, ownHand);
			if (tile.shanten == minShanten && //If next tile same shanten as the best tile
				tile.danger < minDanger * 1.1 && //And the tile is not much more dangerous than the safest tile
				tile.danger <= foldThreshold * 2) {
				log("Tile Priorities: ");
				printTilePriority(tiles);
				setHelpHintContext(tile);
				discardTile(tile.tile);
				return tile.tile;
			}
		}
		// No safe tile with good shanten found: Full Fold.
		log("Hand is very dangerous, full fold.");
		strategyAllowsCalls = false;
	}

	tiles.sort(function (p1, p2) {
		return p1.danger - p2.danger;
	});
	log("Fold Tile Priorities: ");
	printTilePriority(tiles);

	setHelpHintContext(tiles[0]);
	discardTile(tiles[0].tile);
	return tiles[0].tile;
}

//Remove the given Tile from Hand
function discardTile(tile) {
	if (!tile.valid) {
		return;
	}
	log("Discard: " + getTileName(tile, false));
	for (var i = ownHand.length - 1; i >= 0; i--) {
		if (isSameTile(ownHand[i], tile, true)) {
			if (!isDebug()) {
				callDiscard(i);
			}
			else {
				discards[0].push(ownHand[i]);
				ownHand.splice(i, 1);
			}
			break;
		}
	}
}

//Simulates discarding every tile and calculates hand value.
//Asynchronous to give the browser time to "breath"
async function getTilePriorities(inputHand) {

	if (isDebug()) {
		log("Dora: " + getTileName(dora[0], false));
		printHand(inputHand);
	}

	var tiles = [];
	if (strategy == STRATEGIES.CHIITOITSU) {
		tiles = chiitoitsuPriorities(inputHand);
	}
	else if (strategy == STRATEGIES.THIRTEEN_ORPHANS) {
		tiles = thirteenOrphansPriorities(inputHand);
	}
	else {
		for (var i = 0; i < inputHand.length; i++) { //Create 13 Tile hands
			if (!isDebug() && !isDecisionCurrent()) return [];
			if (inputHand[i].valid === false) continue;

			var hand = [...inputHand];
			hand.splice(i, 1);

			if (tiles.some(t => isSameTile(t.tile, inputHand[i], true))) { //Skip same tiles in hand
				continue;
			}

			tiles.push(getHandValues(hand, inputHand[i]));

			await new Promise(r => setTimeout(r, 10)); //Sleep a short amount of time to not completely block the browser
		}
	}
	if (!isDebug() && !isDecisionCurrent()) return [];

	tiles = tiles.filter(tile => tile.tile.valid !== false);
	tiles.sort(function (p1, p2) {
		return p2.priority - p1.priority;
	});
	return Promise.resolve(tiles);
}

/*
Calculates Values for all tiles in the hand.
As the Core of the AI this function is really complex. The simple explanation:
It simulates the next two turns, calculates all the important stuff (shanten, dora, yaku, waits etc.) and produces a priority for each tile based on the expected value/shanten in two turns.

In reality it would take far too much time to calculate all the possibilites (availableTiles * (availableTiles - 1) * 2 which can be up to 30000 possibilities).
Therefore most of the complexity comes from tricks to reduce the runtime:
At first all the tiles are computed that could improve the hand in the next two turns (which is usually less than 1000).
Duplicates (for example 3m -> 4m and 4m -> 3m) are marked and will only be computed once, but with twice the value.
The rest is some math to produce the same result which would result in actually simulating everything (like adding the original value of the hand for all the useless combinations).
*/
function getHandValues(hand, discardedTile) {
	hand = [...hand]; //Never mutate caller-owned arrays while simulating hand branches.
	var shanten = 0; //Accumulate weighted changes from the current hand.
	var yakuCache = {};

	function getCachedYaku(currentHand, inputTriplesAndPairs) {
		var cacheKey = getTileCacheKey(currentHand) + "|" + getTileCacheKey(calls[0]) + "|" +
			inputTriplesAndPairs.triples.map(getTileIdentityKey).join(",") + "|" + getTileCacheKey(inputTriplesAndPairs.pairs);
		if (typeof yakuCache[cacheKey] == 'undefined') {
			yakuCache[cacheKey] = getYaku(currentHand, calls[0], inputTriplesAndPairs);
		}
		return { open: yakuCache[cacheKey].open, closed: yakuCache[cacheKey].closed };
	}

	var callTriples = getMeldCount();

	var triplesAndPairs = getTriplesAndPairs(hand);

	var triples = triplesAndPairs.triples;
	var pairs = triplesAndPairs.pairs;
	var drawAnalysis = getImprovingTileAnalysis(hand, discardedTile, STRATEGIES.GENERAL);
	var baseShanten = drawAnalysis.shanten;

	if (typeof discardedTile != 'undefined') { //When deciding whether to call for a tile there is no discarded tile in the evaluation
		hand.push(discardedTile); //Calculate original values
		var originalShanten = getStandardShanten(hand);
		hand.pop();
	}
	else {
		var originalShanten = baseShanten;
	}

	var expectedScore = { open: 0, closed: 0, riichi: 0 }; //For the expected score (only looking at hands that improve the current hand)
	var yaku = { open: 0, closed: 0 }; //Expected Yaku
	var doraValue = 0; //Expected Dora
	var waits = 0; //Waits when in Tenpai
	var shape = 0; //When 1 shanten: Contains a value that indicates how good the shape of the hand is
	var fu = 0;

	var kita = 0;
	if (getNumberOfPlayers() == 3) {
		kita = getNumberOfKitaOfPlayer(0) * getTileDoraValue({ index: 4, type: 3 });
	}

	var waitTiles = [];
	var tileCombinations = []; //List of combinations for second step to save calculation time

	// STEP 1: Create List of combinations of tiles that can improve the hand
	var newTiles1 = getUsefulTilesForDouble(hand); //For every tile: Find tiles that make them doubles or triples
	for (let newTile of newTiles1) {

		var numberOfTiles1 = getNumberOfTilesAvailable(newTile.index, newTile.type);
		if (numberOfTiles1 <= 0) { //Skip if tile is dead
			continue;
		}

		hand.push(newTile);
		var newTiles2 = getUsefulTilesForDouble(hand).filter(t => getNumberOfTilesAvailable(t.index, t.type) > 0);
		if (PERFORMANCE_MODE - timeSave <= 1) { //In Low Spec Mode: Ignore some combinations that are unlikely to improve the hand -> Less calculation time
			newTiles2 = getUsefulTilesForTriple(hand).filter(t => getNumberOfTilesAvailable(t.index, t.type) > 0);
			if (PERFORMANCE_MODE - timeSave <= 0) { //Ignore even more tiles for extremenly low spec...
				newTiles2 = newTiles2.filter(t => t.type == newTile.type);
			}
		}

		var newTiles2Objects = [];
		for (let t of newTiles2) {
			var dupl1 = tileCombinations.find(tc => isSameTile(tc.tile1, t)); //Check if combination is already in the array
			var skip = false;
			if (typeof dupl1 != 'undefined') {
				var duplicateCombination = dupl1.tiles2.find(t2 => isSameTile(t2.tile2, newTile));
				if (typeof duplicateCombination != 'undefined') { //If already exists: Set flag to count it twice and set flag to skip the current one
					duplicateCombination.duplicate = true;
					skip = true;
				}
			}
			newTiles2Objects.push({ tile2: t, winning: false, furiten: false, triplesAndPairs: null, duplicate: false, skip: skip });
		}

		tileCombinations.push({ tile1: newTile, tiles2: newTiles2Objects, winning: false, furiten: false, triplesAndPairs: null });
		hand.pop();
	}

	//STEP 2: Check if some of these tiles or combinations are winning or in furiten. We need to know this in advance for Step 3
	for (let tileCombination of tileCombinations) {
		//Simulate only the first tile drawn for now
		var tile1 = tileCombination.tile1;
		hand.push(tile1);

		var triplesAndPairs2 = getTriplesAndPairs(hand);

		var winning = isWinningHand(parseInt((triplesAndPairs2.triples.length / 3)) + callTriples, triplesAndPairs2.pairs.length / 2);
		if (winning) {
			waitTiles.push(tile1);
			//Mark this tile in other combinations as not duplicate and no skip
			for (let tc of tileCombinations) {
				tc.tiles2.forEach(function (t2) {
					if (isSameTile(tile1, t2.tile2)) {
						t2.duplicate = false;
						t2.skip = false;
					}
				});
			}
		}
		var furiten = (winning && (isTileFuriten(tile1.index, tile1.type) || isSameTile(discardedTile, tile1)));
		tileCombination.winning = winning;
		tileCombination.canWin = winning && (isClosed || getCachedYaku(hand, triplesAndPairs2).open >= 1);
		tileCombination.furiten = furiten;
		tileCombination.triplesAndPairs = triplesAndPairs2; //The triplesAndPairs function is really slow, so save this result for later

		hand.pop();
	}

	var tile1Furiten = drawAnalysis.furiten || tileCombinations.some(t => t.furiten);
	for (let tileCombination of tileCombinations) { //Now again go through all the first tiles, but also the second tiles
		hand.push(tileCombination.tile1);
		for (let tile2Data of tileCombination.tiles2) {
			if (tile2Data.skip || (tileCombination.canWin && !tile1Furiten)) { //Skip duplicate or already winning first draw.
				continue;
			}
			hand.push(tile2Data.tile2);

			var triplesAndPairs3 = getTriplesAndPairs(hand);

			var winning2 = isWinningHand(parseInt((triplesAndPairs3.triples.length / 3)) + callTriples, triplesAndPairs3.pairs.length / 2);
			var furiten2 = winning2 && (isTileFuriten(tile2Data.tile2.index, tile2Data.tile2.type) || isSameTile(discardedTile, tile2Data.tile2));
			tile2Data.winning = winning2;
			tile2Data.furiten = furiten2;
			tile2Data.triplesAndPairs = triplesAndPairs3;

			hand.pop();
		}
		hand.pop();
	}

	var numberOfTotalCombinations = 0;
	var numberOfTotalWaitCombinations = 0;

	//STEP 3: Check the values when these tiles are drawn.
	for (let tileCombination of tileCombinations) {
		var tile1 = tileCombination.tile1;
		var numberOfTiles1 = getNumberOfTilesAvailable(tile1.index, tile1.type);

		//Simulate only the first tile drawn for now
		hand.push(tile1);

		var triplesAndPairs2 = tileCombination.triplesAndPairs;
		var triples2 = triplesAndPairs2.triples;
		var pairs2 = triplesAndPairs2.pairs;

		if (!isClosed && (!tileCombination.winning) &&
			getNumberOfTilesInTileArray(triples2, tile1.index, tile1.type) == 3) {
			numberOfTiles1 *= 2; //More value to possible triples when hand is open (can call pons from all players)
		}

		var factor;
		var thisShanten = 8;
		if (tileCombination.canWin && !tile1Furiten) { //Hand can win: count the paths ending on the first draw.
			factor = numberOfTiles1 * (availableTiles.length - 1); //Number of ways to draw this tile first and then any of the other tiles
			//Number of ways to draw a random tile which we don't have in the array and then the winning tile. We only look at the "good tile -> winning tile" combination later.
			factor += (availableTiles.length - tileCombinations.reduce((pv, cv) => pv + getNumberOfTilesAvailable(cv.tile1.index, cv.tile1.type), 0)) * numberOfTiles1;
			thisShanten = (-1 - baseShanten);
		}
		else { // This tile is not winning
			// For all the tiles we don't consider as a second draw (because they're useless): The shanten value for this tile -> useless tile is just the value after the first draw
			factor = numberOfTiles1 * ((availableTiles.length - 1) - tileCombination.tiles2.reduce(function (pv, cv) { // availableTiles - useful tiles (which we will check later)
				if (isSameTile(tile1, cv.tile2)) {
					return pv + getNumberOfTilesAvailable(cv.tile2.index, cv.tile2.type) - 1;
				}
				return pv + getNumberOfTilesAvailable(cv.tile2.index, cv.tile2.type);
			}, 0));
			if (tile1Furiten || (tileCombination.winning && !tileCombination.canWin)) {
				thisShanten = 0 - baseShanten;
			}
			else {
				thisShanten = getStandardShanten(hand) - baseShanten;
			}
		}

		shanten += thisShanten * factor;

		if (tileCombination.winning) { //For winning tiles: Add waits, fu and the Riichi value
			var thisDora = getNumberOfDoras(triples2.concat(pairs2, calls[0]));
			var thisYaku = getCachedYaku(hand, triplesAndPairs2);
			var thisWait = numberOfTiles1 * getWaitQuality(tile1);
			var thisFu = calculateFu(triples2, calls[0], pairs2, removeTilesFromTileArray(hand, triples.concat(pairs).concat(tile1)), tile1);
			if (isClosed || thisYaku.open >= 1 || tilesLeft <= 4) {
				if (tile1Furiten && tilesLeft > 4) {
					thisWait = numberOfTiles1 / 6;
				}
				waits += thisWait;
				fu += thisFu * thisWait * factor;
				if (thisFu == 30 && isClosed) {
					thisYaku.closed += 1;
				}
				doraValue += thisDora * factor;
				yaku.open += thisYaku.open * factor;
				yaku.closed += thisYaku.closed * factor;
				expectedScore.open += calculateScoreWithYaku(0, thisYaku.open, thisDora + kita, thisFu) * factor;
				expectedScore.closed += calculateScoreWithYaku(0, thisYaku.closed, thisDora + kita, thisFu) * factor;
				numberOfTotalCombinations += factor;
			}

			expectedScore.riichi += calculateScore(0, thisYaku.closed + thisDora + kita + 1 + 0.2 + getUradoraChance(), thisFu) * thisWait * factor;
			numberOfTotalWaitCombinations += factor * thisWait;
			if (!tile1Furiten && tileCombination.canWin) {
				hand.pop();
				continue; //No need to check this tile in combination with any of the other tiles, if this is drawn first and already wins
			}
		}

		var tile2Furiten = tileCombination.tiles2.some(t => t.furiten);

		for (let tile2Data of tileCombination.tiles2) {//Look at second tiles if not already winning
			var tile2 = tile2Data.tile2;
			var numberOfTiles2 = getNumberOfTilesAvailable(tile2.index, tile2.type);
			if (isSameTile(tile1, tile2)) {
				if (numberOfTiles2 == 1) {
					continue;
				}
				numberOfTiles2--;
			}

			if (tile2Data.skip) {
				continue;
			}

			var combFactor = numberOfTiles1 * numberOfTiles2; //Number of ways to draw tile 1 first and then tile 2
			if (tile2Data.duplicate) {
				combFactor *= 2;
			}

			hand.push(tile2); //Simulate second draw

			var triplesAndPairs3 = tile2Data.triplesAndPairs;
			var triples3 = triplesAndPairs3.triples;
			var pairs3 = triplesAndPairs3.pairs;

			var thisShanten = 8;
			var winning = isWinningHand(parseInt((triples3.length / 3)) + callTriples, pairs3.length / 2);

			var thisDora = getNumberOfDoras(triples3.concat(pairs3, calls[0]));
			var thisYaku = getCachedYaku(hand, triplesAndPairs3);
			var closedYaku = thisYaku.closed;
			var newFu = 30, newFu2 = 30, pinfu = 0, pinfu2 = 0;
			if (winning) {
				newFu = calculateFu(triples3, calls[0], pairs3, [], tile2);
				newFu2 = tile2Data.duplicate ? calculateFu(triples3, calls[0], pairs3, [], tile1) : newFu;
				pinfu = isClosed && newFu == 30 ? 1 : 0;
				pinfu2 = isClosed && newFu2 == 30 ? 1 : 0;
				thisYaku.closed += (pinfu + pinfu2) / 2;
			}

			if (!isClosed && (!winning || tile2Furiten) &&
				getNumberOfTilesInTileArray(triples3, tile2.index, tile2.type) == 3) {
				combFactor *= 2; //More value to possible triples when hand is open (can call pons from all players)
			}

			if (winning && !tile2Furiten && (isClosed || thisYaku.open >= 1)) { //A completed open shape also needs a yaku.
				thisShanten = -1 - baseShanten;
				if (!waitTiles.some(t => isSameTile(t, tile2))) {
					var newShape = numberOfTiles2 * getWaitQuality(tile2) * ((numberOfTiles1) / availableTiles.length);
					if (tile2Data.duplicate) {
						newShape += numberOfTiles1 * getWaitQuality(tile1) * ((numberOfTiles2) / availableTiles.length);
					}
					shape += newShape;
				}
			}
			else { //Not winning? Calculate shanten correctly
				if (winning && (tile2Furiten || (!isClosed && thisYaku.open < 1))) { //Furiten/No Yaku: We are 0 shanten
					thisShanten = 0 - baseShanten;
				}
				else {
					thisShanten = getStandardShanten(hand) - baseShanten;
					if (thisShanten == -1) {  //Give less prio to tile combinations that only improve the hand by 1 shanten in two turns.
						thisShanten = -0.5;
					}
				}
			}
			shanten += thisShanten * combFactor;

			if (winning || thisShanten < 0) {
				doraValue += thisDora * combFactor;
				yaku.open += thisYaku.open * combFactor;
				yaku.closed += thisYaku.closed * combFactor;
				expectedScore.open += (calculateScoreWithYaku(0, thisYaku.open, thisDora + kita, newFu) +
					calculateScoreWithYaku(0, thisYaku.open, thisDora + kita, newFu2)) / 2 * combFactor;
				expectedScore.closed += (calculateScoreWithYaku(0, closedYaku + pinfu, thisDora + kita, newFu) +
					calculateScoreWithYaku(0, closedYaku + pinfu2, thisDora + kita, newFu2)) / 2 * combFactor;
				numberOfTotalCombinations += combFactor;
			}

			hand.pop();
		}

		hand.pop();
	}

	var allCombinations = availableTiles.length * (availableTiles.length - 1);
	shanten = allCombinations > 0 ? shanten / allCombinations : 0;

	if (numberOfTotalCombinations > 0) {
		expectedScore.open /= numberOfTotalCombinations; //Divide by the total combinations we checked, to get the average expected value
		expectedScore.closed /= numberOfTotalCombinations;
		doraValue /= numberOfTotalCombinations;
		yaku.open /= numberOfTotalCombinations;
		yaku.closed /= numberOfTotalCombinations;
	}
	if (numberOfTotalWaitCombinations > 0) {
		expectedScore.riichi /= numberOfTotalWaitCombinations;
		fu /= numberOfTotalWaitCombinations;
	}
	if (waitTiles.length > 0) {
		waits *= (waitTiles.length * 0.15) + 0.75; //Waiting on multiple tiles is better
	}

	fu = fu <= 30 ? 30 : fu;
	fu = fu > 110 ? 110 : fu;

	var efficiency = (shanten + (baseShanten - originalShanten)) * -1; //Percent Number that indicates how big the chance is to improve the hand (in regards to efficiency). Negative for increasing shanten with the discard
	if (originalShanten == 0) { //Already in Tenpai: Look at waits instead
		if (baseShanten == 0) {
			efficiency = (waits + shape) / 10;
		}
		else {
			efficiency = ((shanten / 1.7) * -1);
		}
	}

	if (baseShanten > 0) { //When not tenpai
		expectedScore.riichi = calculateScore(0, yaku.closed + doraValue + kita + 1 + 0.2 + getUradoraChance());
	}

	var danger = 0;
	var sakigiri = 0;
	if (typeof discardedTile != 'undefined') { //When deciding whether to call for a tile there is no discarded tile in the evaluation
		danger = getTileDanger(discardedTile);
		sakigiri = getSakigiriValue(hand, discardedTile);
	}

	var priority = calculateTilePriority(efficiency, expectedScore, danger - sakigiri);

	var riichiPriority = 0;
	if (originalShanten == 0) { //Already in Tenpai: Look at waits instead
		var riichiEfficiency = waits / 10;
		riichiPriority = calculateTilePriority(riichiEfficiency, expectedScore, danger - sakigiri);
	}

	return {
		tile: discardedTile, priority: priority, riichiPriority: riichiPriority, shanten: baseShanten, efficiency: efficiency,
		score: expectedScore, dora: doraValue, yaku: yaku, waits: waits, shape: shape, danger: danger, fu: fu,
		ukeire: drawAnalysis.ukeire, improvingTiles: drawAnalysis.improvingTiles, furiten: drawAnalysis.furiten,
		improvementChance: drawAnalysis.improvementChance, improvementChanceTwoDraws: drawAnalysis.improvementChanceTwoDraws
	};
}

function getClosedHandDecisionValue(expectedScore) {
	// A future riichi can supply the first yaku, so retain its dora and hand
	// value at a discount for committing to riichi. This is a decision utility;
	// the actual no-yaku ron payment remains zero in expectedScore.closed.
	return Math.max(expectedScore.closed, (expectedScore.riichi || calculateRonScore(0, 1)) / 2);
}

// Relative priority for comparing discards from the same hand.
function calculateTilePriority(efficiency, expectedScore, danger) {
	var score = expectedScore.open;
	if (isClosed) {
		score = getClosedHandDecisionValue(expectedScore);
	}
	if (tilesLeft <= getNumberOfPlayers()) score = Math.max(score, 1000); //Value of avoiding noten at an exhaustive draw.

	var placementFactor = 1;

	if (isLastGame() && getDistanceToFirst() < 0) { //First Place in last game:
		placementFactor = 1.5;
	}

	//Basically the formula should be efficiency multiplied by score (=expected value of the hand)
	//But it's generally better to just win even with a small score to prevent others from winning (and no-ten penalty) 
	//That's why efficiency is weighted a bit higher with Math.pow.
	var weightedEfficiency = Math.pow(Math.abs(efficiency), 0.3 + EFFICIENCY * placementFactor);
	weightedEfficiency = efficiency < 0 ? -weightedEfficiency : weightedEfficiency;

	score -= (danger * 2 * SAFETY);

	if (weightedEfficiency < 0) { //Hotfix for negative efficiency (increasing shanten)
		score = 50000 - score;
	}

	return weightedEfficiency * score;
}

//Get Chiitoitsu Priorities -> Look for Pairs
function chiitoitsuPriorities(inputHand = ownHand) {

	var tiles = [];

	var originalShanten = getSevenPairsShanten(inputHand);

	for (var i = 0; i < inputHand.length; i++) { //Create 13 Tile hands, check for pairs
		if (inputHand[i].valid === false || tiles.some(candidate => isSameTile(candidate.tile, inputHand[i], true))) continue;
		var newHand = [...inputHand];
		newHand.splice(i, 1);
		var pairs = getPairsAsArray(newHand);
		var analysis = getImprovingTileAnalysis(newHand, inputHand[i], STRATEGIES.CHIITOITSU);

		var baseDora = getNumberOfDoras(pairs);
		var doraValue = 0;
		var baseShanten = analysis.shanten;

		var waits = 0;
		var shanten = 0;

		var baseYaku = getYaku(newHand, calls[0]);
		var yaku = { open: 0, closed: 0 };

		var shape = 0;

		//Possible Value, Yaku and Dora after Draw
		for (let improvement of analysis.improvingTiles) {
			var tile = { ...improvement.tile, doraValue: getTileDoraValue(improvement.tile) };
			var currentHand = newHand.concat(tile);
			var chance = improvement.count / availableTiles.length;
			var nextShanten = getSevenPairsShanten(currentHand);
			shanten += (nextShanten - baseShanten) * chance;
			var additionalDora = getNumberOfDoras(getPairsAsArray(currentHand)) - baseDora;
			doraValue += additionalDora * chance;
			var y2 = getYaku(currentHand, calls[0]);
			yaku.open += (y2.open - baseYaku.open) * chance;
			yaku.closed += (y2.closed - baseYaku.closed) * chance;
			if (nextShanten == -1) {
				waits += improvement.count * (analysis.furiten ? 1 / 6 : getWaitQuality(tile));
				doraValue = additionalDora;
				if (tile.type == 3 || tile.index < 3 || tile.index > 7 || tile.doraValue > 0 || getWaitQuality(tile) > 1.1 ||
					currentHand.every(candidate => !isTerminalOrHonor(candidate))) shape = 1;
			}
		}
		doraValue += baseDora;
		yaku.open += baseYaku.open;
		yaku.closed += baseYaku.closed + 2; //Add Chiitoitsu manually
		if (getNumberOfPlayers() == 3) {
			doraValue += getNumberOfKitaOfPlayer(0) * getTileDoraValue({ index: 4, type: 3 });
		}

		var expectedScore = {
			open: 1000, closed: calculateScore(0, yaku.closed + doraValue, 25),
			riichi: calculateScore(0, yaku.closed + doraValue + 1 + 0.2 + getUradoraChance(), 25)
		};

		var efficiency = (shanten + (baseShanten - originalShanten)) * -1;
		if (originalShanten == 0 && baseShanten == 0) { //Already in Tenpai: Look at waits instead
			efficiency = waits / 10;
		}
		var danger = getTileDanger(inputHand[i]);

		var sakigiri = getSakigiriValue(newHand, inputHand[i]);

		var priority = calculateTilePriority(efficiency, expectedScore, danger - sakigiri);
		tiles.push({
			tile: inputHand[i], priority: priority, riichiPriority: priority, shanten: baseShanten, efficiency: efficiency,
			score: expectedScore, dora: doraValue, yaku: yaku, waits: waits, shape: shape, danger: danger, fu: 25,
			ukeire: analysis.ukeire, improvingTiles: analysis.improvingTiles, furiten: analysis.furiten,
			improvementChance: analysis.improvementChance, improvementChanceTwoDraws: analysis.improvementChanceTwoDraws
		});
	}

	return tiles;
}

//Get Thirteen Orphans Priorities -> Look for Honors/1/9
//Returns Array of tiles with priorities (value, danger etc.)
function thirteenOrphansPriorities(inputHand = ownHand) {
	var originalShanten = getThirteenOrphansShanten(inputHand);

	var tiles = [];
	for (var i = 0; i < inputHand.length; i++) { //Simulate discard of every tile
		if (inputHand[i].valid === false || tiles.some(candidate => isSameTile(candidate.tile, inputHand[i], true))) continue;
		var hand = [...inputHand];
		hand.splice(i, 1);
		var analysis = getImprovingTileAnalysis(hand, inputHand[i], STRATEGIES.THIRTEEN_ORPHANS);
		var shanten = analysis.shanten;
		var doraValue = getNumberOfDoras(hand);
		var yaku = { open: 0, closed: 13 };
		var waits = shanten == 0 ? analysis.ukeire * (analysis.furiten ? 1 / 6 : 1) : 0;

		var efficiency = originalShanten - shanten + analysis.improvementChance;
		var danger = getTileDanger(inputHand[i]);
		var sakigiri = getSakigiriValue(hand, inputHand[i]);
		var yakuman = calculateScore(0, 13);
		var expectedScore = { open: 0, closed: yakuman, riichi: yakuman };
		var priority = calculateTilePriority(efficiency, expectedScore, danger - sakigiri);

		tiles.push({
			tile: inputHand[i], priority: priority, riichiPriority: priority, shanten: shanten, efficiency: efficiency,
			score: expectedScore, dora: doraValue, yaku: yaku, waits: waits, shape: 0, danger: danger, fu: 30,
			ukeire: analysis.ukeire, improvingTiles: analysis.improvingTiles, furiten: analysis.furiten,
			improvementChance: analysis.improvementChance, improvementChanceTwoDraws: analysis.improvementChanceTwoDraws
		});

	}

	return tiles;
}

// Used during the match to see if its still viable to go for thirteen orphans.
function canDoThirteenOrphans() {

	// PARAMETERS
	var max_missing_orphans_count = 2; // If an orphan has been discarded more than this time (and is not in hand), we don't go for thirteen orphan.
	// Ie. 'Red Dragon' is not in hand, but been discarded 3-times on field. We stop going for thirteen orphan.

	if (calls[0].length > 0) { //Even a concealed kan rules out thirteen orphans.
		return false;
	}

	var ownTerminalHonors = getAllTerminalHonorFromHand(ownHand);

	// Filter out all duplicate terminal/honors
	var uniqueTerminalHonors = [];
	ownTerminalHonors.forEach(tile => {
		if (!uniqueTerminalHonors.some(otherTile => isSameTile(tile, otherTile))) {
			uniqueTerminalHonors.push(tile);
		}
	});

	// Fails if we do not have enough unique orphans.
	if (uniqueTerminalHonors.length < THIRTEEN_ORPHANS) {
		return false;
	}

	// Get list of missing orphans.
	var missingOrphans = getMissingTilesForThirteenOrphans(uniqueTerminalHonors);

	if (missingOrphans.length == 1) {
		max_missing_orphans_count = 3;
	}

	// Check if there are enough required orphans in the pool.
	for (let uniqueOrphan of missingOrphans) {
		if (4 - getNumberOfTilesAvailable(uniqueOrphan.index, uniqueOrphan.type) > max_missing_orphans_count) {
			return false;
		}
	}

	return true;
}

//Return a list of missing tiles for thirteen orphans
function getMissingTilesForThirteenOrphans(uniqueTerminalHonors) {
	var thirteen_orphans_set = "19m19p19s1234567z";
	var thirteenOrphansTiles = getTilesFromString(thirteen_orphans_set);
	return thirteenOrphansTiles.filter(tile => !uniqueTerminalHonors.some(otherTile => isSameTile(tile, otherTile)));
}

function recordDiscardComputationTime(durationMs) {
	if (typeof runtimeProfiling == 'undefined' || !Array.isArray(runtimeProfiling.discardDurationsMs)) {
		return;
	}

	runtimeProfiling.discardDurationsMs.push(durationMs);
	if (runtimeProfiling.discardDurationsMs.length > runtimeProfiling.maxSamples) {
		runtimeProfiling.discardDurationsMs.shift();
	}

	if (durationMs >= runtimeProfiling.slowDiscardThresholdMs) {
		var avg = runtimeProfiling.discardDurationsMs.reduce((p, c) => p + c, 0) / runtimeProfiling.discardDurationsMs.length;
		log("Performance warning: discard evaluation took " + Math.round(durationMs) + "ms (avg " + Math.round(avg) + "ms).");
	}
}

function setHelpHintContext(priority) {
	if (!priority) return;
	helpHintContext = {
		shanten: priority.shanten, strategy: strategy, ukeire: priority.ukeire,
		improvementChance: priority.improvementChance, furiten: priority.furiten
	};
}


//Discards the "best" tile
async function discard() {
	var startTime = (typeof performance != 'undefined' && typeof performance.now == 'function') ? performance.now() : Date.now();
	try {

		var tiles = await getTilePriorities(ownHand);
		if (tiles.length == 0 || (!isDebug() && !isDecisionCurrent())) return;
		tiles = sortOutUnsafeTiles(tiles);

		if (KEEP_SAFETILE) {
			tiles = keepSafetile(tiles);
		}

		if (strategy == STRATEGIES.FOLD || !tiles.some(t => t.safe)) {
			return discardFold(tiles);
		}

		log("Tile Priorities: ");
		printTilePriority(tiles);

		var tile = getDiscardTile(tiles);

		var riichi = false;
		if (canRiichi()) {
			tiles.sort(function (p1, p2) {
				return p2.riichiPriority - p1.riichiPriority;
			});
			riichi = callRiichi(tiles);
		}
		if (!riichi) {
			setHelpHintContext(tiles.find(candidate => isSameTile(candidate.tile, tile, true)));
			discardTile(tile);
		}

		return tile;
	}
	finally {
		var endTime = (typeof performance != 'undefined' && typeof performance.now == 'function') ? performance.now() : Date.now();
		recordDiscardComputationTime(endTime - startTime);
	}
}

//Check all tiles for enough safety
function sortOutUnsafeTiles(tiles) {
	for (let tile of tiles) {
		if (tile == tiles[0]) {
			var highestPrio = true;
		}
		else {
			var highestPrio = false;
		}
		if (shouldFold(tile, highestPrio)) {
			tile.safe = 0;
		}
		else {
			tile.safe = 1;
		}
	}
	tiles = tiles.sort(function (p1, p2) {
		return p2.safe - p1.safe;
	});
	return tiles;
}

//If there is only 1 safetile in hand, don't discard it.
function keepSafetile(tiles) {
	if (getCurrentDangerLevel() > 2000 || tiles[0].shanten <= 1) { //Don't keep a safetile when it's too dangerous or hand is close to tenpai
		return tiles;
	}
	var safeTiles = 0;
	for (let t of tiles) {
		if (isSafeTile(1, t.tile) && isSafeTile(2, t.tile) && (getNumberOfPlayers() == 3 || isSafeTile(3, t.tile))) {
			safeTiles++;
		}
	}
	if (safeTiles > 1) {
		return tiles;
	}

	if (getNumberOfPlayers() == 3) {
		var tilesSafety = tiles.map(t => getWaitScoreForTileAndPlayer(1, t.tile, false) +
			getWaitScoreForTileAndPlayer(2, t.tile, false));
	}
	else {
		var tilesSafety = tiles.map(t => getWaitScoreForTileAndPlayer(1, t.tile, false) +
			getWaitScoreForTileAndPlayer(2, t.tile, false) +
			getWaitScoreForTileAndPlayer(3, t.tile, false));
	}

	var safetileIndex = tilesSafety.indexOf(Math.min(...tilesSafety));

	tiles.push(tiles.splice(safetileIndex, 1)[0]);

	return tiles;
}

//Input: Tile Priority List
//Output: Best Tile to discard. Usually the first tile in the list, but for open hands a valid yaku is taken into account
function getDiscardTile(tiles) {
	var tile = tiles[0].tile;

	if (tiles[0].tile.valid !== false && (tiles[0].yaku.open >= 1 || isClosed || tilesLeft <= 4)) {
		return tile;
	}

	var highestYaku = -1;
	for (let t of tiles) {
		if (t.furiten && !tiles[0].furiten) continue; //Do not undo the modeled furiten penalty just to chase yaku.
		var foldThreshold = getFoldThreshold(t, ownHand);
		if (t.tile.valid !== false && t.yaku.open > highestYaku + 0.01 && t.yaku.open / 3.5 > highestYaku && t.danger <= foldThreshold) {
			tile = t.tile;
			highestYaku = t.yaku.open;
			if (t.yaku.open >= 1) {
				break;
			}
		}
	}
	if (getTileName(tile) != (getTileName(tiles[0].tile))) {
		log("Hand is open, trying to keep at least 1 Yaku.");
	}
	return tile;
}


//################################
// AI DEFENSE
// Defensive part of the AI
//################################

var defenseRuntimeCache = {
	stateKey: "",
	waitScore: {},
	tileDangerForPlayer: {},
	totalPossibleWaits: {},
	expectedDealInValue: {}
};

function getDefenseTileKey(tile) {
	if (typeof tile == 'undefined' || tile == null) {
		return "x";
	}
	return tile.type + "-" + tile.index + "-" + (tile.dora ? 1 : 0);
}

function getDefenseRuntimeStateKey() {
	var discardLengths = discards.map(d => d.length).join(",");
	var callLengths = calls.map(c => c.length).join(",");
	var riichiState = [0, 1, 2, 3].map(p => isPlayerRiichi(p) ? 1 : 0).join(",");
	//dora and availableTiles feed getExpectedDealInValue (via getExpectedHandValue/getUradoraChance),
	//and both can change without any discard/call length changing - include them or the cache goes stale.
	return tilesLeft + "|" + discardLengths + "|" + callLengths + "|" + riichiState +
		"|" + dora.length + "|" + availableTiles.length;
}

function ensureDefenseRuntimeCache() {
	var runtimeState = getDefenseRuntimeStateKey();
	if (defenseRuntimeCache.stateKey != runtimeState) {
		defenseRuntimeCache.stateKey = runtimeState;
		defenseRuntimeCache.waitScore = {};
		defenseRuntimeCache.tileDangerForPlayer = {};
		defenseRuntimeCache.totalPossibleWaits = {};
		defenseRuntimeCache.expectedDealInValue = {};
	}
}

function invalidateDefenseRuntimeCache() {
	defenseRuntimeCache.stateKey = "";
	defenseRuntimeCache.waitScore = {};
	defenseRuntimeCache.tileDangerForPlayer = {};
	defenseRuntimeCache.totalPossibleWaits = {};
	defenseRuntimeCache.expectedDealInValue = {};
}

//Returns danger of tile for all players (from a specific players perspective, see second param) as a number from 0-100+
//Takes into account Genbutsu (Furiten for opponents), Suji, Walls and general knowledge about remaining tiles.
//From the perspective of playerPerspective parameter
function getTileDanger(tile, playerPerspective = 0) {
	var dangerPerPlayer = [0, 0, 0, 0];
	for (var player = 0; player < getNumberOfPlayers(); player++) { //Foreach Player
		if (player == playerPerspective) {
			continue;
		}

		dangerPerPlayer[player] = getDealInChanceForTileAndPlayer(player, tile, playerPerspective);

		if (playerPerspective == 0) { //Multiply with expected deal in value
			dangerPerPlayer[player] *= getExpectedDealInValue(player);
		}

	}

	var danger = dangerPerPlayer[0] + dangerPerPlayer[1] + dangerPerPlayer[2] + dangerPerPlayer[3];

	if (getCurrentDangerLevel() < 2500) { //Scale it down for low danger levels
		danger *= 1 - ((2500 - getCurrentDangerLevel()) / 2500);
	}

	return danger;
}

//Return the Danger value for a specific tile and player
function getTileDangerForPlayer(tile, player, playerPerspective = 0) {
	ensureDefenseRuntimeCache();
	var dangerCacheKey = player + "|" + playerPerspective + "|" + getDefenseTileKey(tile);
	if (typeof defenseRuntimeCache.tileDangerForPlayer[dangerCacheKey] != 'undefined') {
		return defenseRuntimeCache.tileDangerForPlayer[dangerCacheKey];
	}

	var danger = 0;
	if (getLastTileInDiscard(player, tile) != null) { // Check if tile in discard (Genbutsu)
		defenseRuntimeCache.tileDangerForPlayer[dangerCacheKey] = 0;
		return 0;
	}

	danger = getWaitScoreForTileAndPlayer(player, tile, true, playerPerspective == 0); //Suji, Walls and general knowledge about remaining tiles.

	if (danger <= 0) {
		defenseRuntimeCache.tileDangerForPlayer[dangerCacheKey] = 0;
		return 0;
	}

	//Honor tiles are often a preferred wait
	if (tile.type == 3) {
		danger *= 1.3;
	}

	//Is Dora? -> 10% more dangerous
	danger *= (1 + (getTileDoraValue(tile) / 10));

	//Is close to Dora? -> 5% more dangerous
	if (isTileCloseToDora(tile)) {
		danger *= 1.05;
	}

	//Is the player doing a flush of that type? A flush suit is more dangerous (they want it).
	//A chinitsu (single suit, NO honors kept) is worth ~5-6 han, far more than a honitsu,
	//so its suit is rated even more dangerous and honors it sheds become safer.
	var honitsuType0 = isDoingHonitsu(player, 0);
	var honitsuType1 = isDoingHonitsu(player, 1);
	var honitsuType2 = isDoingHonitsu(player, 2);
	var honitsuChance = tile.type == 0 ? honitsuType0 : tile.type == 1 ? honitsuType1 : tile.type == 2 ? honitsuType2 : 0; // honors match no suit
	var chinitsuChance = tile.type == 3 ? 0 : isDoingChinitsu(player, tile.type);
	var otherHonitsu = Math.max(honitsuType0, honitsuType1, honitsuType2);
	var otherChinitsu = Math.max(isDoingChinitsu(player, 0), isDoingChinitsu(player, 1), isDoingChinitsu(player, 2));
	if (honitsuChance > 0) {
		danger *= 1 + honitsuChance + (chinitsuChance * 0.5); //chinitsu suit: bigger hand => more dangerous
	}
	else if (otherHonitsu > 0 || otherChinitsu > 0) { //Is the player going for any other flush?
		if (tile.type == 3) {
			//A honitsu keeper holds honors (still possibly their pair/yaku) => dangerous.
			//A chinitsu player drops honors (never keeps them) => safer.
			if (otherChinitsu > 0) {
				danger *= 1 - (otherChinitsu * 0.5); //Safer, but never assume unseen honors cannot be a honitsu wait
			}
			else {
				danger *= 1 + otherHonitsu;
			}
		}
		else {
			danger *= 1 - Math.max(otherHonitsu, otherChinitsu); //Off-suit tiles are less dangerous
		}
	}

	//Is the player doing a tanyao? Inner tiles are more dangerous, outer tiles are less dangerous
	if (tile.type != 3 && tile.index < 9 && tile.index > 1) {
		danger *= 1 + (isDoingTanyao(player) / 10);
	}
	else {
		danger /= 1 + (isDoingTanyao(player) / 10);
	}

	//Does the player have no yaku yet? Yakuhai is likely -> Honor tiles are 10% more dangerous
	if (!hasYaku(player)) {
		if (tile.type == 3 && (tile.index > 4 || tile.index == getSeatWind(player) || tile.index == getRoundWind()) &&
			getNumberOfTilesAvailable(tile.index, tile.type) > 2) {
			danger *= 1.1;
		}
	}

	//Is Tile close to the tile discarded on the riichi turn? -> 10% more dangerous
	if (isPlayerRiichi(player) && riichiTiles[player] != null) {
		if (isTileCloseToOtherTile(tile, riichiTiles[player])) {
			danger *= 1.1;
		}
	}

	//Is Tile close to an early discard (first row)? -> 10% less dangerous
	discards[player].slice(0, 6).forEach(function (earlyDiscard) {
		if (isTileCloseToOtherTile(tile, earlyDiscard)) {
			danger *= 0.9;
		}
	});

	//Danger is at least 5
	if (danger < 5) {
		danger = 5;
	}

	defenseRuntimeCache.tileDangerForPlayer[dangerCacheKey] = danger;

	return danger;
}

//Percentage to deal in with a tile
function getDealInChanceForTileAndPlayer(player, tile, playerPerspective = 0) {
	var total = getTotalPossibleWaits(player, playerPerspective);
	if (total <= 0) {
		return 0;
	}
	return Math.min(1, Math.max(0, getTileDangerForPlayer(tile, player, playerPerspective) / total));
}

//Total amount of waits possible
function getTotalPossibleWaits(player, playerPerspective = 0) {
	ensureDefenseRuntimeCache();
	var waitCacheKey = player + "|" + playerPerspective;
	if (typeof defenseRuntimeCache.totalPossibleWaits[waitCacheKey] != 'undefined') {
		return defenseRuntimeCache.totalPossibleWaits[waitCacheKey];
	}

	var total = 0;
	for (let i = 1; i <= 9; i++) { // Go through all tiles and check how many combinations there are overall for waits.
		for (let j = 0; j <= 3; j++) {
			if (j == 3 && i >= 8) {
				break;
			}
			total += getTileDangerForPlayer({ index: i, type: j }, player, playerPerspective);
		}
	}
	defenseRuntimeCache.totalPossibleWaits[waitCacheKey] = total;
	return total;
}

//Returns the expected deal in value. Cached per (state, player): it folds isPlayerTenpai*getExpectedHandValue,
//which is hot (called from getCurrentDangerLevel and from getTileDanger for the player-0 perspective).
function getExpectedDealInValue(player) {
	ensureDefenseRuntimeCache();
	if (typeof defenseRuntimeCache.expectedDealInValue[player] != 'undefined') {
		return defenseRuntimeCache.expectedDealInValue[player];
	}

	//DealInValue is probability of player being in tenpai multiplied by the value of the hand
	var value = isPlayerTenpai(player) * getExpectedHandValue(player);
	defenseRuntimeCache.expectedDealInValue[player] = value;
	return value;
}

//Calculate the expected Han of the hand
function getExpectedHandValue(player) {
	var doraValue = getNumberOfDoras(calls[player]); //Visible Dora (melds)

	doraValue += getExpectedDoraInHand(player); //Dora in hidden tiles (hand)

	//Kita (3 player mode only)
	if (getNumberOfPlayers() == 3) {
		doraValue += (getNumberOfKitaOfPlayer(player) * getTileDoraValue({ index: 4, type: 3 })) * 1;
	}

	var hanValue = 0;
	if (isPlayerRiichi(player)) {
		hanValue += 1;
	}

	//Yakus (only for open hands). A chinitsu (full flush, no honors) is worth ~5 han vs a honitsu's ~2,
	//so value the opponent's flush as whichever is higher when a chinitsu push is plausible.
	var flushHan = Math.max(
		(isDoingHonitsu(player, 0) * 2), (isDoingHonitsu(player, 1) * 2), (isDoingHonitsu(player, 2) * 2),
		(isDoingChinitsu(player, 0) * 5), (isDoingChinitsu(player, 1) * 5), (isDoingChinitsu(player, 2) * 5)
	);
	hanValue += flushHan + (isDoingToiToi(player) * 2) + (isDoingTanyao(player) * 1) + (isDoingYakuhai(player) * 1);

	//Expect some hidden Yaku when more tiles are unknown. 1.3 Yaku for a fully concealed hand, less for open hands
	if (calls[player].length == 0) {
		hanValue += 1.3;
	}
	else {
		hanValue += getNumberOfTilesInHand(player) / 15;
	}

	hanValue = hanValue < 1 ? 1 : hanValue;

	return calculateScore(player, hanValue + doraValue);
}

//How many dora does the player have on average in his hidden tiles?
function getExpectedDoraInHand(player) {
	var uradora = 0;
	if (isPlayerRiichi(player)) { //amount of dora indicators multiplied by chance to hit uradora
		uradora = getUradoraChance();
	}
	if (availableTiles.length == 0) return uradora;
	return (((getNumberOfTilesInHand(player) + (discards[player].length / 2)) / availableTiles.length) * getNumberOfDoras(availableTiles)) + uradora;
}

//Returns the current Danger level of the table
function getCurrentDangerLevel(forPlayer = 0) { //Most Dangerous Player counts extra
	var i = 1;
	var j = 2;
	var k = 3;
	if (forPlayer == 1) {
		i = 0;
	}
	if (forPlayer == 2) {
		j = 0;
	}
	if (forPlayer == 3) {
		k = 0;
	}
	if (getNumberOfPlayers() == 3) {
		return ((getExpectedDealInValue(i) + getExpectedDealInValue(j) + Math.max(getExpectedDealInValue(i), getExpectedDealInValue(j))) / 3);
	}
	return ((getExpectedDealInValue(i) + getExpectedDealInValue(j) + getExpectedDealInValue(k) + Math.max(getExpectedDealInValue(i), getExpectedDealInValue(j), getExpectedDealInValue(k))) / 4);
}

//Returns the number of turns ago when the tile was most recently discarded
function getMostRecentDiscardDanger(tile, player, includeOthers) {
	var danger = 99;
	for (var i = 0; i < getNumberOfPlayers(); i++) {
		var r = getLastTileInDiscard(i, tile);
		if (player == i && r != null) { //Tile is in own discards
			return 0;
		}
		if (!includeOthers || player == 0) {
			continue;
		}
		if (r != null && Array.isArray(r.numberOfPlayerHandChanges) && r.numberOfPlayerHandChanges[player] < danger) {
			danger = r.numberOfPlayerHandChanges[player];
		}
	}

	return danger;
}

//Returns the position of a tile in discards
function getLastTileInDiscard(player, tile) {
	for (var i = discards[player].length - 1; i >= 0; i--) {
		if (isSameTile(discards[player][i], tile)) {
			return discards[player][i];
		}
	}
	return wasTileCalledFromOtherPlayers(player, tile);
}

//Checks if a tile has been called by someone
function wasTileCalledFromOtherPlayers(player, tile) {
	for (var i = 0; i < getNumberOfPlayers(); i++) {
		if (i == player) { //Skip own melds
			continue;
		}
		for (let t of calls[i]) { //Look through all melds and check where the tile came from
			if (t.from == localPosition2Seat(player) && isSameTile(tile, t)) {
				t.numberOfPlayerHandChanges = [10, 10, 10, 10];
				return t;
			}
		}
	}
	return null;
}

//Returns a number from 0 to 1 how likely it is that the player is tenpai
function isPlayerTenpai(player) {
	var numberOfCalls = getMeldCount(calls[player]);
	if (isPlayerRiichi(player) || numberOfCalls >= 4) {
		return 1;
	}

	// A disconnected player can still have a ready hand. Connection status
	// provides no evidence that a discard is safe.
	//Based on: https://pathofhouou.blogspot.com/2021/04/analysis-tenpai-chance-by-tedashis-and.html
	//This is only accurate for high level games!
	var tenpaiChanceList = [[], [], [], []];
	tenpaiChanceList[0] = [0, 0.1, 0.2, 0.5, 1, 1.8, 2.8, 4.2, 5.8, 7.6, 9.5, 11.5, 13.5, 15.5, 17.5, 19.5, 21.7, 23.9, 25, 27, 29, 31, 33, 35, 37];
	tenpaiChanceList[1] = [0.2, 0.9, 2.3, 4.7, 8.3, 12.7, 17.9, 23.5, 29.2, 34.7, 39.7, 43.9, 47.4, 50.3, 52.9, 55.2, 57.1, 59, 61, 63, 65, 67, 69];
	tenpaiChanceList[2] = [0, 5.1, 10.5, 17.2, 24.7, 32.3, 39.5, 46.1, 52, 57.2, 61.5, 65.1, 67.9, 69.9, 71.4, 72.4, 73.3, 74.2, 75, 76, 77, 78, 79];
	tenpaiChanceList[3] = [0, 0, 41.9, 54.1, 63.7, 70.9, 76, 79.9, 83, 85.1, 86.7, 87.9, 88.7, 89.2, 89.5, 89.4, 89.3, 89.2, 89.2, 89.2, 90, 90, 90];

	var numberOfDiscards = discards[player].length;
	for (var i = 0; i < getNumberOfPlayers(); i++) {
		if (i == player) {
			continue;
		}
		for (let t of calls[i]) { //Look through all melds and check where the tile came from
			if (t.from == localPosition2Seat(player)) {
				numberOfDiscards++;
			}
		}
	}

	if (numberOfDiscards > 20) {
		numberOfDiscards = 20;
	}

	try {
		var tenpaiChance = tenpaiChanceList[numberOfCalls][numberOfDiscards] / 100;
	}
	catch {
		var tenpaiChance = 0.5;
	}

	tenpaiChance *= 1 + (isPlayerPushing(player) / 5);

	//Player who is doing Honitsu starts discarding tiles of his own type => probably tenpai
	if ((isDoingHonitsu(player, 0) && discards[player].slice(10).filter(tile => tile.type == 0).length > 0)) {
		tenpaiChance *= 1 + (isDoingHonitsu(player, 0) / 1.5);
	}
	if ((isDoingHonitsu(player, 1) && discards[player].slice(10).filter(tile => tile.type == 1).length > 0)) {
		tenpaiChance *= 1 + (isDoingHonitsu(player, 1) / 1.5);
	}
	if ((isDoingHonitsu(player, 2) && discards[player].slice(10).filter(tile => tile.type == 2).length > 0)) {
		tenpaiChance *= 1 + (isDoingHonitsu(player, 2) / 1.5);
	}

	var room = getCurrentRoom();
	if (typeof ROOM_TENPAI_MODIFIER != 'undefined' && typeof ROOM_TENPAI_MODIFIER[room] != 'undefined') {
		tenpaiChance *= ROOM_TENPAI_MODIFIER[room];
	}
	else if (room < 5 && room > 0) { //Fallback behavior for custom environments that don't define ROOM_TENPAI_MODIFIER.
		tenpaiChance *= 1 - ((5 - room) * 0.1);
	}

	if (tenpaiChance > 1) {
		tenpaiChance = 1;
	}
	else if (tenpaiChance < 0) {
		tenpaiChance = 0;
	}

	return tenpaiChance;
}

//Returns a number from -1 (fold) to 1 (push).
function isPlayerPushing(player) {
	var lastDiscardSafety = playerDiscardSafetyList[player].slice(-3).filter(v => v >= 0); //Check safety of last three discards. If dangerous: Not folding.

	if (playerDiscardSafetyList[player].length < 3 || lastDiscardSafety.length == 0) {
		return 0;
	}

	var pushValue = -1 + (lastDiscardSafety.reduce((v1, v2) => v1 + (v2 * 20), 0) / lastDiscardSafety.length);
	if (pushValue > 1) {
		pushValue = 1;
	}
	return pushValue;
}

//Is the player doing any of the most common yaku?
function hasYaku(player) {
	return (isDoingHonitsu(player, 0) > 0 || isDoingHonitsu(player, 1) > 0 || isDoingHonitsu(player, 2) > 0 ||
		isDoingToiToi(player) > 0 || isDoingTanyao(player) > 0 || isDoingYakuhai(player) > 0);
}

//Return a confidence between 0 and 1 for how predictable the strategy of another player is (many calls -> very predictable)
function getConfidenceInYakuPrediction(player) {
	var confidence = Math.pow(getMeldCount(calls[player]), 2) / 10;
	if (confidence > 1) {
		confidence = 1;
	}
	return confidence;
}

//Returns a value between 0 and 1 for how likely the player could be doing honitsu
function isDoingHonitsu(player, type) {
	if (calls[player].length == 0 || calls[player].some(tile => tile.type != type && tile.type != 3)) { //Calls of different type -> false
		return 0;
	}
	if (getMeldCount(calls[player]) >= 4) {
		return 1;
	}
	var earlyDiscards = discards[player].slice(0, 10);
	if (earlyDiscards.length == 0) {
		return 0;
	}
	var percentageOfDiscards = earlyDiscards.filter(tile => tile.type == type).length / earlyDiscards.length;
	if (percentageOfDiscards > 0.2) {
		return 0;
	}
	var confidence = (Math.pow(getMeldCount(calls[player]), 2) / 10) - percentageOfDiscards + 0.1;
	if (confidence > 1) {
		confidence = 1;
	}
	return confidence;
}

//Returns a value between 0 and 1 for how likely the player is going for a CHINITSU (full flush, no honors).
//Distinguishing it from honitsu matters: a chinitsu is worth ~5-6 han vs ~2-3 for honitsu, so an opponent
//pushing chinitsu should be valued (and defended against) more aggressively than honitsu.
//Key signal: a honitsu keeper keeps honors; a chinitsu player discards them. We require the same single-suit
//call signal as honitsu AND early honor discards (honors being shed instead of saved).
//Note: early honor discards are common in ordinary play, so this stays deliberately conservative -
//it demands a strong single-suit call signal before treating the hand as a full flush.
function isDoingChinitsu(player, type) {
	var honitsuConfidence = isDoingHonitsu(player, type);
	if (honitsuConfidence == 0) {
		return 0;
	}
	if (calls[player].some(tile => tile.type == 3)) {
		return 0; //Any exposed honor makes a full flush impossible
	}

	var earlyDiscards = discards[player].slice(0, 10);
	var honorDiscards = earlyDiscards.filter(tile => tile.type == 3).length;
	if (honorDiscards == 0) {
		return 0; //Keeping honors => this is honitsu, not chinitsu
	}

	//Require a committed single-suit call signal (2+ melds) before believing a full flush.
	//One pon plus a couple of honor discards is far too common to justify a 5 han estimate.
	if (getMeldCount(calls[player]) < 2) {
		return 0;
	}

	return honitsuConfidence * Math.min(1, honorDiscards / 3);
}

//Returns a value between 0 and 1 for how likely the player could be doing toitoi
function isDoingToiToi(player) {
	if (calls[player].length > 0 && getMelds(calls[player]).every(meld => meld.every(tile => isSameTile(tile, meld[0])))) {
		return getConfidenceInYakuPrediction(player) - 0.1;
	}
	return 0;
}

//Returns a value between 0 and 1 for how likely the player could be doing tanyao
function isDoingTanyao(player) {
	if (calls[player].length > 0 && !calls[player].some(tile => tile.type == 3 || tile.index == 1 || tile.index == 9)) {
		var earlyDiscards = discards[player].slice(0, 5);
		if (earlyDiscards.length > 0 &&
			earlyDiscards.filter(tile => tile.type == 3 || tile.index == 1 || tile.index == 9).length / earlyDiscards.length >= 0.6) { //only inner tiles called and lots of terminal/honor discards
			return getConfidenceInYakuPrediction(player);
		}
	}
	return 0;
}

//Returns how many Yakuhai the player has
function isDoingYakuhai(player) {
	var playerSeatWind = getSeatWind(player);
	var honorMelds = getMelds(calls[player]).filter(meld => meld[0].type == 3);
	var yakuhai = honorMelds.filter(meld => meld[0].index > 4 || meld[0].index == playerSeatWind || meld[0].index == roundWind).length;
	if (playerSeatWind == roundWind) {
		yakuhai += honorMelds.filter(meld => meld[0].index == playerSeatWind).length;
	}
	return yakuhai;
}

//Returns a score how likely this tile can form the last triple/pair for a player
//Suji, Walls and general knowledge about remaining tiles.
//If "includeOthers" parameter is set to true it will also check if other players recently discarded relevant tiles
function getWaitScoreForTileAndPlayer(player, tile, includeOthers, useKnowledgeOfOwnHand = true) {
	ensureDefenseRuntimeCache();
	var waitCacheKey = player + "|" + includeOthers + "|" + useKnowledgeOfOwnHand + "|" + getDefenseTileKey(tile);
	if (typeof defenseRuntimeCache.waitScore[waitCacheKey] != 'undefined') {
		return defenseRuntimeCache.waitScore[waitCacheKey];
	}

	var tile0 = getNumberOfTilesAvailable(tile.index, tile.type);
	var tile0Public = tile0 + getNumberOfTilesInTileArray(ownHand, tile.index, tile.type);
	if (!useKnowledgeOfOwnHand) {
		tile0 = tile0Public;
	}
	var furitenFactor = getFuritenValue(player, tile, includeOthers);

	if (furitenFactor == 0) {
		defenseRuntimeCache.waitScore[waitCacheKey] = 0;
		return 0;
	}

	//Less priority on Ryanmen and Bridge Wait when player is doing Toitoi
	var toitoiFactor = 1 - (isDoingToiToi(player) / 3);

	var score = 0;

	//Same tile
	score += tile0 * tile0Public * furitenFactor * 2 * (2 - toitoiFactor);

	if (getNumberOfTilesInHand(player) == 1 || tile.type == 3) {
		defenseRuntimeCache.waitScore[waitCacheKey] = score;
		return score;
	}

	var tileL3Public = getNumberOfTilesAvailable(tile.index - 3, tile.type) + getNumberOfTilesInTileArray(ownHand, tile.index - 3, tile.type);
	var tileU3Public = getNumberOfTilesAvailable(tile.index + 3, tile.type) + getNumberOfTilesInTileArray(ownHand, tile.index + 3, tile.type);

	var tileL2 = getNumberOfTilesAvailable(tile.index - 2, tile.type);
	var tileL1 = getNumberOfTilesAvailable(tile.index - 1, tile.type);
	var tileU1 = getNumberOfTilesAvailable(tile.index + 1, tile.type);
	var tileU2 = getNumberOfTilesAvailable(tile.index + 2, tile.type);

	if (!useKnowledgeOfOwnHand) {
		tileL2 += getNumberOfTilesInTileArray(ownHand, tile.index - 2, tile.type);
		tileL1 += getNumberOfTilesInTileArray(ownHand, tile.index - 1, tile.type);
		tileU1 += getNumberOfTilesInTileArray(ownHand, tile.index + 1, tile.type);
		tileU2 += getNumberOfTilesInTileArray(ownHand, tile.index + 2, tile.type);
	}

	var furitenFactorL = getFuritenValue(player, { index: tile.index - 3, type: tile.type }, includeOthers);
	var furitenFactorU = getFuritenValue(player, { index: tile.index + 3, type: tile.type }, includeOthers);

	//Ryanmen Waits
	score += (tileL1 * tileL2) * (tile0Public + tileL3Public) * furitenFactorL * toitoiFactor;
	score += (tileU1 * tileU2) * (tile0Public + tileU3Public) * furitenFactorU * toitoiFactor;

	//Bridge Wait
	score += (tileL1 * tileU1 * tile0Public) * furitenFactor * toitoiFactor;
	defenseRuntimeCache.waitScore[waitCacheKey] = score;

	return score;
}

//Returns 0 if tile is 100% furiten, 1 if not. Value between 0-1 is returned if furiten tile was not called some turns ago.
function getFuritenValue(player, tile, includeOthers) {
	var danger = getMostRecentDiscardDanger(tile, player, includeOthers);
	if (danger == 0) {
		return 0;
	}
	else if (danger == 1) {
		if (calls[player].length > 0) {
			return 0.5;
		}
		return 0.95;
	}
	else if (danger == 2) {
		if (calls[player].length > 0) {
			return 0.8;
		}
	}
	return 1;
}

//Sets tile safeties for discards
function updateDiscardedTilesSafety() {
	for (var k = 1; k < getNumberOfPlayers(); k++) { //For all other players
		for (var i = 0; i < getNumberOfPlayers(); i++) { //For all discard ponds
			for (var j = 0; j < discards[i].length; j++) { //For every tile in it
				if (typeof (discards[i][j].numberOfPlayerHandChanges) == 'undefined') {
					discards[i][j].numberOfPlayerHandChanges = [0, 0, 0, 0];
				}
				if (hasPlayerHandChanged(k)) {
					if (j == discards[i].length - 1 && k < i && (k <= seat2LocalPosition(getCurrentPlayer()) || seat2LocalPosition(getCurrentPlayer()) == 0)) { //Ignore tiles by players after hand change
						continue;
					}
					discards[i][j].numberOfPlayerHandChanges[k]++;
				}
			}
		}
		rememberPlayerHand(k);
	}
	invalidateDefenseRuntimeCache();
}

//Pretty simple (all 0), but should work in case of crash -> count intelligently upwards
function initialDiscardedTilesSafety() {
	for (var k = 1; k < getNumberOfPlayers(); k++) { //For all other players
		for (var i = 0; i < getNumberOfPlayers(); i++) { //For all discard ponds
			for (var j = 0; j < discards[i].length; j++) { //For every tile in it
				if (typeof (discards[i][j].numberOfPlayerHandChanges) == 'undefined') {
					discards[i][j].numberOfPlayerHandChanges = [0, 0, 0, 0];
				}
				var bonus = 0;
				if (k < i && (k <= seat2LocalPosition(getCurrentPlayer()) || seat2LocalPosition(getCurrentPlayer()) == 0)) {
					bonus = 1;
				}
				discards[i][j].numberOfPlayerHandChanges[k] = discards[i].length - j - bonus;
			}
		}
	}
	invalidateDefenseRuntimeCache();
}

//Returns a value which indicates how important it is to sakigiri the tile now
function getSakigiriValue(hand, tile) {
	var sakigiri = 0;
	for (let player = 1; player < getNumberOfPlayers(); player++) {
		if (discards[player].length < 3) { // Not many discards yet (very early) => ignore Sakigiri
			continue;
		}

		if (getExpectedDealInValue(player) > 150) { // Obviously don't sakigiri when the player could already be in tenpai
			continue;
		}

		if (isSafeTile(player, tile)) { // Tile is safe
			continue;
		}

		var safeTiles = 0;
		for (let t of hand) { // How many safe tiles do we currently have?
			if (isSafeTile(player, t)) {
				safeTiles++;
			}
		}

		var saki = (3 - safeTiles) * (SAKIGIRI * 4);
		if (saki <= 0) { // 3 or more safe tiles: Sakigiri not necessary
			continue;
		}

		if (getSeatWind(player) == 1) { // Player is dealer
			saki *= 1.5;
		}
		sakigiri += saki;
	}
	return sakigiri;
}

//Returns true when the given tile is safe for a given player
function isSafeTile(player, tile) {
	return getWaitScoreForTileAndPlayer(player, tile, false) < 20 || (tile.type == 3 && availableTiles.filter(t => isSameTile(t, tile)).length <= 2);
}

//Check if the tile is close to another tile
function isTileCloseToOtherTile(tile, otherTile) {
	if (tile.type != 3 && tile.type == otherTile.type) {
		return tile.index >= otherTile.index - 3 && tile.index <= otherTile.index + 3;
	}
	return false;
}

//Check if the tile is close to dora
function isTileCloseToDora(tile) {
	for (let d of dora) {
		var doraIndex = getHigherTileIndex(d);
		if (tile.type == 3 && d.type == 3 && tile.index == doraIndex) {
			return true;
		}
		if (tile.type != 3 && tile.type == d.type && tile.index >= doraIndex - 2 && tile.index <= doraIndex + 2) {
			return true;
		}
	}
	return false;
}


// Connect the protocol observer to AlphaJong's existing decision engine.
var alphaJongUnityClient = null;

function getUnityClient() {
	return !hasLegacyClient() ? alphaJongUnityClient : null;
}

function initUnityClient() {
	if (alphaJongUnityClient != null || hasLegacyClient() || typeof WebSocket !== "function") return;
	var state = AlphaJongUnityState.create({
		onChange: function (event) {
			decisionEpoch++;
			if (event.type === "auth" || event.action === "ActionNewRound" || event.type === "restore") {
				tilesLeft = 0;
				functionsExtended = false;
			}
			if (event.type === "invalidated" || event.type === "request" || event.type === "timeout") clearCrtStrategyMsg();
		},
		onDiscard: function (event) {
			if (event.player === 0 || event.replaying) return;
			var danger = -1;
			try {
				if (!threadIsRunning) {
					setData(false);
					visibleTiles.push(event.tile);
					availableTiles = removeTilesFromTileArray(availableTiles, [event.tile]);
					invalidateDefenseRuntimeCache();
					danger = getTileDanger(event.tile, event.player);
					if (event.tsumogiri && danger < 0.01) danger = 0.05;
				}
			} catch (_) { /* Keep the observation unknown if a decision owns the simulation. */ }
			if (Array.isArray(playerDiscardSafetyList[event.player])) {
				if (event.riichi) riichiTiles[event.player] = event.tile;
				playerDiscardSafetyList[event.player].push(danger);
			}
		}
	});
	var transport = AlphaJongUnityTransport.install({
		protocol: AlphaJongUnityProtocol,
		onFrame: function (frame, direction, info) {
			if (hasLegacyClient()) return;
			if ((info.game && info.currentGame) || (frame.method.startsWith(".lq.Lobby.") && frame.kind === "response")) state.consume(frame, direction);
		},
		onActivity: function (reason, info) { if (!hasLegacyClient() && info.currentGame) decisionEpoch++; },
		onInvalidate: function (reason, info) { if (!hasLegacyClient() && info.currentGame) state.invalidate(reason); },
		canSend: function (method, payload) {
			if (hasLegacyClient() || MODE !== AIMODE.AUTO || !isActionCurrent() || !state.isInGame()) return false;
			var manager = state.getManager(), operations = manager.oplist;
			if (method === ".lq.FastTest.inputChiPengGang") {
				if (payload.cancel_operation === true) return operations.some(operation => [2, 3, 5, 9].includes(operation.type));
				return [2, 3, 5, 9].includes(payload.type) && validOption(operations, payload);
			}
			if (method !== ".lq.FastTest.inputOperation") return false;
			if (payload.type === 1) {
				if (!operations.some(operation => operation.type === 1)) return false;
				return manager.mainrole.hand.some(entry => entry.valid && entry.val.toString() === payload.tile &&
					(payload.moqie !== true || entry === manager.mainrole.last_tile));
			}
			if (payload.type === 7) {
				var riichi = operations.find(operation => operation.type === 7);
				var inHand = manager.mainrole.hand.some(entry => entry.valid && entry.val.toString() === payload.tile &&
					(payload.moqie !== true || entry === manager.mainrole.last_tile));
				// A red five can represent both fives in the server's riichi options.
				// Compare tile value, but send only an eligible tile actually in hand.
				return inHand && riichi != null && riichi.combination.some(option =>
					option.split("|")[0].replace(/^0/, "5") === payload.tile.replace(/^0/, "5"));
			}
			return [4, 6, 8, 10, 11].includes(payload.type) && validOption(operations, payload);
		}
	});
	function validOption(operations, payload) {
		var operation = operations.find(entry => entry.type === payload.type);
		if (!operation) return false;
		return !operation.combination.length || (Number.isInteger(payload.index) && payload.index >= 0 && payload.index < operation.combination.length);
	}
	alphaJongUnityClient = {
		state: state, transport: transport,
		send: function (method, payload) {
			var manager = state.getManager();
			if (!manager) return false;
			var normalized = Object.assign({}, payload);
			// Retain the game's existing inputOperation timeuse convention (seconds).
			// Operation countdown fields use milliseconds; convert them explicitly.
			var status = state.getStatus();
			var remaining = Math.max(0, status.operationDeadline - Date.now());
			var allotted = (manager.time_fixed + manager.time_add) * 1000;
			normalized.timeuse = Math.max(0, Math.floor((allotted - remaining) / 1000));
			if (method === "inputChiPengGang" && [4, 6, 8, 10, 11].includes(normalized.type)) method = "inputOperation";
			return transport.send(method, normalized);
		},
		getTimeLeft: function () {
			var status = state.getStatus();
			return status.operationDeadline ? Math.max(0, (status.operationDeadline - Date.now()) / 1000) : 20;
		}
	};
}


//################################
// MAIN
// Main Class, starts the bot and sets up all necessary variables.
//################################

var startupStartedAt = Date.now();
var startupFinished = false;
var startupError = "";
var lobbyLoadTimer = null;
var afkTimer = null;

//GUI can be re-opened by pressing + on the Numpad
if (!isDebug()) {
	if (typeof initUnityClient === "function") initUnityClient();
	initGui();
	window.onkeyup = function (e) {
		var key = e.keyCode ? e.keyCode : e.which;

		if (key == 107 || key == 65) { // Numpad + Key
			toggleGui();
		}
	}

	if (AUTORUN) {
		log("Autorun start");
		run = true;
	}

	log(`crt mode ${AIMODE_NAME[MODE]}`);

	waitForMainLobbyLoad();
}

function toggleRun() {
	if (startupError) {
		return;
	}
	clearCrtStrategyMsg();
	decisionEpoch++;
	oldOps = "";
	if (run) {
		log("AlphaJong deactivated!");
		run = false;
		setAutoCallWin(false);
		startButton.innerHTML = "Start Bot";
	}
	else {
		log("AlphaJong activated!");
		run = true;
		setAutoCallWin(MODE === AIMODE.AUTO);
		startButton.innerHTML = "Stop Bot";
		main();
	}
}

function waitForMainLobbyLoad() {
	clearTimeout(lobbyLoadTimer);
	lobbyLoadTimer = null;
	if (startupFinished || startupError) {
		return;
	}

	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity && isUnityPage()) {
		autorunCheckbox.disabled = true;
		roomCombobox.disabled = true;
		if (!unity.state.isLobbyReady()) {
			var connected = unity.transport.getStatus().connected;
			showCrtActionMsg(connected ? "Waiting for sign-in." : "Connecting to Mahjong Soul.");
			if (Date.now() - startupStartedAt >= 30000) showStartupNotice("Sign in to Mahjong Soul, then enter a standard match. " +
				"If already signed in, reload this page once so AlphaJong can observe the game connection.");
			lobbyLoadTimer = setTimeout(waitForMainLobbyLoad, 1000);
			return;
		}
		showStartupNotice("Unity integration is active. Choose a standard match in Mahjong Soul; Auto plays your turns and Help shows recommendations. " +
			"Matchmaking and in-game tile highlighting are not available here.");
	}
	if (!unity && isUnsupportedUnityClient()) {
		startupError = "This Mahjong Soul page uses Unity WebGL. This version of AlphaJong only supports " +
			"the older JavaScript client and cannot read or play games on this client.";
		run = false;
		decisionEpoch++;
		clearInterval(afkTimer);
		afkTimer = null;
		startButton.textContent = "Start Bot";
		startButton.disabled = true;
		autorunCheckbox.disabled = true;
		roomCombobox.disabled = true;
		showCrtActionMsg("Unsupported game client.");
		showStartupNotice(startupError);
		log(startupError);
		return;
	}

	if (!hasFinishedMainLobbyLoading()) {
		if (Date.now() - startupStartedAt >= 30000) {
			if (hasLegacyClient()) {
				showCrtActionMsg("Waiting for login or lobby.");
				showStartupNotice("Mahjong Soul has not reported a ready lobby. Finish signing in. " +
					"If the lobby is already visible, this client may need a compatibility update. Still checking.");
			} else {
				showCrtActionMsg("Cannot access the game.");
				showStartupNotice("AlphaJong cannot access Mahjong Soul's game data. If the lobby is already open, " +
					"update or reinstall AlphaJong and reload the page. Still checking for the game.");
			}
		} else {
			showCrtActionMsg("Waiting for Mahjong Soul.");
		}
		lobbyLoadTimer = setTimeout(waitForMainLobbyLoad, 2000);
		return;
	}

	startupFinished = true;
	startButton.disabled = false;
	if (!unity) showStartupNotice("");
	refreshRoomSelection();
	if (!unity && AUTORUN && run && afkTimer == null) {
		afkTimer = setInterval(preventAFK, 30000);
	}
	if (isInGame()) { // In case a game is already ongoing after reload
		main();
		return;
	}

	log("Main Lobby loaded!");
	startGame();
	if (run) {
		showCrtActionMsg("Waiting for Game to start.");
		setTimeout(main, 10000);
		log("Main Loop started.");
	} else {
		showCrtActionMsg("Bot is not running.");
	}
}

//Main Loop
function main() {
	if (startupError) {
		return;
	}
	if (!run) {
		showCrtActionMsg("Bot is not running.");
		return;
	}
	var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
	if (unity) {
		var unityStatus = unity.state.getStatus();
		if (!unity.state.isInGame()) {
			showCrtActionMsg(unityStatus.phase === "lobby" ? "Enter a match in Mahjong Soul." : "Waiting for game state.");
			showStartupNotice(unityStatus.phase === "paused" ? unityStatus.reason : "");
			setTimeout(main, 1000);
			return;
		}
		showStartupNotice("");
	}
	if (!isInGame()) {
		checkForEnd();
		showCrtActionMsg("Waiting for Game to start.");
		log("Game is not running, sleep 2 seconds.");
		errorCounter++;
		if (errorCounter > 90 && AUTORUN) { //3 minutes no game found -> reload page
			goToLobby();
		}
		setTimeout(main, 2000); //Check every 2 seconds if ingame
		return;
	}

	if (isDisconnect()) {
		goToLobby();
	}

	var operations = getOperationList(); //Get possible Operations

	if (operations == null || operations.length == 0) {
		errorCounter++;
		if (getTilesLeft() == lastTilesLeft) { //1 minute no tile drawn
			if (errorCounter > 120) {
				goToLobby();
			}
		}
		else {
			lastTilesLeft = getTilesLeft();
			errorCounter = 0;
		}
		clearCrtStrategyMsg();
		showCrtActionMsg("Waiting for own turn.");
		setTimeout(main, 500);

		if (MODE === AIMODE.HELP) {
			oldOps = "";
		}
		return;
	}

	showCrtActionMsg("Calculating best move...");

	setTimeout(mainOwnTurn, 200 + (Math.random() * 200));
}

var oldOps = "";
function recordPlayerOps() {
	oldOps = getDecisionStateKey();
}

function checkPlayerOpChanged() {
	return getDecisionStateKey() !== oldOps;
}

function getDecisionStateKey() {
	return JSON.stringify([
		getRound(), getRoundWind(), getCurrentPlayer(), getTilesLeft(),
		getDora().map(getTileIdentityKey),
		getPlayerHand().map(tile => [getTileIdentityKey(tile.val), tile.valid !== false]),
		getOperationList().map(operation => [operation.type, operation.combination || []]),
		getTileIdentityKey(getTileForCall()),
		Array.from({ length: getNumberOfPlayers() }, (_, player) => {
			var pond = getDiscardsOfPlayer(player);
			return [getPlayerScore(player), isPlayerRiichi(player), getNumberOfTilesInHand(player),
				getNumberOfKitaOfPlayer(player),
				pond.pais.map(tile => getTileIdentityKey(tile.val)),
				getTileIdentityKey(pond.last_pai && pond.last_pai.val),
				getCallsOfPlayer(player).map(tile => [getTileIdentityKey(tile), tile.from, tile.kan])];
		})
	]);
}

function isDecisionCurrent() {
	return run && isInGame() && getOperationList().length > 0 && activeDecisionState != null &&
		!activeDecisionState.actionSent && activeDecisionState.epoch == decisionEpoch &&
		activeDecisionState.mode == MODE && activeDecisionState.key == getDecisionStateKey();
}

async function mainOwnTurn() {
	if (!run || threadIsRunning) {
		return;
	}
	threadIsRunning = true;
	var mainScheduled = false;
	function scheduleMain(delay) {
		mainScheduled = true;
		setTimeout(main, delay);
	}

	try {
		//HELP MODE, if player not operate, just skip
		if (MODE === AIMODE.HELP) {
			if (!checkPlayerOpChanged()) {
				scheduleMain(1000);
				return;
			}
		}

		setData(); //Set current state of the board to local variables
		clearHandAnalysisCache();
		activeDecisionState = { epoch: decisionEpoch, mode: MODE, key: getDecisionStateKey() };

		var operations = getOperationList();

		log("##### OWN TURN #####");
		log("Debug String: " + getDebugString());
		if (getNumberOfPlayers() == 3) {
			log("Right Player Tenpai Chance: " + Number(isPlayerTenpai(1) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(1).toFixed(0)));
			log("Left Player Tenpai Chance: " + Number(isPlayerTenpai(2) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(2).toFixed(0)));
		}
		else {
			log("Shimocha Tenpai Chance: " + Number(isPlayerTenpai(1) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(1).toFixed(0)));
			log("Toimen Tenpai Chance: " + Number(isPlayerTenpai(2) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(2).toFixed(0)));
			log("Kamicha Tenpai Chance: " + Number(isPlayerTenpai(3) * 100).toFixed(1) + "%, Expected Hand Value: " + Number(getExpectedHandValue(3).toFixed(0)));
		}

		determineStrategy(); //Get the Strategy for the current situation. After calls so it does not reset folds

		isConsideringCall = true;
		for (let operation of operations) { //Priority Operations: Should be done before discard on own turn
			if (!isDecisionCurrent()) {
				break;
			}
			switch (operation.type) {
				case getOperations().an_gang: //From Hand
					callAnkan(operation.combination);
					break;
				case getOperations().add_gang: //Add from Hand to Pon
					callShouminkan();
					break;
				case getOperations().zimo:
					callTsumo();
					break;
				case getOperations().rong:
					callRon();
					break;
				case getOperations().babei:
					if (callKita()) {
						scheduleMain(1000);
						return;
					}
					break;
				case getOperations().jiuzhongjiupai:
					callAbortiveDraw();
					break;
			}
		}

		for (let operation of operations) {
			if (!isDecisionCurrent()) {
				break;
			}
			switch (operation.type) {
				case getOperations().dapai:
					isConsideringCall = false;
					await discard();
					break;
				case getOperations().eat:
					await callTriple(operation.combination, getOperations().eat);
					break;
				case getOperations().peng:
					await callTriple(operation.combination, getOperations().peng);
					break;
				case getOperations().ming_gang: //From others
					callDaiminkan();
					break;
			}
		}

		log(" ");

		if (MODE === AIMODE.HELP && isDecisionCurrent()) {
			// An interrupted or failed calculation must be retried for this board.
			recordPlayerOps();
		}

		if (MODE === AIMODE.AUTO) {
			showCrtActionMsg("Own turn completed.");
		}

		if ((getOverallTimeLeft() < 8 && getLastTurnTimeLeft() - getOverallTimeLeft() <= 0) || //Not much overall time left and last turn took longer than the 5 second increment
			(getOverallTimeLeft() < 4 && getLastTurnTimeLeft() - getOverallTimeLeft() <= 1)) {
			timeSave++;
			log("Low performance! Activating time save mode level: " + timeSave);
		}
		if (getOverallTimeLeft() > 15) { //Much time left (new round)
			timeSave = 0;
		}

		scheduleMain(1000);
	}
	catch (error) {
		log("mainOwnTurn failed: " + (error && error.message ? error.message : error));
		if (!mainScheduled) {
			scheduleMain(1000);
		}
	}
	finally {
		activeDecisionState = null;
		isConsideringCall = false;
		threadIsRunning = false;
	}

}

//Set Data from real Game
function setData(mainUpdate = true) {

	dora = getDora();

	ownHand = [];
	for (let tile of getPlayerHand()) { //Get own Hand
		ownHand.push(tile.val);
		ownHand[ownHand.length - 1].valid = tile.valid; //Is valid discard
	}

	if (MARK_TSUMOGIRI && !(typeof getUnityClient === "function" && getUnityClient())) {
		for (var j = 1; j < getNumberOfPlayers(); j++) {
			if (getDiscardsOfPlayer(j).last_pai != null && getDiscardsOfPlayer(j).last_pai.val.tsumogiri) {
				getDiscardsOfPlayer(j).last_pai.GetDefaultColor = function () { return new Laya.Vector4(0.85, 0.85, 0.85, 1); }
				getDiscardsOfPlayer(j).last_pai.ResetShow();
			}
		}
	}

	discards = [];
	for (var j = 0; j < getNumberOfPlayers(); j++) { //Get Discards for all Players
		var temp_discards = [];
		for (var i = 0; i < getDiscardsOfPlayer(j).pais.length; i++) {
			temp_discards.push(getDiscardsOfPlayer(j).pais[i].val);
		}
		if (getDiscardsOfPlayer(j).last_pai != null) {
			temp_discards.push(getDiscardsOfPlayer(j).last_pai.val);
		}
		discards.push(temp_discards);
	}
	if (mainUpdate) {
		updateDiscardedTilesSafety();
	}

	calls = [];
	for (var j = 0; j < getNumberOfPlayers(); j++) { //Get Calls for all Players
		calls.push(getCallsOfPlayer(j));
	}

	isClosed = true;
	for (let tile of calls[0]) { //Is hand closed? Also consider closed Kans
		if (tile.from != localPosition2Seat(0)) {
			isClosed = false;
			break;
		}
	}
	if (tilesLeft < getTilesLeft()) { //Check if new round/reload
		decisionEpoch++;
		setAutoCallWin(run && MODE === AIMODE.AUTO);
		strategy = STRATEGIES.GENERAL;
		strategyAllowsCalls = true;
		initialDiscardedTilesSafety();
		riichiTiles = [null, null, null, null];
		playerDiscardSafetyList = [[], [], [], []];
		var unity = typeof getUnityClient === "function" ? getUnityClient() : null;
		if (unity) {
			for (var event of unity.state.getDiscardEvents()) {
				if (event.player === 0) continue;
				playerDiscardSafetyList[event.player].push(-1);
				if (event.riichi) riichiTiles[event.player] = event.tile;
			}
		}
		extendMJSoulFunctions();
	}

	tilesLeft = getTilesLeft();

	if (!isDebug()) {
		seatWind = getSeatWind(0);
		roundWind = getRoundWind();
	}

	updateAvailableTiles();
}

//Search for Game
function startGame() {
	if (typeof getUnityClient === "function" && getUnityClient()) {
		if (run) showCrtActionMsg("Enter a match in Mahjong Soul.");
		return;
	}
	if (!isInGame() && run && AUTORUN) {
		log("Searching for Game in Room " + ROOM);
		showCrtActionMsg("Searching for Game...");
		searchForGame();
	}
}

//Check if End Screen is shown
function checkForEnd() {
	if (typeof getUnityClient === "function" && getUnityClient()) return;
	if (isEndscreenShown() && AUTORUN) {
		run = false;
		setTimeout(goToLobby, 25000);
	}
}

//Reload Page to get back to lobby
function goToLobby() {
	location.reload(1);
}
