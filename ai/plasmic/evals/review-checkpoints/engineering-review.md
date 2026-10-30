# Independent checkpoint engineering review

Scope: candidate Design / Saved-Page / Integration checkpoint wiring, shared review-mode and fallback policy, and scoped preparation/verification helpers in `/Users/yanxianliang/shiguang/plasmic`. Read-only engineering review; no Desktop/MCP actions or prototype acceptance were performed.

## Actionable finding

### [P1] Do not require a fully passed accept-card review before the runtime evidence it mandates can exist

Primary changed locations: `ai/plasmic/references/review-mode.md:64-72` and `ai/plasmic/references/workflows/prototype.md:42`.

The Saved-Page checkpoint now requires a passing scoped `verify_review.py` result, including every project accept-card rule, before advancing. The final Preview entry additionally requires a passing full-scope saved-output report through that same rule-review procedure. However, the project card always includes `references/design/accessibility.md`. Its Acceptance section, line 21, explicitly requires executing the affected keyboard workflow in actual Preview, states that its accept-card verdict records what was exercised, and rules out a screenshot or model property as proof. Component accept documents also contain actual Preview / save-reopen acceptance requirements (for example Table paging and Tabs motion).

The new checkpoint table says static evidence must retain runtime cases for Integration, but neither the rule-review verdict contract nor its invocation identifies a static-only document verdict. It requires every verdict to be resolved as `pass`, `fail`, or `notApplicable`. For an applicable interactive page prior to Preview, the honest accessibility result is unexecuted: `pass` would overstate evidence, `notApplicable` would falsely exempt an applicable rule, and a pending/failing result prevents progressing to the Integration stage that can produce the evidence. This is a workflow circular dependency, not merely the expected first-run missing-review gate (which the candidate already explains how to handle).

Concrete local reproduction:

1. Run `python3 /tmp/plasmic-checkpoint-engineering-review/repro.py`.
2. This uses the repository's existing `RuleReviewTests` fixture and actual `review_skeleton`, accept-card readers, and `verify_review.check` functions; it generates the scoped `/selector` review including the project accessibility document.
3. Resolve other verdicts using the existing synthetic test helper, leave accessibility pending because actual Preview has not happened, and validate against the fixture's saved identity.
4. Actual output is `passed:false` with exactly the unresolved accessibility verdict errors; allowed values are only `pass`, `fail`, `notApplicable`. Results are saved in `pending-accessibility-result.json` and the corresponding review in `pending-accessibility-review.json` beside this report.

The synthetic fixture demonstrates the record/gating contract only. It does not claim any genuine visual or runtime checks were executed.

Suggested correction: explicitly distinguish static Saved-Page rule evidence from completion of runtime/persistence portions in the existing review mechanism, and permit Preview entry once applicable automatic/static prerequisites pass while those required runtime portions remain explicitly pending. Require their completion only after real Integration execution. Keep the single shared capability/fallback mechanism; do not solve this by declaring applicable accessibility/runtime rules notApplicable or by treating a whole-document static pass as runtime acceptance. Update the relevant accept-card guidance and add a workflow/record test for an interactive page with deferred required Preview checks.

## Verification and limits

- Ran `python3 -m unittest discover -s ai/plasmic/scripts -p 'test_verify_review.py'`: 19 tests passed. This establishes existing unit expectations only; it does not validate the workflow's semantics.
- Ran the focused temporary reproduction above: observed the expected two accessibility pending-verdict errors and no other record errors.
- Inspected all requested candidate files, relevant rule routing, accept-card references, suite sequencing, and review tests. No additional actionable defect was established within this review's scope.
- Confirmed the policy text preserves honest fallback labeling, fresh-context qualification, single shared Desktop ownership, offline capture scope, and limited local-edit scope. Those are instruction-level contracts, not verified host enforcement.
- Did not use Desktop/MCP, install dependencies, spawn agents, modify repository files, or execute actual Preview/save/reopen flows. Therefore no claim about real prototype quality, independence enforcement, tool access, or business acceptance is made.

## Independent repair re-review

Re-read the repaired on-disk review-mode, prototype workflow, planning, verification, prepare_plan, verify_review, and verify_all files. The exact inspected bytes are recorded in `rereview-input-hashes.json` beside this report.

The original P1 is resolved. `review-mode.md` now explicitly distinguishes the Saved-Page checkpoint's static/visual assessment from whole-document final verdicts, retains required Preview/persistence work as pending in the existing task checkpoint, and says not to require the final rule-review verifier before Preview. The workflow and verification entry conditions now permit only the final review gate to remain incomplete for pending runtime/persistence evidence; automatic/static failures and actual findings still block their dependent work. Final acceptance follows actual execution and fresh save/reopen evidence. This removes the original dependency cycle without introducing a second verdict/case schema or exempting applicable accessibility rules.

Additional adversarial record checks, using the existing synthetic unit fixture and real verifier, are recorded in `rereview-results.json`:

- Complete synthetic record at the same identity: passes record validation only.
- Old review against a new reopened session: fails `checkedState`.
- Required final rule left pending: fails `ruleReview`.
- Existing failed rule carried into fallback: fails `ruleFinding`.
- Changed plan with the same capture identity: fails `checkedPlan`.

Reran `python3 -m unittest discover -s ai/plasmic/scripts -p 'test_verify_review.py'`: 19 tests passed in 12.702 seconds. The suite includes scoped capture/full-review rejection, required shared-rule failures, pending verdict rejection, identity/plan/rule staleness, and fallback retention of findings.

No additional actionable cycle, erroneous release, or stale-review regression was established in the repaired candidate. The instruction-level static checkpoint remains deliberately non-machine-enforced, and the standalone rule validator still cannot prove execution, independence or live freshness; the repaired documents explicitly preserve these limits and require the automatic evidence checks plus actual execution and fresh post-reopen capture. No Desktop/MCP interaction or actual prototype acceptance was performed during re-review.

Additional completed verification: `python3 -m unittest discover -s ai/plasmic/scripts -p 'test_verify_all.py'` ran 48 tests in 108.416 seconds, all passing. These tests use local fixture/fake Desktop objects; their `Collecting layout` messages were not live Desktop/MCP interactions. Relevant coverage includes missing/failing final review, changed session/revision/changeCounter, evidence reuse across reopen, scoped captures versus full scope, and input/evidence mutation detection.

Also inspected the final `prepare_plan.py` generated guidance update: project and Page accept cards now direct static findings to the checkpoint and retain runtime/persistence work pending; constraint/document verdicts and review-skeleton completion follow required execution. Updated `rereview-input-hashes.json` to include these final bytes. This is a guidance change with no added validation logic; the suite was not rerun a second time solely for that wording update.
