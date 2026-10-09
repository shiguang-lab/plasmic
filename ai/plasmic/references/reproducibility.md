# Regeneration and stability

Read for explicit fresh regeneration or stability testing. Keep requirement-derived inputs and acceptance expectations outside generated output. A previous accepted model is comparison evidence, not the generation input.

## Independent inputs and gates

Use [requirement alignment](requirement-alignment.md) to freeze source-derived pages, routes, menus and behavior. Record source requirement/design versions, viewport, installed library contracts, selected templates, field/information inventories and mock data. Reuse current component APIs; task-specific generators/data remain in the task workspace.

Generate fresh editable pages/components from those inputs. Preserve existing accepted work until the replacement passes. Build structure and actual states/interactions together. Load affected rules through the [admin reference index](admin-design.md); apply its Slot, structure, Form and information gates where relevant. Before insertion, applicable planned-model fixtures must satisfy the reviewed inventory; after generation/save/reopen, run checks against complete public readbacks. Full-project generation includes the full overview and all Pages. A nonzero gate blocks acceptance; do not regenerate expectations from output or trim away unexpected Pages.

Use [rendered inspection](desktop-inspection.md) for actual viewport, screenshots, Preview behavior and persistence. Test relevant long/empty values, permission/state branches, errors, cancellation, reopen-with-another-record, pagination and feedback. Simulated asynchronous processing must be observed before completion; copied/edited/deleted records and totals must actually change. Test scenario-specific contracts from the current requirement, not historical SQL/role scenarios unrelated to the task.

## Rerun and compare

When a failure identifies a reusable rule, correct its owning reference/check and generation source, then regenerate the affected scope from clean inputs. A focused rule change may use a fresh affected-region generation with its real layout/component context; report that scope instead of claiming full-page stability. Remove temporary capability-test pages/canvases after evidence capture.

For explicitly requested stability perform another clean generation with the final same inputs. Both runs must independently pass requirement, model, Preview and persistence checks. Compare observable contracts and measured geometry; generated UUIDs need not match. Run `python3 scripts/compare_models.py <first-mcp-read.json> <second-mcp-read.json> --report <report.json>` from resourceRoot for normalized structure, props, state and interaction equality. Model equality does not prove runtime/visual correctness or universal determinism.

Retain sanitized inputs, calls, check reports, screenshots/observations and limitations. Reject damaged literal text against source input; JSON parsing alone does not prove Unicode fidelity. Keep only the accepted deliverable in the project, with unrelated existing user work preserved.
