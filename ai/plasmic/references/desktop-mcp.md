# Desktop MCP core contract

Discover schemas through `get_app_state`; live registrations and permissions are authoritative.

## Read and target

Read `get_app_state` in the signed-in Desktop. Resolve/open the target through [project management](desktop-management.md), then `execute` → `identify` with the actual model/client and skill `plasmic`. Discovery needs no ready editor; mutations require `canEdit`. `read` without a target returns an overview; use `componentUuids` for full models and `elements` for subtrees, never `components`. See [minimal examples](desktop-examples.md) and [model-reading](model-reading.md).

`open_design` saves the current editable project before switching projects. For read-only inspection or coding, use the already open target or readable imported dependencies. Opening the target is safe when no editor is ready, or when it stays in the same project. If switching would save another editable project, finish independent reads and report that side effect; obtain explicit authorization before that switch. Do not silently persist unrelated work to obtain a read.

Obtain editable UUIDs from `read`/`queryElements`, never DOM. Read installed names, Props, choices, Slots, defaults and event/ref signatures; reread destination identities after imports/upgrades. Metadata neither downloads wrapper source nor establishes npm exports.

## Mutate and persist

Public operations create/change/move/copy/delete nodes, states, interactions, tokens and variants through Studio transactions. Targets must already exist. `execute_batch` validates and applies one atomic transaction, rolling back on failure; it cannot resolve IDs created by an earlier operation in that same batch. Undo reverses the batch. Resolve every ordered batch receipt/message through its live resource indexes.

Code components use `<plasmic-component data-plasmic-component="REGISTERED_NAME" data-plasmic-project="IMPORTED_PROJECT_ID" data-props='{"prop":"value"}'><slot name="children">Content</slot></plasmic-component>`. Names and values come from the registration. Instance styles affect layout; appearance uses real props. Do not insert scripts or invent native input handlers. Dynamic bindings use the discovered expression contract and available data scopes.

`save` confirms no unsaved changes remain and returns `projectId`, `revision`, `saved`; reopen and read to verify persistence. Batch atomicity does not save the model. Imported definitions are readable, not locally editable. Library installation/upgrading and design changes are mutations. `validate` checks model invariants, not runtime behavior or visual quality.

## Conditional capabilities

- Organizations, workspaces, dashboard navigation and project creation: [project management](desktop-management.md).
- Geometry, screenshots, Preview, temporary view positioning: [rendered inspection](desktop-inspection.md).
- Images, SVG/vector, reference-page capture and file export: [media and export](desktop-media.md).
- Admin component usage: [admin reference index](admin-design.md), selecting only affected regions.
- Component registration/runtime changes: [engineering verification](engineering/component-contracts.md), only for explicit platform/component work.

Inspect each result before dependent writes; transport success does not prove Studio success. After failure, restart or session change, stop dependent writes, reread project identity and identify before retrying. Do not save after failed validation or a project change. Report the limitation and continue independent work. Do not assume platform source access, silently upgrade the editor or bypass public tools with private scripting/raw REST.
