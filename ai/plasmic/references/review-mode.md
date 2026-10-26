# Prototype review mode

Read before prototype acceptance. Prefer an independent subagent for review; the main agent owns source planning, finding triage and repairs, and owns generation unless it hands one Page to a [composer child](#page-composition-handoff). Both modes use the same [verification gates](verification.md), [business cases](behavior-acceptance.md) and [execution stages](workflows/prototype.md#execution-plan-and-completion-evidence). Delegation does not replace per-Page checks or defer them until delivery.

## Select from actual capabilities

Use the host's available delegation tools and their live schemas. Independent review requires a fresh conversation without the parent's design history, access to the scoped source files and required inspection/Preview tools, and a supported result-return mechanism. A listed tool is only a candidate: confirm the child starts and has the needed access. Do not assume access or tool names from the client/model brand. A fork inheriting design history does not qualify as independent review.

If delegation is absent, disabled, denied, lacks isolation/access, or cannot return a usable review, continue acceptance in the main conversation. Retain the actual reason and completed evidence; confirm the child is inactive before reclaiming shared Desktop control. A stop request or timeout alone does not confirm inactivity; keep shared Desktop operations blocked while control is uncertain. An unfinished review remains pending until actually performed. Missing MCP/Preview access for the main agent remains a blocker for those checks, not a pass.

Do not enable plugins, alter host permissions/configuration or launch an external CLI to bypass unavailable delegation. Explicit user restrictions on delegation take precedence. Failed acceptance assertions are findings to repair, not reasons to switch modes or discard the review.

## Page composition handoff

Composition of one Page may go to a fresh-context child under the same capability checks as review. A card's `readingBudgetExceeded` signal does not override these checks; unavailable delegation follows [per-Page context handling](workflows/prototype.md#complete-one-page-at-a-time). Supply only disk inputs: the resolved resource root/version, the plan file and Page route, the compose card output and ledger path, contract/template captures, suite and Slot intent paths, project/branch/session/revision/build, and the checkpoint. The child reads its card, composes and saves that Page, runs the scoped gates and returns compact results, evidence paths and an updated checkpoint. It does not change source decisions or expectations; a plan defect returns to the main agent. Review of that Page remains a separate child or fallback pass.

## Independent review handoff

Use a fresh-context child with a self-contained task. Supply original requirement/design paths and scope, the resolved resource root/version and required references, the existing plan/suite, project/branch and current editor session/revision/changeCounter/build, routes/node IDs, evidence paths and necessary test fixtures. Ask it to read sources and actual output independently, including omissions in the plan; do not seed the task with the main agent's reasoning or pass conclusions. A new agent conversation must keep the existing project; it does not require a new project or editor session.

Assign review only: inspect saved models/contracts, run applicable verification scripts, open screenshot pixels and execute scoped Preview cases. The reviewer performs its assigned checks itself without delegating again. The child may write evidence and reports, but must not edit the prototype, code or acceptance expectations. It follows the same client implementation boundary as the main agent. Use host-enforced tool restrictions when available; a prompt alone is not an access-control guarantee.

One agent controls the shared Desktop at a time. Save and hand over before review; the main agent pauses editor/Preview operations until the child returns control. Verify live identity on handoff and reacquisition. Context isolation does not isolate the application, filesystem or Preview state. Use fresh captures after model/session changes and the existing evidence-reuse rules otherwise.

Copy economy needs review even when the budgets pass: check the wording itself against [copy economy](design/content-review.md#copy-economy), not only the gate's lengths and repeats.

## Rule review

Rules without a gate need explicit review. Run every command of the project card (`prepare_plan.py rules PLAN --project --stage accept --ledger /task/accept-reads.jsonl`, once) and of each Page's `prepare_plan.py rules PLAN --page ROUTE --stage accept --ledger /task/accept-reads.jsonl` card, then check each listed document's hard constraints and section rules against the saved model and opened pixels. Project rules (layout, naming, content review, accessibility, and record context or permissions when Pages need them) are reviewed once across all Pages. Examples: which Column is the main text Column and whether its ellipsis Tooltip works, field-semantics control choice, Card header and edge ownership, Descriptions column count, Tag-versus-text presentation. A passing gate or a read ledger does not cover them.

Start `/task/rule-review.json` from `prepare_plan.py review-skeleton PLAN --capture FINAL_RUN/capture.json --mode independent|fallback --output /task/rule-review.json`: it lists every project and Page accept-card document, one pending verdict per hard constraint, and binds `checkedState` (projectId, branchId, sessionId, revision, changeCounter) to the captured saved model. Keep its `checkedPlanSha256` and each rule’s `sha256`: these bind verdicts to the reviewed plan and rule bytes. Changed requirements or rules require a new review, even if the editor state is unchanged. Replace every `__DECIDE__` value, including reviewer identity, reasons and evidence: `pass` needs evidence observed in that state (screenshot/layout paths that exist or observed model values), `notApplicable` a specific `reason`, and `fail` keeps its `finding` until the repair is reviewed again. A passing document records one ordered constraint verdict per hard constraint, retaining the exact current `constraint` text from the skeleton; an individual constraint may be `notApplicable` with its own reason. A whole-document exemption may omit constraint entries, but any entries retained must be complete and resolved: the document's `notApplicable` verdict cannot dismiss a failed or pending constraint. Set `reviewer` (independent) or `fallbackReason` (fallback) to the actual mode.

Record each planned Page exactly once and each document on its accept card exactly once; unknown Pages or documents and duplicate entries fail. A review must cover at least one planned Page; an unknown `verify_review.py --page` route fails instead of producing an empty successful review. Configure the suite's `review: {"ledger", "results"}` and rerun the final `verify_all.py` with `--reuse-evidence` on that capture; it fails without the review, with a missing or pending verdict, a stale read, another `checkedState` or any `fail`, and reports the recorded review mode. Per-Page runs skip this gate. These checks establish record completeness and detect unresolved findings; evidence paths and reasons still need the reviewer's semantic judgement. A verdict does not prove that the reviewer opened the evidence, judged correctly or actually had an independent context.

For standalone `verify_review.py`, supply `--capture` to bind the verdicts to the saved model. An explicitly supplied capture with a missing or invalid `after` identity fails. Without `--capture`, the result checks record completeness only and reports model-state binding as unverified.

## Review results

Return scoped checks with passed, failed, unexecuted and invalid-evidence results; for findings include location, source-backed expected versus actual behavior, impact, reproduction steps and evidence paths bound to the checked state. Missing evidence must remain explicit. Return compact findings and complete evidence on disk through the host's supported completion/message mechanism.

The main agent reproduces findings before fixing, or records evidence for rejecting a false positive. Close Preview before edits, save and rerun affected gates. Return the changed state and affected cross-page flows for reviewer regression within the existing Preview-round limit. Do not count earlier evidence as acceptance of a repaired model.

## Same-conversation fallback and delivery

In fallback, the main agent performs a separate review pass against the original sources, frozen expectations and actual output, then repairs and rechecks through the same stages. Keep all required source, static, visual, runtime and persistence checks. Do not claim context isolation or independent-agent approval.

Record actual review mode, reviewer/session identity when delegated, checked state, evidence paths, fallback reason and unresolved items in the existing task checkpoint and final report. If modes change, identify which scopes each mode covered; a successful child launch alone does not establish independent acceptance.
