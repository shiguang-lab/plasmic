# ActionGroup

Library: [React UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| ActionGroup | `plasmic-react-ui-action-group` |

Read the registered @react/ui ActionGroup contract. Pass complete permission-filtered items and let the component fold them. Set max=3 consistently unless the user specifies another limit; when folding occurs, More consumes one of those three positions. Rows with fewer authorized actions naturally show fewer controls. ActionGroup uses Antd6’s medium size spelling. [Column](../../antd_v6/components/table.md#operation-column-sizing) owns operation-column measurements.

PC More menus use dropdownProps.trigger=["hover"] and follow [Dropdown interaction and acceptance](../../antd_v6/components/dropdown.md). Preserve ordering and danger/disabled behavior after permission filtering and folding.

Row items can declare confirm with title/description/okText/cancelText; onAction fires only after confirmation. Follow [row confirmation](../../antd_v6/compositions/action-bars.md#feedback-and-row-confirmation) for Popconfirm anchoring and business effects. Verify cancel/confirm, repeated use and no mutation before confirmation in real Preview.

Navigation uses item href so the registered Plasmic Link performs routing; onAction is for local actions, not window.location replacement. Save/reopen and reread the delivered items, triggers and handlers.
