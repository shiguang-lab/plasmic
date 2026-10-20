# Desktop MCP minimal examples

Discover needed operations through `get_app_state({toolNames:["read","insertHtml"]})`: default schemas include complete inputs; `schemaView:"full"` adds output schemas. MCP execute_batch already defines its envelope; fetch individual operation contracts instead of native executeBatch’s full union. These are tool argument objects, not raw Studio REST requests. Replace placeholder UUIDs with identities from public model reads.

Status uses `get_app_state({})` with a stable buildId; operation names use `{view:"tools"}`. `get_build_info` supplies provenance; `get_image_service_status` reports service availability. `get_editor_view` returns project/session identity and `view`, passed to execute restoreEditorView only for the same project. Ordinary getEditorContext excludes viewport/import internals. Normal executeBatch discovery returns `{mcpTool:"execute_batch"}`; `schemaView:"full"` retains its native union.

Call `execute` to identify the session (use the actual model and client):

```json
{"name":"identify","input":{"model":"ACTUAL_MODEL","client":"ACTUAL_CLIENT","skill":"plasmic"}}
```

Call `execute` for an inventory page, full components (at most 30 per call), or element subtrees:

```json
{"name":"read","input":{"collection":"components","limit":50}}
```

```json
{"name":"read","input":{"componentUuids":["uuid-1","uuid-2"],"view":"full","depth":"all"}}
```

```json
{"name":"read","input":{"elements":[{"componentUuid":"page-uuid","elementUuid":"element-uuid"}],"view":"full","depth":"all"}}
```

For node discovery and contract reads, keep output focused:

```json
{"name":"queryElements","input":{"componentUuid":"page-uuid","nameContains":"Filter","limit":20,"fields":["uuid","name","registeredComponentUuid"]}}
{"name":"read","input":{"componentUuids":["registered-component-uuid"],"view":"contract"}}
{"name":"read","input":{"componentUuids":["page-uuid"],"view":"context"}}
```

Follow `nextOffset` for more inventory entries. No targets/collection returns counts. Default `tree` contains structure only: component `tree`/`rootElementUuid`, or element `children`/named `slots`; child references retain UUIDs and inherited source identities. `depth` expands structure without props/styles/text. Batch needed node IDs in `elements`, then read values separately:

```json
{"name":"read","input":{"elements":[{"componentUuid":"page-uuid","elementUuid":"table-uuid"}],"view":"properties","propNames":["pagination","rowKey"]}}
{"name":"read","input":{"elements":[{"componentUuid":"page-uuid","elementUuid":"shell-uuid"}],"view":"properties","fields":["uuid","styles"]}}
```

`properties` reads base-variant values; `propNames` defaults to those values without unrelated styles/text. Explicit fields can request both. `contract.props` preserves types/defaults/enums/Slot and event signatures; parameter IDs and codeComponent metadata remain in full/explicit field reads. Read owning context/full for overrides/interactions. Rich text and complete subtree markup remain in full; explicit baseVariantTplTree also reads markup at the requested depth. Partial reads do not replace full Page gates.

For page/layout inventory without dependency catalogues:

```json
{"name":"read","input":{"view":"full","fields":["__type","id","components","canvases","pageFrames","devicePresets"]}}
```

Every project view lists dependency identities/versions without expanding directories. Read each reachable dependency explicitly with fromProject, including indirect dependencies and view:full for complete evidence. Imports stay read-only. `components` is an output collection, not a read input key.

Call `snapshot_layout` directly for each Page without `navigate`:

```json
{"componentUuid":"page-uuid","view":"full"}
```

This pins a background canvas without changing the active arena/selection. Check frame readiness and truncation. Use [rendered inspection](desktop-inspection.md) for actual Preview interactions.

For a fixed viewport-height AppShell Page, call `execute_batch` to update its actual root and shell in one undoable transaction. The same sizing applies to a newly created Page: configure the root returned by `createComponent`, then insert the shell into it without an extra Page wrapper. Studio root width `stretch` is compatible with fixed height `100vh`; keep percentage widths on child containers and shell instances.

```json
{"operations":[
  {"name":"changeElement","input":{"componentUuid":"page-uuid","elementUuid":"root-uuid","styles":{"width":"stretch","min-width":"0","height":"100vh","min-height":"0","overflow":"hidden"}}},
  {"name":"changeElement","input":{"componentUuid":"page-uuid","elementUuid":"shell-uuid","styles":{"width":"100%","height":"100%","min-width":"0","min-height":"0"}}}
]}
```

New IDs can be bound and used in the same batch:

```json
{"operations":[
  {"as":"page","name":"createComponent","input":{"name":"记录列表","type":"page","path":"/records"}},
  {"as":"section","name":"insertHtml","input":{"componentUuid":"$page","html":"<div data-plasmic-name=\"Content\"></div>"}},
  {"name":"changeElement","input":{"componentUuid":"$page","elementUuid":"$section","styles":{"padding":"24px"}}}
]}
```

The receipt's `operations[*].created` contains actual identities; it does not contain full page markup. Bindings resolve only in UUID fields/arrays, action identity fields and `canvasName`; they do not persist across calls. HTML component names resolve during asset preparation and must already exist: instantiate a newly created reusable definition in a subsequent call. A failed batch rolls back its model changes; a successful batch remains unsaved. Make a subsequent content edit and read back root width:stretch and height:100vh before saving; root sizing must survive normal edits. After checking the actual results and validation, call `execute`:

```json
{"name":"save","input":{}}
```

Successful output has this shape (revision is illustrative):

```json
{"projectId":"project-uuid","revision":42,"saved":true}
```

Record the receipt with project/branch identity; it is not an idempotency key for replaying edits. Save errors must not be reported as success. Reopen/reread and repeat affected checks separately. For collecting gate inputs and running the script suite, use [unified verification](verification.md).


## Component instances

Code components use `<plasmic-component data-plasmic-component="REGISTERED_NAME" data-plasmic-project="IMPORTED_PROJECT_ID" data-props='{"prop":"value"}'><slot name="children">Content</slot></plasmic-component>`. Names and values come from the registration. Instance styles affect layout; appearance uses real props. Do not insert scripts or invent native input handlers. Dynamic bindings use the discovered expression contract and available data scopes.

## Large results and layout reads

`ResultReference` is complete retained data, not a failed operation. To read only a field:

```json
{"resultId":"returned-id","path":["results",0,"props"],"limit":20}
```

Call `read_result`, follow `nextOffset`, and append an entry's `key` to `path` when it has `reference` instead of `value`. For SVG/HTML references, read with `limit:16000` and concatenate returned `text` in order. References retain up to 16 snapshots / 64 MiB in the current connection. Do not repeat a mutation to retrieve its result.

`snapshot_layout` defaults to summary and paginated problems. Use `view:"elements"` or `"images"`, optional `frameUuid`/`elementUuid`, `fields`, `offset`, `limit`; follow each frame's `nextOffset`. Full acceptance uses `view:"full"` without filters. `navigateCanvas` returns only the selected canvas/frame/component identities; read layout or model explicitly afterward.

## Dependency discovery and page layout

Use `execute` with these exact envelopes:

```json
{"name":"read","input":{"collection":"components","fromProject":"IMPORTED_PROJECT_ID","nameContains":"Form","view":"contract","fields":["uuid","name","props"],"limit":10}}
```

```json
{"name":"setPageViewport","input":{"componentUuid":"PAGE_UUID","preset":"Desktop"}}
```

Component collections with `view:"contract"` return real contracts. `fromProject` can also scope `componentUuids` or `elements` and verifies their owner; omit it when UUIDs already identify the target. New Pages initialize Desktop and shared overview references. Verify `pageFrames`, `devicePresets` and `canvases`; shorter Preview tests do not add devices. Slot-typed content uses `<slot>`; fix failed required bindings rather than deleting them.
