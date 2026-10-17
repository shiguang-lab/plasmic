# Further false-acceptance audit and full regression — 2026-10-17

This review found additional false acceptance beyond the previous 59 specified guard variants, plus two false-rejection cases. Corrections are confined to verification and its regression tests. The independently reviewed REQ075 inventories/intents, design models and application runtime are unchanged. Full regression passes using the optimized local Desktop and current local resources.

## Findings and isolated counterexamples

| Finding | Correction | Proof that another check cannot mask the test |
| --- | --- | --- |
| Escaped CSS property names/values and comments before properties could hide a required footer action while the checker counted it as visible. | Escaped visibility declarations and inline comments remain unresolved and fail explicitly. Escapes in unrelated background-image values do not cause false rejection. No runtime-evidence exemption is introduced. | `OverlayFooterTests.test_css_escapes_cannot_prove_footer_visibility` and `test_css_comments_cannot_obscure_a_visibility_property` require exactly their respective diagnostic, with an otherwise valid two-action overlay. |
| Duplicate CSS declarations and merging component style props lost `!important` priority. A normal declaration could hide the fact that an important declaration makes the button invisible; the reverse case could reject a visible button. | Preserve normalized property names, declaration order and important priority through both parsing and prop merging before counting actions. | `test_important_declarations_cannot_be_overwritten_by_later_normal_css` requires only the visible-action mismatch and the exact remaining action. Positive controls cover normal order, important order, an earlier winning declaration and important display/opacity declarations combined with conflicting component props. |
| Repeated direct Slots were resolved by taking the first, allowing reviewed content to shadow a second same-name Slot. | Reject duplicate direct Slot names in both intent and actual component trees. `--allow-defaults` cannot waive them or empty intent. | `CardOwnershipTests.test_duplicate_slots_cannot_shadow_reviewed_content` requires only `duplicateSlots`. `test_allow_defaults_inspection_cannot_hide_structural_errors` separately runs duplicate-component, duplicate-Slot and empty-intent CLI cases, asserting exit 1 and exactly one error category in each. |
| Legitimate text-only Card content was classified as empty because only element children were counted. | Nonblank direct text satisfies nonempty content; whitespace alone still fails. This matches the Card's existing ReactNode children contract. | `test_text_only_card_content_is_not_empty` accepts unchanged text and requires only `emptyCards` for whitespace. This corrects a false rejection without accepting empty content. |
| Form rule parameter comparison treated boolean `true` as numeric `1`. | Compare specified rule parameters with typed JSON equality. | `FormCheckTests.test_rule_parameters_preserve_json_types` accepts numeric length 1, then changes only that length to true and requires exactly the field's missing-rule diagnostic. No ownership, inventory, label or control error can satisfy it. |
| Inventory/intent hashes were read after gate execution, independently of the bytes parsed. A replacement could attach a different file identity to earlier checks. | Load input bytes once and parse those same bytes; record their hashes, then fail evidence integrity if any checked file changes during the run. Every gate still runs and reports separately. | `SuiteTests.test_checked_inventory_and_intent_hashes_bind_the_loaded_bytes` independently replaces `forms.json` and `intent.html` after reading. Only evidence may fail; all six gates must pass on the originally loaded bytes, and the recorded hash must match those bytes. Removing either the byte cache or the end-of-run check is detected. |

Before-fix probes and failing tests are retained in `/tmp/plasmic-context-regression-20261017/review5-probes-before.json` and `review5-tests-before.log`. An actual IAB browser rendered the CSS fixture: all eight hidden counterexample buttons were absent from its accessibility tree, and all four valid visible controls remained, including important class rules combined with conflicting inline style props. The fixture hash and observed controls are in `review5-css-runtime.json`; this browser evidence is separate from unit-test inference.

The final bounded audit contains **71 variants: 59 retained plus 12 additions**. **All 71 are caught; none survive.** Each new variant runs only its exact test method and must fail that method's assertion, without an execution/import/syntax error. The final report records these targets, failure logs and source/test hashes. The two additional CLI mutations specifically remove duplicate-Slot and empty-intent protection from inspection mode; neither can hide behind a different Slot error. This is coverage of specified protections, not exhaustive program coverage.

## Actual regression results

| Check | Result |
| --- | --- |
| Reference/verifier tests | **148 passed** |
| Visual/behavior-input evidence tests | **11 passed** |
| Resource packaging/component coverage | **16 passed**, including packaged verifier tests |
| Desktop tests | **220 passed** |
| Studio prototype/batch/canvas/activity tests | **71 passed**, four files |
| Fresh collection, post-reopen collection, same-session reuse | Evidence integrity and **all six gates passed** in each |
| Requirement behavior from final complete models | **185 passed** |
| Required short-screen gallery | **13 surfaces / 25 state images**, integrity, coverage and applicability passed |
| Prior native regression gallery | **29 images**, current source/model/build/branch applicability and hashes passed |
| Current native Preview artifacts | **15 new images**: nine short-screen, all four pages at desktop height, two after reopening |
| Model, build and independent acceptance inputs | Exact equality to the accepted baseline; revision **164**, changeCounter **0** |

`context resolve --mode prototype` succeeded: release `b96191054c05eb48709895cd4c20b1130516ee7235112819c07a145fa9c42395`, resource 0.1.2 / CLI 0.1.0. The running client remains the optimized local Desktop 0.1.14. Current verifier/resource changes are tested locally; no release or installation replacement occurred.

## Native Preview and persistence

Fresh native CUA checks cover all four pages at **1440×720** and **1440×1024**, with current pixels retained through public Desktop workspace captures. The list's draft/query/reset and All/Mine flows give 50 → 1 → 50 and 50 → 25. Required Chinese-name validation keeps the new-group modal open with its error and native X/Cancel/OK available. Both SQL pages reach their bottom actions through body scrolling while the shell header/sidebar remain fixed.

Dangerous DELETE is rejected; valid SELECT enables submission. Both SQL preflights succeed with 12,340 total and masked five-field Top100, and native close restores the gated actions. Detail retains its default Overview, six regular-group tabs, two-column basic/storage information and read-only SQL with X and no footer. Selection history and its failure drawer preserve numeric zero and the missing-partition reason. Readonly persists across navigation and disables SQL edit/check/submit; operator restores editing, then administrator is restored.

Public validation returns four pages, 264 code-component instances, 238 Antd6 instances and no errors/warnings. Explicit save returns `saved:true`, revision 164. Exiting through the dashboard and reopening changes session `PoyDD4kTwlEf` → `xJtvKE0OzGuw`. Offering the prior-session capture correctly causes complete fresh collection. After reopening, initial overlays are closed, list Query/Reset again gives 1/50, and SQL validation/preflight/native close work again. Same-session reuse then refreshes all four layouts and reruns every gate.

Full `pages.json` SHA-256 remains `8594b3c09dff44901e4ffe47278cd8c03c8d45ba908878ef4b4e6077fc008dbd`; the build, suite configuration and all eight reviewed inventory/intent files are unchanged. The 185 requirement cases rerun against this exact final capture. Current native observations supplement the independently revalidated required 25-state gallery and prior 29-image native run; those historical images are not counted as new execution. Required states and acceptance criteria were not removed, waived or reduced. No design or functional regression was found.

The original prototype boundary remains: SQL, scheduler, IAM, application delivery and export/audit use the existing simulation. Unchanged state permutations and prior application/export/confirmation observations retain verified applicability; this review does not claim a fresh execution of every historical state or production integration.

## Reproduce and retained evidence

```sh
python3 -m unittest discover -s ai/plasmic/scripts -p 'test_*.py'
python3 -m unittest discover -s ai/plasmic/evals/req075-regression -p 'test_*.py'
node --test desktop/tests/*.test.cjs
node --test packages/plasmic-cli/tests/resources.test.mjs scripts/validate-plasmic-component-coverage.test.mjs
```

From `platform/wab`, run the same four-file Vitest command in [review 4](review4-results.md). Live collection/reuse follows the [verification contract](../../references/verification.md), followed by `run-behavior.py` and `verify_evidence.py`. Automated reports still explicitly exclude Preview/source interpretation/save-reopen from their own scope; the separate native and persistence records above supply that evidence.

Artifacts under `desktop/desktop-report/optimized-context-regression/`:

- `review5-fresh/`, `review5-reopened/`, `review5-verified/`: complete captures and layouts. `review5-fresh-replay/` and `review5-reopened-replay/` rerun the two earlier raw captures against the final checker; the final live reuse in `review5-verified/` also refreshes all layouts. Each passes all seven checks with exact final checked source hashes.
- `review5-behavior-verified/report.json`, `review5-visual-verified.json`: 185 requirement cases and required 13-surface/25-state gallery validation against the final capture/checker.
- `review5-model-integrity.json`, `review5-integrity.py`: exact models/build/expectations, old-session invalidation, fresh layouts on reuse and current mutation-source/test hashes.
- `review5-preview/`, `review5-preview-index.json`, `review5-preview-integrity.py`, `review5-preview-integrity.json`: 15 new PNGs with viewport/session/observation/hash records and repeatable applicability checks.
- `review5-reused-preview-integrity.py`, `review5-reused-preview-integrity.json`: prior 29-image gallery checked against the current final capture without overwriting its original report.
- `review5-saved.json`, `review5-validated.json`, `review5-reopened-state.json`: public persistence/invariant receipts.
- `review5-mutations-verified.py`, `review5-mutation-verified-report.json`, `review5-mutation-verified-logs/`: exact 71 variants, isolated targets, hashes and assertion-failure logs. Earlier 68/70-variant intermediate runs are retained separately.
- `review5-css-runtime.json`: actual browser observations; fixture at `/tmp/plasmic-context-regression-20261017/review5-css/index.html`.

Final logs under `/tmp/plasmic-context-regression-20261017/`: `review5-python-verified.log`, `review5-evidence-verified.log`, `review5-resources-complete.log`, `review5-desktop-verified.log`, `review5-studio.log`, `review5-mutations-verified.log`, `review5-fresh.log`, `review5-reopened.log`, `review5-fresh-replay.log`, `review5-reopened-replay.log`, `review5-verified.log`, `review5-behavior-verified.log`, `review5-visual-verified.log`. `git diff --check` passes. No publish or deployment occurred.
