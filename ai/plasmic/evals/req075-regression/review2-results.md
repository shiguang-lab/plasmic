# Dynamic-check and evidence-reuse review — 2026-10-17

This review reproduced additional false acceptance in the checkers and evidence reuse. The corrected checks pass the unchanged REQ075 prototype. No acceptance inventory, intent, design model or runtime implementation was changed in this review.

## Findings and corrections

| Finding | Correction and evidence |
| --- | --- |
| Quoted `"{{ $state.busy }}"` inside a Button object expression was indistinguishable from a real read binding. A truthy string could satisfy an expected dynamic disabled prop. | Quoted binding text, including Unicode-escaped delimiters, fails parsing. Actual simple reads still pass and must match the independently reviewed prop. |
| The supported menu program appends `?role=`. Existing queries/fragments could silently lose role propagation. | Literal menu hrefs containing a query or fragment are rejected for this specific transform. The reviewed plain routes, recursive program, exact item inventory and exercised role checks remain required. Unknown programs still fail. |
| Non-boolean `hideFooter` or close-disabled flags and case-varied CSS visibility could produce the wrong visible action inventory. Transparent native actions were also counted. | Footer/close flags require literal booleans. Case/whitespace-normalized hidden CSS and zero/negative opacity remove invisible actions from the inventory. Unresolved styles still fail. Required buttons and exact props remain checked. |
| Explicit `closable: true` with top-level `closeIcon: false/null` was classified as no close icon, potentially allowing a duplicate exit-only footer. | Checked the installed Antd6 `computeClosable` implementation and executed its real export: explicit true/object configurations retain the native fallback icon. The checker now respects this precedence. Positive close-inventory checks and negative sole-dismiss footer cases cover the combinations. |
| Python equality treats `true` and `1` as equal. A changed model could retain historical screenshot applicability, and the model-comparison CLI could report equality despite different fingerprints. Duplicate routes could also overwrite one another in that CLI. | Both evidence applicability and model comparison preserve JSON types. Boolean-to-number changes fail. Empty/duplicate routes fail before comparison. An unchanged model remains reusable across sessions for historical image applicability only. |
| The collector validated one manifest, then reread it before copying; replacing both pages and hashes in between could bypass validation. | Reuse returns the validated manifest and pins its hashes throughout copying. A test replaces model bytes and manifest immediately after validation and proves rejection during copy. |
| A Desktop build could change during collection while the initial build identity was still recorded. An arbitrary nonempty build object also counted as a fingerprint. | Fresh and reuse paths reread status after collection and reject a changed project/version/build or lost readiness. Renderer and Desktop SHA-256 fingerprints are mandatory; optional source hashes must be valid. Missing/invalid fingerprints fail replay and reuse. |

Before-fix failures are retained in `review2-bindings-before.log`, `review2-overlays-before.log`, `review2-visual-before.log`, `review2-reuse-before.log` and `review2-close-before.log` under `/tmp/plasmic-context-regression-20261017/`.

## Verification

- **122** Python reference/verifier tests pass, including supported dynamic bindings and all new negative cases.
- **7** evidence/behavior-input tests pass, including typed model changes, missing states/files, duplicate evidence, tampering, changed source/build/branch and Python optimization.
- **16** resource packaging/component-coverage tests pass, including the packaged verifier tests.
- Optimized local Desktop **0.1.14**, project `6M9xV1Vz9kawVFdoXVQdSG`: fresh complete four-Page collection, then same-session model reuse with new layout requests for every Page. The latest checker passes evidence integrity and **all six gates** on both data paths. The fresh data was replayed after the final close-precedence correction; the final reuse run was collected again with that correction.
- **185** supplemental requirement behavior cases pass from the final hash-verified capture.
- Historical short-screen evidence: **13 surfaces / 25 files** pass the complete state inventory, source/model/build/branch/revision and file-integrity checks.
- All four complete models are exactly equal as typed JSON to the previously accepted revision **164**, including identities, props, bindings, styles, states, variants and interactions. Their `pages.json` hash remains `8594b3c09dff44901e4ffe47278cd8c03c8d45ba908878ef4b4e6077fc008dbd`. Session remains `y-puD1BlwMnE`, changeCounter **0**. The Desktop renderer/build fingerprints are unchanged.
- The independently reviewed expectation/intent file hashes are unchanged from the previous passing review. No gate exemption or expectation reduction was introduced. `git diff --check` passes.

This review did not rerun Preview interactions or replace the original screenshot observations with a synthetic pass. It verified that the original [complete Preview and persistence acceptance](completion-results.md) and [short-screen observations](short-screen-results.md) still apply to the identical source, model and build. Live layout checks were refreshed. The artifact checker explicitly reports that it is not a new Preview execution. Future model/source/build changes require the corresponding acceptance again; old outcome reports cannot grant a pass.

Desktop/Studio runtime source did not change in this review. Their earlier 220/71 test results are retained in the completed requirement report and are not counted as rerun here. The established prototype scope and production-service exclusions remain unchanged. No release, installation replacement or deployment was performed.

## Reproduce and inspect

Run the commands in [the preceding review](review-results.md#reproduce) against the current scripts. Run `verify_all.py --profile` without reuse for a fresh capture, then `--reuse-evidence` in the same live session; the [verification contract](../../references/verification.md) still requires every gate and separate Preview/persistence acceptance.

Complete local artifacts under `desktop/desktop-report/optimized-context-regression/`:

- `review2-fresh/`: fresh full models, overview, layouts and capture identity.
- `review2-fresh-checked/`: all gates rerun on the fresh capture with the final checker sources.
- `review2-verified/`: final live reuse, fresh layouts, build/context identity and passing report.
- `review2-behavior-verified/report.json`: 185 passing behavior cases and checked input hashes.
- `review2-visual-integrity-verified.json`: complete historical visual evidence integrity/applicability and checked input hashes.
- `review2-model-integrity-verified.json`: exact typed model identity and unchanged expectation hashes.

Final test logs: `review2-python-final.log`, `review2-visual-tests-final.log`, `review2-resources-verified.log`, `review2-fresh-checked.log`, `review2-verified.log` and `review2-behavior-verified.log` in `/tmp/plasmic-context-regression-20261017/`.
