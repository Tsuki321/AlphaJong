#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { curatedFixtures, randomFixtures, materializeFixture, seededRandom } from "./benchmark/fixtures.mjs";
import { createRuntime, digest } from "./benchmark/runtime.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const usage = `Source-only deterministic AlphaJong benchmark (no local build).
  node test/benchmark_engine.mjs [options]
  --source-root DIR       Root with src/ and test/test_api.js (default: repository)
  --baseline DIR|JSON     Run preserved sources first, or compare a previous report
  --output FILE          Save timings, outputs, fingerprints, checks and provenance
  --iterations N         Measured repetitions per fixture/cache/mode (default: 3)
  --warmup N             Unmeasured repetitions per row (default: 1)
  --random-cases N       Seeded legal states in addition to 15 fixtures (default: 4)
  --seed N               Unsigned 32-bit corpus/order seed (default: 20260923)
  --modes 0,3,4          Discard performance modes (default: 0,3,4)
  --workloads LIST       exact-shanten,exact-draw,discard (default: all)
  --cache-states LIST    cold,warm (default: both)
  --fixture TEXT         Only fixture IDs containing TEXT
  --timers real|immediate  Preserve 10ms engine yields or use setImmediate (default: real)
  --help                 Print this message

Cold means analysis caches are cleared before each sample; cache clearing and
fixture setup are outside timings. Warm means one priming operation and cache
reuse across identical-state repetitions. Defense state resets with each fixture.
Decision timings await determineStrategy() and the complete discard() pipeline,
using the test API: riichi/network/UI actions are not measured. computeMs removes
the observed scheduled timer wait; it is not an OS CPU-time measurement. These
measurements and legal-state checks do not estimate win rate or playing strength.
`;

function options(argv) {
	const result = { sourceRoot: repositoryRoot, iterations: 3, warmup: 1, randomCases: 4, seed: 20260923,
		modes: [0, 3, 4], workloads: ["exact-shanten", "exact-draw", "discard"], cacheStates: ["cold", "warm"], timers: "real" };
	const names = { "--source-root": "sourceRoot", "--baseline": "baseline", "--output": "output", "--iterations": "iterations",
		"--warmup": "warmup", "--random-cases": "randomCases", "--seed": "seed", "--modes": "modes", "--workloads": "workloads",
		"--cache-states": "cacheStates", "--fixture": "fixture", "--timers": "timers" };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--help") { process.stdout.write(usage); process.exit(0); }
		if (!names[argv[i]] || argv[i + 1] === undefined) throw new Error(`Unknown or missing option: ${argv[i]}\n${usage}`);
		result[names[argv[i]]] = argv[++i];
	}
	for (const key of ["iterations", "warmup", "randomCases", "seed"]) {
		result[key] = Number(result[key]);
		if (!Number.isSafeInteger(result[key]) || result[key] < (key === "iterations" ? 1 : 0)) throw new Error(`Invalid ${key}`);
	}
	if (result.seed > 0xffffffff) throw new Error("Seed must be an unsigned 32-bit integer");
	for (const key of ["modes", "workloads", "cacheStates"]) if (typeof result[key] === "string") result[key] = result[key].split(",");
	result.modes = result.modes.map(Number);
	for (const [key, allowed] of [["modes", [0, 1, 2, 3, 4]], ["workloads", ["exact-shanten", "exact-draw", "discard"]], ["cacheStates", ["cold", "warm"]]]) {
		if (!result[key].length || result[key].some(value => !allowed.includes(value)) || new Set(result[key]).size !== result[key].length) throw new Error(`Invalid ${key}`);
	}
	if (!["real", "immediate"].includes(result.timers)) throw new Error("Invalid timers");
	return result;
}

export function statistics(values) {
	if (!values.length) return { count: 0, min: null, mean: null, p50: null, p95: null, max: null };
	const sorted = values.slice().sort((a, b) => a - b);
	const quantile = q => sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)];
	return { count: sorted.length, min: sorted[0], mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
		p50: quantile(0.5), p95: quantile(0.95), max: sorted.at(-1) };
}

function summarize(rows) {
	const groups = new Map();
	for (const row of rows) {
		const key = `${row.workload}/${row.cache}/${row.mode ?? "independent"}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(row);
	}
	return [...groups].map(([key, entries]) => ({ key, fixtures: entries.length,
		wallMs: statistics(entries.flatMap(row => row.samples.map(sample => sample.wallMs))),
		computeMs: statistics(entries.flatMap(row => row.samples.map(sample => sample.computeMs))),
		failedChecks: entries.reduce((sum, row) => sum + row.errors.length, 0),
		unstableOutputs: entries.filter(row => row.fingerprints.length > 1).length }));
}

async function run(sourceRoot, config, fixtures, label) {
	const started = performance.now();
	const runtime = await createRuntime(sourceRoot, config);
	const jobs = [];
	for (const fixture of fixtures) for (const workload of config.workloads) for (const cache of config.cacheStates)
		for (const mode of workload === "discard" ? config.modes : [null]) jobs.push({ fixture, workload, cache, mode });
	const random = seededRandom(config.seed ^ 0x414a424d);
	for (let i = jobs.length - 1; i > 0; i--) { const j = random(i + 1); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
	const rows = [];
	for (const [jobIndex, job] of jobs.entries()) {
		const { fixture, workload, cache, mode } = job;
		const row = { key: `${fixture.id}/${workload}/${cache}/${mode ?? "independent"}`, fixture: fixture.id, tags: fixture.tags,
			workload, cache, mode, samples: [], outputs: [], fingerprints: [], errors: [] };
		rows.push(row);
		process.stderr.write(`[${label} ${jobIndex + 1}/${jobs.length}] ${row.key}\n`);
		const seen = new Set();
		try {
			runtime.setup(fixture, mode ?? 4, true);
			// Prime a warm cache even when --warmup 0 is requested.
			const warmups = Math.max(config.warmup, cache === "warm" ? 1 : 0);
			for (let iteration = 0; iteration < warmups + config.iterations; iteration++) {
				runtime.setup(fixture, mode ?? 4, cache === "cold");
				const sample = await runtime.sample(workload, fixture);
				for (const error of sample.errors) if (!row.errors.includes(error)) row.errors.push(error);
				if (iteration < warmups) continue;
				if (!seen.has(sample.fingerprint)) { row.outputs.push(sample.output); seen.add(sample.fingerprint); }
				const { output, errors, ...timing } = sample;
				row.samples.push(timing);
			}
			row.fingerprints = [...seen];
			if (seen.size > 1) row.errors.push("Identical fixture produced different outputs across measured repetitions");
		} catch (error) { row.errors.push(error.stack ?? String(error)); }
		row.wallMs = statistics(row.samples.map(sample => sample.wallMs));
		row.computeMs = statistics(row.samples.map(sample => sample.computeMs));
	}
	// Cache order must not alter decisions or exact structural results.
	const peers = new Map();
	for (const row of rows) {
		const key = `${row.fixture}/${row.workload}/${row.mode ?? "independent"}`;
		if (!peers.has(key)) peers.set(key, []);
		peers.get(key).push(row);
	}
	for (const entries of peers.values()) {
		const fingerprints = new Set(entries.flatMap(row => row.fingerprints));
		if (fingerprints.size > 1) for (const row of entries) row.errors.push("Cold and warm caches produced different outputs");
	}
	return { label, provenance: runtime.provenance, elapsedMs: performance.now() - started, rows,
		fingerprint: digest(rows.slice().sort((a, b) => a.key.localeCompare(b.key)).map(row => [row.key, row.fingerprints])),
		summary: summarize(rows), checks: { rows: rows.length, measuredSamples: rows.reduce((sum, row) => sum + row.samples.length, 0),
			failed: rows.reduce((sum, row) => sum + row.errors.length, 0),
			description: "Physical fixture legality, finite metrics, draw probability bounds/count sums, immutable exact/ranking state, legal distinct candidates, exactly one discarded tile, other live state unchanged, deterministic repeated and cold/warm outputs." } };
}

function comparison(baseline, current) {
	const oldRows = new Map(baseline.rows.map(row => [row.key, row]));
	const rows = current.rows.filter(row => oldRows.has(row.key)).map(row => {
		const previous = oldRows.get(row.key);
		return { key: row.key, outputsEqual: JSON.stringify(previous.fingerprints) === JSON.stringify(row.fingerprints),
			baselineTile: previous.outputs[0]?.tile, currentTile: row.outputs[0]?.tile,
			wallMeanRatio: previous.wallMs.mean > 0 && row.wallMs.mean != null ? row.wallMs.mean / previous.wallMs.mean : null,
			computeMeanRatio: previous.computeMs.mean > 0 && row.computeMs.mean != null ? row.computeMs.mean / previous.computeMs.mean : null };
	});
	const changed = rows.filter(row => !row.outputsEqual);
	const ratio = rows.map(row => row.computeMeanRatio).filter(value => value > 0 && Number.isFinite(value));
	const previousSummaries = new Map(baseline.summary.map(summary => [summary.key, summary]));
	const summary = current.summary.filter(entry => previousSummaries.has(entry.key)).map(entry => {
		const previous = previousSummaries.get(entry.key);
		return { key: entry.key, baselineWallMs: previous.wallMs, currentWallMs: entry.wallMs,
			baselineComputeMs: previous.computeMs, currentComputeMs: entry.computeMs,
			wallMeanRatio: previous.wallMs.mean > 0 ? entry.wallMs.mean / previous.wallMs.mean : null,
			computeMeanRatio: previous.computeMs.mean > 0 ? entry.computeMs.mean / previous.computeMs.mean : null };
	});
	return { rows, summary, matchedRows: rows.length, changedOutputs: changed.length,
		baselineFailedChecks: baseline.checks.failed, currentFailedChecks: current.checks.failed,
		changedDiscards: changed.filter(row => row.baselineTile && row.currentTile && row.baselineTile !== row.currentTile),
		geometricMeanComputeRatio: ratio.length ? Math.exp(ratio.reduce((sum, value) => sum + Math.log(value), 0) / ratio.length) : null,
		note: "Ratios are current/baseline (lower is faster). Inspect changed decision outputs; timing/fingerprint changes alone are not evidence of better play." };
}

async function main() {
	const config = options(process.argv.slice(2));
	const fixtures = [...curatedFixtures, ...randomFixtures(config.seed, config.randomCases)].filter(fixture => !config.fixture || fixture.id.includes(config.fixture));
	if (!fixtures.length) throw new Error("Fixture filter matched no cases");
	for (const fixture of fixtures) materializeFixture(fixture);
	const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), config,
		machine: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
			osRelease: os.release(), cpuModel: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem() },
		corpus: { count: fixtures.length, sha256: digest(fixtures), fixtures },
		methodology: { timers: config.timers, sourceOnly: true, percentile: "nearest-rank", timingUnit: "milliseconds",
			computeMs: "wall latency less observed time waiting for scheduled yield callbacks; not OS CPU time",
			cacheStates: "Cold clears hand-analysis caches before every operation. Warm primes and reuses identical hand-analysis state; defense cache resets on fixture setup.",
			excluded: ["fixture setup", "cache clearing", "invariant assertions", "GUI/log rendering", "live riichi operations", "network actions"],
			limitations: "A deterministic public-state decision corpus, not self-play, a win-rate estimate, or a full browser timing model." } };
	const harnessFiles = ["benchmark_engine.mjs", "benchmark/runtime.mjs", "benchmark/fixtures.mjs"];
	report.harness = { sha256: digest(await Promise.all(harnessFiles.map(async file => [file, digest(await readFile(new URL(file, import.meta.url), "utf8"))]))) };
	let baseline;
	if (config.baseline) {
		if (config.baseline.toLowerCase().endsWith(".json")) {
			const loaded = JSON.parse(await readFile(config.baseline, "utf8"));
			if (loaded.schemaVersion !== report.schemaVersion || loaded.corpus.sha256 !== report.corpus.sha256) throw new Error("Baseline report schema or fixture corpus differs");
			for (const key of ["timers", "iterations", "warmup", "randomCases", "seed", "modes", "workloads", "cacheStates", "fixture"])
				if (JSON.stringify(loaded.config[key] ?? null) !== JSON.stringify(config[key] ?? null)) throw new Error(`Baseline ${key} differs`);
			if (loaded.harness?.sha256 !== report.harness.sha256) throw new Error("Baseline harness differs; rerun baseline with this harness version");
			baseline = loaded.current;
			report.baselineReport = { path: path.resolve(config.baseline), generatedAt: loaded.generatedAt, machine: loaded.machine, config: loaded.config, harness: loaded.harness };
		} else baseline = await run(config.baseline, config, fixtures, "baseline");
		report.baseline = baseline;
	}
	report.current = await run(config.sourceRoot, config, fixtures, "current");
	if (baseline) report.comparison = comparison(baseline, report.current);
	if (config.output) {
		await mkdir(path.dirname(path.resolve(config.output)), { recursive: true });
		await writeFile(config.output, `${JSON.stringify(report, null, 2)}\n`);
	}
	process.stdout.write(`${JSON.stringify({ output: config.output, sourceHash: report.current.provenance.sourceHash,
		corpus: report.corpus.count, checks: report.current.checks, summary: report.current.summary,
		comparison: report.comparison && { matchedRows: report.comparison.matchedRows, changedOutputs: report.comparison.changedOutputs,
			changedDiscards: report.comparison.changedDiscards, geometricMeanComputeRatio: report.comparison.geometricMeanComputeRatio } }, null, 2)}\n`);
	if (report.current.checks.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
