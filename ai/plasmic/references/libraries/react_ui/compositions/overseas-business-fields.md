# Overseas business fields

Use this composition when a form saves an overseas user, a department and a
dictionary item and the record is shown in a list and details. It fits a
[BasicFormPage, SearchTableSection and DetailSection](../../../admin-templates.md#select-by-scenario)
or a short form and detail Drawer in an existing AppShell. Read the live
Ant Design 6 and React UI contracts before wiring the destination.

## Generation rules

| Business field | Form.Item name | Control | Table.Column and Descriptions.Item |
| --- | --- | --- | --- |
| 负责人 | `ownerId` | IntlUserSelect | IntlUserView with the saved `ownerId` |
| 所属部门 | `departmentId` | IntlDepartmentSelect | IntlDepartmentView with the saved `departmentId` |
| 业务地区 | `regionCode` | IntlDictSelect with `dictCode` | IntlDictView with the saved `regionCode` and the same `dictCode` |

Leave the Select's value owned by Form.Item. Bind Form.onFinish to the save
action and use its submitted fields as the record. Keep the option labels out
of that payload. Use the Table Column render scope to read the current row.
When the user selects a record, bind the details to that same saved record.
Place the View instances in the Column render and Descriptions.Item content
Slots. Use shared lookup data or the same demo source across both surfaces.

## Acceptance checks

1. With the demo sources, choose 林晓, 运营组 and 新加坡, then submit. The form
   emits `{ ownerId: "demo-user-1", departmentId: "demo-operations", regionCode: "SG" }`.
2. The list and details display the corresponding labels. Change the selection
   to 陈宇, 风控组 and 印度尼西亚. Before submitting, the two surfaces still
   show the previous saved record. After submitting, both show the new labels.
3. If a required field is cleared, validation prevents a save and preserves the
   previous record. With demo data, no overseas lookup request is sent.

For real data, share the same user options, department tree, and dictionary
lookup between the controls and the Views. See the [component data contract](../components/intl-fields.md#data-in-plasmic)
for the different list and tree prop shapes and the native code generation path.
