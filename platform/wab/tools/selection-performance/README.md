# Studio selection benchmark

Run two frozen production builds in an isolated Electron profile. The runner serves
local Studio/canvas assets, caches successful API GET responses for both builds,
and rejects project revision writes. It never saves the benchmark model.

1. Build Studio and copy the entire output to `$PLASMIC_SELECTION_REPORT_DIR/before`.
2. Apply the change, build again, and copy the output to the sibling `after` directory.
3. Set these variables (keep the report directory and storage state private):

```sh
export PLASMIC_SELECTION_REPORT_DIR=/absolute/private/report
export PLASMIC_SELECTION_STORAGE_STATE=/absolute/private/playwright-storage-state.json
export PLASMIC_SELECTION_PROJECT_URL='https://studio.plasmic.shiguanglab.com/projects/PROJECT_ID'
export PLASMIC_SELECTION_TARGET='{"name":"AppShell","select":[282,55],"blank":[100,500]}'
export PLASMIC_SELECTION_BUILD=before
```

The storage state uses Playwright's standard `cookies` array. Obtain it from an
authenticated test session. Choose a visible node and genuinely empty canvas point;
avoid the inspector, artboard content and the floating AI composer. Keep the window,
zoom, arena, model revision and coordinates identical for both builds.

From the repository root, start the isolated app:

```sh
desktop/node_modules/.bin/electron platform/wab/tools/selection-performance/electron.cjs
```

In another terminal with the same environment:

```sh
node platform/wab/tools/selection-performance/measure.cjs before-a
```

Stop the isolated app, change `PLASMIC_SELECTION_BUILD` to `after`, and repeat.
Prefer an A/B/B/A order. Do not run builds, tests, traces or other CPU-heavy tasks
while timing. Each run uses trusted browser mouse input, a 32 ms hold, four warmup
pairs and twenty recorded pairs. It checks that the expected node is selected and
that blank clicks actually clear selection.

Outputs include raw samples, median/p95 handler time, evaluator invocation counts,
and input-to-first-rAF-after-selection-feedback time. **The rAF metric is a paint
opportunity, not a display presentation measurement.** Browser Event Timing entries
are retained separately when they exceed its 16 ms collection threshold. The report
also contains a screenshot of the final state. None of these files should be
committed with authentication data or API response fixtures.
