# Popover

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Popover | `plasmic-antd6-popover` |

## Generation rules

### Supplemental interactive content

Use Popover for small supplemental content with its real title/content/children Slots. Use [Tooltip](tooltip.md) for a brief non-interactive explanation and [Popconfirm](popconfirm.md) for a verified confirmation workflow. Read actual trigger, placement, open/onOpenChange and enter/leave timing; hover must not execute an action.

### Editing and acceptance

The wrapper's temporary previewOpen/reveal belongs to canvas editing, not saved business open state. Explicit empty content must retain its actual native/wrapper semantics instead of showing stale fallback text. Verify entering the popup, interaction, dismissal, keyboard access, viewport bounds and returned focus where appropriate. Save/reopen to ensure transient reveal and inspection state did not enter Preview or export.
