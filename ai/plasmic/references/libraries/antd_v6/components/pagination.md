# Pagination

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Pagination | `plasmic-antd6-pagination` |

**Hard constraints** (always delivered with any section):

- A Table owns its pagination; a standalone Pagination is only for List or card grids and disables any duplicated Table pager.
- Defaults: 20 per page, options 20/50/100, a size changer and the native `showTotal(total, range)`; another value needs the requirement's override.
- current/pageSize/total have one owner and the total is the full matching count, never the current page's row count.

## Generation rules

### Design defaults

- Table owns its pagination. Standalone Pagination is only for List or card grids, right-aligned below them.
- Same defaults as Table: 20 per page, options 20/50/100, total shown.

### Usage and behavior

Read the installed Pagination or Table pagination contract before binding page state. [SearchForm + Tabs + Table](../../overseas/compositions/search-table.md#pagination-and-scrolling) owns the business page size, totals and scroll reachability.

Read [Table paging data and acceptance](table.md#pagination-data-and-acceptance) for normal-state fixture size, simulated records and proof of real page transitions. This also applies when native Pagination pages a separate result region; scope the assertions to that region and this pager.

Pagination initializes its derived indexes from current/default props without emitting a business onChange; changes after user interaction update both page and index values. For wrapper changes, verify initialization separately from user page/page-size changes and test both controlled and uncontrolled props.

### Business paging and acceptance

Use one pagination owner for current, pageSize and total. Server-side total is the full matching result count; client-side slicing happens only in the declared client owner. Read actual onChange/onShowSizeChange and any derived indexes before mapping them to request parameters. Do not add a separate Pagination beside a Table that already owns the same paging controls.

Display totals through native showTotal(total, range), returning the business-language text; the component places it before the pager controls. Bind the callback and matching count on that owner rather than writing a sibling counter. The normalized Studio prop may be any; read its registration.type and registration.args for the original function contract. Object/array registration fields likewise describe native configuration, not a second property model.

Verify the normal first-page → second-page → first-page sequence under the linked Table acceptance before separate zero-result, partial-last-page, page-size, filter/scope and last-page-removal cases. Prototype-owned paging (bound current/pageSize, a server query or a source-defined page policy) requires page-change cases, plus page-size cases when sizes are adjustable; native component-owned paging over local data is observed in Preview without a mandatory case. Exercise controls without duplicate requests or data slicing. The required pagination stays reachable under the actual scroll owner and long total/page-size labels.
