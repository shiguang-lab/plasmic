# Segmented

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Segmented | `plasmic-antd6-segmented` |

## Generation rules

### Design defaults

- Use for switching a view mode or granularity inside one region (list/card view, day/week); content scopes use Tabs, form values use Radio.
- Two to five short options.

### View or option selection

Use Segmented for a compact mutually exclusive set, such as a display mode. Use [Tabs](tabs.md) when each option owns a content panel with its own tab semantics. The current registration exposes options, value/defaultValue, size, block, disabled and onChange; do not add a v5 Segmented Option node or invent an editable option Slot.

## Acceptance checks

### Acceptance

Keep option values stable and distinct from labels. Verify initial selection, changing both directions, disabled items as supported, long labels and controlled/uncontrolled behavior. A view change must retain or reset business state according to its owner, not merely swap decorative content.
