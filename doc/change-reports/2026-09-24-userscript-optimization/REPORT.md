# Userscript optimization and decision review — 24 September 2026

The source changes correct reproducible call, scoring, and defensive-state
errors, reduce repeated work in hand evaluation, and add independent test and
benchmark coverage. The final local source passes all reported correctness
checks and the complete GitHub Actions build/validation workflow. Measured fresh-turn compute time improved, while paired closed-hand
rollouts preserved every chosen discard and tenpai outcome. These experiments
do not establish an improvement in match win rate.

## Starting point and scope

The baseline was the working tree at commit
`5ed820316e1cd3b9d37a1e0a2f7b9ae0acadd25f`, including the preexisting uncommitted
`src/hand_analysis.js` optimization. That file and its existing independent test
were preserved, exercised, and connected to CI. The timing gains below compare
against that optimized working tree, not an older/slower published version.

Separate agents reviewed offense/scoring, defense, and benchmark design. A
fresh final review reproduced two additional scoring defects and added focused
tests before the final measurements. Unrelated workspace files and earlier
change reports were left outside this change.

## Correctness changes

- Call simulation applies kuikae restrictions before ranking discards, including
  reversed input order and red/normal fives. Call combinations are compared using
  reachable legal post-discard shapes. A forbidden top choice no longer prevents
  evaluation of a valid alternative.
- Sanankou scoring distinguishes a triplet completed by ron from a concealed
  triplet completed by self draw. Sequence/pair ambiguity and concealed kans are
  retained. Merely considering a call does not open existing concealed triplets.
- A simulated winning tile must belong to the selected completed hand. An extra
  unused draw cannot invent a ron wait. This matters because two-draw simulation
  can hold 15 tiles while selecting a 14-tile shape.
- Furiten and self-draw-only branches use self-draw han/fu context. Continuing
  after a completed furiten first draw retains furiten for subsequent draws.
  Self-draw potential keeps the existing heuristic discount rather than becoming
  fake ron potential. Pinfu uses the appropriate ron/self-draw fu condition.
- Opponent push observations use the observing player's threat perspective.
  The old code could return zero danger when the bot's riichi was the only threat.
- Defensive lookups return snapshots rather than modifying live called tiles.
  A called-away discard remains genbutsu to its original discarder; its untracked
  timing remains uncertain for unrelated opponents.
- Defensive caches refresh when relevant hand size, kita, riichi tile, recent
  push observations, winds, room, or player count changes.
- Hand-decomposition caches store selected indices and return current input
  objects, preserving live validity, provenance, and dora metadata. The recursive
  search consumes actual remaining physical tiles, including red fives.

The rule regressions use an independent sequence-replacement oracle, the
existing Mahjong Soul forbidden-discard protocol fixture, and the concealed
triplet/kuikae rules in [WRC Rules 2025](https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf).
The engine remains a heuristic evaluator with a bounded lookahead; it does not
perform complete game-tree search or calibrated match-value prediction.

## Performance changes

Visible tile availability reuses a histogram across search branches, refreshing
when the board array is replaced or an observer appends/removes a tile. Full
board refreshes rescan tile identities. Recursive selection avoids allocating
unused candidate arrays, consumes selected tiles in place within its owned
branch, and counts tiles without allocating filtered arrays. The mode-4 greedy
double count now scans counts rather than sorting and caching full tile arrays
at every search node.

Debug output appends HTML instead of reparsing the entire growing document.
This substantially affects the browser suite and is reported separately from
engine-only timing. The headless runner now shares CI's 900 ms default limit.

## Final local validation

| Check | Result |
| --- | --- |
| Engine tests | 22/22 passed |
| Exhaustive greedy-double oracle | 548,090 relevant nine-rank count patterns |
| Changing visible-board oracle | 300 boards × 34 tile kinds |
| Seeded benchmark wall validation | 1,024 generated legal states |
| Full browser decision/call suite | 91/91 cases, plus 1,574 direct assertions |
| Production API contract suite | 245 assertions passed |
| Unity protocol/state suite | 35 tests passed |
| Native Chromium WebSocket transport | 15/15 passed |
| Final snapshot benchmark | 1,350 measured operations; zero invariant failures |
| Final paired multi-turn benchmark | 320 hand runs, 4,138 decisions; zero invariant failures |

The engine tests also enumerate independent complete suit shapes with copy
limits, check closed/open/kan hands and special hands, and exercise scoring and
cache mutation regressions. CI retains its separately generated 3,000 reference
hands. The local results above do not count those CI-only external references.

The browser suite changed from 239,416 ms total (2,630.95 ms/case) to 47,967 ms
(527.11 ms/case), an 80.0% reduction. This includes the debug-rendering fix and
must not be presented as an 80% engine speedup. See the
[baseline](evidence/browser-baseline.json) and [final](evidence/browser-final.json)
results; [engine output](evidence/engine-tests.txt) and
[API output](evidence/api-tests.json) are also saved.

## Snapshot benchmark

27 legal positions, modes 0/3/4, cold/warm hand caches, five measured repetitions
and one warmup per row. There are 810 full discard operations plus 540 exact
shanten/draw analyses. Real scheduled yields are preserved. Timing excludes
fixture setup, assertions, GUI/logging, and network operations. Compute time is
wall time less observed callback waits, not OS CPU time.

Measurements used Node 24.14.1 on Windows 11 with an Intel i3-1115G4 and 4 GB RAM.
No concurrent agent benchmark was run during these measurements. Temperature,
background activity, garbage collection, and JIT optimization still introduce
variance; all raw samples are retained.

| Cold decision mode | Baseline compute mean | Final compute mean | Change | Final wall p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| 0 | 62.31 ms | 57.62 ms | -7.5% | 189.12 / 384.33 ms |
| 3 | 231.45 ms | 146.79 ms | -36.6% | 346.84 / 539.91 ms |
| 4 | 289.21 ms | 207.63 ms | -28.2% | 364.72 / 828.19 ms |

Warm compute means changed by -9.1% / +6.3% / -22.5% in modes 0 / 3 / 4.
The mode-3 warm result is slower and is retained rather than averaged away.
Cold exact shanten was approximately unchanged (+2.6% at about 0.06 ms), while
draw analysis improved. The preexisting hand-analysis optimization is not
claimed as a new speed gain.

The baseline has 108 invariant failures across 54 affected rows, all exposing
the live called-tile mutation; final code has zero. Repeated outputs and
cold/warm outputs agree. Exact-analysis outputs remain identical.

One position changes its chosen discard in modes 3 and 4, consistently in both
cache states: the dead-side furiten fixture moves from `9m` (four-live-tile
furiten tenpai) to `1s` (one-shanten, 33 improving tiles). The former option's
priority drops from 372.06 to 228.80 when invalid ron credit is removed; the
alternative remains 326.84. This demonstrates the effect of corrected valuation,
not proof that the resulting strategic tradeoff is optimal. The remaining
158 of 162 discard rows select the same tile.

The [summary and changed candidates](evidence/benchmark-summary.json) contain
source hashes, setup, all mode/cache statistics, and comparison data. The
[compressed full report](evidence/benchmark-full.json.gz) retains every sample
and candidate output. Its final engine source hash is
`21b4c2f31f66f883169e6d5b0911e4e6374ee24d9ca9cf24505a577c0895e98f`.

## Multi-turn experiment

40 independent walls per player count, both versions, modes 0/3, and an
18-own-draw limit: 160 paired conditions, 320 hand runs. Baseline/current order
alternates. The versions see the same physical draws and only public information.
No opponent actions or calls are simulated. A separate completed-shape oracle
evaluates shanten and public live ukeire after each discard.

| Player count / mode | Baseline and final tenpai hands | Mean draws among reached hands | Baseline / final compute per decision |
| --- | ---: | ---: | ---: |
| 3 / 0 | 33/40 | 10.33 | 62.99 / 54.36 ms |
| 3 / 3 | 35/40 | 10.34 | 179.87 / 155.69 ms |
| 4 / 0 | 28/40 | 12.96 | 86.85 / 72.23 ms |
| 4 / 3 | 32/40 | 13.34 | 296.87 / 301.83 ms |

Every paired physical discard sequence is unchanged, as are final shanten,
tenpai outcomes, and independent efficiency opportunity costs. Mode-3 four-player
compute time is 1.7% slower in this experiment; the other groups improve by
13–17%. This supports retained isolated closed-hand behavior, not higher win rate.
Hands not reaching tenpai are censored, and score fields are engine estimates,
not independently settled payments. See the [summary](evidence/rollout-summary.json)
and [complete compressed trajectories](evidence/rollout-full.json.gz).

## Build and reproduction

GitHub Actions [run 35950426345](https://github.com/Tsuki321/AlphaJong/actions/runs/35950426345)
passed on source commit `58e1547551a9ba76693ab7e7eb194fe294ac7903`. This includes
22 engine tests, 3,000 independent reference hands (10,574 total source-browser
assertions), all 91 historical decision/call cases, 245 source API checks,
810 additional benchmark samples, and 359 additional rollout decisions.
The assembled userscript passed 1,574 regression assertions, 245 API checks,
and 51 Unity integration checks. Native transport tests passed in Chromium,
Firefox, and WebKit. The source-browser suite averaged 397.19 ms/case on CI.

The validated artifact was downloaded unchanged to
`build/review-optimization-2026-09-24/AlphaJong.user.js`. All 14 source files were
verified against its contents, normalizing line endings. Artifact SHA-256:
`a402cc6a9d6fbef2f5e8395f2d5121b00002b8b15225c7a89d7702d80d70ec04`.
The CI build uses `--no-bump` and retains version 1.3.13; this is a review artifact,
not a new production auto-update. See [CI evidence](evidence/ci-summary.json) and
[artifact provenance](evidence/validated-artifact.json).

No local userscript build was performed. The changes are on
`review/userscript-optimization-2026-09-24`. Production publication was skipped
because the validation branch is not `master`.

Commands, methodology, profile instructions, and report interpretation are in
[Testing and Benchmarks](../../Testing-and-Benchmarks.md). Full reports in this
directory use gzip solely to keep the checked-in evidence compact.
