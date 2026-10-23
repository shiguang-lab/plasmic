# Regeneration and stability

Read for explicit fresh regeneration or stability testing. Keep requirement-derived inputs and acceptance expectations outside generated output. A previous accepted model is comparison evidence, not the generation input.

## Independent inputs and gates

Use [requirement alignment](requirement-alignment.md) to freeze source-derived pages, routes, menus and behavior. Record source requirement/design versions, viewport, installed library contracts, selected templates, field/information inventories and mock data. Reuse current component APIs; task-specific generators/data remain in the task workspace.

Generate fresh editable pages/components from those inputs. Preserve existing accepted work until the replacement passes. Build structure and actual states/interactions together. Load affected rules through the [admin reference index](admin-design.md); apply its Slot, structure, Form and information gates where relevant. Before insertion, validate the source plan through its public schema; after generation/save/reopen, run model checks against complete public readbacks. Task-local synthetic fixtures do not replace live acceptance. Full-project generation includes the full overview and all Pages. A nonzero gate blocks acceptance under [evidence integrity](verification.md#evidence-integrity); do not trim away unexpected Pages.

Use [rendered inspection](desktop-inspection.md) for actual viewport, screenshots, Preview behavior and persistence. Complete every required Page before functional Preview, following the [final review rounds](workflows/prototype.md#final-preview-review) with batch repairs and a 10-round limit. Test relevant long/empty values, permission/state branches, errors, cancellation, reopen-with-another-record, pagination and feedback. Simulated asynchronous processing must be observed before completion; copied/edited/deleted records and totals must actually change. Test scenario-specific contracts from the current requirement, not historical SQL/role scenarios unrelated to the task.

## Rerun and compare

Diagnose a failure from the affected Page's saved model readback and rendered layout, and quote those values. A task generator, script or plan is not evidence of the saved state: it may have changed after the run or never been applied. When a failure identifies a reusable rule gap, report it with evidence. If reference/check maintenance is explicitly in scope, correct the owning resource and validate it; ordinary design work corrects its task-owned generation input/model without rewriting verifiers. Regenerate the affected scope from clean inputs. A focused rule change may use a fresh affected-region generation with its real layout/component context; report that scope instead of claiming full-page stability. Remove temporary capability-test pages/canvases after evidence capture.

For explicitly requested stability perform another clean generation with the final same inputs. Both runs must independently pass requirement, model, Preview and persistence checks. Compare observable contracts and measured geometry; generated UUIDs need not match. Run `python3 scripts/compare_models.py <first-mcp-read.json> <second-mcp-read.json> --report <report.json>` from resourceRoot for normalized structure, props, state and interaction equality. Model equality does not prove runtime/visual correctness or universal determinism.

Retain sanitized inputs, calls, check reports, screenshots/observations and limitations. Reject damaged literal text against source input; JSON parsing alone does not prove Unicode fidelity. Keep only the accepted deliverable in the project, with unrelated existing user work preserved.
