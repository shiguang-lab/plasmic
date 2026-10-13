# TreeSelect

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tree Select | `plasmic-antd6-tree-select` |

Single/multiple/checkable values may be scalars, arrays or labeled objects. Registered state and event types must represent those modes. For wrapper changes, test actual mode/value combinations and controlled/uncontrolled behavior against the installed Ant Design version.

## Hierarchy and field ownership

Keep stable unique treeData values, readable titles and the actual parent/child structure. Selection values are not Cascader path arrays; do not flatten the hierarchy into copied labels. Read treeCheckable/multiple and any labeled-value contract before forming a payload. Inside Form, retain the owning Item's value/change binding.

## Acceptance

Verify nested selection, parent/child check behavior, clearing, disabled controls, long labels, empty/reloaded options and selected-value recovery. Remote search/loading may use only a capability present in the current registration. Check actual scalar/array/object output, keyboard navigation and saved bindings in each required mode.
