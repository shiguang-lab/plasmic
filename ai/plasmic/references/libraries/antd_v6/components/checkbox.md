# Checkbox

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Checkbox | `plasmic-antd6-checkbox` |
| Checkbox.Group | `plasmic-antd6-checkbox-group` |

In a business Form or SearchForm, use the registered checked value-prop contract rather than a competing control binding. Read [Form](form.md) or [SearchForm.Item](../../overseas/components/search-form.md#searchformitem). Group array state follows [Checkbox.Group](#checkboxgroup).

## Checkbox.Group

Checkbox Group state is an array. Registered state and events must preserve its native value type. Verify controlled/uncontrolled selections and clearing against the installed contract.

## Choice and acceptance

A standalone Checkbox expresses a boolean; a Group expresses a set of stable option values. Native onChange event extraction for the standalone control and Group's array callback are distinct contracts. An indeterminate visual state describes partial selection and does not replace the actual checked value or selected set.

Verify labels, initial unchecked/checked, disabled items/group, empty and partial/full selection when required, clearing and Form payloads. A select-all action defines its actual scope and permission-filtered options; do not imply all server records were selected by checking currently rendered children. Check keyboard activation and saved bindings.
