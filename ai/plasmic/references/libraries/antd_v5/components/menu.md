# Menu

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Menu | `plasmic-antd5-menu` |
| Menu Divider | `plasmic-antd5-menu-divider` |
| Menu Item | `plasmic-antd5-menu-item` |
| Item Group | `plasmic-antd5-menu-item-group` |
| Sub Menu | `plasmic-antd5-submenu` |

## Children and selection

Menu.Item, ItemGroup, Divider and SubMenu stay in this document. Keep stable keys and meaningful titles; read mode, multiple, triggerSubMenuAction, defaultSelectedKeys and the actual onSelect(info) event. A group/divider is not a fake route. This wrapper exposes children rather than a general v6 items-based control surface.

## Acceptance

Verify direct-entry selection, nested expansion, disabled/permission-filtered items and actual action/route bindings. Read the runtime event/state helper together with registration metadata before binding selected keys. Test hover/click policy, keyboard navigation and long titles without persisting canvas-inspection state.
