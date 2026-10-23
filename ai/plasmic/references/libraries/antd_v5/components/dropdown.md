# Dropdown

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Dropdown | `plasmic-antd5-dropdown` |

## Generation rules

### Trigger and item actions

Read menuItems/menuItemsJson or the actual useMenuItemsSlot editing branch, children, trigger, placement, open and onAction. Keep item keys stable, permissions applied before presentation and actual action labels. A hover/click opening gesture does not perform the business mutation.

## Acceptance checks

### Acceptance

Verify the chosen trigger, movement into/out of the menu, disabled items, actual selection callback and dismissal. Read its v5 styling and popup contract rather than v6 classNames/tokens. Save/reopen items, actions and state, keeping keyboard access and popup bounds usable.
