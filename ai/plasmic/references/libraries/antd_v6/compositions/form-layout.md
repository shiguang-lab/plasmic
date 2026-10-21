# Form layout

Applies to [Ant Design v6](../index.md) registrations and theme behavior. Select the matching project library through the [library index](../../index.md) before using this recipe; another library or major requires its own verified composition rules.

Read [Form](../components/form.md) for values, validation and submission, and [Form Field](../components/form.md#formitem) for field ownership, help, instructions and label layout. For a Form inside a Modal, additionally read [Modal](../components/modal.md) for native footer/submission behavior. For a Form inside any overlay, read [Overlays](modal-drawer.md) for dismissal. A standalone Form does not load overlay rules. Component rules are maintained in those references; this file owns layout and region acceptance.

Read this file through `read_reference.py`: include `layout-ownership` for every Form; include `modal-form-layout` only for Forms in a Modal. All applicable acceptance requirements remain mandatory.

## Layout ownership

Use real labeled inputs, Selects, Buttons and feedback. Modals/Drawers keep the full source page behind them, close unrelated menus, and retain a reachable footer. Keep destructive or unauthorized actions gated according to the source. Loading, failure, success and recovery states belong to the actual flow; do not manufacture generic state boards or placeholder future features.

Compose editable fields as a business Form; adjacent read-only summaries follow [information composition](summary-metrics.md). Keep each field’s real control in its Item children Slot while arranging the Items through registered layout components. Follow [action bars](action-bars.md#buttons-and-action-bars) for workflow ordering and availability.

Spacing between adjacent components has one owner. When the last Form.Item already supplies its theme margin-bottom, a following Alert/help block must not add another margin-top or parent row-gap on the same boundary. Preserve native Form.Item spacing and set the extra wrapper gap/margin to zero for that composition. If a different composition intentionally transfers spacing to the parent, remove the matching child margin instead of stacking both. Verify the rendered control/error-to-next-block distance in normal and validation-error states; checking Alert's margin alone misses parent gap and Form.Item margin.

## Modal form layout

Choose the field arrangement from the complete inventory, content lengths and filling dependencies, then select Modal width. Preserve the designated visual draft under [requirement alignment](../../../requirement-alignment.md); the following product defaults fill unspecified decisions and are not Ant Design component defaults. A wider Modal can still contain a single-column Form.

### Width and columns

| Content and workflow | Arrangement | Desktop width |
| --- | --- | --- |
| A short basic form or fields with a strong sequential dependency | One column | Default 520px |
| Related, independently fillable short fields can be paired and pairing meaningfully reduces excessive single-column height | Two equal columns; long fields span both | Default 720px |
| Long names, Keys, text or complex controls dominate | Keep one column; widen for actual content | 640–720px |
| Two columns are justified but realistic person/entity selections, multi-selects or adjacent actions still crowd them | Two columns with full-row exceptions | 800px, with a recorded content/geometry reason |

Two columns require both a meaningful field pairing and sufficient space: after actual body padding and the 16px column gap, each control has roughly 240px or more usable width and its longest expected label/value, instruction and error fit. Field count alone does not select two columns. If that space is unavailable, use one column. Do not widen solely to make a form look larger, remove fields to reduce height, or reorder dependent inputs to fill a grid. Use one or two columns unless an explicit dense-entry requirement specifies otherwise.

### Field allocation

| Field content | Default allocation |
| --- | --- |
| Long business names, generated/editable Keys, URLs or addresses | Full row |
| Textarea, code/rich-text editors, upload lists and complex nested fields | Full row |
| Short enums such as type/status/scenario, short numbers, single date/time | Half row when the label, control, help and error all fit |
| Person/entity Select, multi-select, date range | Decide from the longest expected content; use a full row when a half row would truncate or crowd it |
| Switch/Checkbox and fixed read-only metadata | Compact related group or information row; avoid a large empty control area |

Input component type alone does not determine column span. Pair related short fields; make an unpaired final field span the row or choose a narrower single-column Modal. Do not leave an unexplained empty half-row beside an editable field. A full-row Key with an adjacent regeneration action must reserve action space without wrapping or overlapping it.

### Labels and spacing

For this Modal composition, explicitly set Form layout="vertical": each Item's label stays above its control in both one- and two-column arrangements. Label direction and field columns are separate decisions. Keep native label/required/help/error ownership from [Form](../components/form.md#formitem); do not change the label layout to make another field fit. Standalone page Forms retain their own source-selected layout.

The Form and every intermediate field-layout wrapper must fill the Modal body width through explicit width:100% or verified stretch alignment, with min-width:0 on grid/flex children. In particular, a full-width Form with align-items:flex-start does not make an un-sized child wrapper full width. Use equal columns, a 16px column gap and explicit full-row spans. Prefer a full-width Antd6 Flex column and Row/Col for mixed full-row and paired fields, using the real registered gutter/span contracts and full-row allocation for long fields. Verify actual component geometry rather than assuming native CSS grid properties apply to Row/Col. Controls fill their allocated cells. Preserve native Form.Item vertical spacing; do not add parent row-gap on top of it. Keep each real control directly in its Item children Slot even when the Items are arranged in a grid.

### Header and field guidance

Keep one native Modal title that names the operation. Do not add a subtitle, workflow introduction, generic filling instructions or a repeated “Basic information” heading before the fields. Omit text such as “Fill in the basic information to enter the creation page”; express the next step through the actual native footer action under [Modal](../components/modal.md#footer).

Necessary user-facing constraints stay with their fields through [field instructions](../components/form.md#field-instructions) or [label help](../components/form.md#label-help). State only what the user needs to enter or decide; do not paste implementation notes, source-system reuse, API/uid behavior or requirement prose into the Form. A generated editable Key may need a short uniqueness/editability instruction; detailed derivation rules belong in field help only when useful to the user.

### Layout acceptance

Before markup, record the source-selected width, native Form layout, complete ordered fields and full-row/paired allocations in the existing field/layout inventory. Keep native component props as the implementation contract. Apply [overlay structure and close behavior](modal-drawer.md#structure-and-close-behavior) for viewport limits, body scrolling, reachable header/footer and closing/reopening; apply [Modal submission](../components/modal.md#submission) for validation and pending/failure behavior.

For Antd6 Row/Col layouts, verify real gutter/span props and rendered column widths, full-row fields and ownership; the optional CSS-grid row check below does not validate Row/Col props. Form field/validation checks still apply to every layout.

For authored CSS-grid rows, record optional Form layout expectations as `layout: {container: "NewGroupFields", modalWidth: 720, columns: 2, columnGap: 16, rows: [{container: "NewTypeScenarioRow", fields: ["NewTypeField", "NewScenarioField"]}]}` and each field's `span` (1 or 2) in the independent field inventory. `verify_forms.py` checks the Modal width, the vertical container and paired rows fill the Form width, the paired row columns/gap, its complete field group and full-row/half-row placement against the saved model; a mismatch must fail the generation check. Run it before delivery and after save/reopen. This structural check does not measure rendered geometry or judge whether text is a useful instruction. In actual preview inspect every affected Modal at the target viewport: no extra subtitle or implementation copy, controls reach their intended column edges, the longest realistic labels/values and adjacent actions fit, validation errors expand without overlap, and the native footer stays reachable. Check normal, invalid, corrected and reopened states. Capture the opened Modal, not just the background page or hidden editor node. Update the generation source and delivered model together when fixing a layout failure.
