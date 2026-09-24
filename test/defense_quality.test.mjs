import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const paths = ["src/parameters.js", "test/test_api.js", "src/ai_defense.js", "src/utils.js",
	"src/hand_analysis.js", "src/logging.js", "test/test_utils.js", "test/test_defense_quality.js"];
const sources = await Promise.all(paths.map(path => readFile(new URL("../" + path, import.meta.url), "utf8")));

test("defense perspective, called-discard safety and board immutability regressions", () => {
	let assertions = 0;
	const context = vm.createContext({
		window: { localStorage: { getItem: () => null } },
		console,
		assertEqual(actual, expected, message) { assertions++; assert.equal(actual, expected, message); },
		assertTrue(value, message) { assertions++; assert.ok(value, message); },
		assertGreaterThan(actual, threshold, message) { assertions++; assert.ok(actual > threshold, message); },
		assertApprox(actual, expected, epsilon, message) {
			assertions++;
			assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon,
				`${message}: expected ${expected}, got ${actual}`);
		}
	});
	for (let index = 0; index < paths.length; index++) vm.runInContext(sources[index], context, { filename: paths[index] });
	vm.runInContext(`
		var testPlayerRiichi = [0, 0, 0, 0];
		var testPlayerHand = [13, 13, 13, 13];
		var testCallTile = {};
		function baselinePredictionState() {
			resetGlobals();
			dora = [];
			updateAvailableTiles();
		}
		runDefenseQualityRegressionTests();
	`, context);
	assert.equal(assertions, 50, "the shared browser regression suite must run all defense assertions");
});
