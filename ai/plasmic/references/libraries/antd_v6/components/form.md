# Form

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Form | `plasmic-antd6-form` |
| Form Field Group | `plasmic-antd6-form-group` |
| Form.Item | `plasmic-antd6-form-item` |
| Form.List | `plasmic-antd6-form-list` |

## Generation rules

Read the installed Form contract before changing values, validation or submission. Read [Form Field](form.md#formitem) for field controls and [form composition](../compositions/form-layout.md) for page layouts. Every Form inside a Modal additionally reads [Modal form layout](../compositions/form-layout.md#modal-form-layout), which owns width, field columns, label placement and header copy for that composition.

**Reading scope**

The [rules card](../../../planning.md#rules-card-and-read-ledger) delivers Generation rules for composition and the whole document for acceptance; a focused edit uses `scripts/read_reference.py` with these `--section` selectors. Read all sections whose conditions apply; an unknown field/flow scope requires discovery before exclusion.

- Every business Form: `values-and-validation`, `events-and-ref-actions`, `acceptance`, `simplified-and-advanced-modes`.
- Any Form before markup: [form layout](../compositions/form-layout.md#layout-ownership) `layout-ownership` (label direction and column pairing are decided first; a non-default direction needs cited or measured evidence).
- Full-project generation or inventory audit: `project-inventory-and-acceptance`; a focused edit instead reads `focused-form-edits`.
- Every editable field: [field semantics](../selection.md#field-semantics), `validation-order` and `label-and-control-layout`.
- Field-label help being added, changed or present in generated fields: `label-help`.
- Visible field instructions being added, moved or present in generated fields: `field-instructions`.
- Repeated fields or grouped paths: `formlist-and-form-field-group`.
- Hidden, conditional or dependent fields: `conditional-and-dependent-fields`.

Section reads retain Form.Item ownership; use `--section formitem` for all field subsections.

### Values and validation

Editable business forms use the registered Antd6 Form with real Form Field/Form.Item instances and their label/children Slots. Read the registered rule shape: this wrapper uses rule objects such as `{"ruleType":"required"}`, not raw Antd `{required:true}`. Overseas SearchForm.Item has its own rule contract; do not copy between them. Give each field its actual name and validation rules through the installed contract; let Form own required indicators, punctuation, error state, error messages and field values. A literal `*` in label text or a separate red error div is not required-field validation. Derive initial values at Form/Item level without competing control value bindings. Use required and whitespace rules for required text when blank-only values are invalid; choose other rules from the requirement. Submit through the supported Form action/validated event or await its registered validateFields action before a mutation. Rejected validation keeps the Modal open, identifies the field, and performs no mutation.

Form disabled must remain effective, including ConfigProvider inheritance; temporary submission disabling must restore on both success and failure. Await validateFields and stop the mutation on rejection. Custom exact-length rules must actually reject invalid values. When concurrent submissions are explicitly permitted, submitting remains true until all finish.

Verify dynamic initial values and custom rules execute in preview: a nested `{{ ... }}` binding inside `initialValues` or `rules` must be a native expression, not literal text. When uniqueness is required, test an existing key and a distinct key; for a numeric range, test its valid and invalid boundaries, including decimals according to the business rule. When a footer submits through a Form ref, test a form remount or reopening with another record so stale refs cannot silently bypass validation or submission.

Generated/dependent values follow [business outcome cases](../../../design/component-policy.md#business-outcome-cases): read native Form values/refs, implement the source calculation and test changed inputs, repeated actions and conflicts. Required-only rules/help text do not implement that behavior.

When correcting an existing Form, move controls into real Item children Slots to preserve UUIDs and applicable interactions. Replace manual field-error state and value-based submission handlers with native Form values and validation; remove obsolete wrappers and handlers. For adjacent controls/actions follow the direct-control and nested noStyle Item rules in [Form Field](form.md#field-instructions).

### Events and ref actions

Read the component's registered `refActions` and ordered `args` before invoking a Form ref. `args: []` means no parameters; missing `args` means the signature is unknown. Ref keys use camelCase node names, such as `$refs.createForm` for `CreateForm`. A footer calls the verified submit action; only the validated Form event performs the business mutation.

Read the registered Form event argument names/types and use the returned submit argument; do not invent a separate data context for submitted values. When renaming a Form, reread submit/cancel ref bindings so the renamed Form remains callable.

Navigation after successful validation uses the native navigation interaction on Form onFinish, deriving its destination from validated values. The submit button calls Form submit and has no unconditional href. Discover the current schema; if this native action is unavailable report the blocked operation without upgrading the editor as part of a design task.

Use the [submission example](../../../desktop-examples.md#form-submission-and-record-context) for destination checks. Reopening another record requires verified reset/set-fields behavior; changed initialValues alone do not prove Form state resets.

### Form.Item

Installed Form Field/Form.Item contracts own field names, rules, labels and controls.

#### Label help

Field-label explanations belong in the real Form.Item `tooltip` prop/Slot. Keep the label plain and let Form.Item place its native help icon beside the label; do not build a separate Tooltip/button beside the control or type an `i`/question mark as an icon. Advanced Form Fields expose editable tooltip content; simplified Form fields expose tooltip text in their field configuration. Read the installed contract first. If tooltip is absent, report the missing public contract and leave that requirement unresolved; an ordinary design task does not update registrations or publish libraries.

For each field tooltip, verify the native icon is in the label, hover opens the expected content, the control remains usable, and clearing tooltip removes the icon. Recheck editor, actual preview and saved readback. Do not force persisted open state for inspection. Verify required indicators and tooltip coexist without duplicate marks or a second label model.

#### Field instructions

Triage every piece of field copy before choosing a Slot or a component:

| Question | Decision |
| --- | --- |
| Does the user need to perceive this text at all, or is it requirement/implementation description? | Not user-facing: render nothing. Record the text in the field's `excludedCopy` with its source quote so the omission is reviewable. |
| Must it be visible while entering the value (format, range, constraint)? | User-facing now: use an inline instruction for a short note beside a compact control, or `description` for one short line below. |
| Is it background, definition or rationale the user opens on demand? | User-facing on demand: use the label `tooltip`. Never paste it as a persistent description. |

Record the decision as `copyTriage` on the field — `perceive-now`, `perceive-on-demand` or `not-user-facing` — and keep it consistent with what the model renders: a `description` requires `perceive-now`, a `tooltip` requires `perceive-on-demand`, and `not-user-facing` may render neither and must cite the excluded text. A tooltip adds a help icon to the label, so the measured shared label width must include that icon.

Decide instruction placement before choosing a Slot. These are field-specific instructions, not the form’s horizontal/vertical layout. Use the requirement, actual control width, expected text length and measured space at the target viewport; do not automatically place every instruction below the input or rely on a fixed character-count threshold.

| Condition | Placement and component contract |
| --- | --- |
| Short, supplementary instruction next to a compact control, with enough width for the complete control, 12px gap and complete instruction | Place after the control in the same row; vertically align with the control. Use registered Typography.Text with `type=secondary` inside that field’s content region. |
| Long, multi-line, important explanatory text; narrow/multi-column area; a full-width control; or inline text would crowd, truncate or wrap awkwardly | Place below using the Form Item `description` Slot/text configuration, which maps to native `extra`. Align its left edge with the control column. |
| Optional label definition/background that is unnecessary while entering the value | Use the real Item `tooltip`. Keep essential format/range information visible. |
| Validation failure | Keep the native error below the control, independent of the instruction position; show one actionable error at a time. |

Form.Item `extra` has no native placement switch: do not invent `extraPosition` or reposition internal DOM. The Antd6 wrapper forwards value/events to its first direct control. For compact inline instructions, keep that control first and add registered secondary Typography.Text in the same `children` Slot. Native Form `styles.content={display:"flex",alignItems:"center",gap:12}` applies form-wide; verify every field supports it and that errors/extra retain their native layout. Do not apply it to unrelated full-width/stacked fields. If Flex/Space is necessary, use a labeled outer Item and nested named `noStyle` Item: inner Item owns name/rules/value with the control directly below it; outer Item owns label/required/errors. Verify the installed contract. Never put Flex between a named Item and its control without the nested Item. Native React codegen follows Ant Design’s [complex form control](https://ant.design/components/form/#components-form-demo-complex-form-control), not the wrapper’s forwarding behavior.

Below-control instructions use `description` (advanced Slot, simplified text), mapped to native extra below controls/errors with theme secondary typography. Inline instructions use the same hierarchy, a 12px control-to-text gap and complete readable text. Keep one approved instruction; remove obsolete siblings/extra when moving it. Persistent instructions must not use `help`, which replaces errors, or input suffix. If space is insufficient, place instructions below rather than shrinking controls, clipping text or forcing nowrap.

Record `description`, `descriptionPlacement` (`below` by default or `afterControl`) and, for inline text, `descriptionNode` in the independent field inventory. These are acceptance expectations, not new component props. Read back native ownership and secondary Typography, then verify actual normal, empty, invalid and corrected states: one error below the control, persistent instructions at the approved location, no duplicate text, no crowding/overlap, and no vertical shift of inline text when an error appears. Recheck after save/reopen. A correct Slot or screenshot of the initial value alone does not pass this acceptance.

#### Validation order

Show one actionable validation error per field at a time. Set native `validateFirst:true` explicitly on every Form.Item with more than one rule, with required/blank checks first, format/type/range checks next and business/remote checks last; Ant Design, and therefore the wrapper, defaults to collecting every failing rule. Do not hide the second error with CSS or slice displayed messages after all rules run. Inventory the expected `validateFirst`, instruction text and placement, verify saved props/Slots, then test an empty value, a nonempty invalid value and a corrected value: exactly one native field error in each invalid state, persistent instructions remain visible, and correction removes the error.

#### Label and control layout

Follow [layout ownership](../compositions/form-layout.md#layout-ownership): wide page forms default to horizontal labels, narrow Modal/Drawer forms to vertical. Record mandatory `formLayout` and a concrete `layoutReason` for exceptions before generation. Page Forms use the [Row/Col structure](../compositions/form-layout.md#page-form-structure) and its required `layout` inventory. Align native descriptions/errors with controls; verify actual geometry instead of inheriting template label spans.

For one horizontal field, use native content-sized label columns (`labelCol.flex="none"`, `wrapperCol.flex="1"`) when supported. Do not reserve width for an absent Tooltip or longer template fields. Stacked fields can share width measured from actual labels, required indicators, punctuation and configured Tooltips. Verify colon-to-control spacing, especially with left-aligned fixed labels. Preserve native punctuation/spacing; no empty nodes, negative margins or internal CSS overrides. Measure normal, required, configured/empty Tooltip and validation-error states after save/reopen.

### Simplified and advanced modes

Form defaults to `simplified`; editable Form.Item children require `data-props='{"mode":"advanced"}'` on Form. Otherwise runtime uses formItems and may hide authored children behind default Name/Message/Submit fields. The Item inventory gate requires effective advanced mode; it cannot scan a simplified field schema. Verify simplified formItems/dataFormItems contracts and runtime separately. Both modes represent the same business fields through different editing paths: do not duplicate values, labels or controls. Choose the needed mode; conversions preserve names, rules, values, submission and interactions and require readback.

### Form.List and Form Field Group

Form.List owns an array field and its repeated Item children. Read its name/initialValue and registered add(defaultValue, insertIndex), remove(index) and move(from, to) ref actions. The repeated field context and relative Item names form the actual nested path. Keep stable repeated-node identity separate from the current array position; do not store a static index in every copied row or bind each child to a second page-level value.

Form Field Group is this wrapper's named path grouping helper, not an invented Antd static Form.Group API. Its name prefixes its children through the real group context; it does not introduce another Form or submission owner. Both helpers are maintained here rather than in separate component files.

Verify adding an empty/defaulted row, editing distinct rows, removal from the middle, moving rows when used, nested groups and the actual submitted array/object. Values, validation errors and labels must stay attached to the intended record. Group/list actions obey the same disabled/submission policy as the owning Form. Check repeated fields after save/reopen and in hidden Tab/overlay branches.

### Conditional and dependent fields

Use the registered dependencies/shouldUpdate, hidden, preserve and noStyle contracts according to the actual Form mode. Decide whether each field remains valid, is cleared or is excluded from the payload when its prerequisite changes. A visually collapsed valid field still belongs to the form; an inapplicable hidden field must not block submission unexpectedly. Do not infer backend omission from CSS hiding or overwrite edited values when remote options arrive.

For dependent choices, preserve still-valid values and remove invalid ones under the requirement's policy. Test both directions of each condition, dependencies changing after edits, hidden validation errors, reopening another record and nested list paths. Use [step-form composition](../compositions/step-form.md) only when the workflow actually has stages.

## Acceptance checks

### Project inventory and acceptance

Derive expected Forms and fields from the submitted business workflow before generation. The absence of Form nodes in output cannot justify a notApplicable gate or moving submitted fields into standalone-control exemptions. Those exemptions cover independently owned controls such as query inputs/SQL editing, not a missing business Form. Full suites use explicit per-Page inventories, including empty lists only where the reviewed source has no submitted field group.

Each Page entry is selected by its exact `path` (derived inventories use it) under the shared [Page selector rules](../../../verification.md#reviewed-suite-configuration).

For full-project generation or a form inventory audit, inventory every project Page, business Form and field across inactive Tabs and Modals before editing. Pages without business Forms still declare `forms: []`. Derive field keys, labels, rules, tooltip content and layout from the reviewed plan with `prepare_plan.py inventories` ([suite configuration](../../../verification.md#reviewed-suite-configuration)), never from the generated output; decide only the measured `labelWidth` and standalone-control reasons it leaves pending. Run `python3 scripts/verify_forms.py <expectations.json> <mcp-read.json> --overview <mcp-overview.json>` against full public MCP readbacks and again after save/reopen. The overview must cover the entire project. This mandatory gate rejects missing/extra Pages, Forms or fields, unowned editable controls, competing values, label stars, separate field-help Tooltip/buttons/icons, manually bound field-error blocks and advanced validators stored as literal strings. Declare genuinely standalone controls, such as a separately validated SQL editor, in each Page's `standaloneControls: [{nodeName: "SQLEditor", reason: "Separate SQL validation workflow"}]`; entries must be named, unique, used and outside business Forms. SearchForm Items retain their own control ownership. The static scan checks model patterns and contracts; runtime validation still requires preview acceptance.

Run the component-specific Form/Item and Modal checks as applicable. Review the combined region in editor and real Preview: label/control/instruction alignment, native errors, validation expansion and reachable footer at the requested viewport. Save/reopen and reread model ownership and bindings. Record model, geometry and runtime outcomes separately.

### Focused form edits

For a local field/validation/layout change, inspect the entire affected owning Form and relevant hidden branches against the current requirement, preserving unrelated Pages. Check control ownership, values/rules, submit/ref actions and actual error/save/reopen behavior. Run the full-project verifier only with a complete reviewed inventory and overview; do not trim the overview or claim a full-project pass from a partial check. Full regeneration continues to require the complete inventory gate above.

### Acceptance

Read back Form/Item ownership, field names, rules, initial values and bindings. In real Preview, empty and whitespace-only required inputs must show native field errors and block mutation; correction clears the error and permits one submission. Check the consuming flow's loading, disabling, duplicate-submit prevention, failed save, retry and reset/reopening behavior where applicable. Wrapper-wide omitted/explicit/inherited-default combinations belong to [engineering verification](../../../engineering/component-contracts.md). For forms in an overlay, apply [Modal submission](modal.md#submission) and the [overlay close policy](../compositions/modal-drawer.md#structure-and-close-behavior). A visible asterisk, working success path or valid model alone does not pass validation acceptance. Save/reopen and reread changed contracts and bindings.
