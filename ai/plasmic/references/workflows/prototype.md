# Product prototype workflow

Same agent/session: sources/contracts → plan/preflight → compose → saved-output acceptance → Preview → repairs. Review sources independently.

## Resolve scope and contracts

1. Resolve Team → Workspace → Project through [management](../desktop-management.md); reread identity/schemas. New projects use their returned ID. Edits require canEdit.
2. Read sources/[requirement alignment](../requirement-alignment.md); resolve visual differences. Before layout retain [content expectations](../requirement-alignment.md#content-before-presentation): fields, roles, transitions, copy, Page scope and deferred cases. Single-Page work excludes siblings. Follow [context reading](../context-reading.md); truncation is incomplete evidence.
3. Use [native library selection](../libraries/index.md#native-component-selection). For Overseas/Antd6 read [selection](../libraries/antd_v6/selection.md) in full. Classify regions/fields/Columns/actions by purpose, follow rule owners, then read actual Props/Slots/events via MCP.
4. Read [admin design](../admin-design.md), [templates](../admin-templates.md) and [catalog](../templates/admin/catalog.json). Before writes complete [source acquisition/evidence](../admin-templates.md#source-evidence-before-composition): select scenarios, inspect live models, record per-Page captures/adaptation. Acquire uninstalled sources; different fields need adaptation. Reference reconstruction need not import. Apply [content entry](../design/layout.md#admin-content-entry) and the selected composition, including [Overseas query/list](../libraries/overseas/compositions/search-table.md). Stability work reads [reproducibility](../reproducibility.md).
5. Before business writes, create structure-expectation.json from source: components/roles/rules, field keys/owners, feedback, template evidence and cases. Apply [component policy](../design/component-policy.md): defaults, source-backed overrides, App context/consumers and row actions. Compare source members; run `python3 RESOURCE_ROOT/scripts/verify_selection.py /absolute/task/structure-expectation.json --report /absolute/task/selection-plan.json`. Inspect/repair until pass. --help is not execution; source completeness needs review. Never change expectations to approve output.

Before composition, prepare the actual [suite and region inventories](../verification.md#reviewed-suite-configuration) and Page Slot intent from source/contracts, using planned names/routes before UUIDs exist. Run `python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --profile "/absolute/Desktop user-data" --report /absolute/task/mcp-contract.json` before writes.

## Execution plan and completion evidence

Before writes, record stages/evidence paths in the existing plan, without another manifest. Track actual results and retain unfinished stages across recovery.

| Plan stage | Completion evidence / next action |
| --- | --- |
| Prepare inputs | Suite, source/region inventories and Slot intent ready; source, selection and MCP checks pass. |
| Compose Page | Content, states/events, overlays and mock/API effects complete or explicitly pending. |
| Accept saved output | Save; scoped `verify_all.py` passes the [report contract](../verification.md#collect-and-verify); opened pixels have no unresolved findings. Repair/recheck here. |
| Preview round N | Saved-output gates pass for all scoped Pages/destinations; collect round findings/pending cases. |
| Repair batch | Close Preview; confirm project/edit mode and get_app_state.canEdit. Mutate, save, repeat saved-output gates. |
| Persistence/delivery | Save/reopen/reread; repeat scoped checks and report runtime/persistence/pending work. |

Keep saved-output acceptance separate from Preview/delivery. Selection `passed:true`, native `validate.valid:true`, save and screenshots do not replace its suite. Missing/failing evidence leaves stages incomplete.

## Complete one Page at a time

MCP does not manage stages. Keep plans/evidence outside UI; derive Slots from [Pen evidence](../design-references.md)/contracts and follow [naming](../design/naming.md). Preview adds no devices.

Run `verify_all.py --page /exact-route`, inspect the full error batch and [open pixels](../desktop-inspection.md) before advancing to siblings. Review hierarchy, copy, data, spacing and hidden states. Update expectations only from source evidence.

Single-Page scope includes overlays, excludes sibling transitions. Unsupported layouts/libraries use focused checks. Follow [explicit recovery](../desktop-context.md).

## Final Preview review

Complete in-scope Pages/destinations before Preview; placeholders do not qualify. Leave excluded transitions unexecuted.

Maximum 10 rounds: collect planned issues, close, batch-repair, save/recheck, then reopen. Failed cases/target errors do not end a usable round; follow [recovery](../desktop-inspection.md#native-preview). Crash/unavailable runtime may end it early; retain findings/pending cases. Stop when cases pass; after round 10 report unresolved work. Do not retry timed-out calls into broken runtime or substitute reference tools.

Retain rounds, cases, images, findings, repairs and outcomes, including failed/pending contexts. Compare with sources and apply [runtime evidence checks](../design/component-policy.md#native-runtime-evidence). Changed behavior needs fresh evidence; capability-test Pages and guessed event parameters cannot replace business checks.

## Final acceptance

Save; open_design with the same projectId and reopen:true starts a new session. Reread/recheck scoped models. Report source/resource versions, catalog/live reads, actual reuse versus reference composition, mock/API boundaries and pending cases. Static passes/read references prove neither behavior nor persistence.
