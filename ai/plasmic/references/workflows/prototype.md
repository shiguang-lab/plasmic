# Product prototype workflow

Sources → structure/contracts → Design review → compose → Saved-Page review → Integration review → delivery. Use the unified [review checkpoints and fallback](../review-mode.md#review-checkpoints) and [evidence integrity](../verification.md#evidence-integrity).

## Before content writes

Complete preparation for the affected scope before inserting or changing business content:

- Verify current identity, `canEdit` and [MCP preflight](../desktop-transports.md#prototype-preflight); these establish tool capability, not design correctness.
- For existing Pages, include relevant [Studio feedback](#studio-comments-and-design-handoff) when reconciling sources before edits.
- For a new Page or structural change, follow [planning](../planning.md): project rules → current-Page scaffold → compose card and its reader commands → resolved decisions → `verify_selection.py PLAN --page ROUTE --reads LEDGER` → Design review. Read the selected live contracts as well. A card or ledger alone does not prove that every rule was read and applied; `--plan-only` does not complete preparation.
- For a local repair, reuse the current plan/checkpoint, read the affected component and composition rules, and run applicable focused checks. Do not create a full-Page plan or redo unrelated template selection merely to change spacing, copy or one prop. Update existing affected declarations and evidence; apply Page preparation when the change actually alters structure.

If preparation is incomplete, continue independent discovery and record the missing step; do not start dependent writes. Revisit affected rules and decisions when components, containers or scope change. Preserve valid unrelated evidence. `validate` checks model invariants and `save` persists changes; neither replaces the design checks below.

## Working set

Plan and verify [visual scenarios](../visual-scenarios.md) across variants, hidden regions, conditional entries and panels. Reconcile source cases with the saved-model inventory before accepting coverage. Retain a screenshot, concrete analysis and any repair/retest history for each required state in the existing rule review.

Sketch in-scope Pages and flows; detail one Page at a time. Keep local edits scoped. Read `mustRead` and applicable [sections](../context-reading.md); retain evidence on disk. Structure-only requests end with reviewed drafts and contract gaps, not composition readiness.

## Existing prototype changes

For requested changes, defect reports and module optimization, first follow [feedback handling](../feedback-handling.md), with or without screenshots. Separate inspection, edit and regression scopes; preserve the current plan and completed evidence. Existing-defect diagnosis may use read-only Preview before repair; post-repair acceptance follows the stages below. Apply scope/contracts and review stages only to the affected decisions, structure, components and flows; a cosmetic edit does not restart full-Page planning/template selection. New Pages or structural changes use the corresponding preparation steps. Read-only analysis stays in inspect; authorized repair/optimization needs no routine reconfirmation.

Targeted local model operations automatically [present their target](../desktop-inspection.md#automatic-presentation-during-model-operations) through temporary content reveal, canvas positioning and scrolling within the current canvas, preserving node selection and the right property panel. Ordinary model reads/writes never require navigation to a dedicated Page/component canvas. `presentation` with `reason:"pending"` and `visible:null` is an advisory background request. Continue model work without waiting for presentation or treating it as a blocker; obtain separate visual evidence only when the task requires it. Use the [interactive canvas workflow](../desktop-inspection.md#interactive-canvas-for-hidden-content) for actual transition demonstrations or confirmed display-state cases that automatic reveal cannot resolve. Distinguish scroll/layout clipping, unrendered instances and absent model nodes before choosing recovery; never rewrite saved display props merely to show a target.

## Studio comments and design handoff

- Before revising or reviewing existing Pages, read relevant unresolved [Studio threads](../desktop-mcp.md#comments) on the affected Pages or component definitions. Read a named thread directly even if resolved; include resolved threads when prior decisions matter. Use the target node and variants to interpret the feedback alongside the design and current requirements. Treat discussion as evidence: confirm material conflicts and leave open questions pending rather than treating every comment as an approved change.
- When delivering a new or changed interactive prototype, leave a Studio demo note if an in-scope state is hard to discover from the default view. Typical triggers are a particular test input or record, a mock scenario, a role, or a prior action. Derive the note from the affected Preview cases and post it after verifying the steps against the saved prototype. A separate request to add a note is not needed for this handoff; honor read-only and no-comment requests. Skip notes for self-explanatory flows and untouched areas.
- Anchor the note to the saved entry control or region where the demonstrator starts, or the Page root for Page-wide instructions. Group alternate outcomes at the same entry into one note. Give the starting point, any setup/reset, exact safe test inputs or steps, and the visible result for each path. Use verified test fixtures; never post passwords, tokens or real customer data. For a note about a specific design variant, pin its verified UUIDs; for a demo that starts in the base view and reaches multiple runtime states, attach the note at the entry in the base view. Keep demo instructions out of the business UI.
- For example, attach this note to the account query form, using the prototype's actual verified fixtures in place of these illustrative values: “演示账户状态：打开「账户查询」，在账号栏输入 `DEMO-ACTIVE` 后点「查询」，进入详情并显示「正常」；返回查询页，输入 `DEMO-LOCKED` 后点「查询」，进入详情并显示「已锁定」。使用演示数据。” If the steps cannot be verified, report the gap in the handoff rather than inventing a fixture or posting an untested recipe as working. Reuse a current note that already covers the same flow.
- For other requested design notes, attach the expected behavior, constraint or open decision to the saved node it concerns. For requested follow-up on an existing discussion, reply in that thread.
- For comment-only work, use the [comment contract](../desktop-mcp.md#comments) and native permissions; design preflight and Preview gates apply only to design changes. Before posting on a new subject or variant, make sure any design save is within the task's scope. A request to implement feedback does not by itself authorize posting a reply or resolving the thread. When asked to resolve after a fix, verify the fix first, then confirm the thread status through the receipt or readback.

## Resolve scope and contracts

1. Before editor work, resolve Team → Workspace → Project through [management](../desktop-management.md); reread identity/schemas and check canEdit. Pass [MCP preflight](../desktop-transports.md#prototype-preflight) before writes.
2. Read and reconcile sources under [requirement alignment](../requirement-alignment.md). Derive [business cases](../behavior-acceptance.md#plan-from-the-source) and inventory source [wireframes](../design/text-wireframes.md) before layout. Truncated reads are incomplete.
3. Draft `pageStructure` under [structure design](../design/page-structure.md), separating source constraints from inference. Choose a [page type](../design/page-types.md#choosing-the-type) from the task: an admin type for its starting recipe, or `non-admin` with source-backed structure for other experiences.
4. Use [native library selection](../libraries/index.md#native-component-selection); Overseas/Antd6 follows [selection](../libraries/antd_v6/selection.md). Read chosen live Props/Slots/events.
5. For admin Pages or matching admin regions, read [admin design](../admin-design.md), [templates](../admin-templates.md) and the full [catalog](../templates/admin/catalog.json) from resourceRoot. Match Page/regions by scenario, inspect live templates/contracts and finalize the current structure. Stability tasks read [reproducibility](../reproducibility.md).
6. Follow [Page planning](../planning.md): read the project card, scaffold the current Page with `--page ROUTE`, read its compose card, resolve decisions/anchors and pass `verify_selection.py --page ROUTE --reads LEDGER`. Complete Design review before composition.

Full-suite commands apply to the [standalone fixed-viewport admin Overseas/Antd6 scope](../verification.md). Non-admin Pages, local edits and other libraries use focused checks with explicit coverage limits; do not change libraries or unrelated Pages to pass.

## Execution plan and completion evidence

| Stage | Completion evidence / next action |
| --- | --- |
| Structure draft | Page tasks, regions and shared flows recorded; sibling components may remain unplanned. |
| Prepare current Page | Live templates/contracts reconciled; anchors resolved; MCP and selection checks pass; scoped suite, Slot intent and cases ready. |
| Design review | Apply the checkpoint in review-mode; required source/structure findings resolved and recorded against current inputs before markup. |
| Compose Page | Follow the reviewed structure/card; implement content, states/events, overlays and mock/API effects; measure label widths. |
| Saved-Page review | Save; scoped automatic gates pass; review models/pixels and resolve static findings before advancing; runtime/persistence stays pending. |
| Integration review | All scoped Pages/destinations ready; execute Preview cases, verify traces, resolve findings, then check save/reopen persistence and the final rule review. |
| Repair batch | Close Preview before edits, verify identity/canEdit, repair, save/recapture and rerun affected gates plus reviewer regression. |

Retain [checkpoint records](../review-mode.md#checkpoint-records); launch or automatic pass does not complete review. No routine user approval.

## Complete one Page at a time

Resume from the Page structure, compose card, contracts and checkpoint. `readingBudgetExceeded` signals context pressure. Use verified [composition handoff](../review-mode.md#page-composition-handoff) or supported compaction; otherwise read sequentially and checkpoint without skipping rules or claiming fresh context. If capacity is insufficient, stop dependent work with the remaining reads/checks and next action recorded.

Keep plans outside UI; derive Slots from [Pen evidence](../design-references.md)/contracts. Run `verify_all.py --page /exact-route` for the supported admin suite, or the applicable focused gates for non-admin/other scopes, and open [pixels](../desktop-inspection.md) before Saved-Page review. Then record the static review under [rule review](../review-mode.md#rule-review), with one Desktop controller and unified fallback. Single-Page scope includes overlays and hidden content, excludes sibling transitions. Preview adds no devices. Use [explicit recovery](../desktop-context.md).

## Final Preview review

Integration review uses complete in-scope Pages/destinations, without placeholders; excluded transitions remain unexecuted. Before Preview, full-scope automatic checks and static reviews must pass. Only the final rule-review gate may remain incomplete for pending runtime/persistence evidence; inspect its diagnostics and preserve findings. Final document verdicts follow execution.

Within at most 10 Preview rounds: collect planned issues, close, batch-repair, save/recheck and reopen for regression. Failed cases do not end a usable round; crashes may ([recovery](../desktop-inspection.md#native-preview)). Stop when cases pass; after round 10 report unresolved work. Do not retry timed-out calls into broken runtime.

Retain findings, captures and failed/unexecuted/invalid-evidence cases under [runtime evidence checks](../behavior-acceptance.md#record-and-verify-execution). The reviewer executes required flows; main-agent claims are not execution evidence.

## Final acceptance

Save/reopen the same project and collect fresh evidence. Complete [model comparison and checks](../verification.md#collect-and-verify) and the Integration checkpoint's final rule review. Revalidate affected cases when reopened models differ. Local edits stay scoped to affected regions/flows; complete generation within the supported admin scope requires the full suite; other scopes retain their applicable checks and explicit coverage limits. Report actual review modes and separate source, static, visual, runtime and persistence outcomes. Required failures or missing checks block delivery.

Complete any applicable [Studio demo notes](#studio-comments-and-design-handoff) on the saved design. Confirm the thread from the server receipt and include its ID in the handoff. If native comment access is unavailable, give the verified steps in the handoff and state that the note was not posted.
