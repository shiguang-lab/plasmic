# Purpose-first component selection

Applies to the Overseas / Antd6 / React UI admin suite. Classify the requirement's purpose before choosing or discovering a component. A screenshot, installed template or already-generated component is not its own justification. Read the linked decision owners for every applicable row, then the chosen component's live contract. A link in a document is not evidence that the target rule was read.

## Decision routes

| Source purpose / inventory role | Selection and rule owner | Distinction to review |
| --- | --- | --- |
| Standalone navigation shell / `shell` | [AppShell](../overseas/components/app-shell.md) | One shell; host ownership and viewport/scroll sizing |
| Query criteria / `query` | [SearchForm](../overseas/components/search-form.md) | Filters versus submitted business fields; row density, labels, collapse and applied query |
| Submitted business fields / `submitted-form` | [Form](components/form.md) | Native Item ownership, validation, defaults and submission; standalone Inputs are insufficient |
| Read-only attributes / `read-only-group` | [Descriptions](components/descriptions.md) | Informational groups versus editable Forms or repeated Table records |
| Repeated records / `data-table`, `pagination` | [Table](components/table.md), [Pagination](components/pagination.md) | All Columns inventoried; one native pagination owner and fixed row actions |
| Content scopes / `content-scope` | [Tabs](components/tabs.md) | Tabs own content; not a Radio/Select field value |
| Choose a field value / `field-choice` | [Radio](components/radio.md), [Select](components/select.md), [Segmented](components/segmented.md), [Checkbox](components/checkbox.md) | Required cardinality, searchability, values and Form/SearchForm ownership |
| Daily clock time or time range / `widget` | [TimePicker](components/time-picker.md), [field semantics](#field-semantics) | Clock time versus dated instant or duration; native picker and value conversion |
| Calendar date, dated time or date range / `widget` | [DatePicker](components/date-picker.md), [field semantics](#field-semantics) | Date-only versus date-and-time; range endpoints, supported showTime and timezone |
| Free numeric quantity / `widget` | [InputNumber](components/input-number.md), [field semantics](#field-semantics) | Numeric quantity versus identifier or finite choice; units, precision and empty versus zero |
| Free text or textual identifier / `widget` | [Input](components/input.md), [field semantics](#field-semantics) | Text semantics, leading zeros and actual secret/multiline/code requirements |
| Lifecycle/processing state / `status` | [Badge](components/badge.md) | Status preset plus readable text; a Table status Column uses a Badge render template, not tag display |
| Category/attribute / `category` | [Tag/text selection](components/tag.md#tag-or-text) | Category meaning does not require a Tag; default ordinary single values to text and preserve the source presentation |
| Count/dot / `count` | [Badge](components/badge.md) | Count/dot is distinct from text status; meaningful zero and overflow |
| Record operations / `row-actions` | [ActionGroup](../react_ui/components/action-group.md) | Real record/permission guards, folding, confirmation, fixed-right owner |
| Action menu / `action-menu` | [Dropdown](components/dropdown.md) | Menu keys/events versus Select values; source-defined grouping and native trigger Slot |
| Short operation result / `feedback.kind:transient` | [Feedback selection](compositions/action-bars.md#feedback-and-row-confirmation), [ConfigProvider](components/config-provider.md) | Real Message global action; no persistent page Alert or layout shift |
| Longer asynchronous notice / `feedback.kind:asynchronous` | [Content states](compositions/content-states.md), [ConfigProvider](components/config-provider.md) | Notification has a justified lifetime/context; task submission acknowledgment remains transient |
| Continuing regional condition / `persistent-feedback` | [Alert](components/alert.md) | Record the continuing condition, removal/recovery policy; not the last operation result |
| No data / `empty-content`, loading / `loading`, substantial page outcome / `page-result` | [Content states](compositions/content-states.md) | Empty, Spin/Skeleton and Result are different conditions; do not disguise failures as empty |
| Brief non-input confirmation / `confirmation` | [Popconfirm](components/popconfirm.md), [Modal/Drawer selection](compositions/modal-drawer.md) | Row anchor versus source-required substantial impact review; never an immediate destructive click |
| Overlay input / `overlay-form`, overlay content / `overlay-information` | [Modal/Drawer](compositions/modal-drawer.md) | Native Form inside input overlay; real trigger, default footer, close and focus contracts |
| Shared business surface / `surface` | [Card](components/card.md), [query/list composition](../overseas/compositions/search-table.md) | Justify background/edge ownership; do not wrap every region, already-surfaced SearchForm or Steps |
| Supplemental help / `help` | [Tooltip](components/tooltip.md), [Popover](components/popover.md), [Form label help](components/form.md#label-help) | Required constraints stay visible; field help belongs to Item; no interactive Tooltip |
| Navigation / `navigation`, staged workflow / `workflow-progress` | [Menu](components/menu.md), [Breadcrumb](components/breadcrumb.md), [Steps + Form](compositions/step-form.md) | Routes/content navigation versus a field choice; Steps don't own business validation |
| Other functional widgets / `widget` | The actual component document from [catalog](catalog.md) | Read its applicability, defaults, Slots, state/events and acceptance; widget cannot bypass a specific role above |

## Field semantics

For each editable Form, SearchForm or standalone field, derive the value's meaning from the requirement before choosing its control. A string payload, a rectangle in a design draft or a formatted sample such as `18:00:00` does not justify Input. Use the existing `components` declaration's `purpose`, `source`, `component`, `rule`, native props and owner; do not introduce another field schema.

- A daily cutoff such as `18:00:00` is a wall-clock time: use TimePicker with the required hour/minute/second precision. A dated appointment needs DatePicker with supported time selection; a date-only field does not. A duration such as 36 hours is a quantity with units, not a clock time.
- Use InputNumber for freely entered quantities. Numeric-looking identifiers, telephone numbers and codes remain text when formatting/leading zeros carry meaning. A finite set of retention-day options remains Select/Radio even though its values are numbers.
- Preserve explicit user control choices and source-required specialized interactions. Record their rationale in the same purpose/source fields. If the installed picker cannot satisfy a required value/event contract, record the exact capability gap and unresolved behavior; do not silently replace it with Input or invent props. A screenshot's input-like appearance alone is not an explicit choice of Input.

Before generation and during either review mode, compare each field's planned control with the original source, then compare the actual saved component with that plan. An incorrect Input in both plan and output is still a selection failure. Static checks establish identity/ownership and declared props, not semantic correctness. In Preview exercise the real picker or numeric interaction, initialization, changed value, invalid/empty handling and reset/reopening as applicable; inspect the submitted/query payload as well as the displayed value. Retain these cases in the existing runtime evidence, not a second checklist.

## Existing inventory, independent expectations

Derive expectations from the source before generation, then check output against them using the workflow's [review mode](../../review-mode.md). The reviewer also checks the inventory against the original source for omissions.

Extend the existing structure inventory's `components`; do not introduce a second prop schema or copy the generated model into the expectation. Each declaration records `nodeName`, actual `component`, semantic `role`, source-derived `purpose`, `source` citation and `rule` (resource-relative reference path, optionally with anchor). Use the same native `props`, `dynamicProps` and `owner` constraints as the structure gate. Every authored functional instance, including hidden branches, needs a selection. Ordinary layout, icons and registered child Items are covered by their owner/Slot/field inventories. A business composition still needs a source purpose and its verified contract.

Resolve [content before presentation](../../requirement-alignment.md#content-before-presentation) first. For SearchForm, include every required SearchForm.Item in `components` as `widget`, with native `props.name`, its label/labelContent intent, source and `owner:{nodeName:QUERY_NODE,slot:"children"}`; declare the contained value control separately under its actual role. Keep Form/Descriptions fields in their existing dedicated inventories and every result Column in components. Compare business keys and ownership, not just instance counts: replacing one required field with another is still incomplete. Layout choices cannot reduce this source-derived set.

`surface` and `persistent-feedback` additionally record `condition`: why this background or continuing condition exists. Do not justify an Alert as “display the last successful/failed operation.” Pin every Table Column's source field meaning; a status Column and its Badge both use `role:status`. Ordinary non-category text Columns use widget; category Columns keep category whether displayed as text or Tag. Declare their native props.displayType as text, tag or custom before markup; purpose/source records the presentation decision and its visual/requirement basis. For custom Tag presentation declare the registered Tag under the actual Column.render owner chain; custom text needs no Tag node. A paginated Table uses pagination; an unpaged Table uses data-table.

Record per-event operation feedback on each Page, independently of generated handlers:

```json
{
  "components": [
    {"nodeName":"StateColumn","component":"plasmic-antd6-table-column","role":"status","purpose":"Lifecycle state","source":"requirements §States","rule":"references/libraries/antd_v6/components/badge.md","props":{"dataIndex":"state","displayType":"custom"}},
    {"nodeName":"StateBadge","component":"plasmic-antd6-badge","role":"status","purpose":"State text and semantic dot","source":"requirements §States","rule":"references/libraries/antd_v6/components/badge.md","owner":{"nodeName":"StateColumn","slot":"render"}}
  ],
  "feedback": [
    {"nodeName":"RowActions","event":"onAction","kind":"transient","source":"requirements §Actions","success":"After confirmed mutation, actual row changes and one success Message dismisses without moving content","failure":"Rejected or failed mutation leaves the row unchanged and shows one error Message"}
  ]
}
```

The fragment is not a complete Page. Declare `feedback:[]` when there are no operation-result events. Read-only navigation, native field validation and continuing regional conditions retain their own contracts. Add event owners/branches for actual mutation/submit/copy/export outcomes, not every click. Read the provider's [qualified action calls](components/config-provider.md#feedback-action-calls), not just the parameter names. Message/Notification are not insertable widgets. An unavailable or miscalled action is a contract problem to resolve, not permission to draw a Toast. Runtime acceptance first proves feedback appears, then its dismissal/recovery; testing absence alone is insufficient.

## Preflight and acceptance

Each Page declares its [template selection and live-source evidence](../../admin-templates.md#source-evidence-before-composition) in the existing structure inventory. Missing selections/reads fail full selection preflight. A source-reviewed no-fit decision uses explicit empty selections; directory-only reading, missing installation and different sample fields do not establish that decision.

Before composition also complete [authored names and UI copy](../../design/content-review.md): functional names reuse `components`; `nodes` covers other authored nodes; `copy.entries` reviews every UI text/binding at its native location. Full Page preflight requires these declarations, and readback checks both missing and unexpected content. Format matching does not replace source interpretation.

Before markup, run `python3 scripts/verify_selection.py structure-expectation.json --report selection-plan.json`. This rejects incompatible declared roles and generic widget escape hatches; it does not understand source prose. Independently review source meaning, missing roles, reference coverage and success/failure expectations before accepting the plan. Amend expectations only for source evidence or a user decision, never to fit output or clear a failing check.

### Runnable plan format and mechanical preparation

Use [prepare_plan.py](../../../scripts/prepare_plan.py) instead of assembling another plan schema or repeatedly patching a task-specific Python builder. It reads/writes the existing structure inventory; it never generates a prototype, infers permissions or executes Preview. The [native field/key reference](../../design/component-policy.md#plan-fields-and-case-kinds) defines the input shape. Do not target a fixed number of actions/cases or pad a plan to match an example; derive coverage from the current source.

When the native plan format is unfamiliar, generate the complete **input-format fixture**, then exercise the same full-Page preflight used for a real plan. Skip this demonstration when the task already has a valid plan:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py example /task/plan-format-example
python3 RESOURCE_ROOT/scripts/verify_selection.py /task/plan-format-example/structure-expectation.json --report /task/plan-format-example/preflight.json
```

The new directory contains an illustrative source and compact JSON with real paths/hashes/excerpts, native owners, feedback, query/reset, first/second/return paging, page-size and action cases. Its [permission example](../../design/permissions.md) distinguishes viewing allowed to all three roles, administrator-only mutation and a separate unauthorized-market boundary; cancellation/confirmation checks observe records as well as feedback. Preflight validates format, not source meaning or execution. The command creates no saved model or runtime evidence. Its template non-applicability is **only for this local fixture**; do not copy it or its source decisions into business tasks, which still [select/read live templates](../../admin-templates.md#source-evidence-before-composition).

For a real task, write source decisions directly into its native JSON and use the helper only for mechanical work:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py evidence /absolute/requirements.md --quote 'Exact text from the actual source'
python3 RESOURCE_ROOT/scripts/prepare_plan.py ids /task/structure-expectation.json --output /task/plan-with-ids.json
python3 RESOURCE_ROOT/scripts/prepare_plan.py clone-actions /task/plan-with-ids.json --page /groups --from-owner AllRowActions --to-owner MyRowActions --output /task/plan-with-shared-actions.json
```

`evidence` emits only a native path/hash/quote and rejects non-verbatim text. It does not refresh old evidence after a requirement changes; reread and review the decision first. `ids` fills missing/duplicate IDs across the Page's existing case arrays, preserving unique IDs, the first duplicate occurrence and all business fields. Plan-edit commands refuse existing outputs and leave inputs untouched.

Use `verify_selection.py PLAN --page /exact-route --report REPORT` for the current Page while siblings are still being prepared; omit `--page` for the complete preflight. Keep shared source scope/navigation decisions in the same inventory. After saved-output capture, `prepare_plan.py runtime-manifest` prepares the existing [runtime evidence index](../../design/component-policy.md#native-runtime-evidence) with real file hashes and all case IDs, leaving every execution unclaimed. It does not generate expected results or infer matches from coincidentally identical assertions.

`clone-actions` is appropriate only when two already-declared row-action owners share the same reviewed rules. It copies contracts, updates their native owner/case nodeName and assigns new IDs without rewriting source excerpts, fixture values, selectors or other nodes. It rejects duplicate action keys, conflicting target contracts and invalid owners/IDs. Review target scope, row fixtures and native assertions before preflight; different permission/state behavior needs its own source-derived cases. Context/action cases inherit owner evidence, so do not repeat it per case unless the source differs. No parallel coverage document or generated prop schema is needed.

With `--report`, selection preflight saves every error and prints counts by check, at most eight representative diagnostics and the report path. Diagnostics retain the Page route, native owner/action key when applicable, JSON `pointer`, and missing/allowed fields or values. Related pointers identify duplicate cases across native arrays. Read the complete batch on disk before repairs; bounded console examples do not mean omitted errors are waived. Inspect only the needed fragment rather than dumping the whole plan/report:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py show /task/selection-plan.json --pointer /errors
python3 RESOURCE_ROOT/scripts/prepare_plan.py show /task/structure-expectation.json --pointer /pages/0/actionContracts/3
```

Use an individual `/errors/N` for a large batch. A pointer to a missing field identifies where to add it; inspect its parent object. Malformed JSON reports its file, line and column. `--full` explicitly prints the complete report; without `--report`, full diagnostics remain on stdout. After applying the collected repairs, rerun plan-only preflight before any live capture. Keep full inputs/reports on disk and reuse unchanged source/model evidence through the existing verification workflow.

After generation run the same command with the full Page readback as its second argument. The unified verifier includes this check in its mandatory structure gate. It catches unreviewed functional instances, wrong identities/status renderers, category text/Tag substitutions against the planned native props/render owners and missing expected provider-feedback wiring. It does not judge whether source semantics justify a Tag or inspect CSS/execute JS: review presentation against the draft, and a string match or an action in dead code is not proof of feedback. Form, SearchForm, Descriptions, overlay, Slot, geometry and native prop checks remain required.

Review the complete error batch before repairing. Invalid role/purpose metadata is reported alongside selection findings; use the named node, allowed roles and rule owner to correct the source interpretation. Do not repeatedly regenerate screenshots or rerun live capture to guess enum values. Rerun plan-only preflight first; reuse the pinned model evidence for static diagnostics when its fingerprint is unchanged.

For each applicable decision row, retain three distinct results in the task report: saved-model checks, opened-pixel observations and executed runtime cases (including negative/recovery cases), followed by fresh saved/reopened readback. For controls check actual value/event payload and reset; for scopes check both directions/inactive content; for feedback check its type, text, dismissal/recovery and content geometry; for overlays check actual trigger/footer/close/focus. Unexecuted or unsupported checks remain unverified. Never convert “read the reference,” “component exists,” “script passed” or “screenshot captured” into a claim that all component rules were followed.
