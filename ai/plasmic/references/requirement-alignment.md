# Requirement alignment

Use before requirement-driven generation, regeneration or an audit of page/navigation scope. The source inventory is a task artifact, not another component prop schema and not UI content.

Keep business-specific page counts, entity names, routes, menu trees, field dictionaries and approved layout decisions in that task's inventory. Do not promote them into this skill's defaults or add branches keyed by a requirement ID. Examples illustrate a mechanism only; a new requirement must produce a new inventory from its own sources. Select design rules for the actual product/platform and [component library](libraries/index.md); do not force the current admin or Antd-v6 defaults onto another scope.

## Source and scope

Read the current requirement body and its page/navigation, field, permission and workflow sections. Record file/URL, version/date and section anchors. Apply explicit current user decisions first, then current requirements for business scope and behavior. For presentation, preserve approved design evidence; use applicable library/composition defaults for unspecified details. Explicit project policies such as [admin content entry](design/layout.md#admin-content-entry) state when a reference image alone is insufficient to opt into an exception. Record those adaptations; if the user explicitly requires conflicting exact reproduction, resolve that conflict before the affected edit. Live registered contracts determine what can actually be implemented, not permission to drop a required behavior. History, obsolete screenshots, previous models and generated code are evidence, not authority for current scope. Separate P0/P1/P2 or other release boundaries explicitly.

Record conflicts and their resolution with sources. If a conflict changes business behavior and the current text/user decisions do not resolve it, ask a focused question while continuing independent work. Do not silently select the convenient statement. Visual conventions must not remove required fields, change entry points, permission rules or page ownership.

## Inventory before routes

Create a table with one row per required surface: source section and brief excerpt, purpose, entry/return path, surface kind, shared page identity, type/role/state differences, in-scope decision and proposed route. Classify independent Page, shared-page variant, Tab, Modal/Drawer and overview frame separately. A separate screenshot/frame is not automatically a Page; an overview frame referencing a Page is not a duplicate route.

Declare every Page's `name` in that inventory before generating; directory names and business copy default to Chinese unless the current user specifies otherwise. Declare `page_layout.overviewName` (default 页面总览) in the suite. Follow [directory versus internal-node naming](design/naming.md#project-directory-names); English PascalCase applies to tree nodes, not Page/group labels. Keep routes/registered identities unchanged and do not add an in-page title to display a directory name.

When the requirement says common/shared detail or creation page, represent type differences through supported bindings, conditional nodes and slots in one Page. Different entity types or permissions alone do not justify another route. Conversely, retain separately specified flows with different entry contracts or business behavior even when their screenshots are similar. Record an explicit user-authorized split if one is required. Count routed Pages from this inventory, never from the number of types, screenshots or generated objects.

Derive the complete navigation tree separately: preserve the requirement's exact labels, parent hierarchy, order, visible/hidden status and destinations. Keep action-only routes under their business owner; a hidden creation/detail route does not become a top-level menu. Record role visibility and test it in live preview. Do not rename a product menu to its current implementation technology. If a host supplies navigation, use its verified contract rather than inventing another sidebar.

Before generation, review coverage in both directions: every in-scope requirement has an intended surface/behavior, and every proposed Page/menu/action has a source or explicit user decision. Mark inferred design choices as such. Keep the reviewed expectation separate from the generator's output plan and generated UUIDs. Updating it requires new source evidence or a user decision; a failed check is not a reason to redefine the expected result.

## Presentation, copy and native components

Apply [admin content entry](design/layout.md#admin-content-entry). Record `pageHeader:null`, or an explicit current user exception as `{"nodeName":"EntityHeader","source":"user decision ..."}`. Native region titles remain with their owners.

Before markup, apply [native component selection](libraries/index.md#native-component-selection) and map every required functional widget to its real registration in `components`, `controls` and matching region inventories. Include actions, navigation, pagination, feedback and overlays, not just Table/Form/Descriptions. SearchForm owns filters; Form/Item owns submitted fields and Descriptions/Item owns read-only groups. Each required target must resolve to its declared identity. Region/Slot gates still check field ownership and completeness.

Classify switches by source purpose before recording a component identity. In the Antd-v6 list composition, content-scope navigation follows [Tabs](libraries/antd_v6/components/tabs.md); choosing a field value follows Radio.Group. Record the chosen native identity in components and real content/action Slot owners in the intent. A plan that merely repeats the generated selector has not reviewed this choice; structural identity checks cannot correct a wrongly classified source role.

Plain semantic text, root/Slot containers, genuine navigation anchors and read-only code do not need exceptions. For a widget with a verified contract gap, add optional `elementFallbacks:[{"nodeName":"CustomWidget","reason":"Checked candidates/contracts and concrete unsupported behavior","source":"requirement section + contract evidence"}]` before generation. Name the exact node; exceptions do not cover descendants or override required native identities or other gates. The structure check rejects unreviewed raw controls/tables/dialogs, ARIA widgets and ordinary-element click targets. It verifies exception shape and exact targets, not the correctness of the rationale; independent contract review remains necessary. A native-component failure is not a reason to add an exception just to pass.

Review `copy` independently of output. `source` cites this review, `excluded` records requirement/process sentences that must not appear, and `help` records necessary user-facing instruction owners/text/sources. Keep scope/release notes, API/implementation rationale, permission-matrix explanations, acceptance steps and simulation/debug controls in the task report. Express behavior through actual UI state and concise actionable feedback. Preserve useful field constraints, irreversible-action warnings and failure guidance; do not remove all help text or use a global keyword blacklist.

```json
{
  "pageHeader": null,
  "components": [
    {"nodeName":"RecordsTable","component":"plasmic-antd6-table","role":"widget","purpose":"Required unpaged result region","source":"requirement §Results","props":{"pagination":false}},
    {"nodeName":"EditForm","component":"plasmic-antd6-form","role":"widget","purpose":"Submitted business fields","source":"requirement §Edit"},
    {"nodeName":"Summary","component":"plasmic-antd6-descriptions","role":"widget","purpose":"Read-only business attributes","source":"requirement §Summary"}
  ],
  "copy": {
    "source":"requirement §Fields + reviewed UI-copy decisions",
    "excluded":[{"text":"P0 excludes the AI creation flow","source":"requirement §Release scope; implementation context, not UI copy"}],
    "help":[{"nodeName":"RetentionHelp","text":"Deleting historical partitions cannot be undone.","source":"requirement §Retention"}]
  }
}
```

The structure gate checks required native identities, recognized/unapproved Page-heading structures, declared excluded literal copy and the expected help text/bindings. These are static guards; unnamed visual headings, arbitrary prose meaning and dynamic rendered messages still require image/runtime review. Do not claim that a string scan understands every sentence or that zero generated Forms means no Form was required. Supported controlled tasks require these declarations before their first business write.

For controlled Overseas/Antd-v6 work, components also records role/purpose, native property constraints and Slot ownership as specified in [controlled tasks](prototype-tasks.md#prepare-source-expectations). A source-driven result table can use these acceptance entries (illustrative names and widths; measure the actual operation content):

```json
[
  {"nodeName":"Results","component":"plasmic-antd6-table","role":"pagination","purpose":"Paged matching records with native total","source":"requirement §Results","props":{"pagination":{"defaultPageSize":20,"pageSizeOptions":[20,50,100]}},"dynamicProps":["pagination.showTotal"]},
  {"nodeName":"CategoryColumn","component":"plasmic-antd6-table-column","role":"category","purpose":"Mapped category label","source":"requirement §Category","props":{"dataIndex":"category","displayType":"tag"},"owner":{"nodeName":"Results","slot":"children"}},
  {"nodeName":"ActionColumn","component":"plasmic-antd6-table-column","role":"widget","purpose":"Final fixed operation column","source":"requirement §Actions","props":{"fixed":"right","width":200}},
  {"nodeName":"RowActions","component":"plasmic-react-ui-action-group","role":"row-actions","purpose":"Permission-filtered record operations","source":"requirement §Actions","props":{"max":3},"owner":{"nodeName":"ActionColumn","slot":"render"}}
]
```

Inventory other Columns as well. Props are a partial match against actual native props, including nested objects; dynamicProps paths require actual bindings, not similar sibling text. A custom Tag uses its registered identity and Column.render owner instead of a tag display preset. Record content scopes as content-scope with actual Tabs identity; ordinary field choices remain widget controls. Roles/expected native identities must be independently reviewed before output, and cannot be relabeled just to pass a check. Plain semantic text/layout remains valid.

## Behavior and field matrix

For each required flow, record source, Page/variant, entry trigger, required fields, labels/defaults/enums, editable/read-only behavior, permission gates, state transitions, navigation and observable expected feedback. Use current requirement enums and mandatory fields, with actual registered props/slots/events as the implementation contract. Record mock data/API limitations separately. Test both positive and relevant blocked cases: a hidden list action does not prove its destination is protected; a toast does not prove the expected record changed.

Shared pages must be exercised for every required type, including directly entering the route, switching from different list rows, type-specific field/Tab visibility and the correct return destination. Screenshot acceptance checks both editor and actual preview. Layout checks must include alignment/grouping against the approved design, not only absence of overflow. Record which cases ran and their observations.

## Structural gate

Save a task-local `structure-expectation.json` before generating. It contains all planned Page paths and the full expected AppShell menu tree; give every Page and the navigation a requirement section/excerpt or explicit user-decision citation. Keys/routes are implementation choices; labels/hierarchy/ownership are source-derived. The following fragment illustrates navigation/binding fields only; it is not a complete controlled plan. Use `plan_schema` for all required declarations and derive routes from the source:

```json
{
  "pages": [
    {"path": "/records", "name":"记录列表", "source": "requirement.md §List: browse records", "bindings":[{"nodeName":"RecordsTable","source":"requirement.md §List: record data","props":["data"]}]},
    {"path": "/record-detail", "name":"记录详情", "source": "requirement.md §Detail: one shared detail for both types", "bindings":[{"nodeName":"ReturnButton","source":"requirement.md §Detail: return to list","events":["onClick"]}]}
  ],
  "navigation": {
    "source": "requirement.md §Navigation: Records > Record list; details entered from rows",
    "items": [
      {"key": "records", "label": "记录", "children": [
        {"key": "list", "label": "记录列表", "href": "/records", "children": [
          {"key": "detail", "label": "记录详情", "href": "/record-detail", "hidden": true}
        ]}
      ]}
    ]
  }
}
```

Full-project suites require each Page to declare source-derived `bindings` before generating. A purely static Page declares `bindings:[]` plus a reviewed `bindingsNotApplicable` reason; missing scope fails the full suite. Prop/event presence alone is insufficient for interactive data. Add the following to each affected Page plan, using its actual chosen component and native state paths:

```json
{
  "controls": [
    {"nodeName":"SqlEditor","source":"requirement §SQL editing","component":"plasmic-antd6-textarea","events":["onChange"]},
    {"nodeName":"Expiry","source":"requirement §Validity: 1–365 days","component":"plasmic-antd6-input-number","props":{"min":1,"max":365}}
  ],
  "bindings": [
    {"nodeName":"RecordsTable","source":"requirement §Query results","props":["data"],"dynamicProps":["data"],"propStateDependencies":{"data":["appliedFilters"]}}
  ],
  "rowActions": [
    {"column":"ActionColumn","control":"RowActions","event":"onAction","source":"requirement §Record local actions"}
  ]
}
```

`controls` prevents a required editable control being replaced with a pre/text node and checks declared literal bounds and events. Include only fields that are editable by the source; read-only summaries remain Descriptions inventory entries. Native Forms/Items, read-only groups and required overlays must be inventoried from the source even before they exist in the model. An absent component is a generation failure when its source inventory requires it, not a reason to delete the expectation.

`dynamicProps` requires an expression somewhere in that prop; `propStateDependencies` additionally requires the named `$state` references in the saved prop. This is a necessary syntactic dependency check, not dataflow analysis: dead/incorrect expressions can still pass. Exercise nonmatching query → zero rows/total, reset → original matching data, scope changes and pagination in Preview. Updating filter state while retaining a literal Table dataset fails the required behavior even with a working click event.

`rowActions` requires native ActionGroup inside the named Column.render with the declared handler for local effects. Navigation items use their actual href contract and source-derived runtime cases; do not invent an onClick/onAction merely to duplicate routing. A link-formatted text label is not a record action. Declare required overlays independently and check two different rows show their own details. Static wiring does not prove the click outcome.

Read the public MCP overview and all full Page models into separate JSON files. Run:

```bash
python3 scripts/verify_structure.py structure-expectation.json overview.json pages.json --report structure-report.json
```

The check rejects missing/extra/duplicate routes, incomplete full-page readback, missing/extra shells and different menu labels/hierarchy/order/visibility/destinations on any Page. It ignores unrelated menu appearance props. It checks standalone Overseas AppShell's static `menuItems` and the restricted, independently inventoried `navigation.roleQuery` transform described in [unified verification](verification.md#reviewed-suite-configuration). Other expressions remain statically unverified and require exercised role/state evidence; extracting a literal menu skeleton is insufficient. For host-owned navigation, record that verification separately rather than presenting this AppShell check as applicable.

This check proves agreement with the supplied expectation, not that the expectation faithfully interprets prose. Review its source citations against the original requirement before running the generator. The behavior matrix, role checks and complete-page screenshots remain necessary; structural success does not establish usability or runtime correctness.

Follow the actual [AppShell menu/context contract](libraries/overseas/components/app-shell.md#menu-routes-and-context). Static structure and runtime query/role behavior are separate evidence. The gate does not evaluate bindings, and an unresolved menu stays unverified by this static check; its nonzero exit is intentional. Do not delete required runtime behavior or replace a source-derived expected tree just to pass. Use the [unified verifier](verification.md) to collect all Pages and run applicable gates together; its report does not replace runtime evidence.

After saving/reopening, reread the overview and full Pages and rerun the gate. Report requirement coverage, structural results, visual review, actual interactions and persistence separately. Repeatability is a separate result: two equally wrong runs cannot establish requirement acceptance. Remove obsolete routes/menus/call sites only as part of an authorized correction, then recheck their replacements and incoming links.
