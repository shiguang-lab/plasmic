# Overseas user, dictionary and department fields

Library: [React UI](../index.md).

| Component | Registration |
| --- | --- |
| IntlUserSelect | `plasmic-react-ui-intl-user-select` |
| IntlUserView | `plasmic-react-ui-intl-user-view` |
| IntlDictSelect | `plasmic-react-ui-intl-dict-select` |
| IntlDictView | `plasmic-react-ui-intl-dict-view` |
| IntlDepartmentSelect | `plasmic-react-ui-intl-department-select` |
| IntlDepartmentView | `plasmic-react-ui-intl-department-view` |

## Generation rules

React UI registers the six Intl components from `@react/ui@1.0.13`. Use the
Select components for editable fields and the View components to resolve values
in tables, details and read-only fields.

### Selection by field purpose

Prefer these React UI registrations for overseas business fields when the
project can use React UI. Classify the field by its meaning and stored value,
including when the source describes only a Chinese label.

| Business role | Filter or editable field | Table cell or detail value | Stored value by default |
| --- | --- | --- | --- |
| 负责人、经办人、审核人 | IntlUserSelect | IntlUserView | User ID |
| 所属部门、负责部门、归属组织 | IntlDepartmentSelect | IntlDepartmentView | Department ID |
| 字典项、字典编码、由字典维护的分类或状态 | IntlDictSelect | IntlDictView | Dictionary item code |

A fixed enum, permission role, free-text name, or organization category does
not imply a user, department, or dictionary lookup. Use the field's actual
data contract and the target project's compatible libraries. Reuse an existing
business component when it already implements that contract. Keep dictionary
codes and option data consistent across editing and display. In admin
compositions, retain SearchForm for filters, Form.Item for submitted fields,
Table.Column for rows and Descriptions.Item for detail values.

Follow the [overseas field composition](../compositions/overseas-business-fields.md)
for a complete submit and display example.

| Components | Local data props | Value |
| --- | --- | --- |
| IntlUserSelect, IntlUserView | `options` with `userId`, `username`, `nickname` | User ID by default, configurable through `valueKey` |
| IntlDepartmentSelect, IntlDepartmentView | `treeData` with `value`, `label` and optional nested `children` | Department ID by default, configurable through `valueField` |
| IntlDictSelect | List `options` with `value`, `label` and searchable `title`. Tree `treeData` with `value`, `label`, `title`, `fullPath` and optional nested `children` | Dictionary item code |
| IntlDictView | `treeData` with `dictItemCode`, `dictItemName` and optional nested `children` | Item code by default, configurable through `valueField` |

### Data in Plasmic

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

### Native React code generation

Import the named component from the target app's `@react/ui@1.0.13`. Carry over
the actual value, options or tree data, and selection mode. Provide the host's
request configuration when using native components with remote data. The
Plasmic demo records and dictionary code belong to the prototype.
