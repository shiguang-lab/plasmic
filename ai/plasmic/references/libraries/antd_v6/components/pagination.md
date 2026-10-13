# Pagination

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Pagination | `plasmic-antd6-pagination` |

Read the installed Pagination or Table pagination contract before binding page state. [SearchForm + Tabs + Table](../../overseas/compositions/search-table.md#pagination-and-scrolling) owns the business page size, totals and scroll reachability.

Pagination initializes its derived indexes from current/default props without emitting a business onChange; changes after user interaction update both page and index values. For wrapper changes, verify initialization separately from user page/page-size changes and test both controlled and uncontrolled props.

## Business paging and acceptance

Use one pagination owner for current, pageSize and total. Server-side total is the full matching result count; client-side slicing happens only in the declared client owner. Read actual onChange/onShowSizeChange and any derived indexes before mapping them to request parameters. Do not add a separate Pagination beside a Table that already owns the same paging controls.

Verify zero results, a partial last page, page-size changes, a filter/scope change, record removal on the last page and the requirement's current-page policy. Exercise both page and page-size controls without duplicate requests or data slicing. The required pagination stays reachable under the actual scroll owner and long total/page-size labels.
