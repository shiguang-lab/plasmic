# Source-driven behavior acceptance

Read when planning business behavior and again when recording Preview outcomes. This uses the existing structure inventory, case arrays, runtime manifest and verifier; it introduces no separate rule schema. Static model/layout and visual checks remain in [unified verification](verification.md).

## Plan from the source

Derive expected results before generation. Use the following review dimensions only where the source requires the behavior; do not impose another product's states, roles, field rules or services. Record cases in `runtimeCases` or context/action `cases` using the existing [case fields](design/component-policy.md#plan-fields-and-case-kinds), with source evidence, `given` and concrete native `checks`.

| Source-defined behavior | Cases to derive | Observable result |
| --- | --- | --- |
| Submit, navigate or open record details | Distinct input/record A and B; direct entry/back when required | Destination retains submitted values or selected identity; all detail regions belong to that object |
| Validate, calculate or authorize | Valid and invalid inputs, applicable boundaries/conflicts, permitted and denied contexts | Actual values/records and guards, including unchanged data on rejection |
| Edit inputs after validation/async work | Change a dependency after success; failed/retried completion when required | Old results cannot approve different inputs; pending/failed states block the required actions |
| Mutate, copy or transition | Confirm/cancel, repeated actions and each source-defined type/state branch | Target record/count/identity changes as specified; unrelated records remain intact |
| Query, paginate or change scope | Matching/empty/reset, page/size changes and return sequence | Actual rows, total and current scope agree; visible controls alone do not prove the effect |
| Overlay, hidden Tab or dependent region | Reopen/switch between different records and applicable states | Complete fields/results, empty/error states and native ownership update together |

Review coverage in both directions before generation: each in-scope source rule has a planned case or a specific non-runtime review, and each expected result has a source. Keep exclusions and unavailable fixtures with their reasons in the existing plan; do not silently delete cases. Source completeness is a review against the original material, not a percentage inferred from how many authored cases pass. A static surface need not invent a business action just to populate runtime cases.

For a cross-page assertion, retain the originating Page/owner and declare the expected destination as case `assertPath` before execution; otherwise assertions belong to the Page's own path. Include concrete object/input values in `given` and destination field/record checks. A route change or success Message alone does not establish data transfer. Keep mock/API limits explicit. Review editor/Preview pixels for source grouping/alignment and record actual observations.

At delivery reconcile the original rule inventory with the actual evidence: report passed, failed, unexecuted and invalid-evidence runtime cases separately, plus source, visual and persistence reviews. An excluded behavior needs its source/scope reason; a required behavior blocked by access or tooling remains unverified. Do not derive expectations from generated output, replace failed cases with easier ones, or describe declared-case execution coverage as complete requirement coverage.

## Record and verify execution

The monitor retains each native Preview call as a JSONL record with `input` and `result`. Prepare the existing manifest from the frozen plan and stable saved capture without calculating hashes or copying case IDs by hand:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py runtime-manifest /task/structure-expectation.json --capture /task/verify-final/capture.json --pages /task/verify-final/pages.json --output /task/runtime-manifest.json
```

The command verifies source-backed runtime plan fields and the capture's identity/pages hash. It writes a new file with all planned cases and `assertLine:null`; it executes no cases and claims no passes. After each real case, fill its one-based assertion line from the trace. Leave unavailable/unexecuted cases null and retain reasons in the existing task plan. For example, after execution:

```json
{
  "planSha256":"HASH_OF_STRUCTURE_EXPECTATION_FILE",
  "pagesSha256":"HASH_OF_CAPTURED_PAGES_FILE",
  "cases":[{"path":"/groups","id":"enable-from-inactive","assertLine":42}]
}
```

`assertLine` is the one-based physical line in that Preview JSONL, not a hand-written success flag. Every case needs a distinct native assertion whose input and returned checks exactly match the plan and whose context matches the captured project/branch/session/revision/changeCounter and expected path (`assertPath`, otherwise the owning Page). A flow originating on `/records` can assert its submitted values on `/records/new` without moving the case away from its source owner. Do not reuse a different scenario's pass or post-repair results for an old model. Hash binding is integrity evidence, not proof that expectations were authored before observing output; retain the pre-generation plan and source review.

```sh
python3 RESOURCE_ROOT/scripts/verify_runtime.py --expectations /task/structure-expectation.json --manifest /task/runtime-manifest.json --trace /task/preview.jsonl --capture /task/verify-final/capture.json --pages /task/verify-final/pages.json --report /task/runtime-report.json
```

The checker is read-only and does not open Preview. Its `cases` and `counts` distinguish `passed`, `failed`, `unexecuted` and `invalid_evidence`; `executedCaseCount` counts only matched actual assertions, including their failures. A missing/null line is unexecuted; stale identity, invalid/reused lines and mismatched checks cannot count as executed or passed. `--report` saves the full report and prints bounded diagnostics; `--full` prints it all. Inspect each failure on disk before repairs. Repaired models require fresh matching captures and execution evidence. The final save/reopen starts a new session without changing the model: compare the exercised capture with the reopened one under [collect and verify](verification.md#collect-and-verify); equal models carry this report forward, any difference requires re-execution.

It verifies declared native assertions; fixture authenticity, source meaning/completeness, visual quality and unasserted effects remain separate review dimensions. Reconcile results with the [source behavior review](#plan-from-the-source); a high pass count cannot establish omitted requirement coverage. Pending cases and failed assertions prevent runtime acceptance. Never report a static gate pass as complete functional acceptance.
