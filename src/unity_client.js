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
				return riichi != null && riichi.combination.some(option => option.split("|")[0] === payload.tile);
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
