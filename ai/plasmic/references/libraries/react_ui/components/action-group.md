# ActionGroup

Library: [React UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| ActionGroup | `plasmic-react-ui-action-group` |

Read the registered @react/ui ActionGroup contract. Pass complete permission-filtered items and let the component fold them. Set max=3 consistently unless the user specifies another limit; when folding occurs, More consumes one of those three positions. Rows with fewer authorized actions naturally show fewer controls. ActionGroup uses Antd6’s medium size spelling. [Column](../../antd_v6/components/table.md#operation-column-sizing) owns operation-column measurements.

PC More menus default to dropdownProps.trigger=["hover"]; explicit click/touch requirements and trigger-specific acceptance follow [Dropdown](../../antd_v6/components/dropdown.md). Preserve ordering and danger/disabled behavior after permission filtering and folding.

When the requirement calls for confirmation, row items declare confirm with title/description/okText/cancelText; for those items, onAction fires only after confirmation. Follow [row confirmation](../../antd_v6/compositions/action-bars.md#feedback-and-row-confirmation) for Popconfirm anchoring and business effects. Verify cancel/confirm, repeated use and no mutation before confirmation for these actions in real Preview.

Navigation uses item href so the registered Plasmic Link performs routing; onAction is for local actions, not window.location replacement. Save/reopen and reread the delivered items, triggers and handlers.
