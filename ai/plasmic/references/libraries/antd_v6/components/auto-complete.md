# AutoComplete

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Auto Complete | `plasmic-antd6-auto-complete` |

## Generation rules

### Free text and suggestions

Use AutoComplete when free text remains valid and suggestions assist entry; use [Select](select.md) when the value must be one of the allowed choices. This registration exposes string value, options, onChange(value) and onSearch(value). Keep suggestion values stable and use the actual option format. A displayed suggestion is not proof that the user selected it.

### Search and acceptance

For remote suggestions, the owning query manages requests and stale results; do not invent loading/filter props absent from the live registration. Preserve entered text while options change. Test typing without selecting, selecting a suggestion, clearing, no suggestions, disabled state, keyboard acceptance and Form validation. Only an explicit committed action submits the business query.
