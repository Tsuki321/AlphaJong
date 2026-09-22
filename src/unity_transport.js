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
