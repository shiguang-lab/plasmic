# DatePicker

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| DatePicker | `plasmic-antd6-date-picker` |
| DatePicker.RangePicker | `plasmic-antd6-date-range-picker` |

Allow typing by default; read-only is explicit. Do not inject global date-picker CSS from each component instance. Range values, endpoint flags and range-specific inheritance belong to [RangePicker](#rangepicker).

## RangePicker

Date ranges honor default dates when uncontrolled, respect controlled values.

Date Range Picker inherits disabled from ConfigProvider when omitted, honors explicit disabled=false, and applies single-side flags only without a whole-control override. Whole-range allowEmpty=false must not enable an endpoint through leftover split flags. For wrapper changes, exercise omitted defaults, controlled/uncontrolled ranges, typing, provider inheritance and endpoint overrides.

## Serialization and acceptance

DatePicker converts supported values through dayjs and emits ISO strings, an array of ISO strings in multiple mode, or null on clear. Read RangePicker's startDate/endDate bindings and registered onChange arguments independently; do not assume it has the same single value-state shape. Display date/time and serialized business values are different boundaries. Determine date-only versus instant semantics, timezone and payload format from the requirement instead of formatting the displayed label into the request.

Use only exposed picker, showTime, allowClear and format/boundary capabilities. In this maintained DatePicker registration, some native formatting/disabled-date APIs are not exposed as normal controls; a desired constraint must be validated through actual supported bindings or reported as a capability gap. Verify initial/cleared values, typing, selection, multiple/range modes, both endpoints, disabled inheritance and day/month/year boundary cases as applicable. Keep temporary previewOpen separate from saved open state and check Form validation and reopening another record.
