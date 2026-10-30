# Table

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Table | `plasmic-antd6-table` |
| Table.Column | `plasmic-antd6-table-column` |
| Table.ColumnGroup | `plasmic-antd6-table-column-group` |
| Table.ExpandColumn | `plasmic-antd6-table-expand-column` |

**Hard constraints** (always delivered with any section):

- Decide every Column's `width` in the plan before markup. The project default uses literal pixel widths, exactly one main text Column (`role:widget`, native text or a text Tooltip render) without width, and numeric Table `scroll.x` greater than the explicit widths sum. Native `max-content` is available through a source-backed `scroll.x` override; this is a project layout policy, not an Ant Design limitation. See [content and scroll width](#content-and-scroll-width).
- Size each width from its title as well as its values; status/time/short fields are fixed, never the main column.
- Row operations: registered ActionGroup in the last leaf Column.render, `fixed:"right"` and a measured numeric width ([operation column sizing](#operation-column-sizing)).
- Column presentation is a plan field: `text` leaves the native render Slot empty, `custom` composes registered components in it; status Columns render a mapped Badge, categories default to text.
- Text columns expected to exceed their planned width use `ellipsis:{showTitle:false}` and a registered Tooltip in Column.render to expose the complete current-row value. Record `presentation:custom` for this render template. See [columns and content](#columns-and-content).
- Every paginated list needs a fixture larger than the initial pageSize. Prototype-owned paging (bound `current`/`pageSize`, a server query or a source page policy) also needs first/second/return `page-change` cases, plus `page-size` when adjustable; native component-owned paging over local data needs no case. See [paging acceptance](#pagination-data-and-acceptance).

## Plan decisions

Declare these native props in each planned instance before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` (or the baseline) for each; selection preflight rejects pending or missing values. `null` means deliberately unset and is accepted only where marked.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-antd6-table` | `scroll` (`null` allowed) | Numeric x greater than the explicit Column widths sum by default when any Column has a width; source-approved `{"x":"max-content"}` uses native content sizing. Null leaves native sizing for an all-text Table without widths. See [rule](#content-and-scroll-width). |
| `plasmic-antd6-table` | `pagination` | false, or the native paging object with one declared ownership mode. See [rule](#data-identity-sorting-and-pagination). |
| `plasmic-antd6-table-column` | `width` (`null` allowed) | Literal pixel width from the title and values; null only for the single main text Column. See [rule](#content-and-scroll-width). |
| `plasmic-antd6-table-column` | `presentation` | Plan field, not a native prop: text (empty render Slot, native value) or custom (registered components in render), from the source presentation. See [rule](#render-templates). |

## Generation rules

### Design defaults

- Use for repeated records with comparable attributes; a few items without columns use List.
- Pagination 20 per page, options 20/50/100, size changer and total shown ([scale](../../../design/scale.md)).
- Row actions use ActionGroup in a fixed right column; status columns render Badge; widths follow [content and scroll width](#content-and-scroll-width).
- The Table sits in its list Card or Tab panel without its own title row.
- Header sorting is opt-in per business task and Column, not automatic for every numeric/date field. Apply [sorting decisions](#when-to-enable-header-sorting) before configuring it.

### Usage and behavior

Read the installed Table contract and the real [Column](table.md#columns) instances. Before choosing a Column's presentation, classify its source purpose using [selection](../selection.md): lifecycle/processing fields follow [Badge](badge.md), category/attribute fields choose text or Tag under [Tag/text rules](tag.md#tag-or-text), and operations follow ActionGroup. Read that rule owner; Table metadata describes capabilities, not the right semantic choice. [SearchForm + Tabs + Table composition](../../overseas/compositions/search-table.md) owns filters, scopes, vertical scrolling and business pagination; [Tab Item](tabs.md#items) owns each panel content Slot.

### Complete editable table

Before inserting each Table, read its live Table and Column contracts and inventory every Column's source purpose, native presentation, dataIndex/render scope and width. Keep category Columns as role:category for both text and Tag. Record `presentation` text or custom from the source decision; the render Slot's content alone carries it. Ordinary single-value categories default to text. When Tag is justified, place a registered Tag in Column.render ([render templates](#render-templates)), not styled spans. For custom presentation declare the actual component/Slot owners; a text template remains valid without a Tag. Row operations use registered [ActionGroup](../../react_ui/components/action-group.md) in Column.render, in the last leaf Column with fixed=right and measured width. Discover its library before choosing substitutes. Pagination totals use native showTotal(total, range). Insert real Column nodes in Table children; ColumnGroup is for grouped headers. Read back visible headers and two distinct rows before advancing. The structural gate checks required identities, props, Slots and complete Column coverage; review the draft and equivalent Tabs for presentation consistency.

For a required record action, declare `rowActions` in the [source inventory](../../../requirement-alignment.md#structural-gate). Do not use link formatting for an action label such as “查看”: it consumes a URL. Use ActionGroup items in the live row scope; onAction(key) owns navigation (a page-navigation interaction conditioned on the key) and local effects. The destination or overlay must show the clicked record, carried by its own route param rather than a global; declare it per [record context](../../../design/record-context.md) and verify with two distinct records. A registered Button in Column.render remains valid for an explicitly required cell control, not a replacement for the row-operation group. For query-driven tables declare dynamic data/state dependencies; test a nonmatching keyword, zero rows **and total**, then reset and recovery. Event presence does not establish the effect.

### Data contract

The registered `data` is queryData; runtime rows come from `data.data`. Static data uses a JSON result object: `data-props='{"data":{"data":[{"id":"one","count":0}]}}'`; an empty result is `{"data":[]}`. An array alone is invalid. For an existing array state `rows`, use `{"data":{"data":"{{ $state.rows }}"}}` or the whole expression `{{ ({data: $state.rows}) }}`. Native result metadata is retained. Do not delete required data to bypass errors. Build JSON with a serializer; when generating HTML in another language, verify its final binding delimiters before insertion. Read Column scopes; verify visible rows, total, page and pageSize against the requirement.

### Title render Slot

Table's optional native `title` render Slot owns required content above the column headers and receives `currentPageData`, the current page rows. Insert editable content in this Slot rather than inventing a `header` prop; each column heading still uses `Column.title`. Leave it unset when no table-top content is required. This capability does not opt in to a standalone Page heading. When using its data scope, verify content after filtering, pagination and an empty result, then save/reopen and reread the Slot and bindings.

### Content and scroll width

Use real Antd6 Table columns and render Slots. Place operations last and fixed right, size the column to visible actions, and use the registered [ActionGroup](../../react_ui/components/action-group.md). Preserve complete source values and meaningful 0/false. Wide content scrolls horizontally within the Table, never widens the viewport. Read [Tooltip](tooltip.md) before configuring overflow content.

The project default fixes planned widths for short fields, status, time and operations and leaves one main text Column without width to absorb remaining space. When any Column has a width, use numeric `scroll.x` equal to the explicit widths plus that column's baseline (for example `{"x":1494}`). This supplies a planned scroll width; actual distribution still depends on native table layout, content and container size. The wrapper does not supply a default `scroll.x`.

Native `scroll.x:"max-content"` sizes from content. When the source requires it, set `props.scroll:{"x":"max-content"}` and the existing `overrides` entry: `"scroll.x":{"reason":"Source requires content sizing","evidence":{"path":"/abs/requirement.md","sha256":"…","quote":"scroll.x = max-content"}}`. Cite the actual instruction. Plan and saved-model gates require matching values and intact source evidence. Other column-width, title and main-text-column checks still apply; measure actual widths after rendering.

The project's literal pixel width policy makes columns statically checkable; it does not describe every native width capability. Size each width from its title as well as its values; the gate's conservative estimate for a four-character Chinese title in a large Table is 92px, followed by rendered measurement. Plan preflight and the structure gate enforce the project policy; the rendering gate also measures fixed control columns. Inactive Tabs need their own layout capture. Preserve widths when the sum exceeds the viewport; verify horizontal scrolling and the fixed-column boundary. Static Pen full-column views are a source presentation convention; in the interactive App verify every column by scrolling and retain measurements and screenshots in the acceptance evidence.

### Columns

Read the installed Column contract for fields, render Slots, widths and overflow. The owning [Table](table.md) defines selection, total scroll width and pagination.

#### Columns and content

For tables, record each field's purpose, longest common real value, required complete boundary value, width and overflow policy in the sidecar acceptance report. Retain the requested App viewport and verify the actual component metrics; do not copy widths from a differently sized reference composition.

Use these starting widths in pixels: short IDs/counts and type/scenario 96–128; status and people 128–176; timestamps 160–192; names 200–280; keys/code 240–320; notes 280–360. Keep ID/count/time/enumeration/status values complete. Name/key/people may ellipsize; details or copy are additional ways to access the value. Set the real Table.Column ellipsis prop instead of shortening data or merely styling a span. Verify actual truncation and the complete value before claiming success; configuration alone is insufficient.

For text expected to exceed its planned width, follow the [official ellipsis with custom Tooltip pattern](https://github.com/ant-design/ant-design/blob/6.6.5/components/table/demo/ellipsis-custom-tooltip.tsx): set Column `ellipsis:{showTitle:false}` and compose a registered Tooltip in Column.render, with `placement:topLeft` and the complete current-row value as its title and visible text. This applies to ordinary long names, keys, addresses and notes, not only special multi-field content. Record `presentation:custom` because the render Slot contains a component; short text that needs no popup keeps `presentation:text` and an empty render Slot. The main text column may use this Tooltip render while still absorbing the remaining width.

The registered `ellipsis` accepts the native boolean or object value: `false` disables ellipsis; `true` or `{showTitle:true}` enables single-line ellipsis with the body's browser `title`; `{showTitle:false}` retains ellipsis and disables that body-cell title to avoid competing hints. Header titles follow native Table behavior. `showTitle:false` does not create the Tooltip itself; `showSorterTooltip` concerns the sorting header only. Confirm the installed Column registration accepts the object form before authoring it; do not invent a separate `showTitle` prop or tooltip configuration schema.

Bind Tooltip content to the live `cell`/`row` render scope, never one row's static text. Preserve complete source values, including meaningful 0/false; use an empty title for null/undefined/empty values so they create no popup. Multi-line or multi-field content may customize the popup using the same row scope. Native Tooltip opens on its configured trigger even when text fits; this pattern does not detect overflow. Verify at least two distinct rows, long/short/empty values, no competing body-cell title, and resized columns, then save/reopen. Apply [Tooltip acceptance](tooltip.md) to configured triggers and temporary editing reveals; verify actual truncation in Preview rather than inferring it from props.

#### Render templates

A Column without render content shows its field value natively; `custom` presentation composes registered components in the native `render` Slot, whose scope is the bare names `cell`, `row` and `index` (no `column` or `$ctx` prefix). Copyable starting points, values illustrative:

```html
<!-- Long text: Column owns ellipsis; Tooltip exposes the complete cell value -->
<plasmic-component data-plasmic-name="Address" data-plasmic-component="plasmic-antd6-table-column" data-props='{"dataIndex":"address","width":280,"ellipsis":{"showTitle":false}}'><slot name="render"><plasmic-component data-plasmic-name="AddressTooltip" data-plasmic-component="plasmic-antd6-tooltip" data-props='{"placement":"topLeft","titleText":"{{ cell == null ? String() : String(cell) }}"}'><slot name="children"><span>{{ cell == null ? String() : String(cell) }}</span></slot></plasmic-component></slot></plasmic-component>
<!-- Status: Badge maps the value; never color/dot/count -->
<plasmic-component data-plasmic-name="Status" data-plasmic-component="plasmic-antd6-table-column" data-props='{"dataIndex":"status","width":128}'><slot name="render"><plasmic-component data-plasmic-name="StatusBadge" data-plasmic-component="plasmic-antd6-badge" data-props='{"status":"{{ row.status === &#39;ENABLED&#39; ? &#39;success&#39; : &#39;default&#39; }}","text":"{{ row.statusLabel }}"}'></plasmic-component></slot></plasmic-component>
<!-- Single-value category Tag: the expression maps value to native color and label -->
<plasmic-component data-plasmic-name="CategoryTag" data-plasmic-component="plasmic-antd6-tag" data-props='{"color":"{{ ({MESSAGE: &#39;blue&#39;})[cell] }}"}'><slot name="children"><span>{{ ({MESSAGE: "消息"})[cell] ?? cell }}</span></slot></plasmic-component>
<!-- Multi-value Tags -->
<plasmic-component data-plasmic-name="LabelTag" data-plasmic-component="plasmic-antd6-tag" data-repeat="{{ cell || [] }}" data-repeat-item="tagValue"><slot name="children"><span>{{ tagValue }}</span></slot></plasmic-component>
<!-- URL link -->
<a href="{{ cell }}" target="_blank" rel="noopener noreferrer" data-visible-if="{{ !!cell }}">{{ cell }}</a>
<!-- Avatar -->
<plasmic-component data-plasmic-name="OwnerAvatar" data-plasmic-component="plasmic-antd6-avatar" data-visible-if="{{ !!cell }}" data-props='{"src":"{{ cell }}","size":32,"alt":"{{ row.name }}"}'></plasmic-component>
```

Name each instance for its role. Generate `data-props` with a JSON serializer: in a single-quoted attribute encode a literal `'` as `&#39;`; in a double-quoted attribute encode every `"` as `&quot;`. A status Column maps the row value inside the Badge `status`/`text` expressions and records `statusMap` on the Column; a Tag maps it inside its native `color` and children. Never add non-official props to the registered component. Verify two distinct rows, unmapped and empty values after save/reopen.

#### Operation column sizing

Measure the widest visible permission-filtered ActionGroup for valid rows in the current role, add actual left/right cell padding, and round up for the fixed-right operation column. Exclude hidden menu widths. An existing width is not evidence that it still fits after replacing the action component.

#### Table.ColumnGroup

Use the real ColumnGroup children/title contract for a required grouped header. Keep actual Column nodes and their render scopes inside that group; a decorative row above the Table is not a grouped header. Verify group order, fixed/scrolling boundaries and the complete leaf-column content after save/reopen.

### Expandable row details

Table supports inline row details through the `expandedRowRender` render Slot and the native `expandable` object. Before use, read the live Table and Table.ExpandColumn contracts with MCP `view:"contract"`. Confirm the Slot's ordered arguments and the expandable prop's `registration.fields` and the top-level expansion event arguments; local source or this document alone does not prove the consuming project's library/runtime is synchronized. If these contracts are missing, synchronize the library before composing; do not imitate expansion with HTML rows or mutate saved props just to reveal content.

| Contract | Usage |
| --- | --- |
| `expandedRowRender` Slot | Receives `row`, `index`, `indent`, `expanded`. Compose registered components and bind to `row` fields. The wrapper maps this top-level Slot to native `expandable.expandedRowRender`; the Slot takes precedence over a function in that object. |
| `rowKey` | Set a stable unique business field even when row selection is disabled. Expansion keys use the field's original string/number type. |
| Table.ExpandColumn | Optional position marker, placed once directly among the Table's Columns, outside ColumnGroup. Its order becomes native `Table.EXPAND_COLUMN`; it owns no data/render props. Without a marker, Ant Design inserts the expansion column automatically. |
| `expandable.showExpandColumn` | Defaults to true. False hides even an explicit position marker. Provide `expandRowByClick:true` or a controlled expansion action if users still need to open rows. |
| `expandable.columnTitle`, `columnWidth`, `fixed` | Native heading, pixel width and fixed side (`left`/`right`). Include this width in horizontal sizing. Position comes from the marker order; pinning comes from `fixed`. |
| `expandable.rowExpandable` | Expression `(row) => boolean` permitting individual rows; separate from whole-column visibility. |
| `expandable.defaultExpandedRowKeys`, `defaultExpandAllRows` | Uncontrolled initial state. An explicit default keys array takes precedence over expand-all. Defaults apply on mount to loaded data. |
| `expandable.expandedRowKeys` | Controlled keys array, including `[]` to close all. Bind state and update it using the top-level `onExpandedRowsChange(expandedKeys)` event. Omit for native component-owned expansion; a constant array freezes expansion. |
| `canvasExpandedRowKeys` | Editing-only initial sample keys. Set representatives for every requirement-defined detail presentation variant. This is a real registered multi-select prop with `editOnly:true`, no uncontrolled/runtime mapping. Explicit `[]` starts the canvas closed; omit to follow native expansion settings. Only loaded, eligible keys of the original type render. Interactive mode, Preview and generated exports use native runtime settings. |
| `onExpand` | Event arguments: `expanded` boolean, then `row` record. |
| `onExpandedRowsChange` | Event argument: `expandedKeys` array. Configure expansion events as top-level Table props. The wrapper forwards them to native `expandable` callbacks; top-level handlers take precedence over callbacks in that object. |

For controlled expansion, create a Page array state `expandedKeys`, bind `expandable.expandedRowKeys` to `{{ $state.expandedKeys }}`, then call MCP `createInteraction` with the actual Page and Table node IDs:

```json
{"componentUuid":"<pageUuid>","elementUuid":"<tableNodeUuid>","eventName":"onExpandedRowsChange","name":"SyncExpandedRows","action":{"actionName":"customFunction","code":"$state.expandedKeys = expandedKeys"}}
```

Use `eventName:"onExpand"` for per-row effects with `expanded` and `row` arguments. `eventName` is the top-level registered name; `expandable.onExpand` and `expandable.onExpandedRowsChange` are runtime destinations, not MCP event paths. Verify the updated state and visible detail rows in Preview.

#### Expand from a cell control

Hide the native expansion column with `expandable.showExpandColumn:false` and bind `expandable.expandedRowKeys` to a Page array state. Keep a stable `rowKey:"id"`; independent Tables need separate array states. Read the installed cell-control contract before choosing its event owner.

When the user explicitly requires an `a` element for the inline detail action, keep it in Column.render with zero padding so its text aligns with the column heading. This is a local action with no destination: do not invent a URL. Give the anchor button semantics and keyboard access, and show noninteractive disabled text for records without details. The native render scope supplies `row` to the anchor's expressions and interactions:

```html
<a data-plasmic-name="DetailsLink" role="button" tabindex="0" data-visible-if="{{ row.hasDetails }}" style="display:inline;padding:0;color:var(--ant-color-link);cursor:pointer">{{ $state.expandedKeys.includes(row.id) ? "收起" : "详情" }}</a>
<span data-plasmic-name="DetailsUnavailable" aria-disabled="true" data-visible-if="{{ !row.hasDetails }}" style="display:inline;color:var(--ant-color-text-disabled)">详情</span>
```

Attach `onClick` to the actual anchor node, not the Column, so the link owns its behavior without depending on href-based cell delegation:

```json
{"componentUuid":"<pageUuid>","elementUuid":"<anchorNodeUuid>","eventName":"onClick","name":"ToggleRowDetails","action":{"actionName":"customFunction","code":"event.preventDefault(); event.stopPropagation(); if (row.hasDetails) { $state.expandedKeys = $state.expandedKeys.includes(row.id) ? $state.expandedKeys.filter(key => key !== row.id) : [...$state.expandedKeys, row.id]; }"}}
```

Add native `onKeyDown` handling for Enter and Space: prevent default and run the same guarded toggle once when `!event.repeat`. If the installed Typography.Link contract exposes the required events, prefer that registered anchor; otherwise record the verified contract gap and exact native target in `elementFallbacks`. A user-requested Button uses its actual registration instead. General record-operation menus still follow ActionGroup.

Keep Table's `onExpandedRowsChange` synchronized to the same state if native expansion interactions are also available. Updating controlled keys does not emit native `onExpand` callbacks; put any required cell-action effects in that action's own interaction. Verify actual anchor DOM, heading/text alignment, two distinct rows, disabled text, keyboard activation, empty-cell clicks, sorting by stable ID and independent state between Tables.

#### Row detail template and canvas editing

Example Slot composition (the consuming task supplies its own `data`):

```html
<plasmic-component data-plasmic-name="Orders" data-plasmic-component="plasmic-antd6-table" data-props='{"rowKey":"id","pagination":false,"expandable":{"columnWidth":48,"showExpandColumn":true,"rowExpandable":"{{ (row) => !!row.detail }}"}}'>
  <slot name="children">
    <plasmic-component data-plasmic-name="Expand" data-plasmic-component="plasmic-antd6-table-expand-column"></plasmic-component>
    <plasmic-component data-plasmic-name="OrderNumber" data-plasmic-component="plasmic-antd6-table-column" data-props='{"dataIndex":"orderNo"}'><slot name="title"><span>订单号</span></slot></plasmic-component>
  </slot>
  <slot name="expandedRowRender"><span>{{ row.detail }}</span></slot>
</plasmic-component>
```

The simple text detail above can be replaced by a registered Descriptions, nested Table or other requirement-derived content after reading its live contract. Each expanded row uses its own record scope. The position marker alone does not enable details; populate the render Slot. Tree data with `children` is a distinct native expansion mode; do not mix nested tree records and detail rendering on the same Table.

Configure `canvasExpandedRowKeys` to show representative details directly in the ordinary canvas. MCP derives the representative records from the requirement's distinct detail presentations: conditional fields/groups, layouts, available actions, empty or missing data, collection cardinality, and required text boundaries. Cover meaningful combinations from the requirement, not a guessed status field or a fixed number of rows. Record the source, representative `rowKey` and expected presentation in the existing task plan/runtime cases. Ordinary value differences that do not change the presentation need no duplicate sample. Use real loaded fixture records and keep representatives reachable on the canvas's initial page; unavailable variants remain a reported coverage gap.

For example, `canvasExpandedRowKeys:["full","empty","restricted"]` can seed three requirement-derived sample records while `expandable.expandedRowKeys:[]` keeps Preview initially closed. Read the live contract before setting these exact native props through MCP `changeElement`, then save and reread. Designers edit the same **Canvas expanded rows** multi-select in the property panel; there is no separate mode or translated property schema.

Configured canvas samples take precedence over business expansion settings only while authoring. Selecting the Table or detail Slot does not add all remaining rows. The shared canvas modifier-click gesture (Cmd on macOS, Ctrl on Windows/Linux) changes temporary canvas keys; manual changes take precedence until the active sample configuration changes. Table defines no modifier shortcut of its own. Changing **Canvas expanded rows** refreshes the samples; Interactive mode, Preview and exports keep the native business configuration. The same repeated Slot template is edited for every row, and callbacks do not update business state during canvas expansion.

When `canvasExpandedRowKeys` is omitted, the canvas follows native expanded/default keys. Selecting the expanded-content Slot/descendant or Edit contents can still reveal eligible loaded rows for authoring. Canvas expansion respects `rowExpandable`, requires stable keys, and has no sample to render without loaded data. Explicit runtime default edits are reflected when no canvas sample configuration overrides them.

Acceptance: use multiple requirement-defined detail variants and a non-expandable record. Verify the configured representative keys on the ordinary canvas, row-key types, missing/ineligible keys, explicit empty samples, manual expansion and sample edits. Selecting content must not broaden configured samples. In Preview verify independent native controlled/default expansion and event arguments, hidden-column row click, marker order alongside selection/fixed columns, and correct row data in the Slot. Save/reopen and confirm sample configuration persists separately while temporary interaction keys do not. Verify `editOnly`/ToolsOnly excludes samples from generated exports and check pagination/horizontal scrolling with expanded content.

### Data identity, sorting and pagination

The wrapper's data input is the actual registered data-source contract, not an assumed native dataSource prop. Use a unique stable business field as rowKey, especially when selection, refresh or sorting is involved. Array indexes and display labels do not identify rows across those transitions. Read the ordered onChange arguments: pagination, filters, sorter and extra. Map their real values to the owning workflow rather than treating the first argument as a row.

Declare client-side or server-side ownership for sorting, filtering and paging. Server-side total is the full matching count, not the current row count; do not slice an already paged response again. Reset or retain current page according to the changed filters/scope and requirement. Do not promise a sorting/filtering column control absent from the installed registration. Use [Pagination](pagination.md) and the matching query composition for the actual configuration.

#### When to enable header sorting

Enable header sorting when the requirement explicitly calls for it, or when an in-scope comparison/prioritization task benefits from users changing the order and the field has a meaningful, supported ordering. Record the task, eligible fields, initial order and local/server owner in the existing design decision notes. Field type alone is not a reason to add sorting; when no ordering task is established, retain the supplied order and leave sorting unset.

| Task or field | Decision |
| --- | --- |
| Find newest/oldest records; compare creation, update or due times | Enable the relevant time Column when users need both directions. Compare actual timestamps, not formatted display strings. |
| Compare amounts, counts, duration or scores; find largest/smallest values | Enable only the relevant metric Columns. Compare underlying numeric values with consistent units, not currency/percentage strings. |
| Browse a directory by name | Enable only when alphabetical/name ordering helps the task and the locale/collation rule is defined. Search remains the entry point for locating a known record. |
| Status, category, person or other discrete attributes | Prefer filtering for finding a subset. Sort only when the requirement defines a meaningful order, such as priority rank; never infer rank from enum codes or translated captions. |
| IDs, operation/selection columns, images, long descriptions or mixed summary cells | Leave sorting disabled by default. An explicit business requirement must identify an actual comparable field before enabling it. |
| Manual sequences, workflow steps, relevance-ranked results or business-priority queues | Preserve the authoritative order unless the requirement permits switching away from it. An ordered list does not by itself require sortable headers. |

Initial ordering and user-changeable sorting are separate decisions. A requirement such as "newest first" may be satisfied by the data/query's fixed order without a clickable header. When header sorting is enabled, derive its initial direction from the business task; there is no universal ascending or descending default. Use single-column sorting by default; multiple sorting requires a stated priority and tie-breaking need. Define empty-value placement and stable tie-breaking where the data requires them; do not treat missing values as zero implicitly.

Sorting covers the full filtered result set before pagination. Use local comparison only when all matching records are available locally; a server-paged list needs server sorting support. Never sort only the loaded page while presenting it as full-result sorting. If a required server order is unavailable, record the contract gap rather than showing an ineffective sorting affordance. Sorting reorders records; filtering changes membership, and neither replaces the other.

#### Header sorting

Configure sorting on the real leaf Column, including leaves inside ColumnGroup. Read the installed Column with MCP `view:"contract"` and confirm these props before composing; a local wrapper build or this reference does not prove the consuming project's installed library model and runtime registration have synchronized.

| Column prop | Native contract and use |
| --- | --- |
| `sorter` | Expression accepting a comparator `(a, b) => number` for local rows, `true` for server sorting, `false` to disable, or `{compare, multiple}` for priority-based multiple sorting. Comparator arguments are complete records, not the render Slot's `cell`/`row` scope. |
| `defaultSortOrder` | Optional initial `"ascend"` or `"descend"`. Leave unset for no initial sorting. Header clicks then own runtime direction. |
| `sortOrder` | Controlled `"ascend"`, `"descend"` or `null` (explicitly cleared). Bind to the owning state and update from Table `onChange`; a fixed direction prevents header clicks from changing the displayed order. Leave unset for uncontrolled sorting. Control only one Column for single-column sorting. |
| `sortDirections` | Ordered native array expression, normally `["ascend", "descend"]` followed by clearing. `["ascend", "descend", "ascend"]` prevents clearing. |

For numeric local sorting, bind Column `sorter` to `{{ (a, b) => a.amount - b.amount }}`; for text use `{{ (a, b) => a.name.localeCompare(b.name) }}`. Choose comparison and empty-value handling from the actual field contract. Set `defaultSortOrder:"ascend"` only when initial ordering is required. Do not add a separate `sortable` prop or imitate sorting arrows in the title Slot.

`sorter:true` displays native header sorting and emits changes; it does not reorder local rows. Server sorting must map Table `onChange(pagination, filters, sorter, extra)` to the real query's field/direction parameters and replace the returned data. `sorter.field`, `sorter.columnKey` and `sorter.order` identify a single sort; multiple sorting can return an array. `extra.action === "sort"` distinguishes sorting from pagination/filtering, and a cleared sort has no order. Preserve one owner for page/reset policy and guard against stale query results.

The design canvas reflects edits to `defaultSortOrder` immediately through a temporary render override. Header clicks there retain authoring selection; exercise actual sorting in Preview. The override is not a saved `sortOrder` or a runtime state binding. For MCP discovery, read Column's `registration.type`, descriptions and choice options, and Table's ordered `onChange` arguments; missing props require a synchronized library/runtime before use.

Choose one ownership mode before binding. For local data with component-owned paging, `pagination:{defaultPageSize:20,showSizeChanger:true,pageSizeOptions:[20,50,100]}` initializes an editable pager without freezing its size. If application state owns paging, bind `pagination.current` and `pagination.pageSize` to the existing states and update both from the registered Table `onChange` argument `pagination.current` / `pagination.pageSize`. Reset current on the source-defined filter change. A constant `pageSize:20` is a controlled value, so displaying a size changer does not make size changes work. Verify the installed contract before using this pattern, and check resulting rows as well as the pager label.

For selection, bind selectedRowKeys only when intentionally controlled and use the actual onSelectedRowKeysChange/ref actions. Define whether selection covers the current page, retains keys across pages, or resets after filters/mutations; the current wrapper does not certify arbitrary cross-page retention. Verify keys still identify the intended records after refresh. [Bulk-action composition](../compositions/bulk-actions.md) owns batch effects and permission handling.

## Acceptance checks

### Column and operation width acceptance

After save/reopen, read both column props and rendered header/cell widths. Check All/Mine use the same definitions, the operation width equals measured content plus padding, remaining space only enlarges the text column, the longest status and timestamps fit, ellipsis preserves complete values, and the horizontal track/fixed columns/pagination remain usable. Report these as individual checks with evidence, not a generic screenshot approval or model-validation result.

Measure the complete rendered buttons, including More's arrow, gaps and button padding. Check the rightmost control against the cell's **content** right edge after native cell padding, rather than only the viewport or table edge. Read actual rendered cell width as well as Column.width: Table layout can redistribute space. `snapshot_layout` reports `cellContent` measurements and `table-cell-control-overflow` when controls in a sticky cell intrude into its padding or escape it. Size from `requiredWidth`, then remeasure both Tabs, all applicable action/permission combinations and horizontal scroll positions. These measurements do not set a universal column width.

### Selection

Selection must persist without a state binding, and controlled selection must follow the bound keys. Clear selection and radio/checkbox modes must work. For wrapper changes, test omitted, explicit and controlled/uncontrolled values with the installed Ant Design version.

### Header sorting acceptance

Confirm each sortable Column has a task-based reason under [sorting decisions](#when-to-enable-header-sorting), and fixed business ordering has not acquired an unintended header control. Check ordering across page boundaries when pagination is present.

Use at least three distinct, initially unsorted values and stable row keys. In Preview verify ascending, descending and clearing (or the declared non-clearing cycle) against actual row order, not just the header icon. Check initial ordering, controlled-state updates including explicit null, and page/selection behavior under the chosen ownership. Server sorting must prove outgoing field/direction and the returned row order; `sorter:true` alone is not acceptance. Verify multiple-sort priority when configured. After save/reopen, reread the Column expressions and directions and confirm temporary canvas ordering did not create a persisted controlled prop.

### Pagination data and acceptance

Prepare a normal initial dataset for every paginated list or Tab: after its initial filters, App/market, role and record permissions apply, the matching count exceeds the initial pageSize (at least pageSize + 1; 25–30 records for a 20-row page). Simulated local records obey the source fields, enums, relationships and permissions, each with a unique stable rowKey; keep the matching count, native total and retrievable records consistent. Record their simulated nature in task evidence, not in the UI. With server paging the backing query must really return the next page; if source/access restrictions prevent enough permitted data, report pagination unverified instead of inventing records.

Native component-owned paging over local data is Ant Design's own behavior: its readiness is the dataset size above, observed once in the Preview round (page 2 shows different records). It needs no runtime case. Paging owned by the prototype (bound `pagination.current`/`pageSize`, a server query, or source-defined page policy on filter/scope change) needs `page-change` cases, plus `page-size` when sizes are adjustable, under [runtime evidence](../../../design/component-policy.md#native-runtime-evidence):

1. Page 1: the first-page record IDs, rendered count, current page, pageSize and matching total.
2. Page 2: different expected record IDs and the correct slice size.
3. Back to page 1: the original records and unchanged total.
4. With a size changer: the resulting rows, current-page policy and total; filtering/reset and scope changes under their source-defined page policy.

Scope assertions to the actual Table and its pager. A visible pager beside a short sample, or a changed counter alone, does not pass.

### Loading, empty and failure acceptance

Read the wrapper's real loading/data behavior before adding a state override. Distinguish first load, background refresh, no matching records and failed requests through [content-state composition](../compositions/content-states.md). Keep complete usable data when the actual failure policy permits it. Test data reordered/refreshed, selection, zero/multiple pages, page-size changes, supported sorting/filtering and out-of-order query results. Check callbacks and payloads in real Preview as well as the rendered rows.
