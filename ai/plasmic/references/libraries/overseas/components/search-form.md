# SearchForm

Library: [Overseas](../index.md).

| Registered component | Registration key |
| --- | --- |
| SearchForm | `plasmic-overseas-search-form` |
| SearchForm.Item | `plasmic-overseas-search-form-item` |

**Hard constraints** (always delivered with any section):

- Use only four columns (`colSpan=6`) or three columns (`colSpan=8`); choose three columns only for a visual draft with multiple aligned three-column rows. Any other value needs a requirement-document [source exception](../../../design/component-policy.md#protected-configuration).
- `minRows=1` and initially collapsed at runtime; use the verified initial-state mapping or an event-backed controlled state. Never freeze runtime `collapsed` to a literal to specify an initial state. Items inherit the column span except a recorded [measured or source span exception](#layout-and-state).
- Every filter field is a real SearchForm.Item, declared in `components` and owned by the SearchForm `children` Slot; never drop or merge fields to fill a row.
- Query and submission stay separate: submitted business fields use Form. SearchForm owns its card surface; never wrap it in a Card. Inside the content root Flex (gap 16) set `marginBottom` 0.

## Plan decisions

Declare these native props in each planned instance before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` (or the baseline) for each; selection preflight rejects pending or missing values. `null` means deliberately unset and is accepted only where marked.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-overseas-search-form` | `colSpan` | 6 (four columns) by default; 8 only for a multi-row three-column draft; other values need a source override. See [rule](#layout-and-state). |
| `plasmic-overseas-search-form` | `marginBottom` (baseline `0`) | The parent content Flex owns the 16px gap. See [rule](#layout-and-state). |

## Generation rules

### Design defaults

- Use for the query criteria above a list; submitted business fields use Form, not SearchForm.
- Four columns (`colSpan` 6) and `minRows` 1 by default; label width measured from the longest label; query/reset sit in the action column; more than one row collapses.
- It owns a card appearance: never wrap it in a Card; inside the content root Flex (gap 16) its `marginBottom` is 0.

### Usage and behavior

The design source is fintechgrowthui's SearchForm; that source is not a required local file. The Overseas implementation keeps the query card, the 24-column grid, the trailing right-aligned action column, expand/collapse, field initial values and business clear-value semantics on Ant Design 6. Input controls are canvas nodes.

### Editable structure

Read [SearchForm.Item](#searchformitem) for field Props, control value/event mapping and label/help Slots.

The Fields (`children`) Slot of `plasmic-overseas-search-form` holds `plasmic-overseas-search-form-item` instances. One instance is one field, and node order is field order. Insert, copy, delete, move and edit fields through existing Studio/MCP node operations; there is no separate field array or simplified mode.

The Extra actions (`extraActions`) Slot holds query helpers placed after query/reset. Business actions such as create or import follow the [list composition](../compositions/search-table.md#query-and-list-structure); the Slot's existence does not move them into the query action column. Built-in button text is editable through props; their behavior is fixed to submit and reset.

### Layout and state

First resolve the complete filter set under [content before presentation](../../../requirement-alignment.md#content-before-presentation) and record each Item's business key, label, source and SearchForm Slot owner in the existing `components` inventory; only then choose the column count. The column count sets density, not the number of fields: never omit, delete, merge different fields or move one to an unrelated global control to fill a row. Fields beyond one row stay real Items and use native wrapping and collapse; update the field inventory only when the requirement explicitly removes a field.

Ordinary generation has exactly two modes. `colSpan` is the 24-column share per field, not a column count: four columns is `colSpan=6`, three columns is `colSpan=8`; never write four columns as `colSpan=4`.

Choose before generation, in this order, and use the same basis for later adjustments:

1. When the requirement document states a column count or grid, follow it. Values other than four or three columns also need that explicit document text, recorded as a [source exception](../../../design/component-policy.md#protected-configuration) with quote, hash and property override.
2. Otherwise choose three columns (`colSpan=8`) only when the visual draft clearly arranges the filter fields in several rows aligned to three columns. Read the original image and record the artboard, viewport and the multi-row three-column observation in the existing reference-region `decision`. Count filter fields only, not the query/reset actions; a short last row still aligns to three columns.
3. In every other case use four columns (`colSpan=6`): no visual draft, an unclear layout, a single row of three fields, or a draft showing another column count. Other counts are invalid visual input: re-flow into four columns rather than adopting a new mode or narrowing columns to fit every field into one row.

Record the selected `props.colSpan` and its source in `components` before generation; three columns is a supported regular mode and needs no fabricated requirement exception. The static script checks the mode and saved value; it cannot prove that the image really shows multiple three-column rows, so keep the image evidence for independent review. Other native grid values are reserved for explicit requirement exceptions, never a model's own choice.

Both modes use `minRows=1` and start collapsed at runtime under the initial-state contract below; Items do not override span and inherit the selected column width. Three columns does not mean initially expanded or several permanent rows; those initial states need an explicit requirement. Actions use the remaining grid of the last row and wrap when it is full. Beyond minRows the form collapses and always keeps at least the first field. Small screens keep the component's responsive grid xs=24, sm=12, md=selected span.

`Item.span` takes precedence over `Form.colSpan`, so check every field's effective span and never mix the three- and four-column modes. A wider field has two accepted bases, declared before generation as the Item's `props.span` plus `overrides.span`:

- **Source**: the requirement document explicitly requires the wider field; record the real file, quote and hash.
- **Measurement**: the field's control cannot work in one column at the target viewport. Record `{"reason": "...", "measurement": {"controlMinWidth": N, "columnControlWidth": M, "layout": {"path": "/abs/layout.json", "sha256": "..."}}}`, where `controlMinWidth` is the rendered width the control needs for its complete realistic value (for example a date range with both endpoints) and `columnControlWidth` is the measured control width in one column from that `snapshot_layout` file. The span may be exactly twice the inherited span, and only when `controlMinWidth` exceeds `columnControlWidth`.

A date range, long placeholder, field count or free space alone does not authorize a wider field; measure it. Never widen a field first and then change the expectation to pass. A grid span is not a fixed pixel width: actual width depends on the container, gutter and labelWidth; measure labelWidth from the longest real label, not an example value.

`labelWidth` is an optional shared label column width in px with no fixed default; select the SearchForm and edit Label width in the property panel. The imported library contract must include it.

Without `labelWidth`, labels take their content width; with it, every Item uses the shared width. Before generation check every label, including initially collapsed fields, custom labels, required and help marks, the generated colon and its native spacing; choose a single-line width that fits the longest label in the actual font while the target viewport still leaves usable control space. Re-evaluate the whole form after label changes, and do not write the Page's width into the component default. Labels are plain text: do not append colons, spaces or CSS offsets to compensate for a narrow label column.

The card uses the theme background and border, 16px/20px padding, an 8px radius and a default 16px bottom margin; set marginBottom=0 when the parent provides a gap. `embedded` removes the card and its outer spacing. className receives canvas styles.

The editor canvas shows all fields so they can be selected and edited; interactive Preview and runtime follow `collapsed`. Collapse only hides columns: fields stay mounted, and initial values, validation and submission include collapsed fields. When a collapsed field fails validation, the form requests expansion so the error is editable.

Initial-value precedence is Item.initialValue > Form.initialValues > Item.clearValue, preserving 0, false and empty strings. Runtime initial values initialize and reset; they never overwrite the user's current draft, and editing a default in the editor updates the field preview. Reset restores initial values, then applies any explicitly set clearValue; clearing an input to null/undefined also restores clearValue.

`onSearch(values)` returns all registered fields after validation; `onReset(values)` returns the reset values; `onValuesChange(values)` provides the current draft (including collapsed fields) and backs the readonly `values` state. Querying does not change applied data by itself: the page interaction assigns the submitted values to appliedFilters and sets page to 1. The reset event performs the same applied-state update. `collapsed` is writable state; ref actions are `submit()`, `reset()` and `setFieldsValue(values)`.

Read MCP's live `collapsed` registration before setting an initial value. The initial-state control declares `editOnly:true` and `uncontrolledProp:"defaultCollapsed"`; authored initial values become native `defaultCollapsed` at runtime, while the writable `collapsed` state remains available for external control. The native uncontrolled default is `defaultCollapsed=true`. A fixed runtime `collapsed:true` or `collapsed:false` prevents the built-in toggle from changing the displayed state. Controlled use must update the owning state through `onCollapsedChange(value)`.

An installed library can still supply a controlled `collapsed:true` default even after the instance override is removed. If its live contract lacks the initial-state mapping, use an explicit page-owned boolean initialized to true, bind `collapsed` to that state and assign the event's `value` in `onCollapsedChange`. Verify the actual Preview toggle; omission alone does not prove uncontrolled behavior, and a local package build does not update an installed library contract. Static policy checks inspect literal initial values; for a state binding, inspect the state's initial value and verify both toggle directions at runtime. Registration metadata and Preview determine whether a saved literal is an initial value or a frozen controlled prop.

### Page generation

Every query field has a visible `label` or real `labelContent`, including keyword inputs. A placeholder is an input hint; it does not replace the label, and the label is never cleared to give the input more room. Derive the label from the business field and re-measure the form's labelWidth. A deliberately unlabeled special search entry needs its own source-reviewed Item declaration with `props.label:""` and the source; a placeholder-only reference image is not that exception.

A standard list keeps `minRows=1`. Only a requirement that explicitly asks for an initially expanded form with a collapse button allows an initial false value, through a source exception and the verified `defaultCollapsed` mapping; never expand initially by raising minRows. Five fields at span=6 cover two rows: minRows=1 shows expand/collapse, while minRows=2 makes both rows permanent with no toggle; declare the latter in the plan only when two permanent rows are explicitly approved. The editor's forced full display and the runtime collapse setting are accepted separately.

In the admin four-column composition (colSpan=6, minRows=1) with only three ordinary fields, query/reset occupy the fourth cell of the same row and no extra expand control appears. Check each Item's actual span; wider controls such as date ranges also inherit unless a recorded span exception applies.

Every list query region uses Overseas SearchForm with real Items and Antd6 controls, four columns (colSpan=6) by default. Never generate a native query grid, duplicate query buttons or a non-editable fields/element JSON. Read the target's installed Overseas and Antd6 contracts before generation; prepare dependencies through [library selection](../../index.md), report missing capability explicitly, and do not treat a component upgrade or publication as the default fix. Add, remove and reorder fields with node operations; wire query/reset events to page state.

```html
<plasmic-component
  data-plasmic-component="plasmic-overseas-search-form"
  data-props='{"colSpan":6,"labelWidth":72,"marginBottom":0}'
>
  <slot name="children">
    <plasmic-component
      data-plasmic-component="plasmic-overseas-search-form-item"
      data-props='{"name":"keyword","label":"关键词"}'
    >
      <slot name="children">
        <plasmic-component
          data-plasmic-component="plasmic-antd6-input"
          data-props='{"placeholder":"请输入关键词","allowClear":true,"size":"medium"}'
        ></plasmic-component>
      </slot>
    </plasmic-component>
  </slot>
</plasmic-component>
```

For an actual MCP insertion every component also sets `data-plasmic-project` to the current project's imported project ID, separately for Overseas and Antd6.

### SearchForm.Item

Read the actual registered child contract before editing a query field. The owning [SearchForm](#editable-structure) controls the grid, shared labels, collapse and query/reset state.

Each Item's `name` is its unique field key; `label`, `span`, `initialValue`, `clearValue`, `required`, `requiredMessage`, `rules`, `valuePropName` and `trigger` are editable and bindable. `name` is a single string key; dotted paths are not interpreted. `rules` is an Ant Design Form.Item rule array.

The Item's Control (`children`) Slot holds one value control, such as Antd6 Input, Select, DatePicker, Checkbox or a custom component. Edit the control's placeholder, options, mode, format and disabled state on the control; configure initial values on the Item/Form and do not also bind an independent controlled value. Binding defaults to `value` / `onChange`; registered controls' `__plasmicFormFieldMeta.valueProp` (`checked` for Checkbox/Switch) and Item-specified prop/event names are supported. The control's own event handlers still run.

Custom label (labelContent) and help are real editable Slots. Custom label overrides the text label; help supplies supporting text or validation feedback.

## Acceptance checks

### Delivery and verification

When the editor forces expansion it shows "收起", an upward indicator and `aria-expanded=true`; Preview uses the actual collapsed state. Check control start positions for short and long labels, complete single-line text, the native colon-to-control spacing and both directions of expand/collapse; clearing labelWidth restores content width without clipping or eliding labels.

Verify omitted and explicit initial values remain interactive, and controlled state follows its owner. After save/reopen, check that initial props export through `defaultCollapsed` rather than a fixed controlled value; click expand then collapse and check both the button/ARIA state and actual hidden fields. A passing uncontrolled component test alone does not establish that Studio's registered initial-value path works.

Check real Item/control Slot ownership, unique field keys and span overrides in the editor, Preview and saved/reopened readback, and verify initial/reset/clear values, validation and collapsed fields.

Inventory every generated SearchForm per Page/Tab, including initially inactive Tabs. Record the expected grid, effective Item spans, shared labelWidth and collapse state independently of the generated output. Check the overall colSpan and `Item.span ?? Form.colSpan` field by field; fields without a declared exception inherit the expected column width, including hidden fields. At the target viewport check the editor and real Preview: measure column widths/row positions, complete labels and punctuation and usable control space; exercise query/reset. With a collapsed region verify hidden field values and both directions of expand/collapse; without one, confirm that no extra toggle appears. Record model, geometry, screenshot and interaction results separately; unvisited Tabs and unmeasured conditions stay unverified. Correct the generation input and delivered model together on failure.

Component implementation, registration and publication are separately authorized engineering tasks under [engineering verification](../../../engineering/component-contracts.md). Prototype acceptance targets the actual installed version and does not require the agent to build or read client internals.
