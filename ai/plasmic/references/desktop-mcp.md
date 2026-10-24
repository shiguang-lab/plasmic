# Desktop MCP core contract

## Read and target

Resolve the [project](desktop-management.md); identify with actual model/client and skill plasmic. Edits require canEdit. Run workflow preflight before content writes. get_build_info gives provenance.

MCP tools have tools/list schemas; call them directly. get_app_state({view:"tools"}) lists native operations in availableEditorTools; only these belong in toolNames. Request their contracts, then execute {name,input}. Native executeBatch points to MCP execute_batch. get_screenshot, snapshot_layout and get_app_state are MCP tools, not operation names. schemaView:full adds output schemas. Status omits contracts; ready means model availability, not rendered frames. Unknown names are not loading delays. See [examples](desktop-examples.md).

read returns counts without targets; collection pages inventory. Target componentUuids/elements. tree returns structure/Slot IDs; properties reads base props/styles/text with optional propNames, contract reads registrations and context reads owning state/events/queries. full,depth:all keeps complete evidence; fields projects output. queryElements shares paging/projections; omissions/references are not empty. Use fromProject for dependencies. Follow [result handling](context-reading.md#model-reads-and-tool-results), [examples](desktop-examples.md) and [model reading](model-reading.md).

open_design saves before switching editable projects. Read-only work uses the open target/dependencies; obtain authorization before switching would save unrelated work.

Discover UUIDs/names/contracts together with read {collection:"components",nameContains:ROLE,view:"contract",fromProject:LIBRARY_ID}. componentUuids takes UUIDs; data-plasmic-component takes registration names. Reread after library changes.

Global contexts retain isContext:true in inventories/projections and belong to project settings, not the Page tree. Read collection:globalContexts in the consuming project for installed instances, definition componentUuid and stored properties. Read the definition's contract.globalActions for qualified keys and ordered parameters; call directly without a Page wrapper. See [context discovery](desktop-examples.md#project-global-contexts).

Keep plans/progress locally. External-browser capture/import tools require a ready, editable project's edit page; local Pen reads do not require a canvas. Start reference_browser with load_page and an external HTTP(S) URL. preview owns runtime acceptance; failure blocks that check without reference-tool fallback.

## Mutate and persist

execute_batch is atomic/undoable. as binds earlier creations in identity fields only; see examples above. Receipts contain name/created and optional componentUuid/elementUuid/messages; batches return ordered operations. Inspect messages/IDs; read changed descendants separately. Navigation returns identities only.

Generate [markup](desktop-examples.md#component-instances) from each component's types: slot uses named `<slot>`, other values use data-props. Same-named props can have different types. Pages default to Desktop/shared overview; verify [page layout](desktop-examples.md#dependency-discovery-and-page-layout).

save returns projectId/revision/saved; reopen/reread proves persistence. Batches do not save. Imports are read-only; library changes mutate. validate checks invariants only, not pixels/behavior. Failed validation/project changes block save; after failure/session change reread identity and identify.

## Conditional capabilities

- Dynamic Island tasks: [activity](desktop-island.md).

- Teams, workspaces, projects: [management](desktop-management.md).
- Geometry, images, native Preview: [rendered inspection](desktop-inspection.md).
- Images, SVG, capture/export: [media](desktop-media.md).
- Admin regions: [admin index](admin-design.md).
- Explicit platform/component work: [engineering verification](engineering/component-contracts.md).

Use public tools; report gaps. Never assume source access or upgrade the editor. Errors use `{msg,detail}`: [recovery](desktop-context.md).
