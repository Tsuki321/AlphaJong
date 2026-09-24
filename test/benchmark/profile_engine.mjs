#!/usr/bin/env node
// Focused V8 CPU profile, without a build step. Example from repository root:
// node --cpu-prof --cpu-prof-dir=test-results test/benchmark/profile_engine.mjs \
//   --source-root test-results/optimization-2026-09-23/baseline --fixture closed-balanced --iterations 100 --mode 4
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntime } from "./runtime.mjs";
import { curatedFixtures, randomFixtures } from "./fixtures.mjs";

const config = { sourceRoot: fileURLToPath(new URL("../../", import.meta.url)), fixture: "closed-balanced", iterations: 100, mode: 4, cache: "cold", seed: 20260923 };
const names = { "--source-root": "sourceRoot", "--fixture": "fixture", "--iterations": "iterations", "--mode": "mode", "--cache": "cache", "--seed": "seed" };
for (let i = 2; i < process.argv.length; i++) {
	const key = names[process.argv[i]];
	if (!key || process.argv[i + 1] === undefined) throw new Error(`Unknown or missing option: ${process.argv[i]}`);
	config[key] = process.argv[++i];
}
for (const key of ["iterations", "mode", "seed"]) config[key] = Number(config[key]);
if (!Number.isSafeInteger(config.iterations) || config.iterations < 1 || ![0, 1, 2, 3, 4].includes(config.mode) ||
	!Number.isSafeInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff || !["cold", "warm"].includes(config.cache)) throw new Error("Invalid profiler configuration");
const fixture = [...curatedFixtures, ...randomFixtures(config.seed, 12)].find(entry => entry.id === config.fixture);
if (!fixture) throw new Error(`Unknown fixture: ${config.fixture}`);
const runtime = await createRuntime(path.resolve(config.sourceRoot), { timers: "immediate" });
runtime.setup(fixture, config.mode, true);
const check = await runtime.sample("discard", fixture);
process.stdout.write(`${JSON.stringify({ config, sourceHash: runtime.provenance.sourceHash, initialInvariantErrors: check.errors })}\n`);
for (let iteration = 0; iteration < config.iterations; iteration++) {
	runtime.setup(fixture, config.mode, config.cache === "cold");
	await runtime.profileDecision();
}
process.stdout.write(`Completed ${config.iterations} awaited decisions. CPU profile contains fixture setup and minimal ranking-state instrumentation.\n`);
