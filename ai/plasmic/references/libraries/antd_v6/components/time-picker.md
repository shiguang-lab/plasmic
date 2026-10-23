# TimePicker

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Time Picker | `plasmic-antd6-time-picker` |
| TimePicker.RangePicker | `plasmic-antd6-time-range-picker` |

## Generation rules

### Time values

Use this control for time-of-day fields, including daily cutoffs; use its RangePicker for a clock-time range. Follow [field semantics](../selection.md#field-semantics) for dates, dated instants and durations. A draft showing only a time in a bordered box does not justify replacing the picker with Input.

The maintained wrapper parses value with dayjs and emits an ISO string, or null on clear. Read the installed contract before binding; do not pass a bare `HH:mm:ss` value to that parser or assume `format="HH:mm:ss"` changes the event payload. Display format, component value and business payload are separate contracts.

For a daily wall-clock field, preserve the business `HH:mm:ss` and its stated timezone/local-time semantics. Initialize the picker with a supported dated value through an explicit conversion, then convert the selected value back to the business clock time under the same policy. Any date used only to satisfy the picker must not enter the persisted daily-time field. Do not extract the time from a UTC ISO string unless UTC is the required business policy; do not default to the viewer's device timezone for a market-specific cutoff. Keep Form/Item as the native value owner and perform boundary conversion through verified bindings, without a competing control value. If the timezone policy is unspecified and affects the outcome, resolve it from the source or report it as unresolved.

### TimePicker.RangePicker

Maintain a range as the actual pair of values; do not borrow DatePicker endpoint props. Range and single-picker variants share this document but have separate registrations. Inside Form, retain native ownership and validate the required ordering/duration only when the business rule requires it.

## Acceptance checks

### Acceptance

Verify initialization, opening the actual picker and selecting a changed hour/minute/second, typing/picking, clearing, format, 12-hour mode when used, disabled state and the serialized payload. For a daily cutoff, test the source sample and midnight: the displayed and saved business time must agree under the required policy, without an unintended date or UTC shift. Test invalid input blocking, required/optional clearing, reset and reopening another record. Test both range endpoints and midnight-crossing rules when applicable; do not invent an end-after-start restriction for an overnight range. A static screenshot of `18:00:00`, a working text input or a passing Form ownership check does not prove picker acceptance.
