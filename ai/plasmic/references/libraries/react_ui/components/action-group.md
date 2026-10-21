# ActionGroup

Library: [React UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| ActionGroup | `plasmic-react-ui-action-group` |

Read the registered @react/ui ActionGroup contract. Pass complete permission-filtered items and let the component fold them. **max=3 is the mandatory generation baseline**, including More as one of those three positions. Only an explicit current-user/source requirement may override it with [verifiable source evidence](../../../design/component-policy.md#protected-configuration). The number of actions, a wider viewport or the wish to show all buttons is not an exception. Do not truncate the authorized items; retain them in native folding. Rows with fewer authorized actions naturally show fewer controls. ActionGroup uses Antd6’s medium size spelling. [Column](../../antd_v6/components/table.md#operation-column-sizing) owns operation-column measurements.

PC More menus default to dropdownProps.trigger=["hover"]; explicit click/touch requirements and trigger-specific acceptance follow [Dropdown](../../antd_v6/components/dropdown.md). Preserve ordering and danger/disabled behavior after permission filtering and folding.

When the requirement calls for confirmation, row items declare confirm with title/description/okText/cancelText; for those items, onAction fires only after confirmation. Follow [row confirmation](../../antd_v6/compositions/action-bars.md#feedback-and-row-confirmation) for Popconfirm anchoring and business effects. Verify cancel/confirm, repeated use and no mutation before confirmation for these actions in real Preview.

Before handlers, follow [permission generation and acceptance](../../../design/permissions.md) and declare [actionContracts and cases](../../../design/component-policy.md#business-actions-and-transitions): every key, allowed roles/record scope, confirmation and transitions. ActionGroup renders supplied items; it does not infer authorization. The same current-context decision must filter items and guard execution/confirmation. Verify permitted non-administrator actions, rejected submissions and revoked-context confirmation outside the business UI. Enable/disable and different retry origins retain separate source-derived cases. Dynamic items remain runtime-unverified until cases execute.

Navigation uses item href so the registered Plasmic Link performs routing; onAction is for local actions, not window.location replacement. Save/reopen and reread the delivered items, triggers and handlers.
