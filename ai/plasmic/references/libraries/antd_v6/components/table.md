# Table

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Table | `plasmic-antd6-table` |
| Table.Column | `plasmic-antd6-table-column` |
| Table.ColumnGroup | `plasmic-antd6-table-column-group` |

Read the installed Table contract and the real [Column](table.md#columns) instances. Before choosing any Column display preset, classify its source purpose using [selection](../selection.md): lifecycle/processing fields follow [Badge](badge.md), category/attribute fields choose text or Tag under [Tag/text rules](tag.md#tag-or-text), and operations follow ActionGroup. Read that rule owner; Table metadata describes capabilities, not the right semantic choice. [SearchForm + Tabs + Table composition](../../overseas/compositions/search-table.md) owns filters, scopes, vertical scrolling and business pagination; [Tab Item](tabs.md#items) owns each panel content Slot.

## Complete editable table

Before inserting each Table, read its live Table and Column contracts and inventory every Column's source purpose, native presentation, dataIndex/render scope and width. Keep category Columns as role:category for both text and Tag. Pin native props.displayType to text, tag or custom from the source decision. Ordinary single-value categories default to text. When Tag is justified, use native tag display with tagOptions/tagColor or registered Tag nodes in render, not styled spans. For custom presentation declare the actual component/Slot owners; a text template remains valid without a Tag. Row operations use registered [ActionGroup](../../react_ui/components/action-group.md) in Column.render, in the last leaf Column with fixed=right and measured width. Discover its library before choosing substitutes. Pagination totals use native showTotal(total, range). These requirements apply even when reading only selected sections. Insert real Column nodes in Table children; ColumnGroup is for grouped headers. Read back visible headers and two distinct rows before advancing. The structural gate checks required identities, props, Slots and complete Column coverage; review the draft and equivalent Tabs for presentation consistency.

For a required record action, declare `rowActions` in the [source inventory](../../../requirement-alignment.md#structural-gate). Do not use link formatting for an action label such as “查看”: it consumes a URL. Use ActionGroup items in the live row scope, item href for navigation and onAction(key) for local effects. The destination or overlay must show the clicked record. Button display presets remain valid for an explicitly required cell control, not a replacement for the row-operation group. For query-driven tables declare dynamic data/state dependencies; test a nonmatching keyword, zero rows **and total**, then reset and recovery. Event presence does not establish the effect.

## Data contract

The registered `data` is queryData; runtime rows come from `data.data`. Static data uses a JSON result object: `data-props='{"data":{"data":[{"id":"one","count":0}]}}'`; an empty result is `{"data":[]}`. An array alone is invalid. For an existing array state `rows`, use `{"data":{"data":"{{ $state.rows }}"}}` or the whole expression `{{ ({data: $state.rows}) }}`. Native result metadata is retained. Do not delete required data to bypass errors. Build JSON with a serializer; when generating HTML in another language, verify its final binding delimiters before insertion. Read Column scopes; verify visible rows, total, page and pageSize against the requirement.

## Title render Slot

Table's optional native `title` render Slot owns required content above the column headers and receives `currentPageData`, the current page rows. Insert editable content in this Slot rather than inventing a `header` prop; each column heading still uses `Column.title`. Leave it unset when no table-top content is required. This capability does not opt in to a standalone Page heading. When using its data scope, verify content after filtering, pagination and an empty result, then save/reopen and reread the Slot and bindings.

## Content and scroll width

Use real Antd6 Table columns and render Slots. Place operations last and fixed right, size the column to visible actions, and use the registered [ActionGroup](../../react_ui/components/action-group.md). Preserve complete source values and meaningful 0/false. Wide content scrolls horizontally within the Table, never widens the viewport. Read [Tooltip](tooltip.md) before configuring overflow content.

Fix widths for short fields, status, time and operations; assign remaining container space only to the main text column. For Antd tables, one column without an explicit width can absorb that remainder. Make the scroll content width agree with the fixed widths plus the main text baseline, so the browser cannot proportionally expand fixed columns. Preserve widths when the sum exceeds the viewport; verify horizontal scrolling and the fixed-column boundary. Static Pen full-column views are a source presentation convention; in the interactive App verify every column by scrolling and retain measurements and screenshots in the acceptance evidence.

After save/reopen, read both column props and rendered header/cell widths. Check All/Mine use the same definitions, the operation width equals measured content plus padding, remaining space only enlarges the text column, the longest status and timestamps fit, ellipsis preserves complete values, and the horizontal track/fixed columns/pagination remain usable. Report these as individual checks with evidence, not a generic screenshot approval or model-validation result.

## Selection

Selection must persist without a state binding, and controlled selection must follow the bound keys. Clear selection and radio/checkbox modes must work. For wrapper changes, test omitted, explicit and controlled/uncontrolled values with the installed Ant Design version.

## Columns

Read the installed Column contract for fields, render Slots, widths and overflow. The owning [Table](table.md) defines selection, total scroll width and pagination.

### Columns and content

For tables, record each field's purpose, longest common real value, required complete boundary value, width and overflow policy in the sidecar acceptance report. Retain the requested App viewport and verify the actual component metrics; do not copy widths from a differently sized reference composition.

Use these starting widths in pixels: short IDs/counts and type/scenario 96–128; status and people 128–176; timestamps 160–192; names 200–280; keys/code 240–320; notes 280–360. Keep ID/count/time/enumeration/status values complete. Name/key/people may ellipsize under the [Tooltip overflow contract](tooltip.md); details or copy are additional ways to access the value. Set the real Table.Column ellipsis prop instead of shortening data or merely styling a span. Verify actual overflow and complete Tooltip text before claiming success; configuration alone is insufficient.

When a column needs an editable display/Tooltip template, use its “Convert to editable template” action with ellipsis enabled. The resulting registered Tooltip has onlyWhenOverflow=true, editable children/title Slots, and bindings in the column's real render scope (cell, row, index, column). Edit these actual nodes; do not add a parallel tooltip configuration schema or copy a row's static text across all rows. A custom title may combine current-row fields; keep display and title bindings consistent with the intended complete content. Verify at least two distinct rows, text/template content, 0/false/empty values and resized columns, then save/reopen. Apply [Tooltip acceptance](tooltip.md) to hover/focus and temporary editing reveals.

### Operation column sizing

Measure the widest visible permission-filtered ActionGroup for valid rows in the current role, add actual left/right cell padding, and round up for the fixed-right operation column. Exclude hidden menu widths. An existing width is not evidence that it still fits after replacing the action component.

Measure the complete rendered buttons, including More's arrow, gaps and button padding. Check the rightmost control against the cell's **content** right edge after native cell padding, rather than only the viewport or table edge. Read actual rendered cell width as well as Column.width: Table layout can redistribute space. `snapshot_layout` reports `cellContent` measurements and `table-cell-control-overflow` when controls in a sticky cell intrude into its padding or escape it. Size from `requiredWidth`, then remeasure both Tabs, all applicable action/permission combinations and horizontal scroll positions. These measurements do not set a universal column width.

### Table.ColumnGroup

Use the real ColumnGroup children/title contract for a required grouped header. Keep actual Column nodes and their render scopes inside that group; a decorative row above the Table is not a grouped header. Verify group order, fixed/scrolling boundaries and the complete leaf-column content after save/reopen.

## Data identity, sorting and pagination

The wrapper's data input is the actual registered data-source contract, not an assumed native dataSource prop. Use a unique stable business field as rowKey, especially when selection, refresh or sorting is involved. Array indexes and display labels do not identify rows across those transitions. Read the ordered onChange arguments: pagination, filters, sorter and extra. Map their real values to the owning workflow rather than treating the first argument as a row.

Declare client-side or server-side ownership for sorting, filtering and paging. Server-side total is the full matching count, not the current row count; do not slice an already paged response again. Reset or retain current page according to the changed filters/scope and requirement. Do not promise a sorting/filtering column control absent from the installed registration. Use [Pagination](pagination.md) and the matching query composition for the actual configuration.

For selection, bind selectedRowKeys only when intentionally controlled and use the actual onSelectedRowKeysChange/ref actions. Define whether selection covers the current page, retains keys across pages, or resets after filters/mutations; the current wrapper does not certify arbitrary cross-page retention. Verify keys still identify the intended records after refresh. [Bulk-action composition](../compositions/bulk-actions.md) owns batch effects and permission handling.

## Pagination test data and acceptance

Before generation, prepare a normal initial dataset for every paginated list/Tab in scope. After its initial filters, current App/market, role and record permissions are applied, the actual matching result count must exceed the initial pageSize: at least pageSize + 1. For a 20-row page this means at least 21 matching records; 25–30 usually suffice. The raw backing array's length is insufficient when the initial visible scope contains fewer records. Empty, sparse and failed-query fixtures are separate cases and cannot replace this normal paging dataset.

Prototype fixtures may extend the supplied examples with explicitly simulated local records that obey the source fields, enums, relationships and permissions. Record their simulated nature in the task evidence; do not add debug labels or controls to the business UI. Give every record a complete, unique stable rowKey. Keep the real matching count, native total and retrievable records consistent; a larger total with only a few actual records does not satisfy this rule. With server paging, the backing query/API must really return the subsequent page. If authoritative source/access restrictions prevent sufficient permitted data, report pagination as unverified rather than inventing real records or claiming a pass.

Use the existing native paging props and runtime cases to record the initial pageSize, matching count, active scope/filters and distinct expected record IDs before composition; do not derive these expectations from the finished screenshot or create another data schema. If a larger pageSize must also support a tested page turn, prepare enough matching records for that tested size too.

In real Preview, scope assertions to the actual Table and its native pager:

1. On page 1, verify the first-page record IDs, rendered record count, current page, pageSize and matching total.
2. Go to page 2, verify different expected record IDs and the correct slice size; first-page records must not simply remain repeated. This must demonstrate real records beyond the first page, not just an active page-number change.
3. Return to page 1 and verify its original records and the unchanged total.
4. When a size changer is available, change pageSize and verify the resulting rows, current-page policy and total separately. Also exercise filtering/reset and scope changes under their source-defined page policy.

Retain the native assertion trace for these cases under [runtime evidence](../../../design/component-policy.md#native-runtime-evidence). Static structure and declared case names do not establish the filtered dataset size or a real page transition. A pager visible beside a short sample or a changed counter alone does not pass.

## Loading, empty and failure acceptance

Read the wrapper's real loading/data behavior before adding a state override. Distinguish first load, background refresh, no matching records and failed requests through [content-state composition](../compositions/content-states.md). Keep complete usable data when the actual failure policy permits it. Test data reordered/refreshed, selection, zero/multiple pages, page-size changes, supported sorting/filtering and out-of-order query results. Check callbacks and payloads in real Preview as well as the rendered rows.
