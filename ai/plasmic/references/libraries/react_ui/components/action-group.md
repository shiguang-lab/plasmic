# ActionGroup

Library: [React UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| ActionGroup | `plasmic-react-ui-action-group` |

## Plan decisions

Declare these native props in each planned instance before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` (or the baseline) for each; selection preflight rejects pending or missing values. `null` means deliberately unset and is accepted only where marked.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-react-ui-action-group` | `max` (baseline `3`) | Mandatory generation baseline; only a verified source override changes it. See [rule](#generation-rules). |

## Generation rules

### Design defaults

- Use for record actions in a Table's fixed right column.
- At most three visible actions, the rest folded; order by frequency (view, edit, then others), destructive actions last and behind confirmation; the column width equals the measured visible content.

### Usage and behavior

Read the registered @react/ui ActionGroup contract. Pass complete permission-filtered items and let the component fold them. **max=3 is the mandatory generation baseline**, including More as one of those three positions. Only an explicit current-user/source requirement may override it with [verifiable source evidence](../../../design/component-policy.md#protected-configuration). The number of actions, a wider viewport or the wish to show all buttons is not an exception. Do not truncate the authorized items; retain them in native folding. Rows with fewer authorized actions naturally show fewer controls. ActionGroup uses Antd6’s medium size spelling. [Column](../../antd_v6/components/table.md#operation-column-sizing) owns operation-column measurements.

Items carry only the native @react/ui fields key, label, disabled, danger and tooltip; the wrapper adds just onAction(key), because item onClick functions cannot be stored. Keep @react/ui's native More-on-click default when the task has no trigger requirement. An explicitly requested hover interaction can use `dropdownProps:{"trigger":["hover"]}`; verify the selected interaction under [Dropdown acceptance](../../antd_v6/components/dropdown.md). Preserve ordering and danger/disabled behavior after permission filtering and folding.

When the requirement calls for confirmation, compose a registered [Popconfirm](../../antd_v6/components/popconfirm.md#row-confirmation-composition) with a native `span` named `RowActionAnchor` around ActionGroup so Antd receives a DOM positioning ref. onAction records the pending key and row identity for confirmed actions and runs the others directly; Popconfirm `open` binds to that row, and only onConfirm performs the mutation. Follow [row confirmation](../../antd_v6/compositions/action-bars.md#feedback-and-row-confirmation) for business effects. Verify cancel/confirm, a folded More item, repeated use and no mutation before confirmation in real Preview.

Before handlers, follow [permission generation and acceptance](../../../design/permissions.md) and declare [actionContracts and cases](../../../design/component-policy.md#business-actions-and-transitions): every key, allowed roles/record scope, confirmation and transitions. ActionGroup renders supplied items; it does not infer authorization. The same current-context decision must filter items and guard execution/confirmation. Verify permitted non-administrator actions, rejected submissions and revoked-context confirmation outside the business UI. Enable/disable and different retry origins retain separate source-derived cases. Dynamic items remain runtime-unverified until cases execute.

Navigation is an onAction interaction step: Plasmic's page navigation action, conditioned on the item key, with the row's route param; never window.location replacement. Save/reopen and reread the delivered items, triggers and handlers.
