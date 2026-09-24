import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { statistics } from "../benchmark_engine.mjs";
import { curatedFixtures, materializeFixture, randomFixtures } from "./fixtures.mjs";

const runNode = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const benchmark = path.join(repositoryRoot, "test/benchmark_engine.mjs");

test("benchmark reports nearest-rank percentiles and excludes empty samples", () => {
	assert.deepEqual(statistics([40, 10, 30, 20]), { count: 4, min: 10, mean: 25, p50: 20, p95: 40, max: 40 });
	assert.deepEqual(statistics([]), { count: 0, min: null, mean: null, p50: null, p95: null, max: null });
	const values = Array.from({ length: 100 }, (_, index) => index + 1);
	assert.equal(statistics(values).p95, 95);
	assert.equal(statistics(values).p50, 50);
});

test("seeded corpus is reproducible, differs across seeds, and respects physical copy limits", () => {
	assert.deepEqual(randomFixtures(12345, 20), randomFixtures(12345, 20));
	assert.notDeepEqual(randomFixtures(12345, 20), randomFixtures(12346, 20));
	for (const seed of [0, 1, 20260923, 0xffffffff]) {
		for (const fixture of randomFixtures(seed, 256)) {
			const state = materializeFixture(fixture);
			assert.equal(state.ownHand.length + 3 * (fixture.melds?.[0]?.length ?? 0), 14);
			assert.ok(state.discards[state.players - 1].length > 0);
			assert.equal(state.discards[3].length === 0, state.players === 3);
		}
	}
	for (const fixture of curatedFixtures) materializeFixture(fixture);
	assert.throws(() => materializeFixture({ id: "invalid-copy", hand: "11111m123p456s77z" }), /fifth visible copy/);
	assert.throws(() => materializeFixture({ id: "invalid-sanma", hand: "123m456p789s11122z", players: 3 }), /unavailable sanma/);
});

test("CLI separates warmups, saves all measured outputs and compares matching reports", async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), "alphajong-benchmark-test-"));
	const baseline = path.join(directory, "baseline.json");
	const current = path.join(directory, "current.json");
	const args = [benchmark, "--fixture", "kokushi", "--random-cases", "0", "--iterations", "2", "--warmup", "1",
		"--modes", "0,3,4", "--timers", "immediate"];
	try {
		await runNode(process.execPath, [...args, "--output", baseline], { cwd: repositoryRoot });
		await runNode(process.execPath, [...args, "--baseline", baseline, "--output", current], { cwd: repositoryRoot });
		const report = JSON.parse(await readFile(current, "utf8"));
		assert.equal(report.corpus.count, 2, "yonma and sanma kokushi states are both measured");
		assert.equal(report.current.checks.rows, 20);
		assert.equal(report.current.checks.measuredSamples, 40, "warmups are excluded from sample counts");
		assert.equal(report.current.checks.failed, 0);
		assert.equal(report.comparison.matchedRows, 20);
		assert.equal(report.comparison.changedOutputs, 0);
		assert.equal(report.comparison.changedDiscards.length, 0);
		assert.ok(report.current.provenance.files.length >= 8);
		for (const row of report.current.rows) {
			assert.equal(row.samples.length, 2);
			assert.equal(row.fingerprints.length, 1);
			assert.equal(row.outputs.length, 1);
			assert.equal(row.errors.length, 0);
			if (row.workload === "discard") assert.equal(row.outputs[0].tile, "5p");
		}
		await assert.rejects(runNode(process.execPath, [...args, "--iterations", "3", "--baseline", baseline], { cwd: repositoryRoot }),
			/Baseline iterations differs/);
		await assert.rejects(runNode(process.execPath, [...args, "--modes", "0,4", "--baseline", baseline], { cwd: repositoryRoot }),
			/Baseline modes differs/);
		await assert.rejects(runNode(process.execPath, [...args, "--timers", "real", "--baseline", baseline], { cwd: repositoryRoot }),
			/Baseline timers differs/);
	} finally {
		for (const file of [baseline, current]) await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
		await rmdir(directory);
	}
});
