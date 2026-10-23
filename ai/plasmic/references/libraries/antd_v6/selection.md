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
| Lifecycle/processing state / `status` | [Badge](components/badge.md) | Status preset plus readable text; a Table status Column renders a Badge, not a Tag |
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

`surface` and `persistent-feedback` additionally record `condition`: why this background or continuing condition exists. Do not justify an Alert as “display the last successful/failed operation.” Pin every Table Column's source field meaning; a status Column and its Badge both use `role:status`. Ordinary text Columns use widget; category Columns keep category for text or Tag display. Declare their native props.displayType as text or custom before markup; purpose/source records the presentation decision and its visual/requirement basis. For Tag presentation declare the registered Tag under the actual Column.render owner chain; text needs no Tag. A Column whose dataIndex/title names a status/state/状态 field uses role:status or records why not in nonStatusReason. A paginated Table uses pagination; an unpaged Table uses data-table.

Record per-event operation feedback on each Page, independently of generated handlers:

```json
{
  "components": [
    {"nodeName":"StateColumn","component":"plasmic-antd6-table-column","role":"status","purpose":"Lifecycle state","source":"requirements §States","rule":"references/libraries/antd_v6/components/badge.md","props":{"dataIndex":"state","displayType":"custom","width":128}},
    {"nodeName":"StateBadge","component":"plasmic-antd6-badge","role":"status","purpose":"State text and semantic dot","source":"requirements §States","rule":"references/libraries/antd_v6/components/badge.md","props":{"options":[{"value":"ACTIVE","label":"启用","status":"success"},{"value":"INACTIVE","label":"停用","status":"default"}]},"owner":{"nodeName":"StateColumn","slot":"render"}}
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

Before markup, follow [Page planning](../../planning.md): scaffold the declarations, decide every pending value, read the compose rules card and run `verify_selection.py PLAN --page ROUTE --reads LEDGER --report REPORT`. Preflight rejects incompatible declared roles, generic widget escape hatches and pending decisions; it does not understand source prose. A failing report blocks composition. Independently review source meaning, missing roles, reference coverage and success/failure expectations before accepting the plan. Amend expectations only for source evidence or a user decision.

After generation run the same command with the full Page readback as its second argument. The unified verifier includes this check in its mandatory structure gate. It catches unreviewed functional instances, wrong identities/status renderers, category text/Tag substitutions against the planned native props/render owners and missing expected provider-feedback wiring. It does not judge whether source semantics justify a Tag or inspect CSS/execute JS: review presentation against the draft, and a string match or an action in dead code is not proof of feedback. Form, SearchForm, Descriptions, overlay, Slot, geometry and native prop checks remain required.

Repair through the [diagnostic loop](../../planning.md#diagnostics-and-repair); reuse pinned model evidence for static diagnostics when its fingerprint is unchanged.

For each applicable decision row, retain three distinct results in the task report: saved-model checks, opened-pixel observations and executed runtime cases (including negative/recovery cases), followed by fresh saved/reopened readback. For controls check actual value/event payload and reset; for scopes check both directions/inactive content; for feedback check its type, text, dismissal/recovery and content geometry; for overlays check actual trigger/footer/close/focus. Unexecuted or unsupported checks remain unverified. Apply [evidence integrity](../../verification.md#evidence-integrity): reading, existence, script and screenshot results do not establish that component rules were followed.
