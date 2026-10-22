# Product prototype workflow

Sources/contracts → plan/preflight → compose → saved-output acceptance → Preview → repairs. Choose [review mode](../review-mode.md) before acceptance.

## Working set and next step

Plan scope/shared flows in the existing inventory, then detail the current Page. Read `mustRead` in full; use [conditional sections/reuse](../context-reading.md) for other references.

Use `prepare_plan.py` for mechanical preparation, never business inference. Keep full evidence on disk; inspect summaries/failures. Follow returned recovery; never replay successful mutations to recover output.

## Resolve scope and contracts

1. Resolve Team → Workspace → Project through [management](../desktop-management.md); reread identity/schemas. New projects use their returned ID. Edits require canEdit.
2. Read sources/[requirement alignment](../requirement-alignment.md). Reconcile [content](../requirement-alignment.md#content-before-presentation), roles, transitions, copy and scope; derive [business cases](../behavior-acceptance.md#plan-from-the-source) before layout. Truncated reading is incomplete evidence.
3. Use [native library selection](../libraries/index.md#native-component-selection). For Overseas/Antd6 read [selection](../libraries/antd_v6/selection.md). Classify by purpose, follow rule owners, then read live Props/Slots/events.
4. Read [admin design](../admin-design.md), [templates](../admin-templates.md) and complete [catalog](../templates/admin/catalog.json). Acquire applicable live models/contracts and record source captures/adaptation before writes. Apply [content entry](../design/layout.md#admin-content-entry) and the selected composition, including [Overseas query/list](../libraries/overseas/compositions/search-table.md) when applicable. Stability work reads [reproducibility](../reproducibility.md).
5. In structure-expectation.json retain source-derived components/roles/owners, feedback, templates and cases under [component policy](../design/component-policy.md). Before composing each Page run `python3 RESOURCE_ROOT/scripts/verify_selection.py /task/structure-expectation.json --page /exact-route --report /task/page-selection.json`. Repair all findings; omit `--page` for complete preflight. --help is not execution; never change expectations to approve output.

Prepare [suite/region inventories](../verification.md#reviewed-suite-configuration) and Page Slot intent from source/contracts using planned names/routes. Before writes run `python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --profile "/absolute/Desktop user-data" --report /task/mcp-contract.json`.

## Execution plan and completion evidence

Record stages/evidence paths in the existing plan; retain unfinished work across recovery.

| Plan stage | Completion evidence / next action |
| --- | --- |
| Prepare inputs | Source scope/shared flows reviewed; Page suite/regions/Slot intent/cases ready; source, selection and MCP checks pass. |
| Compose Page | Content, states/events, overlays and mock/API effects complete or explicitly pending. |
| Accept saved output | Save; scoped `verify_all.py` passes the [report contract](../verification.md#collect-and-verify); opened pixels have no unresolved findings. Repair/recheck here. |
| Preview round N | Saved-output gates pass for all scoped Pages/destinations; execute planned cases and match actual trace lines with `verify_runtime.py`; retain failed, unexecuted and invalid-evidence cases. |
| Repair batch | Close Preview; confirm project/edit mode and get_app_state.canEdit. Mutate, save, repeat saved-output gates. |
| Persistence/delivery | Full-project suite and save/reopen checks; reconcile source rules/evidence. Separate source, static, visual, runtime and persistence results. |

Selection, native validate, save and screenshots do not replace saved-output acceptance. Missing/failing evidence leaves stages incomplete.

Checkpoint project/session/revision, source/resource identities, results and next action at Page boundaries; reconcile readback on resume. Client parsing/retries/restarts belong to the caller; MCP cannot recover calls it never received.

## Complete one Page at a time

Keep plans outside UI; derive Slots from [Pen evidence](../design-references.md)/contracts and follow [naming](../design/naming.md). Preview adds no devices.

Run `verify_all.py --page /exact-route` and [open pixels](../desktop-inspection.md) before siblings. Review all errors, hierarchy, copy, data and hidden states. Change expectations only from source evidence.

Single-Page scope includes overlays, excludes sibling transitions. Unsupported layouts/libraries use focused checks. Follow [explicit recovery](../desktop-context.md).

## Final Preview review

Complete in-scope Pages/destinations before Preview; placeholders do not qualify. Leave excluded transitions unexecuted.

Maximum 10 rounds: collect planned issues, close, batch-repair, save/recheck, then reopen. Failed cases/target errors do not end a usable round; follow [recovery](../desktop-inspection.md#native-preview). Crash/unavailable runtime may end it early; retain findings/pending cases. Stop when cases pass; after round 10 report unresolved work. Do not retry timed-out calls into broken runtime or substitute reference tools.

Retain round findings, images, repairs and pending cases; apply [runtime evidence checks](../behavior-acceptance.md#record-and-verify-execution). Changed behavior needs fresh evidence; capability-test Pages cannot replace business checks.

## Final acceptance

Save; open_design with the same projectId and reopen:true starts a new session. Reread/recheck. Report resource versions, source/template reads, actual reuse, mock/API boundaries and pending cases. Static passes prove neither behavior nor persistence.
