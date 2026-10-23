# Product prototype workflow

Sources → Page plan → compose → saved-output acceptance → Preview → repairs. Choose [review mode](../review-mode.md) before acceptance. Gates and reviews follow [evidence integrity](../verification.md#evidence-integrity).

## Working set

Plan scope/shared flows in one inventory, then detail the current Page. Read `mustRead` in full and other references through [conditional sections](../context-reading.md). Keep full evidence on disk; inspect summaries and failures. Never replay successful mutations to recover output.

## Resolve scope and contracts

1. Resolve Team → Workspace → Project through [management](../desktop-management.md); reread identity/schemas. New projects use their returned ID. Edits require canEdit.
2. Read sources and [requirement alignment](../requirement-alignment.md). Reconcile [content](../requirement-alignment.md#content-before-presentation), roles, transitions, copy and scope; derive [business cases](../behavior-acceptance.md#plan-from-the-source) before layout. Truncated reading is incomplete evidence.
3. Use [native library selection](../libraries/index.md#native-component-selection); for Overseas/Antd6 read [selection](../libraries/antd_v6/selection.md). Classify by purpose, then read live Props/Slots/events.
4. Read [admin design](../admin-design.md), [templates](../admin-templates.md) and the complete [catalog](../templates/admin/catalog.json). Record live model/contract captures and adaptation before writes. Apply [content entry](../design/layout.md#admin-content-entry) and the selected composition, including [Overseas query/list](../libraries/overseas/compositions/search-table.md). Stability work reads [reproducibility](../reproducibility.md).
5. Build each Page plan through [Page planning](../planning.md): scaffold the declarations, decide every `"__DECIDE__"`, read the compose rules card, then pass `verify_selection.py --page ROUTE --reads LEDGER`. Omit `--page` for complete preflight. [Component policy](../design/component-policy.md) defines cases and exceptions.

Prepare [suite/region inventories](../verification.md#reviewed-suite-configuration) and Page Slot intent from source/contracts. Before writes run `python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --profile "/absolute/Desktop user-data" --report /task/mcp-contract.json`.

## Execution plan and completion evidence

Record stages and evidence paths; retain unfinished work across recovery.

| Plan stage | Completion evidence / next action |
| --- | --- |
| Prepare inputs | Source scope/shared flows reviewed; no pending decisions; suite, Slot intent and cases ready; selection (with `--reads`) and MCP checks pass. |
| Compose Page | Compose card read for this Page; content, states/events, overlays and mock/API effects complete or explicitly pending. |
| Accept saved output | Save; read the accept card; scoped `verify_all.py` passes the [report contract](../verification.md#collect-and-verify); opened pixels have no unresolved findings. |
| Preview round N | Saved-output gates pass for all scoped Pages/destinations; execute planned cases and match trace lines with `verify_runtime.py`; retain failed, unexecuted and invalid-evidence cases. |
| Repair batch | Read each diagnostic's `rule` first. Close Preview; confirm edit mode and canEdit. Mutate, save, repeat saved-output gates. |
| Persistence/delivery | Full-project suite and save/reopen checks; reconcile source rules/evidence. |

Checkpoint project/session/revision, source/resource identities, results and next action at Page boundaries; reconcile readback on resume. Client parsing/retries/restarts belong to the caller.

## Complete one Page at a time

Each Page starts from disk, not from conversation memory: its plan entry, compose card, contracts and the checkpoint. With verified fresh-context delegation, hand each Page's composition and scoped gates to a new child with exactly those inputs plus project/session identity; it returns the checkpoint and evidence paths. One agent controls Desktop at a time, so run them sequentially, following the [handoff rules](../review-mode.md#select-from-actual-capabilities). Otherwise compact at the boundary and rebuild from these inputs.

Keep plans outside UI; derive Slots from [Pen evidence](../design-references.md)/contracts and follow [naming](../design/naming.md). Preview adds no devices. Run `verify_all.py --page /exact-route` and [open pixels](../desktop-inspection.md) before siblings; review errors, hierarchy, copy, data and hidden states. Single-Page scope includes overlays, excludes sibling transitions. Unsupported layouts/libraries use focused checks. Follow [explicit recovery](../desktop-context.md).

## Final Preview review

Complete in-scope Pages/destinations before Preview; placeholders do not qualify. Leave excluded transitions unexecuted.

Maximum 10 rounds: collect planned issues, close, batch-repair, save/recheck, then reopen. Failed cases/target errors do not end a usable round; follow [recovery](../desktop-inspection.md#native-preview). A crash may end it early; retain findings/pending cases. Stop when cases pass; after round 10 report unresolved work. Do not retry timed-out calls into broken runtime or substitute reference tools.

Retain round findings, images, repairs and pending cases; apply [runtime evidence checks](../behavior-acceptance.md#record-and-verify-execution). Changed behavior needs fresh evidence; capability-test Pages cannot replace business checks.

## Final acceptance

Save; open_design with the same projectId and reopen:true starts a new session. Reread/recheck. Report resource versions, source/template reads, actual reuse, mock/API boundaries and pending cases, with source, static, visual, runtime and persistence results separate.
