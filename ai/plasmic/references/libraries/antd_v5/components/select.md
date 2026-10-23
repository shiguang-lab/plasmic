# Select

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Option | `plasmic-antd5-option` |
| Option Group | `plasmic-antd5-option-group` |
| Select | `plasmic-antd5-select` |

## Generation rules

### Options and selected values

This registration chooses native options or editable Select.Option/OptGroup children through useChildren. Keep stable business values separate from labels. Read value/defaultValue, single/multiple/tags mode, showSearch, bordered and the actual onChange arguments/state helper. Do not substitute a v6 variant or filtering control absent from this registration.

### Search and acceptance

Remote search and loading use only the actual target's exposed capability; this wrapper's normal controls do not provide every native Select prop. Preserve selected labels while options change, and report a missing required search contract rather than inventing it. Verify initial/reloaded/empty options, disabled choices, clear, multiple/tags values, keyboard navigation and Form ownership. Check complete labels and saved bindings.
