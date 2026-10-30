# Existing prototype feedback, diagnosis and repair

Use for feedback, issue investigation, requested changes and optimization of an existing prototype, including follow-ups during generation. Input may be text, steps, requirements, links, screenshots or a combination. No image is required. This is a scenario within `inspect` and `prototype`, not a new mode. Application-code feedback follows codegen.

Intent/scope → expected behavior → evidence/reproduction → diagnosis → authorized repair → affected regression. Reuse the current task's plan and [review checkpoints](review-mode.md#review-checkpoints); do not restart generation or introduce a parallel acceptance schema.

## Classify intent and scope

Determine three independent dimensions from the current request and relevant conversation:

- **Authority:** explain/review only, apply a specified change, or diagnose and improve. Reviewing does not authorize writes; an existing repair/optimization request does not need another routine approval.
- **Scope:** named element, region, Page, module or cross-Page flow. An attached whole-Page image does not expand a named target. A vague description does not authorize a whole-module redesign.
- **Expectation:** explicit result, result derivable from current sources/contracts, or unresolved material business choice. A precisely specified change can affect an entire module; uncertain wording can concern only one element.

| Request | Route and action |
| --- | --- |
| “分析这页的问题 / 给优化建议” | `inspect`: diagnose and report, without saving or repairing. |
| “只把按钮间距改成 16” | `prototype`: read the actual target/owner, apply the requested delta and check related layout. |
| “查询后结果不变，修复一下” | `prototype`: reproduce the query and inspect state/data bindings; no screenshot prerequisite. |
| “把筛选模块完整检查优化” | `prototype`: review the module's content, structure, contracts and query/reset/paging flow; apply justified improvements within existing business semantics. |
| “这里不对” or an image alone | Use established task context to locate the issue and determine authority; inspect first if authority is unclear. Do not infer a desired redesign from the image. |

Record the user's wording, expected outcome, inspection scope, permitted edit scope, regression scope and protected content in the existing task checkpoint. For a simple edit, a short entry is enough. State a material scope assumption briefly and proceed with supported work. Read available context/model/sources before asking; ask only about ambiguity that changes the target, authority or business result. Continue independent work while that decision is pending; silence is not a decision.

Inspection can expand to ancestors, shared definitions, state owners and consumers to find a cause. Expansion of inspection is not permission for unrelated edits. Prefer an instance-level correction when that is the actual defect; do not fork a shared component merely to avoid checking its consumers. If the necessary shared change exceeds the authorized scope, establish its impact and proposed correction, then resolve that scope decision before writing it. Record unrelated findings without silently fixing them.

## Establish expectations and collect evidence

Apply [source precedence](requirement-alignment.md#source-and-scope). Current explicit user decisions can change previous requirements; otherwise requirements define business content/behavior, selected visual references define presentation and live contracts constrain implementation. A contract gap is not permission to remove required behavior. Read the affected source sections completely; a spacing edit does not require rediscovering an unrelated PRD. For module optimization, inventory its required members and flows in both directions before judging layout, using the existing [content reconciliation](requirement-alignment.md#content-before-presentation).

Use the available evidence path:

| Input or symptom | Evidence to obtain |
| --- | --- |
| Text naming a field, action or region | Locate it in the current Page/model; read its owner, props, Slots and relevant bindings. Use current identities, not labels or coordinates as editable UUIDs. |
| Operation steps or wrong results | Reproduce in read-only Preview where possible; retain inputs, role, record, state, expected and actual effects. Read the event/state/data chain. |
| Visual complaint without an image | Obtain current geometry and pixels through [rendered inspection](desktop-inspection.md); do not ask for a screenshot already obtainable through tools. |
| Supplied image | Establish whether it shows a defect, desired reference, historical state or location annotation. Match Page/region, viewport and relevant data/role/Tab/overlay/scroll state to current evidence. A mismatch alone is not a defect. |
| Missing or inaccessible evidence | Complete supported checks and name the missing source/state/tool. Ask for the smallest essential detail only when it cannot be recovered; do not invent observations or label missing behavior absent. |

Treat each image observation as a lead until matched to the current target. If image access/resolution is insufficient, retain that limitation and use other evidence; do not claim to have inspected pixels. Separate model completeness from visibility: collapsed, inactive, virtualized and permission-limited content may not appear in a capture. Do not rewrite saved props to expose it. Preserve identity/build and evidence freshness under [context rules](context-reading.md#acceptance-evidence).

Investigation of an existing defect may use read-only Preview before repairs or passing generation gates; otherwise a broken artifact could never be diagnosed. Such reproduction is diagnostic evidence, not post-repair acceptance. Follow inspect's no-save/no-write rules and [Preview safety](desktop-inspection.md#native-preview), including temporary state and potentially executed actions. Do not submit irreversible or external effects merely to reproduce a report without appropriate authorization/test context.

## Diagnose by impact

Establish the relevant expected result before deciding what is wrong. Then inspect these dimensions to the depth needed by the scope; a local fix checks applicable rows, while module optimization assesses every row and records concrete exclusions. Do not impose states, roles, animations or responsive breakpoints absent from the task and applicable rules.

| Dimension | Question and evidence |
| --- | --- |
| Requirements/content | Are fields, actions, states and destinations missing or unexpected? Compare original sources with the inventory, then inventory with current output, including hidden branches. |
| Structure/layout | Do grouping, order, space allocation, action placement and scroll ownership support the task? Use [Page structure](design/page-structure.md), geometry and normal-viewport pixels; expanded full-content images do not prove viewport layout. |
| Components/contracts | Does each functional widget use the right available native component and real Props/Slots/events? Follow [library selection](libraries/index.md#native-component-selection) and applicable component rules; do not redraw an available widget. |
| Visual/accessibility | Check applicable density, alignment, clipping, typography, status semantics, focus and keyboard behavior. Use actual pixels and interaction evidence, not capture success. |
| Business behavior | Check guards, values, query/reset/paging, record identity, transitions and failure/cancel paths that the requirement calls for. A success message is not proof of data effects. |
| Persistence/regression | Check saved/reopened output and affected consumers/flows; retain unrelated content and valid existing behavior. |

Distinguish symptom, hypothesis and confirmed cause. Trace, for example, a clipped action through its own bounds, column/Slot owner and parent constraints, or an ineffective query through input state, handler and result binding. Select the smallest coherent correction to the confirmed cause. Do not compensate by shrinking all controls, deleting required fields or removing guards. If the cause is an unavailable component/platform contract, preserve the call/model evidence and report the blocker; the skill's client implementation boundary still applies.

Use [existing findings](review-mode.md#checkpoint-records): location, expected/actual, source/rule or observed usability failure, impact and evidence; include reproduction steps for behavior. Keep severity (blocking/incorrect/degraded), certainty (confirmed/suspected/unverified) and disposition (repair in scope/business decision needed/out of scope) distinct. Severity never grants edit authority. An unsupported aesthetic preference is an optional suggestion, not a required defect.

## Repair and choose regression

For authorized work, summarize material findings and the intended correction, then execute without asking for routine approval. Optimization permits reasoned presentation/interaction improvements within the named scope and current business requirements; it does not permit invented fields, permissions or workflow transitions. For read-only work stop with evidence-backed findings and proposals.

Before writing, define observable success and the related regression checks. Derive business outcomes from sources and verified contracts; familiar control names alone do not determine their effects (for example, cancel may close a draft or transition a record). Preserve verified existing behavior unless the authorized change requires otherwise. Keep proposed semantics separate from acceptance expectations; resolve a material unknown before asserting or changing that outcome, while continuing independent checks. Preserve the baseline, update only affected source decisions/plan entries, and follow the prototype workflow's identity/canEdit/preflight and close-Preview requirements. Reuse applicable live contracts and templates; cosmetic edits do not trigger template installation, replacement or full-Page planning. Changed structure/component ownership needs the corresponding design and selection checks before composition. If an inherited prototype has no plan, establish the scoped source-backed expectation first; do not infer requirements from its current defects or fabricate a passing full suite.

| Change | Minimum affected verification |
| --- | --- |
| Caption, spacing, color | Target model delta, actual pixels/adjacent layout and applicable accessibility; preserve protected bindings/content and verify persistence. Do not rerun unrelated business flows. |
| Fields, defaults, validation or filters | Source/member reconciliation, native owner/keys, applicable valid/invalid/empty/reset outcomes, submitted/query values and paging dependencies. |
| Layout, component or overlay | Relevant structural/contract gates, pixels at required viewports, scroll/focus/action reachability and affected open/close/hidden states. |
| Actions, routes, roles or state | Related [source-derived cases](behavior-acceptance.md#plan-from-the-source), including record/role/state effects and required cancel/failure paths. |
| Shared definition/binding | Identify consumers, check affected instances and distinct behaviors, and justify the regression selection; do not assume one passing instance covers all consumers. |

After each coherent repair batch, save/recapture, run affected [automatic checks](verification.md) and static/visual review, then execute affected Preview cases and save/reopen verification. Focused local edits use focused evidence, not an unrelated full-project suite. Keep required runtime/persistence work pending until actually executed; do not require their final verdict to enter Preview. Changed plan/model/rules invalidate bound verdicts under [rule review](review-mode.md#rule-review); carry forward evidence only after confirming applicability and identity. Compare intended versus actual changes, including protected fields, routes, bindings and unrelated nodes.

Return repaired findings to the reviewer through the existing checkpoint/fallback policy. Use the existing [repair-round limit](workflows/prototype.md#final-preview-review), not a fresh budget per feedback item. If repeated attempts add no evidence or progress, preserve the unresolved cause and obtain the missing information rather than patching speculatively.

## Completion

Every reported issue ends as verified repaired, already correct/not reproducible with stated conditions, an optional/out-of-scope finding, or unresolved with its missing evidence/decision. Failure to reproduce does not prove absence. Required in-scope failures and unexecuted checks prevent claiming full completion; an unrelated finding does not block a verified local edit.

Report the actual scope, changes, checks/results and remaining limits concisely. Separate source, model/static, visual, runtime and persistence results as applicable. Neither screenshots, saved models, written plans nor passing scripts alone prove complete business acceptance. Keep evidence and implementation notes outside the business UI.
