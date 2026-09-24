import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { materializeFixture, tileName, analysisExpectations } from "./fixtures.mjs";

export const engineFiles = ["src/parameters.js", "test/test_api.js", "src/ai_offense.js", "src/ai_defense.js",
	"src/utils.js", "src/hand_analysis.js", "src/yaku.js", "src/logging.js"];

export function digest(value) { return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex"); }

function finiteTree(value, location = "result") {
	if (typeof value === "number") assert.ok(Number.isFinite(value), `${location} must be finite: ${value}`);
	else if (Array.isArray(value)) value.forEach((entry, index) => finiteTree(entry, `${location}[${index}]`));
	else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) finiteTree(entry, `${location}.${key}`);
}

function firstStateChange(before, after, location = "state") {
	if (Object.is(before, after)) return null;
	if (!before || !after || typeof before !== "object" || typeof after !== "object") return { path: location, before, after };
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const difference = firstStateChange(before[key], after[key], `${location}.${key}`);
		if (difference) return difference;
	}
	return null;
}

// Source is evaluated directly in an isolated lexical scope. This does not run
// build.py, concatenate a userscript artifact, or start the production client.
// Debug mode uses the repository's test API and disables live riichi/network UI.
export async function createRuntime(sourceRoot, { timers = "real" } = {}) {
	const files = await Promise.all(engineFiles.map(async file => ({ file, source: await readFile(path.join(sourceRoot, file), "utf8") })));
	const metrics = { timerCount: 0, timerRequestedMs: 0, timerWaitMs: 0 };
	const timer = (callback, milliseconds, ...args) => {
		const started = performance.now();
		metrics.timerCount++;
		metrics.timerRequestedMs += Number(milliseconds) || 0;
		const invoke = () => { metrics.timerWaitMs += performance.now() - started; callback(...args); };
		return timers === "real" ? setTimeout(invoke, milliseconds) : setImmediate(invoke);
	};
	const makeEngine = new Function("window", "document", "performance", "setTimeout", "clearTimeout", `
		var DEBUG = true;
		var testExcludedSeats = [], testPlayerHand = [13, 13, 13, 13], testPlayerRiichi = [0, 0, 0, 0];
		${files.map(entry => `${entry.source}\n`).join("\n")}
		log = function () {};
		printHand = function () {};
		printTilePriority = function () {};
		var capturedPriorities;
		var rankingStateBefore, rankingStateAfter;
		var originalPriorities = getTilePriorities;
		function state() {
			return { ownHand, calls, discards, dora, availableTiles, visibleTiles, seatWind, roundWind, tilesLeft,
				isClosed, strategy, strategyAllowsCalls, testPlayerRiichi, riichiTiles, testExcludedSeats, testPlayerHand };
		}
		getTilePriorities = async function (hand) {
			rankingStateBefore = JSON.stringify(state());
			var result = await originalPriorities(hand);
			rankingStateAfter = JSON.stringify(state());
			capturedPriorities = result;
			return result;
		};
		return {
			setup: function (input, mode, clearCaches) {
				if (clearCaches) clearHandAnalysisCache();
				invalidateDefenseRuntimeCache();
				ownHand = input.ownHand; calls = input.calls; discards = input.discards; dora = input.dora;
				seatWind = input.seatWind; roundWind = input.roundWind; tilesLeft = input.tilesLeft;
				isClosed = input.isClosed; strategy = STRATEGIES.GENERAL; strategyAllowsCalls = true;
				PERFORMANCE_MODE = mode; timeSave = 0; EFFICIENCY = 1; SAFETY = 1; SAKIGIRI = 1;
				KEEP_SAFETILE = false; isConsideringCall = false;
				playerDiscardSafetyList = [[], [], [], []]; totalPossibleWaits = {};
				testExcludedSeats = input.players === 3 ? [3] : [];
				testPlayerHand = calls.map(melds => 13 - getMeldCount(melds) * 3);
				testPlayerRiichi = input.riichi; riichiTiles = input.riichiTiles;
				helpHintContext = { shanten: 8, strategy: STRATEGIES.GENERAL };
				runtimeProfiling.discardDurationsMs = [];
				capturedPriorities = null; rankingStateBefore = null; rankingStateAfter = null;
				initialDiscardedTilesSafety(); updateAvailableTiles();
			},
			clear: clearHandAnalysisCache,
			state,
			analyze: function (kind, handStrategy) {
				var hand = ownHand.slice(0, -1), discarded = ownHand[ownHand.length - 1];
				if (kind === "exact-draw") return getImprovingTileAnalysis(hand, discarded, handStrategy);
				if (handStrategy === STRATEGIES.CHIITOITSU) return getSevenPairsShanten(hand);
				if (handStrategy === STRATEGIES.THIRTEEN_ORPHANS) return getThirteenOrphansShanten(hand);
				return getStandardShanten(hand);
			},
			decide: async function () {
				determineStrategy();
				var tile = await discard();
				return { tile, strategy, priorities: capturedPriorities, hint: helpHintContext,
					rankingStateUnchanged: rankingStateBefore === rankingStateAfter,
					rankingStateBefore, rankingStateAfter };
			}
		};
	`);
	const engine = makeEngine({ localStorage: { getItem: () => null } }, { body: { innerHTML: "" } }, performance, timer,
		timers === "real" ? clearTimeout : clearImmediate);
	function resetMetrics() { metrics.timerCount = 0; metrics.timerRequestedMs = 0; metrics.timerWaitMs = 0; }
	function setup(fixture, mode, clearCaches = true) { engine.setup(materializeFixture(fixture), mode, clearCaches); resetMetrics(); }
	function inspectAnalysis(result, fixture, before) {
		finiteTree(result);
		assert.equal(JSON.stringify(engine.state()), before, `${fixture.id}: exact analysis mutated source state`);
		const expected = analysisExpectations[fixture.id];
		if (typeof result !== "object") {
			if (expected) assert.equal(result, expected.shanten, `${fixture.id}: incorrect exact shanten`);
			return result;
		}
		assert.ok(result.shanten >= -1 && result.shanten <= 13, `${fixture.id}: invalid shanten`);
		assert.ok(result.ukeire >= 0 && Number.isInteger(result.ukeire), `${fixture.id}: invalid ukeire`);
		assert.ok(result.improvementChance >= 0 && result.improvementChance <= 1, `${fixture.id}: invalid draw probability`);
		assert.ok(result.improvementChanceTwoDraws >= result.improvementChance && result.improvementChanceTwoDraws <= 1,
			`${fixture.id}: invalid two-draw probability`);
		assert.equal(result.ukeire, result.improvingTiles.reduce((sum, entry) => sum + entry.count, 0), `${fixture.id}: inconsistent ukeire`);
		for (const entry of result.improvingTiles) assert.ok(entry.count > 0 && entry.count <= 4, `${fixture.id}: invalid improving count`);
		if (expected) assert.deepEqual({ shanten: result.shanten, ukeire: result.ukeire,
			structuralWaits: result.structuralWaits.map(tileName), furiten: result.furiten }, expected,
			`${fixture.id}: incorrect exact waits/counts/furiten`);
		return { shanten: result.shanten, ukeire: result.ukeire, furiten: result.furiten,
			improvementChance: result.improvementChance, improvementChanceTwoDraws: result.improvementChanceTwoDraws,
			structuralWaits: result.structuralWaits.map(tileName),
			improvingTiles: result.improvingTiles.map(entry => ({ tile: tileName(entry.tile), count: entry.count })) };
	}
	function inspectDecision(result, fixture, before, errors) {
		const check = callback => { try { callback(); } catch (error) { errors.push(error.message ?? String(error)); } };
		assert.ok(result.tile, `${fixture.id}: no tile selected`);
		if (!result.rankingStateUnchanged) {
			const initial = JSON.parse(result.rankingStateBefore), final = JSON.parse(result.rankingStateAfter);
			errors.push(`${fixture.id}: ranking mutated source state: ${JSON.stringify(firstStateChange(initial, final))}`);
		}
		check(() => finiteTree(result.priorities));
		const state = engine.state();
		const selected = tileName(result.tile);
		check(() => assert.ok(before.ownHand.some(tile => tile.valid !== false && tileName(tile) === selected), `${fixture.id}: illegal discard ${selected}`));
		assert.ok(result.priorities.length > 0, `${fixture.id}: empty priority list`);
		check(() => assert.equal(new Set(result.priorities.map(candidate => tileName(candidate.tile))).size, result.priorities.length, `${fixture.id}: duplicate discard candidates`));
		for (const candidate of result.priorities) check(() => assert.ok(before.ownHand.some(tile => tile.valid !== false && tileName(tile) === tileName(candidate.tile)), `${fixture.id}: illegal candidate`));
		check(() => assert.equal(state.ownHand.length, before.ownHand.length - 1, `${fixture.id}: discard did not remove exactly one tile`));
		check(() => assert.equal(state.discards[0].length, before.discards[0].length + 1, `${fixture.id}: discard pond did not grow once`));
		check(() => assert.equal(tileName(state.discards[0].at(-1)), selected, `${fixture.id}: returned tile differs from discarded tile`));
		const expectedHand = before.ownHand.slice();
		const removed = expectedHand.map(tileName).lastIndexOf(selected);
		expectedHand.splice(removed, 1);
		check(() => assert.deepEqual(state.ownHand, expectedHand, `${fixture.id}: remaining tiles changed`));
		for (const key of ["calls", "dora", "seatWind", "roundWind", "tilesLeft", "isClosed", "riichiTiles", "testPlayerRiichi", "testExcludedSeats", "testPlayerHand"])
			check(() => assert.ok(JSON.stringify(state[key]) === JSON.stringify(before[key]), `${fixture.id}: decision mutated ${key}`));
		check(() => assert.deepEqual(state.discards.slice(1), before.discards.slice(1), `${fixture.id}: decision mutated opponent discards`));
		check(() => assert.deepEqual(state.discards[0].slice(0, -1), before.discards[0], `${fixture.id}: decision mutated earlier own discards`));
		const candidates = result.priorities.map(candidate => ({ tile: tileName(candidate.tile), shanten: candidate.shanten,
			ukeire: candidate.ukeire, furiten: candidate.furiten, priority: candidate.priority, riichiPriority: candidate.riichiPriority,
			efficiency: candidate.efficiency, danger: candidate.danger, waits: candidate.waits, score: candidate.score,
			yaku: candidate.yaku, safe: candidate.safe, fu: candidate.fu, dora: candidate.dora,
			improvementChance: candidate.improvementChance, improvementChanceTwoDraws: candidate.improvementChanceTwoDraws }));
		const preferred = { "kokushi": ["5p"], "sanma-kokushi": ["5p"], "two-riichi-defense": ["9m"] }[fixture.id];
		if (preferred) check(() => assert.ok(preferred.includes(selected), `${fixture.id}: expected ${preferred}, got ${selected}`));
		return { tile: selected, strategy: result.strategy, selected: candidates.find(candidate => candidate.tile === selected), candidates };
	}
	return {
		provenance: { sourceRoot: path.resolve(sourceRoot), sourceHash: digest(files.map(entry => [entry.file, digest(entry.source)])),
			files: files.map(entry => ({ path: entry.file, sha256: digest(entry.source) })) },
		setup,
		clear: engine.clear,
		// The profiling driver uses this path to remove report serialization and
		// invariant assertions from sampled CPU stacks. Normal benchmarks always
		// use sample(), which checks both state and the complete candidate list.
		profileDecision: engine.decide,
		async sample(kind, fixture) {
			const before = JSON.parse(JSON.stringify(engine.state()));
			const beforeText = JSON.stringify(before);
			resetMetrics();
			const started = performance.now();
			const result = kind === "discard" ? await engine.decide() : engine.analyze(kind, fixture.analysisStrategy ?? "General");
			const wallMs = performance.now() - started;
			const timing = { wallMs, computeMs: Math.max(0, wallMs - metrics.timerWaitMs), ...metrics };
			const errors = [];
			let output;
			try { output = kind === "discard" ? inspectDecision(result, fixture, before, errors) : inspectAnalysis(result, fixture, beforeText); }
			catch (error) { errors.push(error.message ?? String(error)); }
			return { ...timing, output: output ?? null, fingerprint: digest(output ?? null), errors };
		}
	};
}
