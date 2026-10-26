# Drawer

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Drawer | `plasmic-antd6-drawer` |

## Generation rules

### Design defaults

- Use for viewing or editing one record while keeping the list context.
- Opens from the right. Choose native `size` by the content under [scale](../../../design/scale.md): 480 short help or a compact confirm, 640 record detail, Form or Table, 720 code or long values.
- Title names the record or operation. Footer actions are right-aligned with an 8px gap (Space size 8), cancel first; the body scrolls and the footer stays visible. Detail content uses a two-column Descriptions.

### Usage and behavior

Use the native title, children, footer and closeIcon Slots. Read the installed Drawer contract before setting open or handling onOpenChange(open); temporary editing reveals must not persist an open initial state.

Ant Design v6 `size` accepts `"default"`, `"large"`, a pixel number or a CSS length string. It controls width for a left/right Drawer and height for a top/bottom Drawer. Use this native prop in the plan and model; the pixel values above are content-based design choices, not the only accepted API values. [Overlay composition](../compositions/modal-drawer.md#overlay-width) owns sizing evidence and form inventories.

Choose the footer from the [Modal + Drawer composition](../compositions/modal-drawer.md). Remove an unused footer through the actual Drawer Slot contract, preserving a usable exit, bounded body and reachable business actions. Verify close/reopen, cleanup, keyboard focus and return to the trigger in Preview, then save/reopen and reread.
