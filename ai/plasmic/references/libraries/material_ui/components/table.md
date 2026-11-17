# Table

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Table | `plasmic-material-ui-table` |
| TableBody | `plasmic-material-ui-table-body` |
| TableCell | `plasmic-material-ui-table-cell` |
| TableContainer | `plasmic-material-ui-table-container` |
| TableFooter | `plasmic-material-ui-table-footer` |
| TableHead | `plasmic-material-ui-table-head` |
| TablePagination | `plasmic-material-ui-table-pagination` |
| TableRow | `plasmic-material-ui-table-row` |
| TableSortLabel | `plasmic-material-ui-table-sort-label` |

## Generation rules

Compose TableHead/TableBody/TableFooter with TableRow and TableCell; TableContainer is the native table container when needed. This is MUI Core Table, not Antd Table or MUI X Data Grid. It does not acquire dataSource, columns, rowSelection or built-in query behavior from another library. Bind repeated rows and cell content using the current project's supported model.

TableSortLabel presents sort state and an action; wire ordering explicitly. TablePagination exposes page/onPageChange(event, page) and rowsPerPage/onRowsPerPageChange(event). Its page is zero-based; the writable-state helper converts event.target.value to a number for rowsPerPage. Pagination is one-based. Reset/clamp the current page when the actual data or page size requires it. Choose page sizes from the requirement/theme rather than the Antd 20/50/100 baseline.

## Acceptance checks

Verify header/cell alignment, row data, sort order and pagination against the actual dataset. Check empty/long content and supported overflow at target widths, using the shared scroll-container contract without adding a second scroll region.
