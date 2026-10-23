# Button

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Button | `plasmic-antd5-button` |

## Generation rules

### Action and navigation

Read type, size, shape, ghost, danger, loading, disabled, icon, onClick and href/target from this v5 registration. Form submission uses its submitsForm contract rather than an assumed v6 property model. One primary action belongs to the actual action group; danger reflects the required consequence, not every publish/save label.

## Acceptance checks

### Acceptance

Verify the actual effect or route, permission/disabled/loading behavior, keyboard activation and complete labels. A submit button follows the owning Form's validated event and duplicate-submit policy. Icon-only buttons need a real accessible name. Save/reopen Props/Slots and callbacks.
