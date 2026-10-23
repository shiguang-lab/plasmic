# DatePicker

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Date/Time Picker | `plasmic-antd5-date-picker` |
| Date Range Picker | `plasmic-antd5-date-range-picker` |

## Generation rules

### Serialized dates and display

Single DatePicker converts supported values through dayjs and emits an ISO string or null. Display format and the backend date/time contract are separate; establish date-only versus instant meaning and timezone from the requirement. Read picker, showTime, bordered, clear and the actual popup styling contract rather than adding v6 variant/classes.

### RangePicker

The range wrapper exposes startDate/endDate and their own states, plus endpoint disabling/allowEmpty flags, presets and onChange. Read those exact arguments rather than inventing a single range value binding. Single-picker defaults and callback timing do not establish the range's behavior.

## Acceptance checks

### Acceptance

Verify typing, picking, clear, both endpoints, disabled combinations, initialization and the actual serialized payload. Test relevant day/month/time boundaries and reopening another record. Existing wrapper popup behavior must be inspected in real Preview at required widths; it is not a general responsive layout guarantee.
