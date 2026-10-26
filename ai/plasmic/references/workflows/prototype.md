# Product prototype workflow

Sources → plan → compose → acceptance → Preview → repairs. Choose [review mode](../review-mode.md); follow [evidence integrity](../verification.md#evidence-integrity).

## Working set

Inventory scope/shared flows, then detail only the current Page. Read `mustRead` fully and [conditional sections](../context-reading.md) as applicable. Retain evidence on disk; inspect summaries/failures.

## Resolve scope and contracts

1. Resolve Team → Workspace → Project through [management](../desktop-management.md); reread identity/schemas. New projects use their returned ID. Edits require canEdit. Follow [MCP preflight](../desktop-transports.md#prototype-preflight) before writes; a failure blocks dependent work.
2. Read sources under [requirement alignment](../requirement-alignment.md); reconcile content, roles, transitions, copy and scope. Before layout, derive [business cases](../behavior-acceptance.md#plan-from-the-source) and inventory every [text wireframe](../design/text-wireframes.md) element. Truncated reads are incomplete.
3. Choose each Page's [page type](../design/page-types.md#choosing-the-type) from its user task; it selects templates and the region skeleton.
4. Use [native library selection](../libraries/index.md#native-component-selection); for Overseas/Antd6 read [selection](../libraries/antd_v6/selection.md). Classify by purpose, then read live Props/Slots/events.
5. Read [admin design](../admin-design.md), [templates](../admin-templates.md) and the complete [catalog](../templates/admin/catalog.json); match templates to regions. Capture live models/contracts and planned adaptation before writes. Stability tasks read [reproducibility](../reproducibility.md).
6. Follow [Page planning](../planning.md): read the project card once, scaffold declarations with `pageType`, read the compose card, resolve every `"__DECIDE__"`, then pass `verify_selection.py --page ROUTE --reads LEDGER`. Omit `--page` for all Pages. [Component policy](../design/component-policy.md) owns cases/exceptions.

Full-suite commands below apply to the [standalone fixed-viewport Overseas/Antd6 scope](../verification.md). For local edits or other/mixed libraries, preserve unrelated Pages, use focused checks from the [actual library](../libraries/index.md#read-by-actual-library), and report uncovered checks; do not change libraries to pass. Derive supported [inventories](../verification.md#reviewed-suite-configuration) with `prepare_plan.py inventories`; resolve pending decisions.

## Execution plan and completion evidence

| Plan stage | Completion evidence / next action |
| --- | --- |
| Prepare inputs | MCP contract and selection with `--reads` pass; scope/flows reviewed; no pending decisions; suite, Slot intent and cases ready. |
| Compose Page | Card read; content, states/events, overlays and mock/API effects complete or pending; label widths measured. |
| Accept saved output | Save; scoped `verify_all.py` passes the [report contract](../verification.md#collect-and-verify); opened pixels have no unresolved findings. |
| Preview round N | Saved-output gates pass for all scoped Pages/destinations; execute planned cases and match trace lines with `verify_runtime.py`; retain failed, unexecuted and invalid-evidence cases. |
| Repair batch | Read each diagnostic's `rule` first. Close Preview; confirm edit mode and canEdit. Mutate, save, repeat saved-output gates. |
| Persistence/delivery | Save/reopen; full-project suite; [rule review](../review-mode.md#rule-review) of that capture; `compare_models.py` of the exercised and reopened models; reconcile source rules/evidence. |

Checkpoint identities/revision, stage, evidence, results and next action at Page boundaries; reconcile readback on resume.

## Complete one Page at a time

Resume each Page from its plan, compose card, contracts and checkpoint. `readingBudgetExceeded` signals reading pressure. Use verified [fresh-context delegation](../review-mode.md#page-composition-handoff) with one Desktop controller, or supported compaction. Otherwise read sequentially, checkpoint decisions/evidence and finish one Page at a time; retain all reads and gates without claiming fresh context. If capacity is insufficient, stop and checkpoint the Page, remaining reads/checks and next action.

Keep plans outside UI; derive Slots from [Pen evidence](../design-references.md)/contracts. Preview adds no devices. Run `verify_all.py --page /exact-route` and [open pixels](../desktop-inspection.md) before siblings; review errors, hierarchy, copy, data and hidden states. Single-Page scope includes overlays, excludes sibling transitions. Follow [explicit recovery](../desktop-context.md).

## Final Preview review

Preview requires complete in-scope Pages/destinations, without placeholders; leave excluded transitions unexecuted.

Maximum 10 rounds: collect planned issues, close, batch-repair, save/recheck, then reopen. Failed cases do not end a usable round; a crash may ([recovery](../desktop-inspection.md#native-preview)). Stop when cases pass; after round 10 report unresolved work. Do not retry timed-out calls into broken runtime.

Retain findings, images, repairs and pending cases under [runtime evidence checks](../behavior-acceptance.md#record-and-verify-execution).

## Final acceptance

Save; reopen via open_design with the same projectId and reopen:true. Apply [checks, review and model comparison](../verification.md#collect-and-verify). Report versions, source/template reads, review mode, mock/API limits and pending cases; separate source, static, visual, runtime and persistence results. Failed applicable gates block delivery.
