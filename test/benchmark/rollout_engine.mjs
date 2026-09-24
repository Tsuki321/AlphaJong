#!/usr/bin/env node
// Deterministic isolated efficiency experiment, NOT a Mahjong win-rate model.
// No opponents draw/discard/call. Each engine only sees its public tiles; the
// unopened wall is never sent to the source runtime or the reference oracle.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { curatedFixtures, tileName } from "./fixtures.mjs";
import { createRuntime, digest } from "./runtime.mjs";
import { statistics } from "../benchmark_engine.mjs";
import { oracleShanten, oracleDiscardOptions, tileCounts, oracleCacheSize } from "./rollout_oracle.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const usage = `node test/benchmark/rollout_engine.mjs [options]
  --baseline DIR     Preserved source root, paired on identical physical walls
  --source-root DIR  Current source root (default repository)
  --output FILE      JSON output with every draw/discard and source hashes
  --seeds N          Independent walls per player count (default 30)
  --seed N           Unsigned 32-bit first seed (default 20260923)
  --draws N          Maximum own draws per hand (default 18)
  --players 3,4      Player counts (default 3,4)
  --modes 0,3        Performance modes (default 0,3)
  --timers POLICY   immediate or real (default immediate)
  --help            Show usage

This is a no-opponent, no-call, closed-hand experiment. No simulated result is
a win rate. Independent shanten/live-ukeire regret ignores hand value, defense,
future shape and furiten; choosing a different tradeoff is not itself an error.
Stop on first post-discard tenpai. Unreached hands are censored at the draw budget.
Final hand scores are engine expected-value estimates, not settled game points.
`;

function options(argv) {
	const config = { sourceRoot: repository, seeds: 30, seed: 20260923, draws: 18, players: [3, 4], modes: [0, 3], timers: "immediate" };
	const keys = { "--source-root": "sourceRoot", "--baseline": "baseline", "--output": "output", "--seeds": "seeds", "--seed": "seed",
		"--draws": "draws", "--players": "players", "--modes": "modes", "--timers": "timers" };
	for (let index = 0; index < argv.length; index++) {
		if (argv[index] === "--help") { process.stdout.write(usage); process.exit(0); }
		const key = keys[argv[index]];
		if (!key || argv[index + 1] === undefined) throw new Error(`Unknown or missing option: ${argv[index]}\n${usage}`);
		config[key] = argv[++index];
	}
	for (const key of ["seeds", "seed", "draws"]) config[key] = Number(config[key]);
	for (const key of ["players", "modes"]) if (typeof config[key] === "string") config[key] = config[key].split(",").map(Number);
	for (const key of ["seeds", "draws"]) if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`Invalid ${key}`);
	if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) throw new Error("Invalid seed");
	for (const [key, allowed] of [["players", [3, 4]], ["modes", [0, 1, 2, 3, 4]]]) {
		if (!config[key].length || config[key].some(value => !allowed.includes(value)) || new Set(config[key]).size !== config[key].length) throw new Error(`Invalid ${key}`);
	}
	if (config.draws > (config.players.includes(3) ? 55 : 70)) throw new Error("Draw budget exceeds the selected game's nominal live wall");
	if (!["immediate", "real"].includes(config.timers)) throw new Error("Invalid timer policy");
	return config;
}

export function makeWall(seed, players) {
	let state = (seed ^ Math.imul(players, 0x9e3779b9)) >>> 0;
	const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
	const wall = [];
	for (let type = 0; type < 4; type++) for (let index = 1; index <= (type === 3 ? 7 : 9); index++) {
		if (players === 3 && type === 1 && index > 1 && index < 9) continue;
		for (let copy = 0; copy < 4; copy++) wall.push({ id: `${type}/${index}/${copy}`, type, index, dora: type < 3 && index === 5 && copy === 0 });
	}
	for (let index = wall.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[wall[index], wall[other]] = [wall[other], wall[index]];
	}
	assert.equal(new Set(wall.map(tile => tile.id)).size, wall.length);
	assert.equal(wall.length, players === 3 ? 108 : 136);
	assert.ok(tileCounts(wall).every(count => count === 0 || count === 4));
	return wall;
}

function stringTiles(tiles) { return tiles.map(tileName).join(""); }

async function rollout(runtime, seed, players, mode, config, label) {
	const wall = makeWall(seed, players), indicator = wall[0], initial = wall.slice(1, 14);
	const hand = initial.slice(), discarded = [], turns = [], errors = [];
	let drawsToTenpai = oracleShanten(tileCounts(hand), players) === 0 ? 0 : null;
	let finalShanten = oracleShanten(tileCounts(hand), players), oracleTimeMs = 0;
	for (let draw = 0; draw < config.draws && drawsToTenpai === null; draw++) {
		const tile = wall[14 + draw];
		hand.push(tile);
		const seen = [indicator, ...hand, ...discarded];
		assert.equal(new Set(seen.map(entry => entry.id)).size, seen.length, "Physical tile repeated across hand/indicator/discards");
		assert.ok(tileCounts(seen).every(count => count <= 4), "Fifth visible copy");
		const fixture = { id: `rollout-${players}-${seed}-${draw}`, tags: ["rollout"], players, hand: stringTiles(hand),
			ponds: [stringTiles(discarded)], indicators: tileName(indicator), tilesLeft: (players === 3 ? 55 : 70) - draw };
		// No opponent progress is invented. Empty opponent ponds give zero
		// estimated tenpai risk; no offensive/defensive coefficient is changed.
		runtime.setup(fixture, mode, true);
		const sample = await runtime.sample("discard", fixture);
		for (const error of sample.errors) errors.push({ draw: draw + 1, error });
		assert.ok(sample.output?.tile, "Engine returned no discard");
		const index = hand.map(tileName).lastIndexOf(sample.output.tile);
		assert.ok(index >= 0, "Discard is not in the physical hand");
		const oracleStarted = performance.now();
		const candidates = oracleDiscardOptions(hand, discarded, indicator, players);
		oracleTimeMs += performance.now() - oracleStarted;
		const selected = candidates.find(candidate => candidate.tile === sample.output.tile);
		const bestShanten = Math.min(...candidates.map(candidate => candidate.shanten));
		const bestUkeire = Math.max(...candidates.filter(candidate => candidate.shanten === bestShanten).map(candidate => candidate.ukeire));
		const sameShantenBestUkeire = Math.max(...candidates.filter(candidate => candidate.shanten === selected.shanten).map(candidate => candidate.ukeire));
		const exactRegret = { shanten: selected.shanten - bestShanten,
			ukeireAtBestShanten: selected.shanten === bestShanten ? bestUkeire - selected.ukeire : null,
			ukeireAtChosenShanten: sameShantenBestUkeire - selected.ukeire };
		if (sample.output.strategy === "General" && sample.output.selected.shanten < selected.shanten)
			errors.push({ draw: draw + 1, error: "Engine general-hand shanten is lower than independent minimum over all hand families" });
		const [removed] = hand.splice(index, 1); discarded.push(removed);
		assert.equal(hand.length, 13);
		finalShanten = selected.shanten;
		if (finalShanten === 0) drawsToTenpai = draw + 1;
		turns.push({ draw: draw + 1, observedTile: tileName(tile), observedTileId: tile.id, discardedTile: sample.output.tile,
			discardedTileId: removed.id, strategy: sample.output.strategy, hand: stringTiles(hand),
			independent: { selected, bestShanten, bestUkeire, regret: exactRegret, candidates },
			engineSelected: sample.output.selected, wallMs: sample.wallMs, computeMs: sample.computeMs, timerWaitMs: sample.timerWaitMs,
			decisionFingerprint: sample.fingerprint });
	}
	const record = { label, seed, players, mode, wallHash: digest(wall), indicator: tileName(indicator), initialHand: stringTiles(initial),
		drawsObserved: turns.length, drawsToTenpai, censored: drawsToTenpai === null, finalShanten, finalHand: stringTiles(hand),
		finalScoreEstimate: turns.at(-1)?.engineSelected?.score ?? null,
		availableDrawSequence: wall.slice(14, 14 + config.draws).map(tileName), turns, errors, oracleTimeMs };
	record.fingerprint = digest({ seed, players, mode, wallHash: record.wallHash, drawsToTenpai, finalShanten,
		turns: turns.map(turn => [turn.observedTileId, turn.discardedTileId, turn.decisionFingerprint, turn.independent]) });
	return record;
}

function summarize(records) {
	const groups = new Map();
	for (const record of records) {
		const key = `${record.label}/${record.players}p/mode${record.mode}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(record);
	}
	return [...groups].map(([key, group]) => {
		const turns = group.flatMap(record => record.turns);
		return { key, hands: group.length, tenpaiHands: group.filter(record => !record.censored).length,
			censoredHands: group.filter(record => record.censored).length,
			drawsToTenpaiAmongReached: statistics(group.filter(record => !record.censored).map(record => record.drawsToTenpai)),
			finalShanten: statistics(group.map(record => record.finalShanten)), observedDraws: turns.length,
			shantenRegret: statistics(turns.map(turn => turn.independent.regret.shanten)),
			decisionsAboveMinimumShanten: turns.filter(turn => turn.independent.regret.shanten > 0).length,
			ukeireRegretAtBestShanten: statistics(turns.map(turn => turn.independent.regret.ukeireAtBestShanten).filter(value => value !== null)),
			decisionWallMs: statistics(turns.map(turn => turn.wallMs)), decisionComputeMs: statistics(turns.map(turn => turn.computeMs)),
			finalClosedScoreEstimate: statistics(group.map(record => record.finalScoreEstimate?.closed).filter(Number.isFinite)),
			finalRiichiScoreEstimate: statistics(group.map(record => record.finalScoreEstimate?.riichi).filter(Number.isFinite)),
			failedChecks: group.reduce((sum, record) => sum + record.errors.length, 0) };
	});
}

async function main() {
	const config = options(process.argv.slice(2));
	const roots = config.baseline ? [["baseline", config.baseline], ["current", config.sourceRoot]] : [["current", config.sourceRoot]];
	const runtimes = await Promise.all(roots.map(async ([label, root]) => ({ label, runtime: await createRuntime(root, config) })));
	const report = { schemaVersion: 1, kind: "isolated-closed-hand-rollout", generatedAt: new Date().toISOString(), config,
		methodology: { noOpponents: true, noCalls: true, noHiddenWallAccess: true, noCoefficientChanges: true,
			stopRule: "First independent structural tenpai after a discard, or draw budget; already-tenpai initial hands stop at zero.",
			oracle: "Independent enumeration of legal completed suit targets with four-copy limits, plus distinct seven pairs and thirteen orphans; public unseen counts only.",
			regret: "Reference efficiency opportunity cost, not a mistake rate: does not optimize hand value, future shape, furiten or risk.",
			score: "Final source-engine expected closed/riichi score, not an independent score or settled points.",
			timing: "Awaited source decisions with source caches reset per turn; reference-oracle time excluded. Fixed fixture setup/invariant checks are outside timings.",
			limitations: "This is not self-play or win rate. Only own draws advance the wall; zero opponent threat. Paired versions share the identical hidden physical wall and alternate execution order per seed/mode." },
		machine: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
			osRelease: os.release(), cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length },
		sources: runtimes.map(({ label, runtime }) => ({ label, ...runtime.provenance })), records: [], progress: { complete: false } };
	const files = ["rollout_engine.mjs", "rollout_oracle.mjs", "runtime.mjs", "fixtures.mjs", "../benchmark_engine.mjs"];
	report.harnessHash = digest(await Promise.all(files.map(async file => [file, digest(await readFile(new URL(file, import.meta.url), "utf8"))])));
	async function save() {
		if (!config.output) return;
		await mkdir(path.dirname(path.resolve(config.output)), { recursive: true });
		await writeFile(config.output, `${JSON.stringify(report, null, 2)}\n`);
	}
	// One untimed known fixture warms JS execution before wall-specific work.
	for (const { runtime } of runtimes) {
		runtime.setup(curatedFixtures[0], config.modes[0], true);
		await runtime.profileDecision();
	}
	let pairIndex = 0;
	for (const players of config.players) for (let number = 0; number < config.seeds; number++) for (const mode of config.modes) {
		const seed = (config.seed + number) >>> 0;
		const order = pairIndex++ % 2 === 0 ? runtimes : runtimes.slice().reverse();
		for (const { label, runtime } of order) {
			process.stderr.write(`[${pairIndex}/${config.players.length * config.seeds * config.modes.length}] ${label} ${players}p seed=${seed} mode=${mode}\n`);
			report.records.push(await rollout(runtime, seed, players, mode, config, label));
		}
		report.summary = summarize(report.records);
		await save();
	}
	const baseline = new Map(report.records.filter(record => record.label === "baseline").map(record => [`${record.players}/${record.seed}/${record.mode}`, record]));
	report.pairs = report.records.filter(record => record.label === "current" && baseline.has(`${record.players}/${record.seed}/${record.mode}`)).map(record => {
		const previous = baseline.get(`${record.players}/${record.seed}/${record.mode}`);
		assert.equal(previous.wallHash, record.wallHash);
		return { players: record.players, seed: record.seed, mode: record.mode, identicalTrajectory: record.fingerprint === previous.fingerprint,
			baselineDrawsToTenpai: previous.drawsToTenpai, currentDrawsToTenpai: record.drawsToTenpai,
			baselineFinalShanten: previous.finalShanten, currentFinalShanten: record.finalShanten,
			baselineObservedDraws: previous.drawsObserved, currentObservedDraws: record.drawsObserved };
	});
	report.oracleCache = oracleCacheSize();
	report.progress = { complete: true, hands: report.records.length, observedDraws: report.records.reduce((sum, record) => sum + record.drawsObserved, 0) };
	await save();
	process.stdout.write(`${JSON.stringify({ output: config.output, progress: report.progress, summary: report.summary,
		pairedHands: report.pairs.length, identicalTrajectories: report.pairs.filter(pair => pair.identicalTrajectory).length,
		oracleCache: report.oracleCache }, null, 2)}\n`);
	if (report.records.some(record => record.label === "current" && record.errors.length)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
