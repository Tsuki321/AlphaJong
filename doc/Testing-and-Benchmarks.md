# Testing and benchmarks

All engine tests and benchmarks execute JavaScript source directly. They do not
assemble the installable userscript. GitHub Actions runs `build.py` and validates
the assembled artifact separately.

## Correctness checks

```sh
npm run test:engine
npm run test:headless
npm run test:api
npm run test:unity
npm run test:unity-browser
```

The engine suite covers regular hands, seven pairs, thirteen orphans, fixed
melds, kans, three-player tile restrictions, dead waits, furiten, physical red
fives, scoring, call restrictions, and cache refreshes. Its suit oracle
enumerates completed shapes independently of the production transition table.
The count-only double calculation is checked against an independent sorted
neighbor scan over every nine-rank count pattern with at most 15 tiles.

The browser suite combines direct rules assertions with the historical discard
and call cases. CI also generates 3,000 deterministic hand references with the
pinned `mahjong==1.4.0` package. Its runtime limit includes browser yields and
debug rendering; it is not a pure engine benchmark. Set
`ALPHAJONG_MAX_MS_PER_TEST` to a machine-appropriate limit when measuring locally;
the runner and CI default to 900 ms. `ALPHAJONG_FAST=1` runs only the direct browser regressions.

## Reproducible snapshot benchmark

```sh
npm run benchmark -- --iterations 5 --warmup 1 --random-cases 12 --modes 0,3,4 --timers real --output test-results/benchmark.json
```

This configuration has 27 positions, 270 workload rows, and 1,350 measured
operations: 810 complete discard decisions and 540 exact shanten/draw analyses.
Unmeasured warmups are separate. Each row has five samples; pooled summaries
have 135 samples. The 95th percentile of a five-sample row is its maximum, so
prefer the pooled mode/cache summary when comparing tail latency.

The curated positions include open and closed hands, overlapping sequences,
red fives, multiple kans, special hands, three-player hands, dead and furiten
waits, two riichi opponents, and restricted discards. Seeded positions enforce
physical four-copy limits across the hand, indicators, calls, and ponds.

Cold samples clear hand-analysis caches before each decision. Warm samples
prime and reuse the identical hand-analysis state; defense state resets during
fixture setup. A cold sample better represents a fresh turn. A warm sample
helps detect cache bugs and measures repeated-state work.

The runner awaits `determineStrategy()` and `discard()`, including safety filters
and final tile selection. It checks legal and distinct candidates, finite values,
unchanged board data during ranking, exactly one discarded tile, draw probability
bounds, known waits, and repeat/cold/warm output consistency. These checks remain
active even when a baseline has a known defect; the report preserves its outputs
and timings, and the current run fails on any current invariant violation.

`wallMs` includes the engine's scheduled yields. `computeMs` subtracts observed
time waiting for those callbacks; it is an estimate, not operating-system CPU
time. Fixture setup, assertions, logging, UI, network actions, and live riichi
operations are excluded. Two state snapshots inside ranking add a small fixed
instrumentation cost. `--timers immediate` replaces the scheduled delays for
fast experiments; compare only runs with the same policy.

For a before/after comparison, preserve the old `src/` directory and
`test/test_api.js` under a separate root before editing:

```sh
npm run benchmark -- --source-root test-results/baseline --iterations 5 --warmup 1 --random-cases 12 --output test-results/baseline.json
npm run benchmark -- --baseline test-results/baseline.json --iterations 5 --warmup 1 --random-cases 12 --output test-results/comparison.json
```

`--baseline` also accepts a source root to execute both versions. Saved reports
must match the corpus, harness, seed, repetitions, warmups, modes, workloads,
cache states, and timer policy. Reports record source hashes, machine/Node
versions, every sampled output, and changed discards. A ratio below 1 means the
current version is faster. Review mode-specific means and percentiles rather
than pooling tiny exact-analysis operations with full decisions. Run comparisons
without other CPU-heavy work; sequential runs can still vary with temperature,
background load, garbage collection, and JIT optimization.

On Windows PowerShell, native stderr redirection can mark an otherwise successful
command as failed. Preserve the actual Node exit status when redirecting:

```powershell
npm run benchmark -- --output test-results/benchmark.json *> test-results/benchmark.log
$benchmarkExit = $LASTEXITCODE
exit $benchmarkExit
```

## Paired multi-turn experiment

```sh
npm run benchmark:rollout -- --baseline test-results/baseline --seeds 40 --draws 18 --players 3,4 --modes 0,3 --output test-results/rollout.json
```

Each version receives the same shuffled physical wall, indicator, and initial
hand. Execution order alternates between versions. The runtime sees only its
own hand and public tiles. Each turn draws one tile, awaits one discard, and
checks the result against a separate completed-shape oracle. A hand stops at
structural tenpai or after the draw budget. Hands that never reach tenpai are
reported as censored; draws-to-tenpai averages include only reached hands.

The report records every draw/discard, the minimum achievable shanten, and live
ukeire opportunity cost. An efficiency opportunity cost is not automatically a
mistake: the reference ignores value, future shape, furiten, and defensive risk.
Scores are engine estimates, not independent scoring results. This experiment
has no opponent draws, calls, riichi decisions, or settled payments and therefore
cannot establish a win-rate improvement.

Reports are checkpointed after each paired hand. An interrupted report has
`progress.complete: false` and must not be presented as a completed run. Resume
unmeasured seed/player/mode ranges in a separate output and verify source/harness
hashes before combining nonoverlapping records.

## Profiling and CI

```sh
node --cpu-prof --cpu-prof-dir=test-results test/benchmark/profile_engine.mjs --fixture closed-balanced --iterations 30 --mode 4
```

This driver removes report assertions from the sampled work, keeps minimal
ranking-state instrumentation, and uses immediate yields. It measures source
execution without a build step.

CI runs the engine oracles, repeated snapshot benchmark, a smaller multi-turn
experiment, the full browser and client suites, and the GitHub Actions build.
The build is followed by bundle/API/Unity integration checks. Test and benchmark
JSON artifacts retain failures for diagnosis; production publication runs only
on `master` after the required jobs succeed.
