# Calendar

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Calendar | `plasmic-antd6-calendar` |

## Date navigation and selection

Use Calendar for a month/year date-navigation surface; DatePicker remains the compact field control. This wrapper serializes value/onChange/onSelect through dayjs and ISO strings. Bind the actual selected date and preserve the requirement's timezone/date-only meaning. Switching the visible mode or month is distinct from committing an operation.

## Acceptance

Verify initial date, navigation, selection, month/year and fullscreen behavior when used, serialization and adjacent region sizing. Custom date-cell rendering or event data requires a real registered capability; do not invent a cell Slot. Check boundary dates, empty data and save/reopen values at the requested viewport.
