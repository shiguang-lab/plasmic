# Dropdown

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Dropdown | `plasmic-antd6-dropdown` |

For PC pointer interaction, ordinary Dropdown menus use hover, including creation, language and account menus. Keep Ant Design enter/leave delays so moving from the trigger into the menu does not close it; item selection executes the action and closes the menu. Use click for touch requirements or an explicitly click-operated interaction; contextMenu is reserved for an actual right-click requirement. Remove obsolete click overrides when applying the PC convention.

Read the live contract: Dropdown exposes trigger="hover". [ActionGroup](../../react_ui/components/action-group.md) has its own dropdownProps mapping. Select, Cascader and date pickers remain click-operated form controls; Popconfirm remains an explicit click confirmation.

For Dropdown changes, verify opening without clicking, moving into the menu, leaving both trigger and menu, item selection and disabled items. Confirm hovering never performs the business action, and opening More does not open a confirmation. Test the actual registered Dropdown, ActionGroup and header menus; capture the visible menu and confirm its state after selection or leaving. Recheck the delivered props after save/reopen, including explicit click overrides.
