# TimePicker

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Time Picker | `plasmic-antd6-time-picker` |
| TimePicker.RangePicker | `plasmic-antd6-time-range-picker` |

## Time values

This wrapper converts supported serialized values through dayjs and returns serialized times through its registered onChange callback. Read the exact value/clear contract before binding. A display format is not a backend format or timezone policy. Determine whether the requirement means a local wall-clock time or an instant, and use its explicit conversion at the business boundary.

## TimePicker.RangePicker

Maintain a range as the actual pair of values; do not borrow DatePicker endpoint props. Range and single-picker variants share this document but have separate registrations. Inside Form, retain native ownership and validate the required ordering/duration only when the business rule requires it.

## Acceptance

Verify initialization, typing/picking, clearing, format, 12-hour mode when used, disabled state and the serialized payload. Test both range endpoints, midnight boundaries and reopening another record under the requirement's timezone policy.
