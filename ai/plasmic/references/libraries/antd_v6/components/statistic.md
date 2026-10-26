# Statistic

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Statistic | `plasmic-antd6-statistic` |
| Statistic.Timer | `plasmic-antd6-statistic-timer` |

## Generation rules

### Design defaults

- Use for an emphasized number: a total, count or rate that the user reads first.
- The label goes in the title Slot (14px secondary), the unit in the suffix; value styling per [metrics](../compositions/summary-metrics.md#overview-metrics-and-information-cards).
- Placement: four metric Cards per row in an overview, or beside or directly above the data it counts.

### Usage and behavior

Use the registered Statistic for emphasized numeric business values. Read its actual Props/Slots and apply typography through supported content styling; never invent a prop to force font size or replace required numeric content with decorative text.

[Metric composition](../compositions/summary-metrics.md#overview-metrics-and-information-cards) owns project typography defaults, label/value/unit roles, comparison placement and longest-content acceptance. Preserve complete values and legitimate zero.

### Statistic.Timer and acceptance

Timer uses its own type=countdown/countup, value, format and onFinish contract. The registered value is a Unix timestamp in milliseconds, not a duration or seconds. Displayed time does not prove an external operation completed; onFinish triggers only the consuming workflow's verified action. Do not recreate Timer as a constantly changing text expression or assume Statistic has Timer's value semantics.

Verify metric value/precision/prefix/suffix/loading with zero, long and missing values; verify Timer initialization, boundary/finish, reopening and the required callback policy. Keep title/unit/action ownership and complete readable values under the metric composition, then save/reopen actual bindings.
