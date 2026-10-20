# Desktop MCP core contract

## Read and target

Resolve the [project](desktop-management.md); execute identify with actual model/client and skill plasmic. Edits require canEdit. get_app_state status omits schemas/capabilities; view:tools lists names, toolNames selects contracts, schemaView:full retains schemas. Discovery includes runtimeCapabilities; get_build_info gives provenance. Run the workflow's preflight before content writes.

read returns counts without targets; collection pages inventory. Target componentUuids/elements. tree returns structure/Slot IDs; properties reads base props/styles/text with optional propNames, contract reads registrations and context reads owning state/events/queries. full,depth:all keeps complete evidence; fields projects output. queryElements shares paging/projections; omissions/references are not empty. Use fromProject for dependencies. Follow [result handling](context-reading.md#model-reads-and-tool-results), [examples](desktop-examples.md) and [model reading](model-reading.md).

open_design saves before switching editable projects. Read-only work uses the open target/dependencies; obtain authorization before switching would save unrelated work.

Use model UUIDs, never DOM. Read installed Props/Slots/defaults/events/ref signatures; reread identities after library changes.

New supported generation uses [prototype_task](prototype-tasks.md). preview exercises native runtime; reference_browser reads external sources; import_reference creates independent reference artboards. Never import Preview or inspect it in the isolated browser.

## Mutate and persist

execute_batch is atomic/undoable. as binds earlier creations in identity fields only; see examples above. Receipts contain name/created and optional componentUuid/elementUuid/messages; batches return ordered operations. Inspect messages/IDs; read changed descendants separately. Navigation returns identities only.

Use registered [markup](desktop-examples.md#component-instances), props/scopes and layout styles. New Pages default to native Desktop/shared overview; verify [page layout](desktop-examples.md#dependency-discovery-and-page-layout).

save returns projectId/revision/saved; reopen/reread proves persistence. Batches do not save. Imports are read-only; library changes mutate. validate checks invariants only, not pixels/behavior. Failed validation/project changes block save; after failure/session change reread identity and identify.

## Conditional capabilities

- Teams, workspaces, projects: [management](desktop-management.md).
- Geometry, images, native Preview: [rendered inspection](desktop-inspection.md).
- Images, SVG, capture/export: [media](desktop-media.md).
- Admin regions: [admin index](admin-design.md).
- Explicit platform/component work: [engineering verification](engineering/component-contracts.md).

Use public tools; report missing capabilities instead of assuming source access or upgrading the editor.
