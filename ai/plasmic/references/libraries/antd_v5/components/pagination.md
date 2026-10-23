# Pagination

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Pagination | `plasmic-antd5-pagination` |

## Generation rules

### Page owner

Read current/defaultCurrent, pageSize/defaultPageSize, total, pageSizeOptions and actual onChange/onShowSizeChange contracts and derived indexes. Server-side total is the full matching count and an already paged response is not sliced again. paginatedUrl is used only for an actual route-driven page contract.

## Acceptance checks

### Acceptance

Verify initial derived state against this implementation; do not carry v6 initialization fixes into the v5 reference as facts. Test no results, last page, page-size/filter changes and controlled/uncontrolled bindings. Avoid duplicate requests or a second paging owner, keep controls reachable and save/reopen the actual values.
