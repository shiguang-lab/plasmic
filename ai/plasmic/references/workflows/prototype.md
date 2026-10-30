# Product prototype workflow

Sources → structure/contracts → Design review → compose → Saved-Page review → Integration review → delivery. Use the unified [review checkpoints and fallback](../review-mode.md#review-checkpoints) and [evidence integrity](../verification.md#evidence-integrity).

## Working set

Sketch scoped Pages/flows; detail each Page in turn. Read `mustRead` and applicable [sections](../context-reading.md); retain evidence on disk. Structure-only work ends with reviewed drafts and contract gaps.

## Resolve scope and contracts

1. Before editor work, resolve Team → Workspace → Project through [management](../desktop-management.md); reread identity/schemas and check canEdit. Pass [MCP preflight](../desktop-transports.md#prototype-preflight) before writes.
2. Read and reconcile sources under [requirement alignment](../requirement-alignment.md). Derive [business cases](../behavior-acceptance.md#plan-from-the-source) and inventory source [wireframes](../design/text-wireframes.md) before layout. Truncated reads are incomplete.
3. Draft `pageStructure` under [structure design](../design/page-structure.md), separating source constraints from inference. Choose a [page type](../design/page-types.md#choosing-the-type) for starting guidance.
4. Use [native library selection](../libraries/index.md#native-component-selection); Overseas/Antd6 follows [selection](../libraries/antd_v6/selection.md). Read live Props/Slots/events.
5. Read [admin design](../admin-design.md), [templates](../admin-templates.md) and the full [catalog](../templates/admin/catalog.json) from resourceRoot. Match Page/regions by scenario, inspect live templates/contracts and finalize the current structure. Stability tasks read [reproducibility](../reproducibility.md).
6. Follow [Page planning](../planning.md): read the project card, scaffold the current Page with `--page ROUTE`, read its compose card, resolve decisions/anchors and pass `verify_selection.py --page ROUTE --reads LEDGER`. Review Design before composing.

Full suites cover [standalone fixed-viewport Overseas/Antd6 Pages](../verification.md). Use focused checks for local edits/other libraries and report limits; preserve scope/library.

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

Retain [checkpoint records](../review-mode.md#checkpoint-records); launch or automatic pass is insufficient.

## Complete one Page at a time

Resume from the Page structure, compose card, contracts and checkpoint. `readingBudgetExceeded` signals context pressure. Use verified [composition handoff](../review-mode.md#page-composition-handoff) or supported compaction; otherwise read sequentially and checkpoint without skipping rules or claiming fresh context. If capacity is insufficient, stop dependent work and record remaining checks/next action.

Keep plans outside UI; derive Slots from [Pen evidence](../design-references.md)/contracts. Run `verify_all.py --page /exact-route` and open [pixels](../desktop-inspection.md) before Saved-Page review. Then record the static review under [rule review](../review-mode.md#rule-review), with one Desktop controller and unified fallback. Single-Page scope covers overlays/hidden content, excludes sibling transitions. Preview adds no devices. Use [explicit recovery](../desktop-context.md).

## Final Preview review

Integration needs complete scoped Pages/destinations; excluded transitions stay unexecuted. Before Preview, full-scope automatic checks and static reviews must pass. Only the final rule-review gate may remain incomplete for pending runtime/persistence evidence; inspect its diagnostics and preserve findings. Final document verdicts follow execution.

Within at most 10 Preview rounds: collect planned issues, close, batch-repair, save/recheck and reopen for regression. Failed cases do not end a usable round; crashes may ([recovery](../desktop-inspection.md#native-preview)). Stop when cases pass; after round 10 report unresolved work. Do not retry timed-out calls into broken runtime.

Retain findings, captures and failed/unexecuted/invalid-evidence cases under [runtime evidence checks](../behavior-acceptance.md#record-and-verify-execution). The reviewer executes required flows; main-agent claims are not execution evidence.

## Final acceptance

Save/reopen the same project and collect fresh evidence. Complete [model comparison and checks](../verification.md#collect-and-verify) and the Integration checkpoint's final rule review. Revalidate affected cases when reopened models differ. Local edits stay scoped to affected regions/flows; complete generation requires the full suite. Report review modes and source/static/visual/runtime/persistence outcomes. Required failures or missing checks block delivery.
