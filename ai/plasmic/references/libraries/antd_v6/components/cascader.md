# Cascader

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Cascader | `plasmic-antd6-cascader` |
| Cascader.Panel | `plasmic-antd6-cascader-panel` |

## Generation rules

### Design defaults

- Use for choosing a path through a fixed-depth hierarchy (region, category levels).
- Fills its column; placeholder `请选择` + the field noun.

### Hierarchical choice

Use Cascader for a choice expressed as a hierarchy path. Maintain options with stable values and meaningful labels; a single value is a path array, while multiple selection uses the native collection of paths. Do not flatten paths into labels or reuse TreeSelect's value model. Keep the selected path and its labels valid when options reload.

### Cascader.Panel

Panel uses the same options/value/multiple/disabled contract in an inline region. It is content rather than a fabricated dropdown. Inside Form, use the verified field binding and preserve the complete path in submission. Remote loading, search and custom rendering may be used only when the actual registration exposes the required capability.

## Acceptance checks

### Acceptance

Test nested selection, changing an ancestor, single/multiple modes, empty and disabled options, the complete saved path and real Form errors. Verify panel/dropdown geometry, keyboard navigation and long labels without widening the page.
