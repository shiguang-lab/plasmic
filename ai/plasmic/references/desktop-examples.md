# Desktop MCP minimal examples

Discover native operations through `get_app_state({view:"tools"})`, then `get_app_state({toolNames:["read","insertHtml"]})`: default schemas include complete inputs; `schemaView:"full"` adds output schemas. Top-level MCP tools have their schemas in tools/list; get_screenshot, snapshot_layout, execute_batch and get_app_state are not native operation names for toolNames. MCP execute_batch already defines its envelope; fetch individual operation contracts instead of native executeBatch’s full union. These are tool argument objects, not raw Studio REST requests. Replace placeholder UUIDs with identities from public model reads.

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
{"name":"read","input":{"collection":"components","fromProject":"IMPORTED_PROJECT_ID","nameContains":"badge","view":"contract","fields":["uuid","name","props"],"limit":10}}
{"name":"read","input":{"componentUuids":["registered-component-uuid"],"view":"contract"}}
{"name":"read","input":{"componentUuids":["page-uuid"],"view":"context"}}
```

The component collection contract read returns uuid/name/props together; use the returned UUID for a later targeted read, never a registration key such as plasmic-antd6-badge in componentUuids. Follow `nextOffset` for more inventory entries. No targets/collection returns counts. Default `tree` contains structure only: component `tree`/`rootElementUuid`, or element `children`/named `slots`; child references retain UUIDs and inherited source identities. `depth` expands structure without props/styles/text. Batch needed node IDs in `elements`, then read values separately:

```json
{"name":"read","input":{"elements":[{"componentUuid":"page-uuid","elementUuid":"table-uuid"}],"view":"properties","propNames":["pagination","rowKey"]}}
{"name":"read","input":{"elements":[{"componentUuid":"page-uuid","elementUuid":"shell-uuid"}],"view":"properties","fields":["uuid","styles"]}}
```

`properties` reads base-variant values; `propNames` defaults to those values without unrelated styles/text. Explicit fields can request both. `isContext:true` remains visible on global-context definitions even in narrow projections. `contract.props` preserves types/defaults/enums/Slot and event signatures; parameter IDs and codeComponent metadata remain in full/explicit field reads. Read owning context/full for overrides/interactions. Rich text and complete subtree markup remain in full; explicit baseVariantTplTree also reads markup at the requested depth. Partial reads do not replace full Page gates.

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

For a standalone Overseas/Antd-v6 AppShell Page, keep the default root returned by `createComponent` and insert the shell directly. AppShell owns `width:100%` and `height:100vh` on its outer DOM; no root-height or shell percentage-height mutation is needed. Use the [golden boilerplate](design/layout.md#standalone-appshell-golden-boilerplate) and measure the rendered shell after content edits.

New IDs can be bound and used in the same batch:

```json
{"operations":[
  {"as":"page","name":"createComponent","input":{"name":"记录列表","type":"page","path":"/records"}},
  {"as":"section","name":"insertHtml","input":{"componentUuid":"$page","html":"<div data-plasmic-name=\"Content\"></div>"}},
  {"name":"changeElement","input":{"componentUuid":"$page","elementUuid":"$section","styles":{"padding":"24px"}}}
]}
```

The receipt's `operations[*].created` contains actual identities; it does not contain full page markup. Bindings resolve only in UUID fields/arrays, action identity fields and `canvasName`; they do not persist across calls. HTML component names resolve during asset preparation and must already exist: instantiate a newly created reusable definition in a subsequent call. A failed batch rolls back its model changes; a successful batch remains unsaved. After checking the actual results and validation, call `execute`:

```json
{"name":"save","input":{}}
```

Successful output has this shape (revision is illustrative):

```json
{"projectId":"project-uuid","revision":42,"saved":true}
```

Record the receipt with project/branch identity; it is not an idempotency key for replaying edits. Save errors must not be reported as success. Reopen/reread and repeat affected checks separately. For collecting gate inputs and running the script suite, use [unified verification](verification.md).


## Event arguments and step results

Read each used event's named arguments once from its current contract, then use them directly: SearchForm onSearch(values), Form onFinish(values) and ActionGroup/Dropdown onAction(key) have different scopes. There is no generic $args substitute. For SearchForm, one customFunction step can apply `values` to the existing appliedFilters state and reset page to1; a separate return-value probe is unnecessary.

`$steps` is a dictionary keyed by the normalized interaction-step name, not an array. When a later action needs a result, use a distinct already-normalized lowerCamelCase step name such as `captureSearchArgs`; a customFunction code expression `values` returns the object, and the next action reads `$steps.captureSearchArgs`. Do not use `$steps[0]` or a key from another handler. A missing public signature is a contract gap to report, not a reason to generate TestHarness Pages or repeatedly open Preview. Runtime acceptance remains in the completed business Page and its scoped overlays.

## Form submission and record context

For example, with the installed `onFinish(values)` contract, a required destination name comes from `values.name`, not the initial example name. Use the verified host route/context contract to carry the necessary values or stable record key; do not assume browser globals or a new global store. On the destination, resolve that key/context and populate all dependent fields. Test two submissions with distinct names and a rejected submission: each valid destination must retain its own values, while rejection must not navigate or mutate. For an editor reused across records, verify its registered reset/set-fields behavior; changing a constant initialValues object alone is not proof that reopening resets native Form state.

## Component instances

Insertable code components use `<plasmic-component data-plasmic-component="REGISTERED_NAME" data-plasmic-project="IMPORTED_PROJECT_ID" data-props='{"prop":"value"}'><slot name="children">Content</slot></plasmic-component>`. Names and values come from the registration. Instance styles affect layout; appearance uses real props. Do not insert scripts or invent native input handlers. Dynamic bindings use the discovered expression contract and available data scopes.

Generate each binding from that component's live `contract.props` type. For the Antd6 registrations, Input.placeholder is text while Select.placeholder is a Slot:

```html
<plasmic-component data-plasmic-component="plasmic-antd6-input" data-plasmic-project="IMPORTED_PROJECT_ID" data-plasmic-name="KeywordInput" data-props='{"placeholder":"搜索名称"}'></plasmic-component>
<plasmic-component data-plasmic-component="plasmic-antd6-select" data-plasmic-project="IMPORTED_PROJECT_ID" data-plasmic-name="MarketSelect"><slot name="placeholder"><span data-plasmic-name="MarketPlaceholder">请选择市场</span></slot></plasmic-component>
```

These are syntax examples, not required business defaults. A Select with an initial all/market value needs no placeholder override. Preserve required help/content through the correct Slot instead of dropping it after a type error. Reread the affected contract when the installed library changes; saved readback must retain the intended prop values and Slot ownership.

The same distinction applies to Column `render`: read its live Slot/render scope, place the registered control in that Slot, and bind record fields in the returned row scope. Do not send HTML or a function string as an ordinary `render` prop. For a local action that opens details, retain the clicked record/key in the existing page state and derive every information/parameter/result region from it. Exercise two records with different values or statuses; matching only the drawer title cannot validate its remaining fields. Missing returns use the source-defined empty/pending state, not another row's example payload.

## Project global contexts

An inventory entry with `isContext:true` is already managed outside the Page tree. Discover the consuming project's installed instance, then its definition and action contracts:

```json
{"name":"read","input":{"collection":"globalContexts"}}
{"name":"read","input":{"componentUuids":["componentUuid-from-installed-context"],"view":"contract"}}
```

The first result lists instance `uuid`, definition `componentUuid`, registered `name` and stored `properties`; combine overrides with the definition's registered defaults. The second includes `globalActions[*].name` as the exact flat `$globalActions` key and `parameters` in call order. For a transient result use the discovered [Message action](libraries/antd_v6/components/config-provider.md#feedback-action-calls) in the existing event callback. The installed context supplies theme/portal ownership to Pages automatically. Neither using Message nor inheriting theme requires `insertHtml` for a provider. Explicit context setting changes require the advertised project-level editing capability; report its absence instead of composing another provider.

## Dynamic native text

`changeElement.text` writes plain text; a string containing `{{ ... }}` is not converted into a binding by that operation. To create a dynamic text leaf, use `insertHtml` with a native text element whose text contains the expression. For an existing message leaf inside a component Slot:

```json
{"name":"insertHtml","input":{"componentUuid":"page-uuid","elementUuid":"message-leaf-uuid","location":"replace","html":"<span data-plasmic-name=\"Message\">{{ $state.message }}</span>"}}
```

Use an existing state/data scope. Preserve the owning component, its Slot and unrelated business nodes; this replacement creates a new text-leaf UUID, so inspect references to the old leaf first. Do not prepend/append expression fragments to an existing text block or enumerate every possible message as conditional static nodes. Do not substitute a Badge, Input or another functional widget for ordinary message text. Read back the new leaf and verify an actual state change in Preview: serialized `{{ ... }}` text alone does not prove that a binding executes.

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
