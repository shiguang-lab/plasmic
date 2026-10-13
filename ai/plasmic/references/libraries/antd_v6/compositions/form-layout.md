# Form layout

Applies to [Ant Design v6](../index.md) registrations and theme behavior. Select the matching project library through the [library index](../../index.md) before using this recipe; another library or major requires its own verified composition rules.

Read [Form](../components/form.md) for values, validation and submission, and [Form Field](../components/form.md#formitem) for field ownership, help, instructions and label layout. Read [Modal](../components/modal.md) for native footer/submission behavior and [Overlays](modal-drawer.md) for dismissal. Component rules are maintained in those references; this file owns layout and region acceptance.

## Layout ownership

Use real labeled inputs, Selects, Buttons and feedback. Modals/Drawers keep the full source page behind them, close unrelated menus, and retain a reachable footer. Keep destructive or unauthorized actions gated according to the source. Loading, failure, success and recovery states belong to the actual flow; do not manufacture generic state boards or placeholder future features.

Compose editable fields as a business Form; adjacent read-only summaries follow [information composition](summary-metrics.md). Keep each field’s real control in its Item children Slot while arranging the Items through registered layout components. Follow [action bars](action-bars.md#buttons-and-action-bars) for workflow ordering and availability.

Spacing between adjacent components has one owner. When the last Form.Item already supplies its theme margin-bottom, a following Alert/help block must not add another margin-top or parent row-gap on the same boundary. Preserve native Form.Item spacing and set the extra wrapper gap/margin to zero for that composition. If a different composition intentionally transfers spacing to the parent, remove the matching child margin instead of stacking both. Verify the rendered control/error-to-next-block distance in normal and validation-error states; checking Alert's margin alone misses parent gap and Form.Item margin.

## Modal form layout

Choose Modal width and Form columns together from the field inventory. Do not make every Modal multi-column. A short, simple form usually starts at 480–560px with one column. A 640–800px Modal can use two columns when its actual body width, padding and column gap leave roughly 240px or more of usable width per field and the longest labels/values fit. These are starting points, not component defaults or a substitute for preview inspection. Do not use three or more columns in an ordinary confirmation Modal without an explicit dense-entry requirement.

| Field content | Default allocation |
| --- | --- |
| Long business names, generated/editable Keys, URLs or addresses | Full row |
| Textarea, code/rich-text editors, upload lists and complex nested fields | Full row |
| Short enums such as type/status/scenario, short numbers, single date/time | Half row when the label, control, help and error all fit |
| Person/entity Select, multi-select, date range | Decide from the longest expected content; use a full row when a half row would truncate or crowd it |
| Switch/Checkbox and fixed read-only metadata | Compact related group or information row; avoid a large empty control area |

Input component type alone does not determine column span. Pair related short fields; make an unpaired final field span the row or choose a narrower single-column Modal. Do not leave an unexplained empty half-row beside an editable field. A full-row Key with an adjacent regeneration action must reserve action space without wrapping or overlapping it.

The Form and every intermediate field-layout wrapper must fill the Modal body width through explicit width:100% or verified stretch alignment, with min-width:0 on grid/flex children. In particular, a full-width Form with align-items:flex-start does not make an un-sized child wrapper full width. Use equal columns, a 16px column gap and explicit full-row spans. Prefer a full-width Antd6 Flex column and Row/Col for mixed full-row and paired fields, using the real registered gutter/span contracts and full-row allocation for long fields. Verify actual component geometry rather than assuming native CSS grid properties apply to Row/Col. Controls fill their allocated cells. Preserve native Form.Item vertical spacing; do not add parent row-gap on top of it. Keep each real control directly in its Item children Slot even when the Items are arranged in a grid.

For Antd6 Row/Col layouts, verify real gutter/span props and rendered column widths, full-row fields and ownership; the optional CSS-grid row check below does not validate Row/Col props. Form field/validation checks still apply to every layout.

For authored CSS-grid rows, record optional Form layout expectations as `layout: {container: "NewGroupFields", modalWidth: 640, columns: 2, columnGap: 16, rows: [{container: "NewTypeScenarioRow", fields: ["NewTypeField", "NewScenarioField"]}]}` and each field's `span` (1 or 2) in the independent field inventory. `verify_forms.py` checks the Modal width, the vertical container and paired rows fill the Form width, the paired row columns/gap, its complete field group and full-row/half-row placement against the saved model; a mismatch must fail the generation check. Run it before delivery and after save/reopen. This structural check does not measure rendered geometry. In actual preview inspect every affected Modal at the target viewport: controls reach their intended column edges, the longest realistic labels/values and adjacent actions fit, validation errors expand without overlap, and the native footer stays reachable. Capture the opened Modal, not just the background page or hidden editor node. Update the generation source and delivered model together when fixing a layout failure.
