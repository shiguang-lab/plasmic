# FloatButton

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| FloatButton.BackTop | `plasmic-antd6-back-top` |
| Float Button | `plasmic-antd6-float-button` |
| FloatButton.Group | `plasmic-antd6-float-button-group` |

## Generation rules

### Persistent auxiliary actions

Use FloatButton for an explicitly required auxiliary action; primary business actions belong to their normal page/region toolbar. Read icon, content, tooltip, type, shape and onClick. Keep an accessible action name and placement that does not obscure form errors, pagination or the last row.

### FloatButton.Group and BackTop

Group owns its actual FloatButton/BackTop children, trigger, controlled open and onOpenChange. BackTop uses visibilityHeight/duration/icon, but its actual scrolling target must work with the page's scroll owner. Do not invent a registered target prop or claim a document-scrolling BackTop controls a separately bounded AppShell body without verifying it.

## Acceptance checks

### Acceptance

Check opening/closing the group, each authorized action, real BackTop behavior and viewport bounds at the required widths. Hover does not perform the action. Save/reopen and verify no demo content or transient editing state remains.
