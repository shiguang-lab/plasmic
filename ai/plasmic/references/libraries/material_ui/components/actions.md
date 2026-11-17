# Actions

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Button | `plasmic-material-ui-button` |
| ButtonGroup | `plasmic-material-ui-button-group` |
| IconButton | `plasmic-material-ui-icon-button` |
| Fab | `plasmic-material-ui-fab` |
| ToggleButton | `plasmic-material-ui-toggle-button` |
| ToggleButtonGroup | `plasmic-material-ui-toggle-button-group` |

## Generation rules

Use Button for an action and IconButton for an icon action with an accessible name. Choose variant, color and size from the live registration and project theme; there is no mandatory primary-action count or PC size baseline here. ButtonGroup groups actions; ToggleButtonGroup represents a selected value, not a replacement for Tabs.

ToggleButtonGroup's onChange receives (event, value); exclusive selection can clear to null. Bind the actual value type and decide whether clearing is allowed from the requirement. Supply navigation destinations or submit behavior through the registered Button contract and actual owning form.

## Acceptance checks

Verify the effect or destination, disabled/loading behavior where supported, and toggle selection/clearing. Icon-only controls need an accessible name; a submit action must invoke the real form behavior.
