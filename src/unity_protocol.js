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
