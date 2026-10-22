# Admin composition policy and source-backed exceptions

Applies to the supported Overseas/Antd6 admin prototype workflow. Registered defaults describe component behavior; the owning component references define the required generation baseline. A configurable Prop is not permission to change that baseline. Keep these rules out of SKILL.md and do not change component runtime defaults to enforce a prototype convention.

## Protected configuration

Before composition, use the owning references: [SearchForm](../libraries/overseas/components/search-form.md#页面生成), [ActionGroup](../libraries/react_ui/components/action-group.md), [Dropdown](../libraries/antd_v6/components/dropdown.md), and [AppShell context](../libraries/overseas/components/app-shell.md#app-source-context).

Keep their protected layout/interaction defaults unless the owning reference defines another supported mode or the current user/authoritative source explicitly requires an exception. Interpret visual evidence through [visual sources and component rules](../requirement-alignment.md#visual-sources-and-component-rules); a draft's appearance alone is not an explicit override. Do not optimize them to fit available space, a long placeholder, the number of actions, a screenshot inspection or the current generated output. Data, labels, enum options, permissions, routes and measured labelWidth still follow the requirement; they are not frozen to example defaults. Existing scene rules such as headerless Tabs/Card composition also remain mandatory even when a component has default demo Slot content.

SearchForm's [column decision](../libraries/overseas/components/search-form.md#布局与状态) uses four columns (`colSpan=6`) by default. A visual draft with multiple three-column field rows selects its supported three-column mode (`colSpan=8`); a single row of three fields does not. Other visual column counts are ignored and use four columns. Only explicit requirement-document evidence permits another grid value or Item span exception. Record the selected 6/8 mode in the existing component props/source and reference-region decision, without an override for a regular mode. The checker validates those native values and field inheritance; it does not infer the draft's row/column structure from a declaration.

Use the same task-local `components` inventory, real prop names and native ownership. A necessary exception adds `overrides` under that component, keyed by the exact native property path:

```json
{
  "props": {"colSpan": 12},
  "overrides": {
    "colSpan": {
      "reason": "The requirement document explicitly requires two query columns",
      "evidence": {
        "path": "/absolute/requirements.md",
        "sha256": "SHA256_OF_THE_ACTUAL_FILE",
        "quote": "筛选区每行2列。"
      }
    }
  }
}
```

The checker reads the real file and exact excerpt, verifies its hash and recognizes explicit native property/value constraints or the supported equivalent layout wording. A citation saying only “keyword search” cannot approve span12. State the real requirement, not a statement authored afterward to justify output. If a genuine source decision cannot be represented by the bounded checker, report that concrete limitation; do not edit the source quote or weaken the gate. Source meaning and source conflicts still require review.

`verify_selection.py` checks the policy before writes; `verify_structure.py` checks the saved values independently of the proposed `props`. Updating `props` to match wrong output cannot authorize an exception. Requirement evidence is included in the unified runner's pinned inputs; source changes invalidate the review.

## App context inventory

Every planned standalone shell declares `appContext.required` with exact source evidence. App 来源, App Source, app_source, appSource, appId/app_id/application_id, app_name, 应用标识/应用名称, multi-App requirements and equivalent application identifiers trigger context review. Review whether they identify distinct working Apps rather than merely mentioning an application's display title. Excluding a business filter or form field does not remove the global App selector. An explicit current instruction disabling the top-level switcher is a separate exception.

For a required context, record `shell`, the actual shared `binding`, `consumers` and cases. A consumer uses its native `nodeName` and `property`; `kind` is data/create/export/navigation as applicable. For data-query-driven controls, `queryName` selects the actual native query whose arguments carry the context. Use native implicit AppShell.appSource state when its live state contract fits; do not add redundant callbacks around that native state. Otherwise wire the existing page/host context through the real appSource/onAppSourceChange contract. Cross-page persistence needs the actual supported router/host contract and a navigation case, not a claim based on local shell state.

```json
{
  "appContext": {
    "required": true,
    "evidence": {"path":"/absolute/requirements.md","sha256":"FILE_HASH","quote":"app_source 由 App 入口带入。"},
    "shell": "AppShell",
    "binding": "$state.appSource",
    "consumers": [
      {"nodeName":"Results","property":"data","kind":"data"},
      {"nodeName":"CreateForm","property":"initialValues","kind":"create"},
      {"nodeName":"ExportForm","property":"onFinish","kind":"export"}
    ],
    "cases": []
  }
}
```

This is an inventory shape, not a passing plan: fill cases before preflight. When the source has no App dimension, `required:false` still needs evidence; do not pass an empty options array to make a missing required control disappear. Do not copy demo App options or fabricate a second authorized App. Record unsupported or single-App switching cases honestly.

## Business actions and transitions

Every full Page with row-actions declares `actionContracts` by native owner and action key. Each contract contains source `evidence`, explicit `confirm:true/false`, `transitions:[]` or source-derived transitions `{from,to,text}`, and `cases`. An omitted confirmation/transition decision is not an approved negative. Distinguish metadata edits from SQL edits, current state from ever-enabled history, and role permission from record/market scope. Resolve conflicting sources before implementing that branch; do not disable all editing as a shortcut.

Use one source-derived status dictionary for key, display text and Badge mapping, and one transition table for actions. Initial selection and re-enable selection are distinct states. A retry's target depends on its originating failure state. Tests cover every declared transition, including its displayed text; a correct Badge identity does not prove those transitions.

Derive permission-allowed/permission-denied cases through [permission generation and acceptance](permissions.md): permitted non-administrator roles need positive cases; a denied fixture needs a real role or data-scope restriction. Case kinds alone cannot validate the matrix or execute its context/guards. Confirmed actions also need confirm-cancel and confirm-accept; transition actions need a state-transition case for every declared `{from,to,text}`. Test cancel before mutation, confirmation exactly once and current permissions/state at submission. All active keys, including More, need source coverage; dynamic items cannot receive a static confirmation pass from confirm=true alone.

## Business outcome cases

Before generation, trace each source-defined calculation, generated value, conflict rule, permission guard and data mutation from **input → rule → observable output**. Keep this in the existing component `purpose`/`source`, native `bindings` and `runtimeCases` or action/context `cases`; do not add a second business-rule schema. Source review must check rule coverage, not only field/action counts. A statement such as “automatically generated, globally unique” needs input dependencies, the actual generation/validation behavior and result cases; copying it into help text or applying only `required` does not satisfy it.

Implement with the verified field/state/ref/event contract. Read current business inputs when the action executes; do not replace a required dependency with a constant/example value. Preserve source-defined formats, fixed segments, dates/time zones, rounding and scope. Apply the same specified behavior across generation, regeneration, copy and manual submission where required. Inspect the saved handlers/bindings for those dependencies, but string presence alone does not prove the calculation.

In existing cases, `given` records real setup, input values, selected record/context and repeated operations; it does not execute them. Derive `checks` independently from the source before observing output. For a derived value, use two inputs producing different expected results; test relevant boundaries/collisions, including repeated actions on the **same original record**, not only copying an already-created copy. Recheck manual edits and commit guards. Assert the resulting field values, specific records/counts, transitions and unchanged data on rejection. A success Message is additional feedback evidence, never the sole assertion for a data effect.

### Native assertion examples

The following **case fragment** illustrates an assumed source: live total = quantity × unit price, displayed in a read-only textbox to two decimals; copying ITEM-001 twice allocates ITEM-002 and ITEM-003. These are fixture rules, not platform defaults or rules for another requirement. Supply each case's real source `evidence` (or inherit it within an action contract), native owners and complete Page inventory before preflight; use the [runnable format example](../libraries/antd_v6/selection.md#runnable-plan-format-and-mechanical-preparation) for the envelope.

```json
[
  {"id":"total-three","kind":"derived-value","nodeName":"AmountForm","given":{"quantity":3,"unitPrice":"12.00"},"checks":[{"kind":"value","role":"textbox","name":"合计","value":"36.00"}]},
  {"id":"total-four","kind":"derived-value","nodeName":"AmountForm","given":{"quantity":4,"unitPrice":"12.00"},"checks":[{"kind":"value","role":"textbox","name":"合计","value":"48.00"}]},
  {"id":"copy-original-twice","kind":"repeat-action","nodeName":"RowActions","given":{"records":["ITEM-001"],"copySource":"ITEM-001","copyTimes":2},"checks":[{"kind":"count","role":"row","count":4},{"kind":"count","role":"cell","name":"ITEM-002","count":1},{"kind":"count","role":"cell","name":"ITEM-003","count":1}]}
]
```

The row count assumes one visible header plus three data rows in this isolated table fixture. Derive counts from the actual component/fixture. `checks.value` is a string. Use current snapshot roles/names; `nodeName` identifies the planned owner and does **not** scope a DOM assertion. Resolve ambiguous/hidden/virtualized content through the real UI, not diagnostic controls added to the business page. Native assertions support exact text/value/count/visibility, not arbitrary regex, uniqueness or arithmetic operators: choose concrete expected results for each fixture. Do not insert unsupported assertion fields or weaken expectations to match output. Preserve setup and observations when an outcome cannot be asserted; report it unverified.

A prototype implements executable behavior within its declared data scope. It can detect collisions among available records and reject conflicts; true global uniqueness, concurrent writes, authorization and external jobs require the real service. Missing service access is a reported boundary, not permission to omit local calculations/guards or claim global acceptance. Keep live execution in the [Preview review](../workflows/prototype.md#final-preview-review); native trace matching verifies executed assertions, not the completeness of the source-derived cases.

## Native runtime evidence

### Plan fields and case kinds

These are fields of the **existing structure inventory**, not an additional checklist or component API. Generate a runnable complete format example with the [selection preparation helper](../libraries/antd_v6/selection.md#runnable-plan-format-and-mechanical-preparation); the fragments below illustrate individual decisions only.

| Native location/key | Shape and meaning |
| --- | --- |
| Root `pages` | Array of Page objects; each has exact absolute route `path` and native `components` inventory. A fragment without `path` is not a full Page preflight. |
| `components[*]` | `nodeName`, registered `component`, semantic `role`, source-derived `purpose`, citation `source`, resource-relative `rule`; existing native `props`, `dynamicProps` and `owner:{nodeName,slot}` constrain the same model. Use the selection decision table for exact roles. |
| `templates` | Existing template selections/capture evidence; see [template sources](../admin-templates.md#source-evidence-before-composition). No-fit uses `templates:[]` plus a source-reviewed `templatesNotApplicable`, never an omitted read. |
| `feedback` | Array, including `[]` if no operation feedback. Entries need `nodeName`, native `event`, `kind:transient/asynchronous`, `source`, `success`, `failure`. |
| `appContext` | `required` is boolean and `evidence` is mandatory for a shell. When required: native `shell`, shared `binding`, consumer array `{nodeName,property,kind}` and `cases`. |
| `actionContracts[*]` | Native action-owner `nodeName`, action `key`, `evidence`, **boolean** `confirm`, **array** `transitions`, nonempty `cases`. No-confirm/no-transition decisions are `false` and `[]`, not omitted values. |
| `transitions[*]` | Exact source state `from`, target state `to`, displayed `text`; each needs a matching case `transition` object and target-text assertion. |
| A runtime case | Nonempty Page-unique string `id`, string `kind`, native owner `nodeName`, nonempty `given` preconditions, nonempty `checks` array; source `evidence` unless inherited from context/action owner. |
| Case `assertPath` | Optional exact local Preview destination path for a cross-page result. Defaults to the owning Page path. Plan it from the required navigation before execution; it is not a manifest override. |
| Source `evidence` | Existing absolute UTF-8 file `path`, SHA-256 of its real bytes `sha256`, exact nonempty verbatim `quote`. Citation text alone is not this object. |
| `checks[*].kind` | Native Preview assertion type: **`text`, `visible`, `count`, `value`** only. Its remaining fields follow the live Preview contract. Business case kinds such as `page-change` do not belong here. |

Case `kind` describes the scenario; `checks[*].kind` describes an assertion. They are distinct. Gate-required scenario spellings are:

| Owner/behavior | Required `case.kind` values |
| --- | --- |
| Each action contract | `permission-allowed`, `permission-denied` |
| Confirmed action | Additionally `confirm-cancel`, `confirm-accept` |
| Declared state transition | `state-transition`, with one matching `transition:{from,to,text}` and text check per declared transition |
| Query owner | `query`, `reset` |
| Every pagination owner | `page-change`; separate cases can cover first/second/return. **`pagination` is a component role, not this case kind.** |
| Adjustable page size | Additionally `page-size` |
| Required global context | `app-switch` on the shell; `context-data`, `context-create`, `context-export`, `context-navigation` for the corresponding consumer kinds |

These spellings are required coverage, not a closed enum for every business scenario. Add source-required failure, recovery, feedback appearance/dismissal and other cases without replacing the mandatory kinds. IDs distinguish separate fixtures/branches of the same kind. Do not invent aliases or extra parallel case collections. The helper can assign IDs and copy reviewed shared actions; it cannot determine `given`, expected effects, permissions, source meaning or whether an assertion observes the right row.

Cases live in `runtimeCases`, `appContext.cases` or `actionContracts[*].cases`, with unique IDs per Page. Context/action cases inherit their owner's evidence. Each case declares `id`, `kind`, `nodeName`, `given` preconditions and native Preview `checks`; standalone cases also declare source `evidence`.

```json
{
  "id":"enable-from-inactive",
  "kind":"state-transition",
  "nodeName":"RowActions",
  "given":{"role":"administrator","status":"INACTIVE","appSource":"SOURCE_FROM_REQUIREMENT"},
  "transition":{"from":"INACTIVE","to":"RE_SELECTING","text":"重新启用圈选中"},
  "checks":[{"kind":"text","text":"重新启用圈选中","present":true}]
}
```

The states above illustrate a requirement-derived transition, not a universal lifecycle. Add separate failure-retry, permission and cancellation cases for the current requirement. Query owners require query/reset cases; exercise collapse/expand when applicable. Every pagination owner requires page-change cases, even with a fixed pageSize; a visible size changer or multiple/dynamically defined page-size options additionally requires page-size cases. Follow [Table paging data and acceptance](../libraries/antd_v6/components/table.md#pagination-test-data-and-acceptance) for fixture readiness and first/second/return record assertions; declared cases alone do not prove enough visible records. Required context needs app-switch plus context-data/create/export/navigation cases for its listed consumers. Feedback must be observed appearing, then dismissed, including error paths; absence alone is not a successful feedback case.

Run actual Preview cases only after all in-scope content and saved-model gates pass. Collect a round's issues before repairs, close Preview before edits, and retain the shared maximum of10 opens/review rounds. Crash/vanished UI can end a round early; a single failed assertion cannot. Capability probes and temporary TestHarness Pages do not belong in business prototype work.

Use [runtime evidence preparation and verification](../behavior-acceptance.md#record-and-verify-execution) for the existing manifest, exact-model trace matching, cross-page outcomes and per-case results. This executes no Preview actions and does not establish source completeness or fixture authenticity.
