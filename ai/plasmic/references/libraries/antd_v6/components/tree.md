# Tree

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tree.DirectoryTree | `plasmic-antd6-directory-tree` |
| Tree | `plasmic-antd6-tree` |

Preserve the installed Ant Design expansion defaults unless explicitly overridden by the requirement. Do not force Tree expansion through registration hints or injected runtime defaults.

## Keys, selection and checks

Keep treeData keys stable and unique. Selected, expanded and checked keys have different meanings; bind only the states required by the workflow and read each event's keys/info arguments and state helper. Parent/child checks, half-checked data and disabled nodes follow the actual native contract rather than a flat list of booleans. titleRender is a real node render Slot, with its registered node scope.

## Tree.DirectoryTree and acceptance

DirectoryTree is maintained here with its own registration/defaults. Do not assume its expandAction and checkable behavior matches an ordinary Tree. Verify nested expansion, selection/checking, disabled nodes, empty/reloaded data, long titles and actual event output. Use [master-detail composition](../compositions/master-detail.md) when selection controls another region; check keyboard behavior, the real scroll owner and saved bindings.
