# Dropdown

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Dropdown | `plasmic-antd6-dropdown` |

## Generation rules

For PC pointer interaction, ordinary Dropdown menus **must use the hover generation baseline**, including creation, language and account menus. Keep Ant Design enter/leave delays so moving from the trigger into the menu does not close it; item selection executes the action and closes the menu. Use click only for an explicit click/touch requirement and record its [source-backed override](../../../design/component-policy.md#protected-configuration); contextMenu requires an actual right-click requirement. Availability of the trigger Prop is not permission to choose click for convenience. ActionGroup's equivalent protected property is dropdownProps.trigger=["hover"].

Read the live contract: Dropdown exposes trigger="hover". [ActionGroup](../../react_ui/components/action-group.md) has its own dropdownProps mapping. Select, Cascader and date pickers remain click-operated form controls; Popconfirm remains an explicit click confirmation.

Preserve a source-defined grouped create menu as one Dropdown trigger with its ordered menu choices. Discover `children`, `menuItems`/`menuItemsJson`, `useMenuItemsSlot` and `onAction` from the installed contract; a list of possible destinations is not permission to replace the menu with sibling Buttons. Shared tabbed-list actions follow [the Tabs extra ownership rule](../../overseas/compositions/search-table.md#query-and-list-structure).

### Trigger appearance

Use a stable trigger treatment for each interaction role. For an ordinary hover/click Dropdown opened by a **text Button**, always show one trailing registered `DownOutlined` indicator. Keep it present in both open and closed states and when permission filtering leaves only one menu choice. A leading action icon, such as `PlusOutlined` for creation, does not replace this indicator. A direct-action Button without a menu has no dropdown indicator. Icon-only More triggers already communicate a menu; shared ActionGroup/AppShell controls keep their own native indicators without an additional one. An actual contextMenu/right-click entry does not require this button treatment.

The current Dropdown wraps its children; it does not append a trigger icon. For a create menu, place the registered PlusOutlined in Button.icon with iconPlacement=start, then the label and registered DownOutlined in Button.children, using native Space to arrange them. If only the trailing indicator is needed, Button.icon with iconPlacement=end is also valid. Read the actual [Button](button.md) and [icon](../../antd_icons/index.md#icon-usage-and-acceptance) contracts; use editable registered icon nodes and currentColor, not Unicode, copied SVG or a new showArrow/dropdownIcon property. Native Dropdown.arrow controls the popup's small pointing triangle, not the Button indicator; it is not a substitute and must not be added when the installed contract does not expose it.

The trigger opens choices through its configured trigger; a menu item executes the chosen business action. Use a split-button composition only when the source has a separate immediate default action plus alternative menu choices and the installed library supports that composition. Do not introduce a default creation action merely to obtain a chevron.

In the source-reviewed intent, retain Button as Dropdown.children, a leading action icon in Button.icon, and the trailing indicator after the text. Verify exactly one indicator in the saved model and visible pixels, correct placement/currentColor, and no duplicate indicator after open/close or save/reopen. Static node checks do not establish CSS visibility or runtime behavior.

`menuItemsJson` uses the native Menu item `key`, including nested children, and `onAction(key)` returns that key. `value` is not an item identity. Set distinct stable keys for business branches, e.g. `[{"key":"create","label":"新建"}]`; do not compare callbacks against labels or infer an omitted key. Read the live recursive item schema. Slot mode uses registered MenuItem keys. Verify each callback branch separately, including disabled items; opening the menu does not prove routing. Internal destinations follow [source and interaction rules](../../../requirement-alignment.md#source-and-interaction-rules).

Imported library definitions can retain older persisted defaults. Public `default` reports that stored definition; `registration.defaultValue` reports the current literal registered insertion default when it differs from the stored value. New HTML instances materialize changed current registered defaults without rewriting imported definitions or existing instances; explicit props win. Build the actual source menu with explicit keys rather than retaining any sample actions. Inspect the saved instance and each runtime branch; a newer registration does not repair an old instance containing `value`.

For Dropdown changes, test the configured trigger: hover menus open without clicking and stay open while moving into the menu; explicit click/contextMenu interactions use their corresponding trigger. Check dismissal, item selection and disabled items. Confirm hovering never performs the business action, and opening More does not open a confirmation. Test affected Dropdown, ActionGroup or header menus; capture the visible menu and confirm its state after selection or dismissal. Recheck delivered props after save/reopen against the reviewed trigger.
