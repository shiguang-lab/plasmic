# Menu

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Menu | `plasmic-antd6-menu` |
| Menu.Divider | `plasmic-antd6-menu-divider` |
| Menu.Item | `plasmic-antd6-menu-item` |
| Menu.ItemGroup | `plasmic-antd6-menu-item-group` |
| Menu.SubMenu | `plasmic-antd6-submenu` |

Native Menu onSelect receives an info object containing key and selectedKeys, not a bare key. Preserve that registered event signature and bind callbacks using its actual arguments.

## Items, groups and selection

Maintain Menu.Item, Menu.ItemGroup, Menu.Divider and Menu.SubMenu inside this document. Stable item keys identify the real route or action; groups/dividers do not become fake clickable destinations. Read the installed items/children, selected/defaultSelected and open/defaultOpen contracts before choosing a controlled binding. Let an existing AppShell own its route-derived menu rather than adding a second page menu state.

## Acceptance

Verify selected route on direct entry, parent expansion, click versus configured hover, disabled/permission-filtered items and group order. Keep navigation separate from decorative labels, inspect the actual onSelect object and check keyboard traversal and long titles. Canvas selection must not persist a temporary open submenu or rewrite business defaults.
