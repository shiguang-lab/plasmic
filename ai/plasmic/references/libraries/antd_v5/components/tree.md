# Tree

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Directory Tree | `plasmic-antd5-directory-tree` |
| Tree | `plasmic-antd5-tree` |

## Generation rules

### Tree and DirectoryTree

Keep stable unique treeData keys. Selected, checked and expanded states use different events/helpers, including info and half-checked data. Read actual editOnly/default state props, defaultExpandAll, autoExpandParent, expandAction and the native titleRender node scope. This wrapper's seeded defaults must be verified independently of v6.

## Acceptance checks

### Acceptance

Test nested selection/checking/expansion, disabled nodes, required parent-child semantics, empty/reloaded data and long titles. DirectoryTree has its own defaults and expand interaction. Keep selection-driven business content and key identity consistent after refresh, preserve keyboard usability and save/reopen.
