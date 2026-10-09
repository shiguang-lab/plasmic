# Desktop MCP core contract

Discover exact tools and operation schemas through `get_app_state`; registrations and permissions are authoritative. This reference describes operating invariants, not a replacement tool catalog.

## Read and target

Start the user's signed-in Desktop, read `get_app_state` and list accessible projects, then call `execute` → `identify` with the actual model/client and skill `plasmic`. Accessible reads do not require `canEdit`; validated mutations do. `read` without a target returns an overview; full components and element subtrees use the live schema's UUID fields. Full model reading follows [model-reading](model-reading.md).

`open_design` saves the current editable project before switching projects. For read-only inspection or coding, use the already open target or readable imported dependencies. Opening the target is safe when no editor is ready, or when it stays in the same project. If switching would save another editable project, finish independent reads and report that side effect; obtain explicit authorization before that switch. Do not silently persist unrelated work to obtain a read.

Obtain editable UUIDs from `read`/`queryElements`, never DOM observations. Read installed component metadata for registered names, Props, choices, Slots, defaults and event/ref signatures. Re-read destination identities after imports/upgrades. Metadata describes the design contract; it does not download wrapper source or establish a npm export.

## Mutate and persist

Public operations create/change/move/copy/delete nodes, states, interactions, tokens and variants through Studio transactions. Targets must already exist. `execute_batch` validates and applies one atomic transaction, rolling back on failure; it cannot resolve IDs created by an earlier operation in that same batch. Undo reverses the batch.

Code components use `<plasmic-component data-plasmic-component="REGISTERED_NAME" data-plasmic-project="IMPORTED_PROJECT_ID" data-props='{"prop":"value"}'><slot name="children">Content</slot></plasmic-component>`. Names and values come from the registration. Instance styles affect layout; appearance uses real props. Do not insert scripts or invent native input handlers. Dynamic bindings use the discovered expression contract and available data scopes.

`save` persists the model; reopen and read to verify it. Imported definitions are readable but are not local editable components. Library installation/upgrading and design changes are mutations, distinct from read-only inspection. `validate` checks model invariants, not runtime behavior or visual quality.

## Conditional capabilities

- Geometry, screenshots, Preview, temporary view positioning: [rendered inspection](desktop-inspection.md).
- Images, SVG/vector, reference-page capture and file export: [media and export](desktop-media.md).
- Admin component usage: [admin reference index](admin-design.md), selecting only affected regions.
- Component registration/runtime changes: [engineering verification](engineering/component-contracts.md), only for explicit platform/component work.

Inspect each operation result before dependent writes: a successful transport or shell exit does not prove Studio success. After a failure, Desktop restart or session change, stop dependent writes, reread app/project identity and identify the session before retrying. In particular, do not save after failed validation or an unexpected project change. Retain the known model state, report the exact limitation and complete independent work. Never assume access to platform source, silently install an editor upgrade, or use private Studio scripting/raw REST to bypass the public contract.
