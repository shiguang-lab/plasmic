# Form

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Form | `plasmic-antd6-form` |
| Form Field Group | `plasmic-antd6-form-group` |
| Form.Item | `plasmic-antd6-form-item` |
| Form.List | `plasmic-antd6-form-list` |

Read the installed Form contract before changing values, validation or submission. Read [Form Field](form.md#formitem) for field controls and [form composition](../compositions/form-layout.md) for page layouts. Every Form inside a Modal additionally reads [Modal form layout](../compositions/form-layout.md#modal-form-layout), which owns width, field columns, label placement and header copy for that composition.

**Reading scope**

Use `scripts/read_reference.py` from resourceRoot with the required `--section` selectors below; it preserves the complete selected sections, including nested headings. Full reading is also valid. Read all sections whose conditions apply; an unknown field/flow scope requires discovery before exclusion.

- Every business Form: `values-and-validation`, `events-and-ref-actions`, `acceptance`, `simplified-and-advanced-modes`.
- Full-project generation or inventory audit: `project-inventory-and-acceptance`; a focused edit instead reads `focused-form-edits`.
- Every editable field: `validation-order` and `label-and-control-layout`.
- Field-label help being added, changed or present in generated fields: `label-help`.
- Visible field instructions being added, moved or present in generated fields: `field-instructions`.
- Repeated fields or grouped paths: `formlist-and-form-field-group`.
- Hidden, conditional or dependent fields: `conditional-and-dependent-fields`.

The section reader retains the Form.Item ownership introduction when selecting its subsections. Use `--section formitem` when all field subsections apply. Never skip a relevant check to meet a context budget.

## Values and validation

Editable business forms use the registered Antd6 Form with real Form Field/Form.Item instances and their label/children Slots. Read the registered rule shape: this wrapper uses rule objects such as `{"ruleType":"required"}`, not raw Antd `{required:true}`. Overseas SearchForm.Item has its own rule contract; do not copy between them. Give each field its actual name and validation rules through the installed contract; let Form own required indicators, punctuation, error state, error messages and field values. A literal `*` in label text or a separate red error div is not required-field validation. Derive initial values at Form/Item level without competing control value bindings. Use required and whitespace rules for required text when blank-only values are invalid; choose other rules from the requirement. Submit through the supported Form action/validated event or await its registered validateFields action before a mutation. Rejected validation keeps the Modal open, identifies the field, and performs no mutation.

Form disabled must remain effective, including ConfigProvider inheritance; temporary submission disabling must restore on both success and failure. Await validateFields and stop the mutation on rejection. Custom exact-length rules must actually reject invalid values. When concurrent submissions are explicitly permitted, submitting remains true until all finish.

Verify dynamic initial values and custom rules execute in preview: a nested `{{ ... }}` binding inside `initialValues` or `rules` must be a native expression, not literal text. When uniqueness is required, test an existing key and a distinct key; for a numeric range, test its valid and invalid boundaries, including decimals according to the business rule. When a footer submits through a Form ref, test a form remount or reopening with another record so stale refs cannot silently bypass validation or submission.

Generated/dependent values follow [business outcome cases](../../../design/component-policy.md#business-outcome-cases): read native Form values/refs, implement the source calculation and test changed inputs, repeated actions and conflicts. Required-only rules/help text do not implement that behavior.

When correcting an existing Form, move controls into real Item children Slots to preserve UUIDs and applicable interactions. Replace manual field-error state and value-based submission handlers with native Form values and validation; remove obsolete wrappers and handlers. For adjacent controls/actions follow the direct-control and nested noStyle Item rules in [Form Field](form.md#field-instructions).

## Events and ref actions

Read the component's registered `refActions` and ordered `args` before invoking a Form ref. `args: []` means no parameters; missing `args` means the signature is unknown. Ref keys use camelCase node names, such as `$refs.createForm` for `CreateForm`. A footer calls the verified submit action; only the validated Form event performs the business mutation.

Read the registered Form event argument names/types and use the returned submit argument; do not invent a separate data context for submitted values. When renaming a Form, reread submit/cancel ref bindings so the renamed Form remains callable.

Navigation after successful validation uses the native navigation interaction on Form onFinish, deriving its destination from validated values. The submit button calls Form submit and has no unconditional href. Discover the current schema; if this native action is unavailable report the blocked operation without upgrading the editor as part of a design task.

Use the [submission example](../../../desktop-examples.md#form-submission-and-record-context) for destination checks. Reopening another record requires verified reset/set-fields behavior; changed initialValues alone do not prove Form state resets.

## Acceptance

Read back Form/Item ownership, field names, rules, initial values and bindings. In real Preview, empty and whitespace-only required inputs must show native field errors and block mutation; correction clears the error and permits one submission. Check the consuming flow's loading, disabling, duplicate-submit prevention, failed save, retry and reset/reopening behavior where applicable. Wrapper-wide omitted/explicit/inherited-default combinations belong to [engineering verification](../../../engineering/component-contracts.md). For forms in an overlay, apply [Modal submission](modal.md#submission) and the [overlay close policy](../compositions/modal-drawer.md#structure-and-close-behavior). A visible asterisk, working success path or valid model alone does not pass validation acceptance. Save/reopen and reread changed contracts and bindings.

## Project inventory and acceptance

Derive expected Forms and fields from the submitted business workflow before generation. The absence of Form nodes in output cannot justify a notApplicable gate or moving submitted fields into standalone-control exemptions. Those exemptions cover independently owned controls such as query inputs/SQL editing, not a missing business Form. Full suites use explicit per-Page inventories, including empty lists only where the reviewed source has no submitted field group.

Prefer `{"path":"/records","forms":[...]}` for each Page in reusable inventories. The gate resolves the exact `pageMeta.path` from overview to the current UUID. A unique `name` or explicit `componentUuid` also works; if multiple selectors are supplied they must agree. Missing, ambiguous, empty or duplicate resolutions fail; a miss does not silently fall back to an old UUID. Omit UUIDs from inventories shared across projects. Semantic keys such as `list` require an explicit path/name mapping. See [unified verification](../../../verification.md) for collecting evidence and running all applicable gates.

For full-project generation or a form inventory audit, inventory every project Page, business Form and field across inactive Tabs and Modals before editing. Pages without business Forms still declare `forms: []`. Record field keys, labels, required/whitespace/business rules and tooltip content independently of the generated output. Run `python3 scripts/verify_forms.py <expectations.json> <mcp-read.json> --overview <mcp-overview.json>` against full public MCP readbacks and again after save/reopen. The overview must cover the entire project. This mandatory gate rejects missing/extra Pages, Forms or fields, unowned editable controls, competing values, label stars, separate field-help Tooltip/buttons/icons, manually bound field-error blocks and advanced validators stored as literal strings. Declare genuinely standalone controls, such as a separately validated SQL editor, in each Page's `standaloneControls: [{nodeName: "SQLEditor", reason: "Separate SQL validation workflow"}]`; entries must be named, unique, used and outside business Forms. SearchForm Items retain their own control ownership. The static scan checks model patterns and contracts; runtime validation still requires preview acceptance.

Run the component-specific Form/Item and Modal checks as applicable. Review the combined region in editor and real Preview: label/control/instruction alignment, native errors, validation expansion and reachable footer at the requested viewport. Save/reopen and reread model ownership and bindings. Record model, geometry and runtime outcomes separately.

## Focused form edits

For a local field/validation/layout change, inspect the entire affected owning Form and relevant hidden branches against the current requirement, preserving unrelated Pages. Check control ownership, values/rules, submit/ref actions and actual error/save/reopen behavior. Run the full-project verifier only with a complete reviewed inventory and overview; do not trim the overview or claim a full-project pass from a partial check. Full regeneration continues to require the complete inventory gate above.

## Form.Item

Read the installed Form Field/Form.Item contract before editing a field. Native field names, rules, labels and control ownership remain the source of truth.

### Label help

Field-label explanations belong in the real Form.Item `tooltip` prop/Slot. Keep the label plain and let Form.Item place its native help icon beside the label; do not build a separate Tooltip/button beside the control or type an `i`/question mark as an icon. Advanced Form Fields expose editable tooltip content; simplified Form fields expose tooltip text in their field configuration. Read the installed contract first. If tooltip is absent, report the missing public contract and leave that requirement unresolved; an ordinary design task does not update registrations or publish libraries.

For each field tooltip, verify the native icon is in the label, hover opens the expected content, the control remains usable, and clearing tooltip removes the icon. Recheck editor, actual preview and saved readback. Do not force persisted open state for inspection. Verify required indicators and tooltip coexist without duplicate marks or a second label model.

### Field instructions

Decide instruction placement before choosing a Slot. These are field-specific instructions, not the form’s horizontal/vertical layout. Use the requirement, actual control width, expected text length and measured space at the target viewport; do not automatically place every instruction below the input or rely on a fixed character-count threshold.

| Condition | Placement and component contract |
| --- | --- |
| Short, supplementary instruction next to a compact control, with enough width for the complete control, 12px gap and complete instruction | Place after the control in the same row; vertically align with the control. Use registered Typography.Text with `type=secondary` inside that field’s content region. |
| Long, multi-line, important explanatory text; narrow/multi-column area; a full-width control; or inline text would crowd, truncate or wrap awkwardly | Place below using the Form Item `description` Slot/text configuration, which maps to native `extra`. Align its left edge with the control column. |
| Optional label definition/background that is unnecessary while entering the value | Use the real Item `tooltip`. Keep essential format/range information visible. |
| Validation failure | Keep the native error below the control, independent of the instruction position; show one actionable error at a time. |

Ant Design Form.Item `extra` has no native placement switch; do not invent an `extraPosition` prop or move its internal DOM with absolute positioning, transforms or selectors. For inline instructions, use supported component composition. The installed Antd6 Form Field wrapper forwards value/events to its first direct control; for a simple compact field, retain that control as the first child and add one secondary Typography.Text sibling after it in the same `children` Slot. Use native Form `styles.content={display:"flex",alignItems:"center",gap:12}` when all fields in that Form support this composition; it styles the control content region, so errors and below-control extra retain their native layout. This prop is form-wide: inspect every field, and do not apply it to unrelated full-width or stacked fields. If a Flex/Space wrapper is necessary, use the native outer labeled Item and nested `noStyle` named Item pattern: only the inner Item owns the field name/rules/value, the control is its direct child, and the outer Item owns label/required/error layout. Read and verify that exact installed contract. Never place a Flex between a named Item and its bound control without an appropriate nested Item. Native React code generation must use Ant Design’s [complex form control](https://ant.design/components/form/#components-form-demo-complex-form-control) pattern rather than assuming the Plasmic wrapper’s forwarding behavior is an Ant Design default.

Below-control instructions use the wrapper’s `description` (editable Slot in advanced mode, text in simplified mode). Native extra starts below the control/error area and uses the theme’s secondary text color/font/spacing. Inline instructions use the same secondary hierarchy, a 12px control-to-text gap and complete readable text. Keep exactly one instruction at the chosen location; remove obsolete standalone siblings and bottom extra when moving to inline. Do not use `help` for persistent instructions because it replaces native errors. Do not move instruction text into the input’s suffix: suffix belongs inside the control. When available width no longer accommodates the full instruction, choose below rather than shrinking the control, clipping text or forcing nowrap.

Record `description`, `descriptionPlacement` (`below` by default or `afterControl`) and, for inline text, `descriptionNode` in the independent field inventory. These are acceptance expectations, not new component props. Read back native ownership and secondary Typography, then verify actual normal, empty, invalid and corrected states: one error below the control, persistent instructions at the approved location, no duplicate text, no crowding/overlap, and no vertical shift of inline text when an error appears. Recheck after save/reopen. A correct Slot or screenshot of the initial value alone does not pass this acceptance.

### Validation order

Show one actionable validation error per field at a time. Use native `validateFirst=true`, with required/blank checks first, format/type/range checks next and business/remote checks last. The Antd6 Form Field wrapper defaults to this ordered short-circuit behavior and exposes the actual prop; Ant Design itself defaults to collecting errors. Do not hide the second error with CSS or slice displayed messages after all rules run. Inventory the expected `validateFirst`, instruction text and placement, verify saved props/Slots, then test an empty value, a nonempty invalid value and a corrected value: exactly one native field error in each invalid state, persistent instructions remain visible, and correction removes the error.

### Label and control layout

Follow [layout ownership](../compositions/form-layout.md#layout-ownership): wide page forms default to horizontal labels, narrow Modal/Drawer forms to vertical. Record mandatory `formLayout` and a concrete `layoutReason` for exceptions before generation. `verify_forms.py` checks explicit native layout and width ownership even without Grid expectations. Align native descriptions/errors with controls; verify actual geometry instead of inheriting template label spans.

For a single horizontal field, prefer native content-sized label columns (`labelCol.flex="none"`, `wrapperCol.flex="1"` in the installed contract). Do not reserve a fixed label width for an absent Tooltip or a template's longer fields. Multiple stacked fields may share a label width to align their controls; choose that width from their actual longest label, required indicator, punctuation and configured Tooltip. Left-aligned fixed-width labels leave unused space after the colon, so verify the rendered colon-to-control distance instead of accepting the column width alone. Preserve native label punctuation/spacing; do not compensate with empty nodes, negative margins or internal component CSS overrides. Measure normal, required, configured/empty Tooltip and validation-error states after save/reopen.

## Simplified and advanced modes

The registered default mode is `simplified`. Editable Form.Item children require `data-props='{"mode":"advanced"}'` on Form. Without this setting the runtime renders formItems and can leave authored children hidden behind default Name/Message/Submit fields. The Form.Item inventory gate therefore requires effective advanced mode; it cannot verify a simplified field schema by scanning children. For simplified forms verify the actual formItems/dataFormItems contract and runtime separately. Read the actual mode, formItems/dataFormItems and children contract. Simplified configuration and advanced editable Item nodes express the same business fields through different editing paths; do not maintain a second set of values or duplicate field labels/controls in both. Choose the mode needed for the actual field composition. A mode conversion preserves names, rules, values, submission and interactions, and must be reread rather than assumed from its visual result.

## Form.List and Form Field Group

Form.List owns an array field and its repeated Item children. Read its name/initialValue and registered add(defaultValue, insertIndex), remove(index) and move(from, to) ref actions. The repeated field context and relative Item names form the actual nested path. Keep stable repeated-node identity separate from the current array position; do not store a static index in every copied row or bind each child to a second page-level value.

Form Field Group is this wrapper's named path grouping helper, not an invented Antd static Form.Group API. Its name prefixes its children through the real group context; it does not introduce another Form or submission owner. Both helpers are maintained here rather than in separate component files.

Verify adding an empty/defaulted row, editing distinct rows, removal from the middle, moving rows when used, nested groups and the actual submitted array/object. Values, validation errors and labels must stay attached to the intended record. Group/list actions obey the same disabled/submission policy as the owning Form. Check repeated fields after save/reopen and in hidden Tab/overlay branches.

## Conditional and dependent fields

Use the registered dependencies/shouldUpdate, hidden, preserve and noStyle contracts according to the actual Form mode. Decide whether each field remains valid, is cleared or is excluded from the payload when its prerequisite changes. A visually collapsed valid field still belongs to the form; an inapplicable hidden field must not block submission unexpectedly. Do not infer backend omission from CSS hiding or overwrite edited values when remote options arrive.

For dependent choices, preserve still-valid values and remove invalid ones under the requirement's policy. Test both directions of each condition, dependencies changing after edits, hidden validation errors, reopening another record and nested list paths. Use [step-form composition](../compositions/step-form.md) only when the workflow actually has stages.
