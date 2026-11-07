# Popover

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Popover | `plasmic-antd6-popover` |

## Generation rules

### Supplemental interactive content

Use Popover for small supplemental content with its real title/content/children Slots. Use [Tooltip](tooltip.md) for a brief non-interactive explanation and [Popconfirm](popconfirm.md) for a verified confirmation workflow. Read actual trigger, placement, open/onOpenChange and enter/leave timing; hover must not execute an action.

### Editing and acceptance

Studio's temporary selection reveal belongs to canvas editing and does not change saved business open state. MCP edits public runtime props and content Slots; selecting the target reveals content through the internal editor mechanism. Explicit empty content must retain its actual native/wrapper semantics instead of showing stale fallback text. Verify entering the popup, interaction, dismissal, keyboard access, viewport bounds and returned focus where appropriate. Save/reopen to ensure transient reveal and inspection state did not enter Preview or export.
