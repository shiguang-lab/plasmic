# Overseas user, dictionary and department fields

React UI registers the six Intl components from `@react/ui@1.0.13`. Use the
Select components for editable fields and the View components to resolve values
in tables, details and read-only fields.

| Components | Local data props | Value |
| --- | --- | --- |
| IntlUserSelect, IntlUserView | `options` with `userId`, `username`, `nickname` | User ID by default, configurable through `valueKey` |
| IntlDepartmentSelect, IntlDepartmentView | `treeData` with `value`, `label` and optional nested `children` | Department ID by default, configurable through `valueField` |
| IntlDictSelect | List `options` with `value`, `label` and searchable `title`. Tree `treeData` with `value`, `label`, `title`, `fullPath` and optional nested `children` | Dictionary item code |
| IntlDictView | `treeData` with `dictItemCode`, `dictItemName` and optional nested `children` | Item code by default, configurable through `valueField` |

## Data in Plasmic

The registered components always receive local data. When the data prop is
omitted they use shared demo users, departments and a dictionary named
`DEMO_REGION`. With a different `dictCode`, bind the relevant local data.
Explicit empty arrays produce an empty source. Source, request and request
adaptors are not Studio properties. To prototype a server-backed flow, bind
the result of the page's data source to the component's native local data prop.

Select controls support an initial value via Studio's `value` editor, mapped
to the runtime `defaultValue`. Bind their writable `value` state for controlled
usage and use `onChange` for interactions. The Select event passes the value
and option, or the value, label and extra information in tree mode. The View
components take `value` directly. Give a View the selected ID or code and data
that uses the same keys. With no value the View renders `emptyText`, and an
unmatched ID or code displays as its original value.

## Native React code generation

Import the named component from the target app's `@react/ui@1.0.13`. Carry over
the actual value, options or tree data, and selection mode. Provide the host's
request configuration when using native components with remote data. The
Plasmic demo records and dictionary code belong to the prototype.
