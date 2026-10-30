# Prototype review mode

Use this policy at the [review checkpoints](#review-checkpoints), not only at delivery. Prefer an independent subagent when available; otherwise use the same-conversation fallback below. The main agent owns planning, generation, finding triage and repairs. Reviewers check the assigned artifact without becoming its authors. The same [gates](verification.md), [business cases](behavior-acceptance.md) and evidence standards apply in both modes.

## Review checkpoints

| Checkpoint | Inputs and reviewer responsibility | Completion boundary |
| --- | --- | --- |
| Design, before composition | Original sources, in-scope Page/flow inventory, `pageStructure`, source wireframes, current Page plan, selected template/contract captures and selection results. Independently reconcile source coverage, simultaneous/sequential regions, sizing/scroll/action decisions, template fit and acceptance cases. Check omissions in the plan as well as incorrect entries. | Current Page is ready to compose only after required findings are resolved and current-Page selection preflight passes. Review sibling structures at region level; do not demand their detailed components. |
| Saved Page, before advancing | Passing scoped automatic gates, current plan/contracts, saved model/layout and opened screenshot pixels, including required hidden branches. Check native ownership, actual region relationships, content/copy, space allocation and reachable actions. Reuse applicable project rules as well as the Page card. | Record static/visual findings against that capture; resolve them before advancing. Keep Preview and persistence checks explicitly pending for Integration. This checkpoint establishes static readiness, not final Page acceptance. |
| Integration, before delivery | Complete in-scope Pages/destinations, statically reviewed saved output, source-derived runtime cases and fixtures. Execute Preview flows, observe data/state effects and failure recovery, then verify save/reopen using fresh captures and model comparison. Reconcile outstanding findings and evidence from earlier checkpoints. | Applicable runtime cases and persistence checks pass; the final rule review is bound to the reopened model and current plan/rules. No required finding or unexecuted required check remains. |

Choose the mode through the single [capability decision](#select-from-actual-capabilities) for each checkpoint. Structure-only requests receive design review of the draft and its assumptions; missing live contracts stay explicit, and draft approval does not authorize composition. Local edits review only affected regions, rules and flows: a caption-only edit needs no new structure review or unrelated cross-page testing. Record a concise non-applicability reason in the task checkpoint rather than manufacturing empty reviews. Read-only review requests do not authorize repairs.

Run deterministic checks before assigning judgement work. A failed automatic check is repaired first unless diagnosis is the assigned review task. Each checkpoint is an internal quality check, not a routine user approval request. Readiness blocks only dependent work; independent Pages or source work may continue when they do not compete for shared Desktop control.

## Select from actual capabilities

Use the host's available delegation tools and their live schemas. Independent review requires a fresh conversation without the generator's history, access to the scoped inputs and tools needed for the assigned checkpoint, and a supported result-return mechanism. Confirm the child starts and can read its inputs. A listed tool or a fork inheriting generation history does not establish independence. Do not infer capabilities from a client/model brand.

Design review can use sources and captured contracts without editor control. Saved-Page review can inspect complete, state-bound models and pixels offline; integration requires the actual Preview tools and fixtures. A child without those tools may report its completed subset, but cannot pass the unavailable checks.

If delegation is absent, disabled, denied, lacks isolation/access, or cannot return a usable review, perform the outstanding checks in the main conversation under fallback. Retain the actual reason, findings and valid evidence. If the child had shared Desktop access, confirm it is inactive before reclaiming control; a timeout or stop request alone is insufficient. Missing MCP/Preview access for both agents leaves dependent checks unverified. Do not retry delegation indefinitely or use fallback to erase a failed review.

Do not enable plugins, change permissions/configuration or launch an external CLI to bypass unavailable delegation. Explicit user restrictions take precedence. A new checkpoint may use a different mode if capability changes; label each result accurately.

## Page composition handoff

Composition may go to a fresh-context child under the same capability checks. A card's `readingBudgetExceeded` does not establish delegation support; unavailable delegation follows [per-Page context handling](workflows/prototype.md#complete-one-page-at-a-time). Supply resolved resources/version, plan/route, design-review checkpoint, compose card/ledger, contracts/templates, suite/Slot intent, editor identity and pending work. The composer reads its inputs, composes/saves the Page, runs scoped automatic gates and returns evidence plus a checkpoint. A plan defect returns to the main agent; the composer does not rewrite expectations to fit its output. It cannot independently review its own Page. Saved-Page review uses another child or the disclosed main-conversation fallback.

## Independent review handoff

Start a fresh review context for each checkpoint; the same reviewer may handle its repair regression. Give a self-contained review-only assignment containing:

- Checkpoint, exact Page/region/flow scope, exclusions and required checks.
- Original requirement/design sources, resource root/version and relevant rule/card paths. Include the artifact's recorded rationale as something to assess; do not replace sources with the main agent's summary or suggest a passing conclusion.
- The actual draft/plan and source/template/contract evidence. For saved/runtime work include suite, captures, screenshots, cases/fixtures and project/branch/session/revision/changeCounter/build. Design-only work has no saved-model identity: do not invent one.
- Output location and completion mechanism; permitted evidence collection and shared Desktop ownership, if required.

The reviewer reads original sources and actual artifacts, checks omissions, runs applicable checks and returns findings. It may write reports/evidence but must not edit the prototype, application code or acceptance expectations, delegate its review again, install libraries or switch projects outside the assigned scope. It follows the skill's client implementation boundary. Use host-enforced restrictions when available; an instruction is not an access-control guarantee.

For live review, the main agent saves and yields shared Desktop control. Only one agent operates the editor/Preview at a time; verify live identity at handoff and return. File/context isolation does not isolate the application. An offline reviewer reads immutable captures; if the main agent changes their source model, its verdict applies only to the captured state and must be reconciled before advancing. A review child keeps the existing project; it does not create an editor session or project merely to gain independence.

## Checkpoint records

Use the existing task checkpoint to record stage, scope, `reviewMode`, reviewer identity or `fallbackReason`, reviewed input versions/hashes, evidence/report paths, outcome and unresolved findings. A design review binds its source/plan/contracts, not fictitious screenshots or `checkedState`. Saved-Page review records static/visual results and pending runtime/persistence checks in this checkpoint. Integration completes the existing rule-review file below and additionally references the runtime report/trace, reopened capture and model comparison; do not replace these with a second case schema or a single “passed” assertion.

Separate passed, failed, unexecuted and invalid-evidence checks. Each finding identifies location, expected versus actual, its source/rule or observed usability failure, impact and evidence; runtime findings include reproducible steps. Required fixes block the affected next stage. Unsubstantiated preferences and optional improvements do not. Missing required evidence is unverified, never notApplicable or pass. Non-applicability needs a task-specific scope reason.

A checkpoint records a decision, not automatic proof of semantic correctness. Design checkpoint records are reviewer evidence, not an additional machine gate. Selection checks completeness/contracts; rule-review checks records and saved-state binding; runtime verification checks executed traces. Report those limits separately.

## Rule review

Rules without a deterministic gate need explicit review. Run the project and current Page accept-card reader commands, then check their rules and hard constraints against the source, saved model and opened pixels. Review [copy economy](design/content-review.md#copy-economy) by meaning and placement even when length budgets pass. Global project rules still apply to a scoped Page; unrelated sibling component contracts do not become review work.

At Saved-Page review, read the accept cards and assess their static/visual portions; retain required runtime/persistence checks as pending in the checkpoint. Acceptance documents mix these evidence types: a static pass cannot pass the whole document. Do not require the final rule-review verifier before Preview.

After applicable Preview and persistence checks are complete, prepare the final review. For a single-Page task:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py rules PLAN --project --stage accept --ledger ACCEPT_READS
python3 RESOURCE_ROOT/scripts/prepare_plan.py rules PLAN --page ROUTE --stage accept --ledger ACCEPT_READS
python3 RESOURCE_ROOT/scripts/prepare_plan.py review-skeleton PLAN --page ROUTE --capture RUN/capture.json --mode independent --output PAGE_REVIEW
```

Execute the reader commands emitted by the cards. Use `--mode fallback` when appropriate. The skeleton leaves reviewer/reason and every verdict pending. It includes the shared project rules and selected Page rules, binds `checkedState` to the capture's projectId/branchId/sessionId/revision/changeCounter, `checkedPlanSha256` to the complete plan, and each rule's `sha256` to current bytes. Fill only observed results: `pass` needs evidence, `fail` preserves its finding, and `notApplicable` needs a specific scope reason. Preserve each hard constraint's exact text/order and record its verdict. A document exemption cannot dismiss a failed or pending constraint supplied under it.

Then validate the completed review against the same capture:

```sh
python3 RESOURCE_ROOT/scripts/verify_review.py PLAN --page ROUTE --capture RUN/capture.json --ledger ACCEPT_READS --review PAGE_REVIEW
```

`verify_all.py --page` runs automatic prerequisites and skips its integrated review gate. The Saved-Page checkpoint still requires the static/visual review above before advancing. The separate command validates final single-Page acceptance after runtime/persistence checks; it cannot validate a partial review. Do not remove sibling Pages from the source plan to prepare a scoped review. A scoped review-skeleton omits sibling verdicts while retaining the complete plan digest. Unresolved placeholders, unknown/duplicate Pages or rules, missing verdicts, failed findings and stale inputs fail validation. `--page` still checks the shared project rules; it does not require sibling Page verdicts.

For final full-scope acceptance, omit `--page` from skeleton/verification, configure `suite.review: {ledger, results}` and rerun `verify_all.py` on the final capture. Pre-Preview collection may fail only the incomplete review gate; inspect its diagnostics, retain pending runtime/persistence verdicts, and resolve all automatic/static failures before Preview. After execution, fill evidence-backed verdicts and rerun the full suite against the unchanged state. A failed review finding still blocks its dependent stage. Follow [capture reuse](verification.md#reuse-within-the-same-live-design-state); post-reopen evidence must be fresh. A full-project review cannot reuse a scoped capture as proof of all Pages. For local edits outside the full suite's library/scope, retain focused review evidence and explicit coverage limits.

A changed plan, rule or model invalidates its bound review. At final integration, regenerate the skeleton for the current full scope, compare with earlier evidence and revalidate affected regions/shared consumers plus cross-page flows. Carry forward unchanged findings/evidence only after checking their applicability; do not blindly copy verdicts or replace digests/state to make stale reviews pass. Shared rules need one full-scope verdict, not repeated whole-project reviews for each Page.

Without `--capture`, standalone verification checks record completeness only and reports saved-model binding unverified. Supplied captures must have a valid identity and a compatible Page scope. These checks cannot establish the reviewer's independence, judgement, actual execution or persistence by themselves.

## Review results

Return compact findings and evidence paths through the host's supported result mechanism. The main agent reproduces findings before fixing, or records concrete evidence for rejecting a false positive. Keep disputed requirements unresolved until their authority is established; do not downgrade a defect because it is inconvenient.

Batch repairs, rerun affected automatic checks, then return the changed artifact and updated evidence to the reviewer for regression. A design change updates the plan before composition; an implemented change requires save/recapture. Runtime repair closes Preview before editing and follows the existing [Preview-round limit](workflows/prototype.md#final-preview-review). Check related consumers, not unrelated Pages. If repeated corrections produce no new evidence or progress, checkpoint the unresolved cause and seek the missing information rather than looping or claiming a pass.

## Same-conversation fallback and delivery

Fallback performs the same checkpoint checks as a distinct review pass against original sources and actual output. Record why independent execution was unavailable, which checks were completed and which remain blocked. It is not self-declared independent approval, a reduced checklist or permission to discard child findings. An incomplete child review remains pending until the missing work is performed. When executors change, retain each completed subset's scope and mode; checks completed by the main agent cannot inherit an independent label.

Final reporting names actual modes/scopes, evidence and unresolved limitations. Review launch, file existence and script success alone never establish business acceptance. Keep required source, static, visual, runtime and persistence outcomes distinct.
