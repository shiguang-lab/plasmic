# Canvas geometry experiment

This is an offline diagnostic, not a product implementation. Release entries do
not import these modules. `prepare.cjs` copies Studio sources to a private directory
and checks exact replacement sites before instrumenting only that copy.

The original three-way experiment targets the pre-integration source recorded in
its report. Use its retained frozen copy to reproduce those injections; current
product code uses the integration validation below.

The experiment compares:

- `baseline`: current selection traversal, DOM reads, clipping and Box predicates.
- `cached-js`: the same rules, sharing computed styles and client rectangles only
  within one synchronous query. Maps are released before returning; no cache can
  survive a scroll, edit, component render or later selection gesture.
- `cached-wasm`: the same read cache, with one batch of Float64 rectangles checked
  by a scalar Rust WASM kernel. Packing, the call, result decoding and ancestor
  pruning remain inside measured query time. No worker or asynchronous query is
  introduced.

All modes use the same diagnostic build. WASM is instantiated only for its mode
in timing/memory processes; its initialization time and linear memory are reported.
Raw fixture/model contents and profiles must stay outside the repository.

## Acceptance

Require exact ordered selection equivalence on existing selection/clipping tests,
real fixture queries, zoom, pan, inner scrolling, DOM changes and model undo/redo.
The kernel is additionally compared against actual `Box` behavior on finite,
fractional, zero-size, touching and negative-size input. Cache lifetime is tested.

Use fresh processes in balanced orders, serially, with no build, profiler or tests
running alongside timing. Exclude pilot runs. Record direct query median/p95 and
native Electron pointerup-to-evaluation/double-rAF feedback separately. The latter
is a feedback proxy, not OS input latency or compositor presentation. A direct
query improvement alone does not establish an interaction improvement.

Treat a >=10% median feedback improvement repeated across at least three balanced
rounds, with no repeated p95 regression, as a candidate interaction benefit. Inspect
per-run results rather than treating all queries in one process as independent
replicates. Compare WASM specifically against cached JS. Measure memory separately:
natural renderer RSS/working-set sums, all attached unique isolate heaps, external
memory and a final diagnostic-GC sample. RSS sums double-count shared pages and
are not physical footprint. Do not ship a candidate on a noisy or unexplained
memory regression. No forced GC is used in timing or native interaction runs.

Profile DOM reads and clipping separately from timing. `clipMs` includes its
style/rectangle reads, and `collectMs` includes those nested costs; never sum them.
The scalar kernel only handles final rectangle predicates. Browser layout and
DOM measurement remain on the main thread.

## Reproduction

From the repository root, choose a fresh private directory and prepare sources:

```sh
node desktop/tests/performance/geometry/prepare.cjs /tmp/private-geometry-run
rustc --edition=2021 --target wasm32-unknown-unknown --crate-type=cdylib \
  -C opt-level=3 -C panic=abort -C link-arg=-z -C link-arg=stack-size=65536 \
  desktop/tests/performance/geometry/kernel.rs -o /tmp/private-geometry-run/kernel.wasm
```

From `platform/wab`, build with `NODE_ENV=production PLASMIC_SELF_HOSTED=1`,
`PUBLIC_URL=https://plasmic-studio.shiguanglab.com`,
`STATIC_URL=https://plasmic-studio.shiguanglab.com`,
`PERF_SOURCE_ROOT=/tmp/private-geometry-run/source`,
`PERF_BUILD_OUT=/tmp/private-geometry-run/build`, and
`rsbuild build --config ../../desktop/tests/performance/geometry/build.config.ts`.
Use `prepare-open-build.cjs` to fill missing unchanged runtime assets from the
matching installed build and record the diagnostic fingerprint.

Run `platform/wab/node_modules/.bin/vitest run --config desktop/tests/performance/geometry/test.config.ts` with
`PERF_SOURCE_ROOT`, `GEOMETRY_WASM`, and each `GEOMETRY_VARIANT` set. Then run:

```sh
desktop/node_modules/.bin/electron desktop/tests/performance/geometry/run.cjs \
  /tmp/private-geometry-run /private/saved-project-fixture baseline run-id timing
```

The last argument may be `functional`, `profile` or `memory`. Use each variant
and a unique run ID. `GEOMETRY_FRAME`, `GEOMETRY_QUERIES` and `GEOMETRY_INPUTS`
control the existing artboard and sample counts. The saved-project fixture format
is documented in the parent performance README. The runner routes all requests
to local fixtures and blocks sockets; writes are permitted only to the isolated
in-memory save fixture, never a live service.

`series.cjs <privateOutput> <fixtures.json> <phase>` runs balanced serial rounds;
the fixture JSON maps dataset names to private fixture directories. It waits for
other diagnostic Electron benchmarks and excludes detected overlapping rounds.
`analyze.cjs <privateOutput>` produces per-process timing/memory summaries;
`profile.cjs <privateOutput>` maps CPU samples to source files and totals timeline
events. Profiling explicitly enables the CDP Profiler and fails on capture errors.

## Product integration validation

`prepare-production.cjs <fresh-private-output> <baseline-git-revision>` freezes the
current product and verifies the uncached reference against the experiment's
recorded SHA-256. Build with the same environment as above and
`production-build.config.ts`. Its private entry compares the actual product
function with that reference; the shared clipping helper's uncached path is
unchanged. Only the private copy gains a timing boundary, with no per-read
counters and no WASM initialization.

Run `series.cjs <output> <fixtures.json> functional 1 baseline,cached-js` for
geometry equivalence plus real edit/undo/redo, Preview pagination where available,
full local-fixture save and reopen. Use `timing` for three alternating-order A/B
rounds and `memory` for two reversed-order rounds. The release implementation
never imports the reference or any of these diagnostic entry points.

For incremental comparisons, the second argument can be a private source directory
saved **before editing**. It must contain `Dnd.tsx` and the canvas files
`marquee-selection.ts`, `geometry-snapshot.ts`, and `HoverBox/visible-bounds.ts`
at their repository-relative paths. The preparer copies and fingerprints the
reference implementations separately, including the reference clipping helper;
the baseline therefore retains its own cache behavior. Use a fresh output for
each candidate. Do not compare against an uncached version when attributing the
incremental benefit of additional caching.

The production diagnostic also contains `dragQueries`. Run
`series.cjs <output> <gp-fixtures.json> drag 1 baseline,cached-js` to compare real
drag construction for 1/3/6 selected objects, with two warmups and six samples
per size. It compares the complete node/insertion geometry, acceptance rules and
final cursor offset, then cancels and verifies the complete model is unchanged.
It supplies the ghost elements while leaving the property-panel selection
unchanged, to isolate construction from selection-driven panel layout work.
This measures constructor time, not movement, commit or native pointer latency. Use the GP fixture with
at least six independent selectable objects; the small overview scope is not a
multi-object drag benchmark.

The fourth argument starts the three-round timing/drag series (default `1`).
For additional declared rounds use a new starting number; existing results and
logs cannot be overwritten. Keep anomalous completed runs in the analysis and
explain why additional rounds were needed. Detected overlapping benchmarks are
retained with an exclusion suffix and rerun serially.
