# ColorPicker

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Color Picker | `plasmic-antd6-color-picker` |

ColorPicker updates its value on change while preserving the separate completion callback. For wrapper changes, verify value updates and completion callback timing separately against the installed Ant Design version.

## Value and acceptance

Read the wrapper's serialized color/state/event shape and supported format, disabled, allowClear, trigger and displayed-text controls. A native Color object and the business's stored color string are different contracts; do not infer the payload from the visible label. Use a color field only when users actually configure color, rather than replacing theme-owned semantic status colors.

Test initial/changing/cleared values, the required formats, continuous versus completion callbacks, disabled state and Form ownership. Verify the actual stored representation, popup bounds, any custom trigger and complete text after save/reopen.
