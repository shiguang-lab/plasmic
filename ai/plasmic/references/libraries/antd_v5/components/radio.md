# Radio

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Radio | `plasmic-antd5-radio` |
| Radio Button | `plasmic-antd5-radio-button` |
| Radio Group | `plasmic-antd5-radio-group` |

## Radio, Radio.Button and Radio.Group

Radio.Group owns one stable option value. This wrapper supports options or children via useChildren and optionType; individual Radio/Button nodes carry labels and their real values. Read the native group onChange(event) extraction rather than treating its event as a bare value. Do not simulate a group with independent checkbox booleans.

## Acceptance

Verify absent and explicit initial selection, switching, disabled choices, options/children modes and Form validation. Preserve zero/false option values, readable long labels and keyboard traversal, then save/reopen the actual group state.
