# Select

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Select.Option | `plasmic-antd6-option` |
| Select.OptGroup | `plasmic-antd6-option-group` |
| Select | `plasmic-antd6-select` |

## Generation rules

### Design defaults

- Use for choosing from more than five options or from dynamic options; two to five short, always-visible options in a Form use Radio; switching a view uses Segmented or Tabs.
- Fills its column. `mode: "multiple"` for multi-choice; `showSearch:{"optionFilterProp":"label"}` above ten options; `allowClear` in query fields and optional form fields.
- Placeholder `请选择` + the field noun. Options keep the source labels and order.

### Usage and behavior

Search uses the native `showSearch` boolean or configuration object. Ant Design filters by option value by default; set `showSearch:{"optionFilterProp":"label"}` when searching displayed labels that differ from values. For editable Option children, select the actual searchable `children` field through the same native configuration. Server-side `showSearch.filterOption:false` and `suffixIcon:null` are honored; labels may be React nodes or numbers. Single/multiple/tags values may be scalars, arrays or labeled objects. Registered state and event types must represent these modes; tags supports multiple initial values.

Check the default down arrow on the editor canvas as well as in Preview, and verify a custom icon and explicit suffixIcon=null separately. Follow [shared Slot/default verification](../../../engineering/component-contracts.md#slots-and-editor-state) for omitted versus null values.

### Options and remote search

Choose native options or the registered editable children path through useChildren; do not duplicate options in both. Select.Option and Select.OptGroup remain in this document. Values are stable business identities, group labels are presentation, and the selected value is not the display label unless the real contract says so.

The Antd6 Select registers `placeholder` as a Slot; supply custom content through `<slot name="placeholder">...</slot>`, not data-props. Antd6 Input registers the same name as a text prop; do not copy that binding syntax to Select. See the [typed markup examples](../../../desktop-examples.md#component-instances). An initial selected “all” option is a value, not a placeholder, and needs no placeholder override.

Studio registers the native `showSearch` configuration object, including `optionFilterProp` and `filterOption`; a remote-search callback belongs in its native `onSearch` binding. Verify the supported expression/callback path and loading prop in the live contract before using remote search; a callback is not a JSON string or an invented property control. The owning query handles stale responses and preserves a selected value's label while its options load. Server filtering does not require filtering the same results again locally. Do not replace a selected value merely because a temporary search result omits it.

## Acceptance checks

### Acceptance

Verify initial/reloaded labels, empty options, disabled choices, clearing, single/multiple/tags and labelInValue when supported. Test distinct value types, multiple initial tags and Form ownership without competing value bindings. Exercise typing, keyboard selection, reopening and long labels at the required width; inspect actual callback arguments and saved option/selection bindings.
