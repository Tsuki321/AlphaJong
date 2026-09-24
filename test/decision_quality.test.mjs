import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function fixture() {
	const context = vm.createContext({
		window: { localStorage: { getItem: () => null } },
		document: { body: { innerHTML: "" } },
		console, performance, setTimeout, clearTimeout,
		DEBUG: true,
		testCallTile: {}, testPlayerRiichi: [0, 0, 0, 0], testPlayerHand: [13, 13, 13, 13],
		assertEqual: (actual, expected, message) => assert.equal(actual, expected, message),
		assertTrue: (actual, message) => assert.ok(actual, message),
		assertGreaterThan: (actual, expected, message) => assert.ok(actual > expected, message),
		assertApprox: (actual, expected, tolerance, message) => {
			assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
				`${message}: expected ${expected}, got ${actual}`);
		}
	});
	for (const path of ["src/parameters.js", "test/test_api.js", "src/ai_offense.js", "src/ai_defense.js",
		"src/utils.js", "src/hand_analysis.js", "src/yaku.js", "src/logging.js", "test/test_utils.js",
		"test/test_decision_quality.js"]) {
		vm.runInContext(await readFile(new URL(`../${path}`, import.meta.url), "utf8"), context, { filename: path });
	}
	vm.runInContext(`
		function baselinePredictionState() {
			resetGlobals(); dora = []; updateAvailableTiles(); invalidateDefenseRuntimeCache();
		}
		log = function () {};
	`, context);
	return context;
}

test("kuikae restrictions match an independent sequence replacement oracle", async () => {
	(await fixture()).runKuikaeRuleRegressionTests();
});

test("sanankou distinguishes ron, self draw, ambiguous winning groups, and kans", async () => {
	(await fixture()).runConcealedTripletRegressionTests();
});

test("call simulation evaluates permitted discards and preserves live state", async () => {
	await (await fixture()).runLegalCallDiscardRegressionTest();
});

test("sanankou-only shanpon keeps self-draw potential without fake ron waits in every mode", async () => {
	(await fixture()).runTsumoOnlyWaitRegressionTest();
});
