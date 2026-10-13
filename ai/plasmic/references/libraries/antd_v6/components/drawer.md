# Drawer

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Drawer | `plasmic-antd6-drawer` |

Use the native title, children, footer and closeIcon Slots. Read the installed Drawer contract before setting open or handling onOpenChange(open); temporary editing reveals must not persist an open initial state.

Choose the footer from the [Modal + Drawer composition](../compositions/modal-drawer.md). Remove an unused footer through the actual Drawer Slot contract, preserving a usable exit, bounded body and reachable business actions. Verify close/reopen, cleanup, keyboard focus and return to the trigger in Preview, then save/reopen and reread.
