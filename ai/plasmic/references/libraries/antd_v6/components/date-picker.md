# DatePicker

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| DatePicker | `plasmic-antd6-date-picker` |
| DatePicker.RangePicker | `plasmic-antd6-date-range-picker` |

**Hard constraints** (always delivered with any section):

- Date-range quick choices such as recent-day ranges belong in RangePicker's native `presets` popup. Do not add sibling Segmented, Radio or button choices for the same range. Presets and manual selection must update the same start/end values and use the same query/reset path.

## Generation rules

### Design defaults

- Use DatePicker for a calendar date, with time selection only for a dated instant; RangePicker for a period, including query ranges.
- Set `width:100%` in a Form column. Display format `YYYY-MM-DD`, or `YYYY-MM-DD HH:mm:ss` with time.
- Put requirement-defined quick ranges inside the date popup with native `presets`; keep the filter row to its date control and label.

### Usage and behavior

Allow typing by default; read-only is explicit. Do not inject global date-picker CSS from each component instance. Range values, endpoint flags and range-specific inheritance belong to [RangePicker](#rangepicker).

### RangePicker

Date ranges honor default dates when uncontrolled, respect controlled values.

Date Range Picker inherits disabled from ConfigProvider when omitted, honors explicit disabled=false, and applies single-side flags only without a whole-control override. Whole-range allowEmpty=false must not enable an endpoint through leftover split flags. For wrapper changes, exercise omitted defaults, controlled/uncontrolled ranges, typing, provider inheritance and endpoint overrides.

### Quick-range presets

Read the installed RangePicker contract before configuring quick ranges. Its `presets` entries use `{label, startDate, endDate}`; do not substitute the upstream raw `value` shape or invent unsupported callbacks. Derive labels, date boundaries, timezone and the reference date from the requirement. Relative production ranges must follow the current business date; fixed prototype fixtures must use their recorded reference date consistently with the defaults and dataset.

The preset is a way to fill the native range, not a second filter. Presets and manual selection share the same range owner, including when the picker is inside SearchForm. Do not create a separate quick-range state or duplicate range control. In SearchForm, selecting a preset changes the draft; Query applies it unless the requirement explicitly requests immediate querying. Reset restores both picker endpoints and the applied default range. Use the requirement's native clear semantics for an unrestricted range; do not fabricate extreme dates as an "All" preset.

If the actual contract lacks native presets or the required range binding, report the exact capability gap under [component engineering](../../../engineering/component-contracts.md); do not replace the native interaction with an external choice group.

### Serialization and acceptance

DatePicker converts supported values through dayjs and emits ISO strings, an array of ISO strings in multiple mode, or null on clear. Read RangePicker's startDate/endDate bindings and registered onChange arguments independently; do not assume it has the same single value-state shape. Display date/time and serialized business values are different boundaries. Determine date-only versus instant semantics, timezone and payload format from the requirement instead of formatting the displayed label into the request.

Use only exposed picker, showTime, allowClear and format/boundary capabilities. In this maintained DatePicker registration, some native formatting/disabled-date APIs are not exposed as normal controls; a desired constraint must be validated through actual supported bindings or reported as a capability gap.

## Acceptance checks

### Values and serialization

Verify initial/cleared values, typing, selection, multiple/range modes, both endpoints, disabled inheritance and day/month/year boundary cases as applicable. Follow [serialization and acceptance](#serialization-and-acceptance) for the declared date-only or instant payload and timezone. Keep temporary previewOpen separate from saved open state and check Form validation and reopening another record.

### Presets and range ownership

Open the native date popup and exercise every required preset. Verify both endpoint values, manual selection, clearing and reset against the same range owner; confirm there is no external quick-choice group or independent range state. For SearchForm, check results stay unchanged before Query, then inspect actual result dates after Query. Verify reset restores the displayed and applied default range, including when the field is collapsed. Check date-only serialization across the relevant timezone boundary; an ISO timestamp sliced at UTC must not move a local calendar date. Save/reopen and repeat a preset and reset; static `presets` metadata alone does not prove the interaction works.
