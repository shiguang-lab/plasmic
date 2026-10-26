# Form layout

Applies to [Ant Design v6](../index.md) registrations and theme behavior. Select the matching project library through the [library index](../../index.md) before using this recipe; another library or major requires its own verified composition rules.

Read [Form](../components/form.md) for values, validation and submission, and [Form Field](../components/form.md#formitem) for field ownership, help, instructions and label layout. For a Form inside a Modal, additionally read [Modal](../components/modal.md) for native footer/submission behavior. For a Form inside any overlay, read [Overlays](modal-drawer.md) for dismissal. A standalone Form does not load overlay rules. Component rules are maintained in those references; this file owns layout and region acceptance.

The rules card delivers the whole Generation rules stage. [Modal form layout](#modal-form-layout) applies to Forms in a Modal and in a Drawer; all applicable acceptance requirements remain mandatory.

**Hard constraints** (always delivered with any section):

- Page Form defaults: `layout="horizontal"`, `labelAlign="right"`, shared `labelCol={"flex":"<px>px"}` from `prepare_plan.py label-width` then rendered measurement, and three short fields per row. Source overrides follow [layout ownership](#layout-ownership).
- Use one wrapping Row (`gutter` 16) of Cols per field group, in reading order. Default spans: 8 for short fields, 24 for full-row fields; trailing rows retain span 8 and left alignment. See [Page Form structure](#page-form-structure).
- Never build one flex/grid container per visual row with Items set to `flex:1`: rows with different field counts then misalign their columns.
- Incidental screenshot/wireframe wrapping does not set column count; follow the selected source's reviewed arrangement or the three-column default.
- A Form inside a Card: Card body `24px 20px 0` and the Form's own padding 0. The first row starts 24px below the body edge; the last Form.Item (fields or the actions Item) keeps its native 24px margin as the bottom edge. A Form that wraps several Cards (grouped form) gives each group Card the same body padding.
- A Modal/Drawer Form defaults to `layout="vertical"` with one or two columns under [Modal form layout](#modal-form-layout).

## Plan decisions

Declare these native props in each planned Form before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` for each; selection preflight rejects pending values. `null` means deliberately unset.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-antd6-form` | `layout` | Default `horizontal` on Pages, `vertical` in overlays; source choices follow [layout ownership](#layout-ownership). |
| `plasmic-antd6-form` | `labelAlign` | `right` for horizontal labels; `null` for a vertical Form. See [rule](#columns-and-label-width). |
| `plasmic-antd6-form` | `labelCol` | `{"flex": "<px>px"}` for a horizontal Page Form with several fields: the `prepare_plan.py label-width` estimate before markup, replaced by the rendered measurement after the first render; `{"flex": "none"}` for one field, `null` for a vertical Form. See [rule](#columns-and-label-width). |

## Generation rules

### Layout ownership

Use real labeled inputs, Selects, Buttons and feedback. Modals/Drawers keep the full source page behind them, close unrelated menus, and retain a reachable footer. Keep destructive or unauthorized actions gated according to the source. Loading, failure, success and recovery states belong to the actual flow; do not manufacture generic state boards or placeholder future features.

Compose editable fields as a business Form; adjacent read-only summaries follow [information composition](summary-metrics.md). Keep each field’s real control in its Item children Slot while arranging the Items through registered layout components. Follow [action bars](action-bars.md#buttons-and-action-bars) for workflow ordering and availability.

Decide labels and columns separately. Explicit user choices win: inspect selected visual sources and preserve their reviewed arrangement with native components. Retain source/region evidence and [reconcile business requirements](../../../requirement-alignment.md#visual-sources-and-component-rules). Mere attachments do not override defaults; use these for unspecified choices:

| Context | Label direction | Field allocation |
| --- | --- | --- |
| Desktop page create/edit form with short labels and sufficient width | Horizontal; native labelAlign=right with a shared labelCol width measured from the longest actual label | Three short fields per row by default; two when the measured control width does not fit three; full row for textarea, editor, Key or other long values |
| Narrow Modal or Drawer | Vertical, to preserve control width | Usually one column; pair only when realistic values, help and errors fit |
| Long labels, complex fields or narrow page regions | Vertical when horizontal labels would crowd controls | Long Keys, URLs, editors and multi-line input use a full row |

A wide overlay can justify horizontal labels; a page can justify vertical labels.

#### Page Form structure

Use one wrapping Row per field group, with shared column edges. For a single-group Page Form, generate the following structure with `prepare_plan.py form-skeleton` from the decided plan and field inventory ([planning](../../../planning.md#format-example-and-mechanical-helpers)). For a [grouped Form](../../../design/page-types.md#grouped-form), compose one such Row inside each group Card under the same Form; the helper generates only single-group Forms.

```html
<plasmic-component data-plasmic-name="BasicForm" data-plasmic-component="plasmic-antd6-form"
  data-props='{"mode":"advanced","layout":"horizontal","labelAlign":"right","labelCol":{"flex":"108px"},"wrapperCol":{"flex":1}}' style="width:100%;padding:0">
  <slot name="children">
    <plasmic-component data-plasmic-name="BasicFields" data-plasmic-component="plasmic-antd6-row"
      data-props='{"gutter":16,"wrap":true}' style="align-self:stretch;max-width:none;min-width:0">
      <slot name="children">
        <plasmic-component data-plasmic-name="NameCol" data-plasmic-component="plasmic-antd6-col" data-props='{"span":8}'>
          <slot name="children"><!-- NameItem: Form.Item whose children Slot holds the control --></slot>
        </plasmic-component>
        <!-- one span-8 Col per short field, in reading order -->
        <!-- one span-24 Col per full-row field (textarea, Key, URL, editor) -->
      </slot>
    </plasmic-component>
    <!-- Inline actions (basic-form): a Form.Item without name, label Slot holding one space, colon false -->
    <plasmic-component data-plasmic-name="FormActions" data-plasmic-component="plasmic-antd6-form-item" data-props='{"colon":false}'>
      <slot name="label">&nbsp;</slot>
      <slot name="children"><!-- Space size 8: submit (primary), cancel --></slot>
    </plasmic-component>
  </slot>
</plasmic-component>
```

A single-group Form goes inside its Card; a grouped Form wraps its group Cards. Each field Card uses body `24px 20px 0` ([Card ownership](../components/card.md#card-ownership)). Keep one submission owner for groups saved together.

- Each Col holds exactly one Form.Item. Do not nest Rows per visual line, and do not wrap Items in native flex rows.
- The Row stretches to the Form content width; keep `max-width:none` because Row gutter uses negative inline margins and a `max-width:100%` cap shifts its right edge inward.
- A full-row field keeps the shared labelCol, so its label column aligns with the first column above it.
- Controls fill their Item. Input, Select and TextArea fill by default; DatePicker, TimePicker and InputNumber need `width:100%` unless a source or measurement makes them compact.
- With two columns (measured crowding), use `span` 12; never mix short-field spans within one Form.

#### Columns and label width

Background and definition text belongs in the label `tooltip`, not in a persistent description. In a multi-column Form a persistent description is limited to one short line of format or range information; long explanatory paragraphs make a grid row tall and crowded, so move them to the label tooltip (the user opens it on demand) or drop them.

A Page create/edit Form defaults to three fields per row. Use a source-specified count, or two when measured control widths show three would crowd them (`columnsReason` measurement). A trailing row may hold fewer fields at the same column width.

Labels are right-aligned with `labelAlign="right"`; left alignment needs a source quote that states it (`labelAlignReason`). The shared label column fits the longest real label, including its required mark, colon and any help icon, plus at least 8px, in two steps:

1. **Plan.** Before markup set `labelCol={flex: "<px>px"}` to the estimate from `prepare_plan.py label-width PLAN --page ROUTE` (14px per CJK character, 8px per other character, 11px required mark, 14px colon, 18px help icon, 8px padding, rounded up to 4px). The derived field inventory records it as `labelWidth.estimatedPx`; `form-skeleton` writes it.
2. **Measure.** After the first insertion, measure the longest label element with `snapshot_layout`, keep that capture, and record `labelWidth.measuredPx` with `measuredFrom: {path, sha256}` of the capture. When the measurement differs from the estimate, change `labelCol` in the plan and the model to the measured value. The saved-output Forms gate requires the measurement and its capture; an arithmetic estimate is not a measurement. Re-measure after adding or removing a tooltip. Make the layout decision explicitly rather than inheriting a template's label spans. For one compact horizontal field use content-sized native labels. Keep errors and descriptions aligned with controls.

Every Form and intermediate field-layout wrapper fills its allocated surface/cell through width:100% or proven stretch alignment; grid/flex children use min-width:0. A Form with align-items:flex-start does not stretch an un-sized child. max-width:100% only caps width. Col occupies its intended column, not 100% of its Row. Keep Switch/Checkbox and deliberately compact controls content-sized. An internal wrapper must not accidentally constrain the whole form.

Record mandatory `formLayout` for every Form in the independent field inventory. A non-default direction needs machine-checkable evidence, never a prose justification:

- `layoutReason: {"kind": "source", "evidence": {"path": "/abs/requirement.md", "sha256": "…", "quote": "…"}}` — the quote must be verbatim and must itself state the label direction or column layout.
- `layoutReason: {"kind":"reference","referenceId":"form","evidence":{path,sha256,quote}}` — quote the user's source selection. Reuse [reference evidence](../../../design-references.md): region `nodeNames` includes this Form; `decision` records label direction/adaptation. The gate checks source/image hashes, complete layout reads and Form mapping. Visually inspect label/control groups; outer frame stacking proves neither label direction nor fidelity.
- `layoutReason: {"kind": "measurement", "labelWidth": 220, "controlMinWidth": 160, "regionWidth": 360}` — measured widths must show that horizontal labels crowd the control.

Bare/partial reasons and reuse across Forms fail; without evidence, use defaults. Suite `references` supplies evidence; standalone `verify_forms.py` needs `--references-inventory` and `--references-evidence`. Actual ownership determines Page/overlay. Compact text/selection controls need `controlWidthReason`: `{"kind":"measurement","controlWidth":180,"columnWidth":420}` from rendered bounds, or a `source` quote specifying width. Filling controls need none. These are acceptance metadata, never component props or fabricated justifications.

Spacing between adjacent components has one owner. When the last Form.Item already supplies its theme margin-bottom, a following Alert/help block must not add another margin-top or parent row-gap on the same boundary. Preserve native Form.Item spacing and set the extra wrapper gap/margin to zero for that composition. If a different composition intentionally transfers spacing to the parent, remove the matching child margin instead of stacking both.

### Modal form layout

These rules apply to a Form in a Modal or a Drawer. Use native Modal `width` or Drawer `size` under [overlay sizing](modal-drawer.md#overlay-width). Choose the field arrangement from the complete inventory, content lengths and filling dependencies, then select that native dimension. Preserve the designated visual draft under [requirement alignment](../../../requirement-alignment.md); the following product defaults fill unspecified decisions and are not Ant Design component defaults. A wider Modal can still contain a single-column Form.

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

## Acceptance checks

### Page Form acceptance

Record each Page Form's arrangement in the independent field inventory: `layout: {container: "BasicFields", columns: 3, gutter: 16}` for the Row structure (a grouped Form lists one Row per group Card in reading order, `container: ["BasicGroup", "RuleGroup"]`), each field's `span` (1, or `columns` for a full row), and `labelWidth` for horizontal labels. `verify_forms.py` fails a Page Form with two or more fields that has no `layout`, a Row whose Cols are not one Item each with `span` 24/columns (or 24 for full-row fields), a horizontal Form without the labelWidth decomposition or with a native `labelCol` that disagrees with it, a left-aligned Form without a source, a column count other than three without `columnsReason`, and a long persistent description in a three-column Form. It checks all Form-to-field width paths, including unnamed wrappers; unknown sizing remains unresolved, not a pass.

For every affected page and opened overlay, inspect real Preview at the target viewport in normal and validation-error states, then after save/reopen. Record the surface, Form, layout wrapper, Item and control bounds with the screenshot. Check that same-column Items share their left edge across rows, controls reach their column edge, full-row fields align with the first column, labels are right-aligned, and instructions and errors are readable without overlap. Exercise long Key/person selections. Model checks cannot certify these rendered measurements; missing Preview evidence leaves layout acceptance unverified. Verify the rendered control/error-to-next-block distance in normal and validation-error states; checking Alert's margin alone misses parent gap and Form.Item margin.

### Modal layout acceptance

Before markup, record the source-selected width, native Form layout, complete ordered fields and full-row/paired allocations in the existing field/layout inventory. Keep native component props as the implementation contract. Apply [overlay structure and close behavior](modal-drawer.md#structure-and-close-behavior) for viewport limits, body scrolling, reachable header/footer and closing/reopening; apply [Modal submission](../components/modal.md#submission) for validation and pending/failure behavior.

For authored CSS-grid rows, record `layout: {container: "NewGroupFields", modalWidth: 720, columns: 2, columnGap: 16, rows: [{container: "NewTypeScenarioRow", fields: ["NewTypeField", "NewScenarioField"]}]}` and each field's `span` (1 or 2) in the independent field inventory. For a Drawer, replace `modalWidth` with `drawerSize`, such as `drawerSize:640`; preserve the actual native `size` value, including a preset or CSS length. These are verification keys: the component props remain Modal `width` and Drawer `size`.

Every row container holds exactly `columns` Items except a trailing partial row, and a full-row field (`span` = `columns`) is a direct child of the layout container between those rows, not an Item alone inside its own row container. A Row/Col overlay layout uses the Page Form inventory shape plus `modalWidth` or `drawerSize` for its actual owner. `verify_forms.py` checks the owning overlay's native dimension, full-width stacked container and paired rows or Cols, columns/gap, complete field group and full-row/half-row placement for either label direction. A mismatch fails generation. Run before delivery and after save/reopen. Apply the Preview checks above, including invalid, corrected and reopened states and reachable native footer. Capture the opened Modal or Drawer, not its background or hidden editor node. Update generation source and delivered model together when fixing a layout failure.
