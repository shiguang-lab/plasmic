# Tabs

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tab Item | `plasmic-antd5-tab-item` |
| Tabs | `plasmic-antd5-tabs` |

## Generation rules

### Panel ownership

Read activeKey, items, tabPosition, size, destroyInactiveTabPane, sticky controls and ordered events from this v5 wrapper. Editable Tab Item nodes are the children of its actual items Slot. Stable keys identify real panels; each owns its content, not decorative sibling labels above a shared unbound region.

## Acceptance checks

### Acceptance

Verify initial selection, both switch directions, disabled panels, actual event arguments and the lifecycle of inactive panel state. Test fields/queries in hidden panels and required preservation/reset behavior. Do not persist an editor reveal as the initial active key; save/reopen model bindings and inspect every affected panel.
