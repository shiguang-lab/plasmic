# Additional false-acceptance audit and full regression — 2026-10-17

The review found additional false acceptance beyond the previous 45 specified guard regressions. The corrections pass the unchanged four-page REQ075 requirement, including a fresh native Preview run and explicit save/exit/reopen. Acceptance inventories, intents, business models and runtime code were not changed by this review.

## Findings and independent counterexamples

| Finding | Correction | Targeted regression |
| --- | --- | --- |
| Static navigation discarded `disabled`, `type` and `icon`. A disabled link or divider could therefore match an enabled navigation item. | Compare these fields, including their explicit defaults, without bool/number coercion. Check typed flags, registered item types and supported keys; unresolved values cannot prove navigation. The existing dynamic role-query proof remains unchanged. | `StructureTests.test_static_menu_disabled_type_and_icon_changes_are_not_projected_away`; `test_reviewed_static_menu_flags_pass_but_invalid_flags_do_not`. Changed-property cases fail navigation while page identities, routes and shells remain valid. Positive controls retain explicitly reviewed flags. |
| Duplicate named components overwrote earlier entries in the Slot check. A later correct component could hide an earlier wrong one. | Detect duplicates in both intent and actual trees before building name maps. The inspection-only `--allow-defaults` option cannot hide these structural errors. | `CardOwnershipTests.test_duplicate_names_cannot_hide_a_wrong_component`; `test_allow_defaults_inspection_cannot_hide_structural_errors`. The CLI output must contain only the duplicate category. |
| Unprovided Slots ignored plain text and elements without a UUID. Empty intent could silently disable comparison, and Card padding equated `0` with `false`. | Retain direct text for inspection, reject unidentified nonempty Slot content, require nonempty named component intent, and compare typed padding values. Whitespace-only empty defaults and unchanged numeric padding still pass. | `test_unprovided_content_without_uuid_and_plain_text_are_not_empty`; `test_empty_intent_cannot_disable_the_gate`; `test_card_padding_preserves_json_types`. Each negative case requires its precise category and every other category empty. |
| Capture metadata could name one project while the public overview named another. | Bind the overview's Project ID to the requested project on replay and reuse. | `SuiteTests.test_overview_project_identity_cannot_differ_from_capture`: only evidence fails; all six resource gates pass. |
| Replay parsed model bytes independently of the bytes later hashed. Replacing the files and manifest after parsing could attach new hashes to checks of old models. | Pin the manifest first, parse and hash the same raw bytes, then verify those hashes against both the pinned manifest and the current files. Reuse, behavior checks and visual applicability share this loader. | `test_loaded_models_are_bound_to_the_manifest_bytes_during_replay` returns model A while installing model/manifest B; only evidence fails. `test_manifest_hash_mismatch_is_the_only_failing_gate` isolates the other half of the hash comparison. `VisualEvidenceTests.test_visual_replay_rejects_files_replaced_after_loading` checks the same protection before visual comparison. |

Before-fix reproductions are retained under `/tmp/plasmic-context-regression-20261017/`: `review4-probes-before.json`, `review4-structure-before.log`, `review4-slots-before.log`, `review4-evidence-before.log`.

The bounded mutation audit now contains **59 cases: the previous 45 plus 14 additional guard variants. All 59 were caught; none survived.** Each of the 14 additions was run against its exact test method in a disposable source copy. Its own assertion must fail; another test, an import/syntax failure or an execution error cannot count. Slot and evidence counterexamples additionally assert that unrelated categories/gates pass. Source and test hashes are retained and were rechecked against the final files. This is coverage of the specified protections, not exhaustive program coverage.

## Actual regression results

| Check | Result |
| --- | --- |
| Python reference/verifier suite | **141 passed** |
| Visual/behavior-input evidence suite | **11 passed** |
| Resource packaging/component coverage | **16 passed**, including packaged Python tests |
| Desktop tests on optimized sources | **220 passed** |
| Studio prototype/batch/canvas/activity tests | **71 passed** across four files |
| Live fresh, post-reopen fresh and same-session reuse | Evidence integrity and **all six gates passed** in all three captures |
| Requirement behavior from final verified full models | **185 passed** |
| Required historical short-screen state inventory | **13 surfaces / 25 images**, hashes, state coverage and source/model/build applicability passed |
| New native Preview evidence | **29 new images**: 23 at 1440×720, four pages at 1440×1024, two after reopening; indexed with observations, identities and SHA-256 |
| Final model/build and independent acceptance inputs | Exact equality to the accepted baseline; revision **164**, changeCounter **0** |

The original source remains REQ075 v1.36. `context resolve --mode prototype` succeeded and resolved release `b96191054c05eb48709895cd4c20b1130516ee7235112819c07a145fa9c42395`, resource 0.1.2 / CLI 0.1.0. The regression uses the optimized local Desktop 0.1.14 and current local verifier/resources. It is not a publication of the local changes.

## Fresh native Preview and persistence

These are current-run native CUA observations. Public `get_screenshot` workspace captures retain the actual Preview pixels. They are separate from historical-image integrity checks and from the 185 supplemental model checks.

| Flow | Observed result |
| --- | --- |
| Regular SQL | Dangerous DELETE rejected and actions gated; valid SELECT formats/checks; cancellation leaves no ghost preflight success; rerun succeeds with 12,340 / masked five-field Top100. Inner scrolling preserves the title/X, page 5 ends at MX****1099 with next disabled. Changing SQL invalidates Save/Launch; a missing partition gives a recoverable failure. Simulated Save reports initialization. |
| List and roles | Keyword remains a draft until Query; 1002 gives one result, Reset restores 50. All/Mine gives 50/25; page 2 contains 1021–1040. Header/sidebar remain fixed during body scrolling. Readonly removes writes and disables SQL editing/check/submit, including after navigation; operator restores editing and its role survives navigation. |
| One-time flow | Blank/non-Chinese names fail native validation; a valid Chinese name opens the locked ONETIME summary without a duplicate name field. Expiry 366 clamps to 365 and variables fail SQL validation. Validate/preflight/save/launch reaches first selection; detail has five tabs without refresh and no snapshot until formal success. |
| Detail, members and metadata | Seconds-level deadline edit reads back as 19:15:30; basic/storage/partition information remains available. Read-only SQL opens, closes and reopens with native X and no footer. Members page 617 ends at MX****13339 with next disabled, separate from Top100. |
| Applications and export | Blank target shows native validation. During submission target, OK, Cancel and new application are disabled; Review4Campaign appears as a successful record. Query/Reset and failed application drawer work. Export retains GROUP/CSV, masking and audit information; generation reports the existing simulated success. |
| Confirmations and failure recovery | Disable/enable/delete/launch/retry confirmations fit at the short viewport. Cancels preserve records/status; confirmed launch sets selecting. Reenable-failure detail shows numeric zero and the missing-partition drawer; retry adds a running attempt while retaining successful and failed history. |
| Layout | All four pages checked at 1440×720 and 1440×1024. Short-screen modal/drawer bodies scroll and native dismissal/footer actions remain available. The current screenshots supplement the unchanged required 25-state gallery; they do not relabel historical captures as new execution. |
| Save and reopen | Public validation reports four pages, 264 code-component instances, 238 Antd6 instances and no errors/warnings. Explicit save returns `saved:true`, revision 164. Exit through the dashboard and reopen changes session `y-puD1BlwMnE` → `PoyDD4kTwlEf`; the old-session reuse request falls back to a complete fresh collection. After reopening, Query/Reset and SQL check/preflight/close run successfully again. |

Temporary Preview actions do not change the saved design: full `pages.json` SHA-256 remains `8594b3c09dff44901e4ffe47278cd8c03c8d45ba908878ef4b4e6077fc008dbd`. Same-session reuse copies only verified complete models and still obtains all four new layouts. The acceptance configuration and all eight independently reviewed inventory/intent hashes are unchanged. No gate is skipped or exempted. The current checks and model/build equality found no design or functionality regression.

The original prototype scope is unchanged: SQL execution, scheduler, IAM, application delivery and export/audit use the existing simulation. Current evidence does not promote these to production integrations. Retention-option permutations remain covered by requirement checks and prior accepted evidence; they are not represented as newly visited native options in this run.

## Reproduce and retained evidence

```sh
python3 -m unittest discover -s ai/plasmic/scripts -p 'test_*.py'
python3 -m unittest discover -s ai/plasmic/evals/req075-regression -p 'test_*.py'
node --test desktop/tests/*.test.cjs
node --test packages/plasmic-cli/tests/resources.test.mjs scripts/validate-plasmic-component-coverage.test.mjs
```

From `platform/wab`:

```sh
pnpm exec vitest run src/wab/client/copilot/prototype.test.ts src/wab/shared/copilot/batch-result.test.ts src/wab/client/copilot/canvas-inspection.test.ts src/wab/client/copilot/activity.test.ts
```

Use the [unchanged live fresh/reuse workflow](../../references/verification.md) with `suite.json`, followed by `run-behavior.py` and `verify_evidence.py`. Preview and save/reopen remain separate mandatory acceptance; the resource gate report continues to list them as outside its automated scope.

Artifacts under `desktop/desktop-report/optimized-context-regression/`:

- `review4-fresh/`, `review4-reopened/`, `review4-final/`: complete models, current layouts, identities, checked source hashes and seven passing checks.
- `review4-behavior/report.json`, `review4-visual-integrity.json`: 185 behavior cases and required 13-surface/25-state evidence validation.
- `review4-model-integrity.json`, `review4-integrity.py`: exact model/build/expectation equality, old-session invalidation, fresh layouts on reuse and final mutation-input hashes.
- `review4-preview/`, `review4-preview-index.json`, `review4-preview-integrity.py`, `review4-preview-integrity.json`: 29 new PNGs, viewport/session/observation index and repeatable hash/source/model/build applicability check. Historical state coverage is still verified independently by `verify_evidence.py`.
- `review4-saved.json`, `review4-validated.json`, `review4-reopened-state.json`: public persistence and invariant receipts.
- `review4-mutations-final.py`, `review4-mutation-final-report.json`, `review4-mutation-final-logs/`: exact 59 mutations, isolated test targets for all 14 additions, source/test hashes and assertion-failure logs.

Final test logs under `/tmp/plasmic-context-regression-20261017/`: `review4-python-verified.log`, `review4-evidence-verified.log`, `review4-resources-final.log`, `review4-desktop.log`, `review4-studio.log`, `review4-mutations-final.log`, `review4-fresh.log`, `review4-reopened.log`, `review4-final.log`, `review4-behavior.log`, `review4-visual-integrity.log`. `git diff --check` passes. No release, installation replacement or deployment occurred.
