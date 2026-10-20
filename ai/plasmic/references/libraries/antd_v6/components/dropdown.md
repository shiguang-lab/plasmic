# Dropdown

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Dropdown | `plasmic-antd6-dropdown` |

For PC pointer interaction, ordinary Dropdown menus use hover, including creation, language and account menus. Keep Ant Design enter/leave delays so moving from the trigger into the menu does not close it; item selection executes the action and closes the menu. Use click for touch requirements or an explicitly click-operated interaction; contextMenu is reserved for an actual right-click requirement. Remove obsolete click overrides when applying the PC convention.

Read the live contract: Dropdown exposes trigger="hover". [ActionGroup](../../react_ui/components/action-group.md) has its own dropdownProps mapping. Select, Cascader and date pickers remain click-operated form controls; Popconfirm remains an explicit click confirmation.

Preserve a source-defined grouped create menu as one Dropdown trigger with its ordered menu choices. Discover `children`, `menuItems`/`menuItemsJson`, `useMenuItemsSlot` and `onAction` from the installed contract; a list of possible destinations is not permission to replace the menu with sibling Buttons. Shared tabbed-list actions follow [the Tabs extra ownership rule](../../overseas/compositions/search-table.md#query-and-list-structure).

For Dropdown changes, test the configured trigger: hover menus open without clicking and stay open while moving into the menu; explicit click/contextMenu interactions use their corresponding trigger. Check dismissal, item selection and disabled items. Confirm hovering never performs the business action, and opening More does not open a confirmation. Test affected Dropdown, ActionGroup or header menus; capture the visible menu and confirm its state after selection or dismissal. Recheck delivered props after save/reopen against the reviewed trigger.
