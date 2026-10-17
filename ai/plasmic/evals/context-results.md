# Context optimization regression — 2026-10-17

The three source changes are implemented. **The optimized-build REQ075 prototype regression now passes.** All six gates, evidence integrity, 185 behavior cases, 8 hidden Modal/Drawer instances and 5 confirmation surfaces pass; save/reopen preserves the complete model. See the [final acceptance report](req075-regression/completion-results.md). No resource or Desktop release was published.

The [latest focused review](req075-regression/review3-results.md) closes further visibility, custom-close and invalid layout/provenance false acceptance, strengthens isolated counterexamples and catches all 45 specified guard regressions in disposable mutation tests. Current model, build and independently reviewed expectations remain unchanged; the corrected gates and evidence checks pass.

## Changes and measured scope

- `executeBatch` and local AI edit receipts share byte-identical final resources. Ordered operation names, resource indexes and messages remain available; different slices of the same Project are not merged. Transaction, rollback and undo behavior are unchanged.
- Library indexes contain shared rules; complete registration tables live in searchable catalogs. Form/overlay/template references specify conditional reading. `read_reference.py` preserves complete selected sections, descendants, registration preambles and ancestor introductions; unknown sections fail. A read ledger cannot substitute for missing knowledge after compaction.
- `verify_all.py --reuse-evidence` checks the live project, branch, session, revision, changeCounter, Desktop build and evidence hashes. Incomplete/damaged/mismatched evidence is recollected. Every gate reruns; prior outcomes are never cached. Post-reopen collection, Preview and visual acceptance remain separate and mandatory. Full evidence/reports remain on disk; stdout contains statuses and paths.

| Measurement | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Existing two-operation list-card batch | 162,059 bytes | 81,109 bytes | Exact reconstruction of both original results; 49.95% smaller JSON, not a token estimate |
| Antd6 shared library index | 10,382 bytes | 2,873 bytes | 69 catalog rows preserved verbatim, read by actual registration |
| Antd5 shared library index | 5,022 bytes | 1,773 bytes | 30 catalog rows preserved verbatim |
| Four-page repeated evidence collection | 1,346,852 bytes | No repeated model/layout responses | Same-session live identity checks still run; previous evidence is retained |

A complex scenario still needs broad rules. One independent forward run read 235,567 reference bytes, including 17,158 bytes reread after truncation and some unnecessary full sections. This was a routing evaluation, not an A/B token benchmark or generated-design acceptance. Do not infer a universal context reduction percentage from index sizes or the batch example.

## Automated verification

- WAB `tsc --noEmit --incremental false --pretty false`: exit 0.
- Public prototype tools + batch results: 57 tests passed, including complete two-page final readbacks for ten operations, schema validation, ordered receipts, a single undo and exact restoration. Existing rollback/local-edit checks remain enabled.
- Expanded editor/server selection: 82 passed, 4 failed. All four failures are in unchanged `local-edit-session.test.ts`, whose mock contexts omit required `browserImportCanvasName`. Replaying that original test with the HEAD version of `prototype-tools.ts` also gives 8 passed / the same 4 failures. These are retained baseline failures, not reported as a green expanded suite.
- Python reference/verifier suite: 103 passed. Includes session/revision/unsaved-change/build invalidation, hash damage, incomplete layouts, changed expectations, context changes during reuse, and all existing six-gate positive/negative tests.
- Resource packaging/CLI: 12 passed; original reading budgets, link/anchor/reachability checks and embedded Python checks remain enabled. Skill metadata validation passed.
- Desktop controller/management/RPC: 29 passed. Component coverage: 4 tests passed; actual registrations cover 5 libraries, 185 registrations and 848 icons. All four moved catalogs retain their original rows in order.
- Targeted ESLint: no new diagnostics after fixing the added test helper's shadowed name. The modified coverage validator has the same 7 pre-existing lint errors as HEAD; prototype tests retain 2 pre-existing empty-function warnings. `git diff --check` passed.

## Real four-page requirement regression

Source: REQ075 overseas customer-group requirements v1.36 and the existing independently prepared source/form/structure inventories in `desktop/desktop-report/req075-aligned-regeneration`. Target: `6M9xV1Vz9kawVFdoXVQdSG`, revision 158, with `/req-075/groups`, `/req-075/regular`, `/req-075/onetime`, `/req-075/detail`.

Desktop 0.1.13 / renderer revision `89da0f32491432d951805be092128fdf7b842342` is the running baseline, not a deployment of the new batch implementation. The complete four-page evidence was collected once, reused against the same live session, and replayed with the HEAD verifier. All gate reports are identical across those three runs:

| Gate | Result | Reason/scope |
| --- | --- | --- |
| Evidence | Passed | Complete Page identities/models and stable capture identity |
| Structure | Failed | Dynamic role-based menu cannot satisfy the existing static menu check |
| Forms | Passed | Four-page inventory, six Forms, twenty fields |
| Descriptions | Unverified | No independent information inventory exists in the prior acceptance set |
| Overlays | Unverified | No independent overlay inventory exists in the prior acceptance set |
| Slots | Failed | Prior intent HTML retains names from before the project's node renaming |
| Shell height | Passed | All four full Page models and targeted 1440 × 1024 geometry |

No expectations were copied from the actual model to manufacture a pass, no dynamic-menu exemption was added, and no failing/unverified gate was removed.

Observed in actual in-app Preview:

- List keyword `1002` remains a draft until Query; Query yields one row, Reset restores 50. Second page starts at 1021 and ends at 1040; 50/100 page sizes work. All/Mine switches 50 → 25. Scrolling reaches the last row/pagination while shell header/sidebar remain in place.
- New one-time-group Modal retains native fields. Clearing the required name and confirming displays “请输入客群中文名称” and keeps the Modal open; native X closes it.
- Regular SQL validation enables Submit, preflight opens the 12,340 / Top100 result, and simulated Save reports initialization. Changing SQL to `SELECT uid FROM other.users` shows the dwt/cdm, uid/app_source and App-filter errors and disables Submit/Save/Launch.
- One-time SQL validation/preflight succeeds with the configured 14-day validity. At 1440 × 720, the shell fills the viewport and scrolling reaches the SQL footer actions without moving the header/sidebar.
- Detail overview exposes 12,340 members. The read-only SQL Modal opens with a native close icon and no footer, then closes. Members, selection records, refresh records and application records expose their hidden contents; the failed selection row visibly preserves numeric `0`.

Preview business actions use the project's existing simulation; these observations do not prove production APIs or authorization. The full role matrix, all CRUD/error cases, every page's short viewport and every post-reopen interaction have not been exhaustively exercised. The independent complex-scenario evaluation mapped 26 requirements including Form.List, conditional fields and hidden branches, but did not generate a new prototype.

After Preview, all four complete models are structurally equal to the pre-run capture, revision remains 158 and changeCounter is 0. Reloading the already saved project creates a new session (`DO3lNUwjHBzX` → `tXGDvyXQ2CMJ`); a fresh collection without reuse has identical complete models and the same gate statuses. All four shell-height checks pass again; temporary inspection frame IDs change as expected. This verifies existing persistence, not a new design save. The original editor view was restored.

## Evidence and remaining acceptance

Local artifacts: `/tmp/plasmic-context-regression-20261017/`. `live/first`, `live/reused`, `live/reopened` retain complete captures/reports; `live/baseline-report.json` holds the HEAD result. `forward/report.md`, `forward/acceptance.json` and `forward/reference-reads.jsonl` retain the independent routing review. Test logs, reference/batch byte measurements and Preview screenshots are in the same directory.

Before claiming complete new-design acceptance, run the updated build on an independent complete requirement with source-reviewed structure/Form/Descriptions/overlay/Slot inventories, all required roles and runtime cases, every target/short viewport, and explicit save/reopen validation. Existing REQ075 inventory defects and baseline tests must remain visible until resolved; this change does not authorize calling them passes.

## Second review — 2026-10-17

A further source review found repeated schema discovery was larger than the recorded batch example. `get_app_state` now accepts optional `toolNames`: omitted retains the full response; `[]` returns status plus available operation names; a name list returns each requested complete schema. Unknown/unavailable names and malformed selections fail. Identity, readiness, editing context and running operations are retained. Selection does not modify or summarize a schema, and the controller's original state is unchanged. The verifier requests status only; skill guidance checks that the advertised tool input supports this option and still requires contracts before execution.

Replaying the 50 previously captured live schemas through the changed DesktopController produces 2,291,789 bytes for all schemas, 969 bytes for status and 68,371 bytes for `identify` + `read`. Selected schemas are deeply equal to the original schemas, including their definitions/references. These are deterministic response-size measurements with fixture state, not a deployed Desktop or model-token benchmark. This measurement covers public response selection; the third review below checks the internal renderer transport too.

The review also makes missing Desktop version/build invalidate evidence reuse, even when the old capture is missing the same fields. Read-only Modal routing no longer leads into irrelevant Form instructions, while all overlay, visual, close/reopen and persistence checks remain required. Descriptions instructions now require a source-reviewed inventory before insertion and the actual model gate after insertion/before delivery, save and reopen; nonexistent nodes are no longer expected to pass a pre-insertion model check.

Validation: 30 Desktop/RPC/stdio tests, 103 Python tests and 12 resource packaging/CLI tests passed. New coverage checks full/default/scoped/empty schema selection, preservation of state and recursive schema contents, invalid/unknown/duplicate selections, a not-ready editor, MCP forwarding, and missing build identity. ESLint diagnostics for the four touched Desktop code/test files match HEAD exactly (23 existing errors; no added diagnostics). Full requirement-acceptance limitations above remain open; this second review did not mutate a live design or publish a build. Additional logs and `schema-metrics.json` are in the same local evidence directory.

## Third review — 2026-10-17

Following the controller call sites showed that public response selection still fetched all renderer metadata first. Selection now reaches `editor-bridge.js` before its response is serialized. Status-only calls, readiness polling and navigation identity checks request no schema bodies; selected contracts retain their complete definitions/references and the full available-name inventory. Default discovery still returns all contracts. Current editing context is still read, and context/unknown-schema failures propagate rather than being converted to readiness success.

A new integration harness executes the actual controller and editor-bridge sources, with Electron/services isolated at their boundaries. Schema getters prove that a status-only request reads zero schema bodies, a request for `read` never accesses `save`, and default discovery preserves both. The harness also verifies recursive references, identity/context, readiness polling and error propagation. No live application or business project was changed in this review.

The section reader was additionally applied across all 148 Markdown reference files / 490 headings: no generated-anchor collisions were found, and selecting every section reconstructs every original document exactly. The batch consumers, local edit result envelope, evidence invalidation and gate invocation paths were reviewed without further protocol changes.

Validation: all 220 Desktop `*.test.cjs` tests passed; 71 Studio prototype/batch/canvas-inspection/activity tests passed; all 103 Python tests and 12 resource packaging/CLI tests passed. New editor-bridge/controller tests and the bridge source pass ESLint; syntax checks and `git diff --check` pass. Existing lint diagnostics in the controller/management test files remain outside this edit. Full new-design acceptance limitations recorded above remain open; no release or deployment was performed.

Evidence: `third-desktop-all.log`, `third-desktop.log`, `third-studio.log`, `third-resources.log` and `third-lint.log` under `/tmp/plasmic-context-regression-20261017/`.

## Fourth review — 2026-10-17

Live model identity does not identify current rendering: runtime resources can change without changing project/session/revision/changeCounter. The collector now reuses only the overview and complete Page models, and always takes fresh targeted layout snapshots before running every configured gate. Copied model files are checked against their source capture hashes before use. New capture hashes cover the reused models and fresh layouts together; model changes during collection still fail. This deliberately retains layout collection cost to preserve acceptance quality; raw models and reports remain on disk rather than being repeatedly printed.

The live-reuse regression now changes rendered shell height without changing any model/session identity. It proves that no model read is repeated, a fresh layout is requested, evidence consistency passes, and the shell-height gate fails. The ordinary unchanged-layout path still passes all six gates. Batch serialization/consumer and section-reader paths were reviewed without additional changes.

Validation: `python3 -m unittest discover -s ai/plasmic/scripts -p 'test_*.py'` passed all 103 tests; `node --test packages/plasmic-cli/tests/resources.test.mjs` passed all 12 tests, including packaged Python scripts and existing resource budgets. `git diff --check` passed. Logs: `fourth-python.log` and `fourth-resources.log` in the evidence directory. Desktop/Studio code did not change in this review; their prior test results are recorded above, not reported as rerun here. Full requirement acceptance limitations remain open; no live design mutation, release or deployment occurred.

## Full-requirement regression follow-up

Built and ran the optimized local Desktop/Studio against the four-page REQ075 project. Added source-reviewed inventories, fixed two preflight sole-dismiss footers and corrected the overlay checker to match Studio empty code-component Slot defaults. Evidence, passed cases and unresolved dynamic/runtime checks are recorded in [REQ075 results](req075-regression/results.md). Login expiry blocked the remaining live cases; this run is not full acceptance.

Rerun validation: 220 Desktop tests, 104 Python tests, 12 resource tests and 4 component-coverage tests passed. Studio prototype/batch and canvas/activity tests passed 71 cases across two commands. Build succeeded before testing. Logs: fifth-*.log under /tmp/plasmic-context-regression-20261017/.

## Login-resumed requirement regression

Normal login was restored for the isolated optimized build. The [resumed report](req075-regression/resumed-results.md) records additional Preview flows, all four pages at both target viewport sizes, a requirement defect fixed in reenable-failure retry, and final revision 164 persistence. All 182 supplemental public-model behavior cases pass after reopen. Static dynamic-expression diagnostics remain visible; exhaustive rendered state permutations and production service integrations are not claimed. No release was published.

## Completed requirement regression

The [final report](req075-regression/completion-results.md) closes the dynamic-menu/native-button diagnostics through non-executing contract checks with negative tests, and supplies 25 reviewed live short-screen screenshots. New-session collection invalidates prior-session reuse and preserves revision 164 exactly; all six gates pass again with fresh layouts. The final hash-verified behavior suite passes 185 cases. Rerun results: 220 Desktop tests, 71 Studio tests, 109 Python tests, 16 resource/component-coverage tests; all pass. The earlier REQ075 gate failures are resolved. The separate broader local-edit-session baseline finding remains recorded above; that unrelated test selection was not rerun or counted as passing in this run. Production service integration retains the original prototype scope boundary.

## Strictness and evidence review

The [focused review](req075-regression/review-results.md) reproduced and fixed lexical, prototype/visibility and incomplete-evidence false acceptance. Replay/reuse now share complete metadata/hash/model checks; behavior validation remains active with Python optimization and rejects duplicate routes. Visual artifacts have automatic source/model/build/branch/revision and 25-file integrity/coverage checks. Reports retain exact checked source hashes. The actual revision 164 model is unchanged, fresh/reused collections pass all gates, and all 185 behavior cases pass. Rerun counts: 113 verifier tests, 6 evidence tests, 16 packaging/component tests. Preview and current layout requirements remain separate and unchanged.

The [second focused review](req075-regression/review2-results.md) adds quoted-binding rejection, menu href preconditions, native close/footer/visibility corrections, typed model equality, pinned copy hashes and collection-end Desktop identity checks. All 122 verifier tests, 7 evidence tests, 16 packaging/component tests and 185 behavior cases pass. Fresh-model replay and live reuse both pass all six gates with current checker sources; 13 surfaces / 25 saved images retain verified applicability. Models and acceptance expectation hashes are unchanged. Historical Preview observations remain explicitly separate from this review's current layout and artifact checks.

The [third focused review](req075-regression/review3-results.md) fixes inline CSS/custom icon/NaN geometry and timestamp acceptance, and isolates previously masked identity/duplicate-image counterexamples. All 45 specified guard regressions are caught by assertion failures in disposable copies. All 131 verifier tests, 10 evidence tests, 16 packaging/component tests and 185 behavior cases pass. Live fresh and reuse paths pass evidence plus all six gates; 13 surfaces / 25 files retain verified applicability. Exact models/build and independent expectation hashes are unchanged; Preview acceptance remains separate.

The [fourth focused review](req075-regression/review4-results.md) finds additional static-menu projection, duplicate/empty Slot intent, unidentified Slot content, typed padding, overview identity and parsed-byte/hash race defects. The bounded audit catches all 59 guard variants, with each of the 14 additions run against its isolated target method. All 141 verifier tests, 11 evidence tests, 16 resource/component tests, 220 Desktop tests, 71 Studio tests and 185 requirement behavior cases pass. Fresh native Preview and explicit save/exit/reopen are rerun; 29 new images supplement the intact required 13-surface/25-state gallery. New-session collection rejects prior-session reuse, all three current captures pass evidence plus six gates, and same-session reuse still obtains four fresh layouts. Exact saved models/build and independent acceptance inputs remain unchanged at revision 164.

The [fifth focused review](req075-regression/review5-results.md) adds CSS escape/comment/priority (including style-prop merging), duplicate direct Slot, typed Form rule and inventory/intent byte-binding protections. Text-only Card content and valid CSS priority also receive positive controls against false rejection. All 71 specified variants are caught, with isolated targets for the 12 additions, including inspection-mode CLI cases. Rerun results: 148 verifier, 11 evidence, 16 resource/component, 220 Desktop, 71 Studio and 185 requirement behavior tests pass. Fresh/reopened evidence is replayed against the final checker and live reuse refreshes all layouts; evidence plus all six gates pass. Four-page Preview at both heights, role controls, SQL flows and post-reopen interactions are rerun. Fifteen new images supplement the required 25-state gallery and prior 29-image native run, both revalidated against unchanged source/model/build. Revision 164, complete models and independent acceptance inputs remain exact.
