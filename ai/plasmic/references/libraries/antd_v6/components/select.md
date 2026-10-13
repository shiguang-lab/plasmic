# Select

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Select.Option | `plasmic-antd6-option` |
| Select.OptGroup | `plasmic-antd6-option-group` |
| Select | `plasmic-antd6-select` |

Select honors custom filtering, server-side filterOption=false and suffixIcon=null; labels may be React nodes or numbers. Single/multiple/tags values may be scalars, arrays or labeled objects. Registered state and event types must represent these modes; tags supports multiple initial values.

Check the default down arrow on the editor canvas as well as in Preview, and verify a custom icon and explicit suffixIcon=null separately. Follow [shared Slot/default verification](../../../engineering/component-contracts.md#slots-and-editor-state) for omitted versus null values.

## Options and remote search

Choose native options or the registered editable children path through useChildren; do not duplicate options in both. Select.Option and Select.OptGroup remain in this document. Values are stable business identities, group labels are presentation, and the selected value is not the display label unless the real contract says so.

The maintained Studio metadata does not expose onSearch/filterOption/loading as normal controls, although the runtime wrapper forwards native Select props. Verify the actual supported advanced/native binding path before using remote search; do not invent a property control. The owning query handles stale responses and preserves a selected value's label while its options load. Server filtering does not require filtering the same results again locally. Do not replace a selected value merely because a temporary search result omits it.

## Acceptance

Verify initial/reloaded labels, empty options, disabled choices, clearing, single/multiple/tags and labelInValue when supported. Test distinct value types, multiple initial tags and Form ownership without competing value bindings. Exercise typing, keyboard selection, reopening and long labels at the required width; inspect actual callback arguments and saved option/selection bindings.
