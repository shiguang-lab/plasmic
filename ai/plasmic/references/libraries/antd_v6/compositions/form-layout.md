# Form layout

Applies to [Ant Design v6](../index.md) registrations and theme behavior. Select the matching project library through the [library index](../../index.md) before using this recipe; another library or major requires its own verified composition rules.

Read [Form](../components/form.md) for values, validation and submission, and [Form Field](../components/form.md#formitem) for field ownership, help, instructions and label layout. For a Form inside a Modal, additionally read [Modal](../components/modal.md) for native footer/submission behavior. For a Form inside any overlay, read [Overlays](modal-drawer.md) for dismissal. A standalone Form does not load overlay rules. Component rules are maintained in those references; this file owns layout and region acceptance.

Read this file through `read_reference.py`: include `layout-ownership` for every Form; include `modal-form-layout` only for Forms in a Modal. All applicable acceptance requirements remain mandatory.

## Plan decisions

Declare these native props in each planned Form before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` for each; selection preflight rejects pending values.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-antd6-form` | `layout` | `horizontal` for a Page create/edit Form, `vertical` for a Form inside a Modal or Drawer. See [rule](#layout-ownership). |
| `plasmic-antd6-form` | `labelAlign` | `right` (native default) for horizontal labels. See [rule](#columns-and-label-width). |
| `plasmic-antd6-form` | `labelCol` | `{"flex": "<measured>px"}` from the longest actual label for a horizontal Page Form. See [rule](#columns-and-label-width). |

## Generation rules

### Layout ownership

Use real labeled inputs, Selects, Buttons and feedback. Modals/Drawers keep the full source page behind them, close unrelated menus, and retain a reachable footer. Keep destructive or unauthorized actions gated according to the source. Loading, failure, success and recovery states belong to the actual flow; do not manufacture generic state boards or placeholder future features.

Compose editable fields as a business Form; adjacent read-only summaries follow [information composition](summary-metrics.md). Keep each field’s real control in its Item children Slot while arranging the Items through registered layout components. Follow [action bars](action-bars.md#buttons-and-action-bars) for workflow ordering and availability.

Choose label direction and field columns separately before markup. Only the current user or the requirement document can make an explicit layout choice; a Pen frame, template, screenshot or previously generated page is a draft, not that choice. If a draft conflicts with these defaults, follow the defaults or ask the user. Otherwise use the defaults:

| Context | Label direction | Field allocation |
| --- | --- | --- |
| Desktop page create/edit form with short labels and sufficient width | Horizontal; native labelAlign=right with a shared labelCol width measured from the longest actual label | Three short fields per row by default; two when the measured control width does not fit three; full row for textarea, editor, Key or other long values |
| Narrow Modal or Drawer | Vertical, to preserve control width | Usually one column; pair only when realistic values, help and errors fit |
| Long labels, complex fields or narrow page regions | Vertical when horizontal labels would crowd controls | Long Keys, URLs, editors and multi-line input use a full row |

A wide overlay can justify horizontal labels; a page can justify vertical labels.

#### Columns and label width

Background and definition text belongs in the label `tooltip`, not in a persistent description. In a multi-column Form a persistent description is limited to one short line of format or range information; long explanatory paragraphs make a grid row tall and crowded, so move them to the label tooltip (the user opens it on demand) or drop them. `verify_forms.py` rejects a description longer than a short line in a three-column Page Form.

A Page create/edit Form uses three fields per row. Use two rows of two only when measured control widths show three would crowd them (`columnsReason` measurement), and cite a source for any other count. A trailing row may hold fewer than three fields; every other row holds exactly three, and a full-row field is a direct child of the layout container rather than an Item alone inside its own row.

Labels are right-aligned. Horizontal labels align on their right edge with `labelAlign="right"`; left alignment needs a source quote that states it (`labelAlignReason`). Size the shared label column from the longest real label plus its required mark and any help icon, set it as `labelCol={flex: "<measured>px"}`, and record the decomposition `labelWidth: {longestLabel, labelTextPx, requiredMarkPx, helpIconPx, paddingPx, measuredPx}` in the field inventory. Measure the real rendered label: `measuredPx = labelTextPx + requiredMarkPx + helpIconPx + paddingPx`, keeping at least 8px trailing padding. When a field shows a label tooltip its icon occupies width, so a column sized without it overlaps the control; re-measure after adding or removing a tooltip. `verify_forms.py` rejects a missing measurement, a native `labelCol` that disagrees with it, a left-aligned Form without a source, and a page Form that deviates from three columns without a measurement showing crowding. Do not inherit the registered vertical default or a template's label spans without making this decision. For one compact horizontal field use content-sized native labels; for multiple fields choose a shared label width from the longest actual label/required mark/help icon. Keep errors and descriptions aligned with controls. Do not force all fields to share one span or widen a compact control merely to remove whitespace.

Every Form and intermediate field-layout wrapper fills its allocated surface/cell through width:100% or proven stretch alignment; grid/flex children use min-width:0. A Form with align-items:flex-start does not stretch an un-sized child, and 1fr 1fr divides that child's width without expanding it. max-width:100% only caps width. Prefer full-width registered Flex and Row/Col with verified gutter/span contracts. Col occupies its intended column, not 100% of its Row. Fill each Form.Item and normal text/selection control's allocated area; keep Switch/Checkbox and deliberately compact controls content-sized. An internal wrapper must not accidentally constrain the whole form.

Record mandatory `formLayout` for every Form in the independent field inventory. A non-default direction needs machine-checkable evidence, never a prose justification:

- `layoutReason: {"kind": "source", "evidence": {"path": "/abs/requirement.md", "sha256": "…", "quote": "…"}}` — the quote must be verbatim and must itself state the label direction or column layout.
- `layoutReason: {"kind": "measurement", "labelWidth": 220, "controlMinWidth": 160, "regionWidth": 360}` — measured widths must show that horizontal labels crowd the control.

A bare string, a boolean or a partial object fails generation, and one reason object cannot be reused by two Forms. If you cannot cite or measure the deviation, change the Form to the default instead of writing a reason. Infer page versus Modal/Drawer from the actual owning model, not a claimed context. Deliberately compact text/selection controls need a field `controlWidthReason` in the same structured form — `{"kind": "measurement", "controlWidth": 180, "columnWidth": 420}` or a `source` quote that specifies the narrower control — including inline-instruction compositions; a control narrower than its column with a prose or missing reason fails generation. These are acceptance metadata, not component props. `verify_forms.py` requires the recorded direction to match explicit native props and checks all Form-to-field width paths, including unnamed wrappers, without requiring optional Grid expectations. It accepts native Row/Col allocation and provable stretch; unknown sizing remains unresolved, not a pass. Use explicit public styles when the static contract cannot prove the width, then verify Preview.

For every affected page and opened overlay, inspect real Preview at the target viewport in normal and validation-error states, then after save/reopen. Record the surface, Form, each field-layout wrapper, Item and control bounds with the screenshot. Check allocated edges after padding/gutter/label space, longest realistic values, full-row fields, equal paired columns, label alignment, readable instructions and errors without overlap. Exercise long Key/person selections. Horizontal labels alone do not fix shrinking wrappers. Model checks cannot certify these rendered measurements; missing Preview evidence leaves layout acceptance unverified.

Spacing between adjacent components has one owner. When the last Form.Item already supplies its theme margin-bottom, a following Alert/help block must not add another margin-top or parent row-gap on the same boundary. Preserve native Form.Item spacing and set the extra wrapper gap/margin to zero for that composition. If a different composition intentionally transfers spacing to the parent, remove the matching child margin instead of stacking both. Verify the rendered control/error-to-next-block distance in normal and validation-error states; checking Alert's margin alone misses parent gap and Form.Item margin.

### Modal form layout

Choose the field arrangement from the complete inventory, content lengths and filling dependencies, then select Modal width. Preserve the designated visual draft under [requirement alignment](../../../requirement-alignment.md); the following product defaults fill unspecified decisions and are not Ant Design component defaults. A wider Modal can still contain a single-column Form.

#### Width and columns

| Content and workflow | Arrangement | Desktop width |
| --- | --- | --- |
| A short basic form or fields with a strong sequential dependency | One column | Default 520px |
| Related, independently fillable short fields can be paired and pairing meaningfully reduces excessive single-column height | Two equal columns; long fields span both | Default 720px |
| Long names, Keys, text or complex controls dominate | Keep one column; widen for actual content | 640–720px |
| Two columns are justified but realistic person/entity selections, multi-selects or adjacent actions still crowd them | Two columns with full-row exceptions | 800px, with a recorded content/geometry reason |

Two columns require both a meaningful field pairing and sufficient space: after actual body padding and the 16px column gap, each control has roughly 240px or more usable width and its longest expected label/value, instruction and error fit. Field count alone does not select two columns. If that space is unavailable, use one column. Do not widen solely to make a form look larger, remove fields to reduce height, or reorder dependent inputs to fill a grid. Use one or two columns unless an explicit dense-entry requirement specifies otherwise.

#### Field allocation

| Field content | Default allocation |
| --- | --- |
| Long business names, generated/editable Keys, URLs or addresses | Full row |
| Textarea, code/rich-text editors, upload lists and complex nested fields | Full row |
| Short enums such as type/status/scenario, short numbers, single date/time | Half row when the label, control, help and error all fit |
| Person/entity Select, multi-select, date range | Decide from the longest expected content; use a full row when a half row would truncate or crowd it |
| Switch/Checkbox and fixed read-only metadata | Compact related group or information row; avoid a large empty control area |

Input component type alone does not determine column span. Pair related short fields; make an unpaired final field span the row or choose a narrower single-column Modal. Do not leave an unexplained empty half-row beside an editable field. A full-row Key with an adjacent regeneration action must reserve action space without wrapping or overlapping it.

#### Labels and spacing

Default this Modal composition to explicit Form layout="vertical": each Item's label stays above its control in both one- and two-column arrangements. Apply the layout decision and justified exceptions above. Keep native label/required/help/error ownership from [Form](../components/form.md#formitem).

Apply width ownership above to the Modal body. Use equal columns, a 16px column gap and explicit full-row spans. Verify actual component geometry rather than assuming native CSS grid properties apply to Row/Col. Preserve native Form.Item vertical spacing; do not add parent row-gap on top of it. Keep each real control directly in its Item children Slot even when the Items are arranged in a grid.

#### Header and field guidance

Keep one native Modal title that names the operation. Do not add a subtitle, workflow introduction, generic filling instructions or a repeated “Basic information” heading before the fields. Omit text such as “Fill in the basic information to enter the creation page”; express the next step through the actual native footer action under [Modal](../components/modal.md#footer).

Necessary user-facing constraints stay with their fields through [field instructions](../components/form.md#field-instructions) or [label help](../components/form.md#label-help). State only what the user needs to enter or decide; do not paste implementation notes, source-system reuse, API/uid behavior or requirement prose into the Form. A generated editable Key may need a short uniqueness/editability instruction; detailed derivation rules belong in field help only when useful to the user.

#### Layout acceptance

Before markup, record the source-selected width, native Form layout, complete ordered fields and full-row/paired allocations in the existing field/layout inventory. Keep native component props as the implementation contract. Apply [overlay structure and close behavior](modal-drawer.md#structure-and-close-behavior) for viewport limits, body scrolling, reachable header/footer and closing/reopening; apply [Modal submission](../components/modal.md#submission) for validation and pending/failure behavior.

For Antd6 Row/Col layouts, verify real gutter/span props and rendered column widths, full-row fields and ownership; the optional CSS-grid row check below does not validate Row/Col props. Form field/validation checks still apply to every layout.

For authored CSS-grid rows, additionally record `layout: {container: "NewGroupFields", modalWidth: 720, columns: 2, columnGap: 16, rows: [{container: "NewTypeScenarioRow", fields: ["NewTypeField", "NewScenarioField"]}]}` and each field's `span` (1 or 2) in the independent field inventory. Place fields structurally the way the check reads them: every row container holds exactly `columns` Items except a trailing partial row, and a full-row field (`span` = `columns`) is a direct child of the layout container between those rows, not an Item alone inside its own row container. Omit modalWidth for page Forms. `verify_forms.py` checks the Modal width, full-width stacked container and paired rows, columns/gap, complete field group and full-row/half-row placement for either label direction. A mismatch fails generation. Run before delivery and after save/reopen. Apply the Preview checks above, including invalid, corrected and reopened states and reachable native footer. Capture the opened Modal, not its background or hidden editor node. Update generation source and delivered model together when fixing a layout failure.
