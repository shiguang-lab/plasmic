# Table

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Table (deprecated) | `plasmic-antd5-table` |
| Column | `plasmic-antd5-table-column` |
| Column Group | `plasmic-antd5-table-column-group` |

## Generation rules

### Registered data and columns

The current registration's display name is Table (deprecated); its actual wrapper remains the source for this library. Read data, rowKey, isSelectable, selectedRowKeys and the selection callbacks rather than assuming the v6 Table's control set. This registration does not expose ordinary v6 pagination/scroll/onChange controls. Preserve source identity; do not switch libraries or claim unsupported controls by copying a v6 recipe.

### Table.Column and ColumnGroup

Columns expose title, dataIndex, render, align, fixed and colSpan; ColumnGroup owns its title and actual leaf children. Inspect render scope before binding row content. Native width/ellipsis/sort capabilities require an actual supported binding path; an unregistered v6 template-conversion action is not available by assumption.

## Acceptance checks

### Acceptance

Use stable unique row keys, complete real values and actual selection ownership. Test multiple distinct rows, zero/false/empty values, selection changes, refresh/reordering and the required overflow behavior. Use [Pagination](pagination.md) only when the consuming flow actually owns separate supported pagination. Verify actual Preview behavior and save/reopen; report a missing required Table capability directly.
