# False-acceptance and counterexample audit — 2026-10-17

The review found and fixed additional false acceptance in visibility, close-icon and evidence validation. It also strengthened counterexamples that could previously fail for the wrong reason. The corrected checks pass the unchanged four-page REQ075 prototype. Acceptance inventories, intents, design models and runtime code were not changed by this review.

## Findings

| Finding | Correction | Counterexample coverage |
| --- | --- | --- |
| Hidden inline CSS with `!important`, whitespace before `:` or uppercase property names was counted as a visible footer action. CSS variables/comments could be treated as resolved visibility. | Normalize inline property names, whitespace and the trailing priority flag. Known-hidden actions do not count. CSS functions, inherited visibility and other unresolved forms fail instead of defaulting to visible. Ordinary visible `display:flex !important` still passes. | `OverlayFooterTests.test_inline_css_hidden_and_unresolved_values_cannot_prove_a_footer_action`; native opacity checks include zero, negative, percent, nonfinite and variable values, plus a positive opacity control. |
| Nonempty `closeIcon` Slots were ignored and counted as the native fallback. Object icon `0` was conflated with `false`, while booleans/blank text could be counted as rendered glyphs. | Unresolved custom Slots cannot prove native icon availability and fail. Literal icons follow React's value rendering: numbers including zero render, booleans/null/blank text do not. Explicit closable precedence and disabled checks remain in force. The installed Antd6 `computeClosable` export was exercised for the primitive cases. | `test_custom_close_icon_slot_cannot_be_assumed_to_be_the_native_icon`, `test_literal_close_icon_obeys_react_node_rendering`, plus the existing explicit-closable and disabled tests. |
| NaN coordinates bypassed tolerance comparisons because `abs(NaN) > tolerance` is false. Truthy/non-boolean snapshot flags could also count as ready/complete. | Measured coordinates/heights must be finite numbers, never booleans; heights must be positive. Ready/truncated flags require literal true/false. Reuse eligibility applies typed flags and a finite viewport too. | `ShellHeightTests.test_nonfinite_or_non_numeric_measurements_cannot_pass_tolerance_checks`, `test_ready_and_truncated_flags_require_literal_booleans`, and `SuiteTests.test_reuse_rejects_invalid_layout_flags_and_numeric_viewport`. |
| A garbage timestamp or a date without timezone could satisfy collection provenance. | Require a parseable timestamp with timezone. Identity fields retain their existing strict types. | `SuiteTests.test_collection_timestamp_must_be_an_aware_iso_timestamp`, `test_identity_types_cannot_be_bool_or_missing_strings`. |
| The old duplicate-screenshot counterexample duplicated its state too; the identity-change counterexample omitted other capture metadata. Other gates could mask missing protection. | Duplicate image tests now preserve distinct, complete states. Identity-change tests keep every other capture field valid and alter only the identity. Add separate case review/observation/viewport tests and independent collection-end ready/project/version tests on fresh and reuse paths. | `VisualEvidenceTests.test_duplicate_image_identity_fails_with_complete_state_coverage`, `test_every_case_requires_pass_observation_and_short_viewport`, `SuiteTests.test_changed_context_and_incomplete_page_reads_fail`, `test_collection_rejects_other_status_changes_on_fresh_and_reuse_paths`. |

Nonempty custom icons and unresolved visibility cannot obtain an exemption or a default pass. Their rendered availability needs explicit evidence and checker support before that gate can pass. The existing Preview, pixel/scroll and saved/reopened requirements remain mandatory. This changes no rendered component or business behavior.

Before-fix artifacts under `/tmp/plasmic-context-regression-20261017/`: `review3-probes-before.json`, `review3-overlays-before.log`, `review3-geometry-before.log`, `review3-timestamp-before.log`.

## Counterexample audit of the previous fixes

In disposable copies, the audit applied **45 specified guard regressions**, one at a time. **All 45 were caught by test assertions; none survived.** Import and syntax failures were not counted as successful detection. The real source, live project and installed client were not mutated by this audit. The source hashes in the final mutation report still match the reviewed files.

The 45 cases cover:

- Menu operator/line-break semantics, prototype keys and query/fragment preconditions.
- Button prototype/duplicate props, quoted binding spoofing, required action props and typed hidden/footer/close-disabled flags.
- Close precedence, literal rendering, custom Slots, CSS normalization, unresolved visibility and transparent/nonfinite opacity.
- Typed model/build comparison, comparison CLI equality and duplicate routes.
- Pinned copy hashes, stable/typed offline identity, full capture files/Page fields, complete build fingerprints, aware timestamps and collection-end ready/project/version/build checks.
- Finite/typed geometry and typed snapshot flags on both validation and reuse paths.
- Required visual surfaces/states, duplicate image identity with complete state coverage, file/source hashes, per-case review and behavior integrity under `python -O`.

This is a bounded mutation audit of the specified protections, not a claim of exhaustive program coverage. Positive controls also protect supported configurations from false rejection. The unit tests remain the maintained regression checks; the audit script, exact mutations and individual failure logs are retained with the local artifacts.

Test sources: [binding checks](../../scripts/test_verify_bindings.py), [overlay checks](../../scripts/test_verify_overlays.py), [capture/reuse checks](../../scripts/test_verify_all.py), [layout checks](../../scripts/test_verify_shell_height.py), [comparison checks](../../scripts/test_compare_models.py), [visual/behavior evidence checks](test_verify_evidence.py).

## Actual rerun results

- Python reference/verifier suite: **131 passed**.
- Visual/behavior-input evidence suite: **10 passed**.
- Resource packaging/component coverage: **16 passed**, including packaged Python tests.
- Optimized local Desktop **0.1.14**: fresh complete four-page capture and same-session model reuse both pass evidence integrity and **all six gates**. Every page gets a new layout request on reuse.
- Supplemental requirement behavior: **185 passed** from the final hash-verified capture.
- Historical short-screen evidence: **13 surfaces / 25 files** pass integrity, complete state coverage and source/model/build/branch/revision applicability.
- Four full models and Desktop build are exactly equal to the preceding accepted review. Revision **164**, changeCounter **0**, session `y-puD1BlwMnE`; `pages.json` SHA-256 remains `8594b3c09dff44901e4ffe47278cd8c03c8d45ba908878ef4b4e6077fc008dbd`.
- Independently reviewed expectation/intent hashes are unchanged. No gate was skipped, exempted or weakened. `git diff --check` passes.

This review refreshed current layout and automated checks. It did not rerun Preview or turn historical screenshots into a new Preview execution. The original [complete Preview/persistence acceptance](completion-results.md) and [short-screen observations](short-screen-results.md) retain verified applicability because the source, model and build are unchanged. Runtime source did not change in this review; earlier Desktop/Studio test counts are not represented as rerun. The source-reviewed prototype scope remains unchanged. No release, installation replacement or deployment occurred.

## Reproduce and artifacts

```sh
python3 -m unittest discover -s ai/plasmic/scripts -p 'test_*.py'
python3 -m unittest discover -s ai/plasmic/evals/req075-regression -p 'test_*.py'
node --test packages/plasmic-cli/tests/resources.test.mjs scripts/validate-plasmic-component-coverage.test.mjs
```

Use the unchanged suite configuration with the [live fresh/reuse workflow](../../references/verification.md). Do not reuse a pre-save capture for post-reopen acceptance or cache previous gate outcomes.

Complete local artifacts under `desktop/desktop-report/optimized-context-regression/`:

- `review3-fresh/`, `review3-final/`: complete captures, fresh layouts, exact identities and passing gate reports.
- `review3-behavior/report.json`: 185 cases and exact checked inputs.
- `review3-visual-integrity.json`: 13-surface/25-file artifact integrity and applicability.
- `review3-model-integrity.json`: typed full-model/build equality and unchanged expectation hashes.
- `review3-mutations.py`, `review3-mutation-final-report.json`, `review3-mutation-final-logs/`: bounded mutation audit, source hashes, all 45 cases and assertion-failure logs. The earlier 39-case intermediate run is retained separately.

Final logs under `/tmp/plasmic-context-regression-20261017/`: `review3-python-verified.log`, `review3-evidence-verified.log`, `review3-resources.log`, `review3-mutations-final.log`, `review3-fresh.log`, `review3-final.log`, `review3-behavior.log`. The preceding fixes and their original reproductions remain in [review 2](review2-results.md).
