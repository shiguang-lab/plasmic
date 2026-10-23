# Requirement alignment

Use before requirement-driven generation or scope review. Keep source inventories outside UI; use native component props.

Keep business-specific page counts, entity names, routes, menu trees, field dictionaries and approved layout decisions in that task's inventory. Do not promote them into this skill's defaults or add branches keyed by a requirement ID. Examples illustrate a mechanism only; a new requirement must produce a new inventory from its own sources. Select design rules for the actual product/platform and [component library](libraries/index.md); do not force the current admin or Antd-v6 defaults onto another scope.

## Source and interaction rules

Read current requirement sections completely before freezing scope, including fields, roles, state transitions and later decisions. Record source coverage; truncation is incomplete. Use the supplied sources and resolved runtime resources. Do not search repository evals, historical task answers or acceptance fixtures to derive this task's requirements.

Build calls from current schemas and registered Props/Slots; serialize data-props as JSON, read each receipt and refresh identities after context changes. Imported definitions can retain older stored defaults; registration.defaultValue exposes a differing current literal insertion default. New HTML instances materialize it; existing instances require explicit correction. Dropdown JSON actions use stable unique key values, including nested items; onAction receives key, not value or label. Clear unused default Slots explicitly: an externally opened Modal needs an empty trigger Slot, while its native Confirm/Cancel footer is retained unless the required composition removes or replaces it.

Use native href/Link or the documented navigation interaction for internal Page transitions. Do not assign window.location or call location.assign/replace for prototype routing: that navigates the canvas host iframe. Preserve only required role/record/entry/return context in supported destinations. Test every menu branch, direct entry and return after all destination Pages are complete.

Name Page and task-owned canvas directories in Chinese by default; name editable internal nodes in concise English PascalCase. Rename the existing automatic overview through updateCanvas, preserving references. Name nodes during composition and verify hidden branches and save/reopen; see the naming reference for native rename operations.

Before binding actions, follow [permission generation and acceptance](design/permissions.md): derive role × action × state/scope decisions from source, establish current-user context and reuse its checks for data, buttons, routes and submission. Separate metadata from condition/SQL edits and current state from ever-enabled history. Resolve conflicts; never freeze all editing because one field group is immutable.

Record decisions in existing [actionContracts and runtime cases](design/component-policy.md#business-actions-and-transitions), including allowed non-administrator actions and real denied boundaries. Source-derived transitions retain from/to keys and displayed text; first selection and re-enable selection cannot share a catch-all retry target. Cover confirm/cancel and failure recovery. Keep fixture role/market/App setup outside business UI; absent setup leaves acceptance unverified.

Normalize App 来源/App Source/app_source/appSource as candidates for the same App dimension. Distinguish global working context from a business field, SQL output column and historical provenance. When the requirement identifies the current App, preserve the AppShell context control and data/action propagation under [App source rules](libraries/overseas/components/app-shell.md#app-source-context). Removing a list/form App field does not opt out of global context. An explicit current instruction about the header takes precedence over ambiguous earlier “page has no App option” wording.

Keep permission demonstrations out of the business UI: do not add role-view switches, administrator/operator/read-only buttons or current-role debug badges. Use one current-user context and representative records to express source-defined record access through the relevant row actions, fields and mutation guards. Where permissions differ between records, show or omit each action accordingly rather than exposing a global simulator. Exercise other roles through test setup or supported direct-entry context outside the page; preserve authorization guards when removing simulation controls.

## Source and scope

Read the current requirement body and its page/navigation, field, permission and workflow sections. Record file/URL, version/date and section anchors. Apply explicit current user decisions first, then current requirements for business scope and behavior. Interpret presentation sources through [visual sources and component rules](#visual-sources-and-component-rules). Live registered contracts determine what can actually be implemented, not permission to drop a required behavior. History, obsolete screenshots, previous models and generated code are evidence, not authority for current scope. Separate P0/P1/P2 or other release boundaries explicitly.

Resolve content differences before choosing components or layout. Current explicit user decisions take precedence; otherwise current requirements define business fields, actions, states and permissions, while the selected visual source defines their presentation. A visual source's missing field is not a removal decision. An obsolete visual field is not a reason to retain it against an explicit current removal. Record each difference and its source-backed resolution in the existing task inventory/reference-region decision. Ask about unresolved business conflicts before generating the affected branch, while continuing independent work.

## Content before presentation

For each in-scope region, reconcile the complete member set across its current requirement and visual source before markup: query fields, submitted fields, read-only attributes, result Columns, actions and states. Identify members by business meaning and owning region, then map them to native keys/values; a field and a global context control are not interchangeable merely because their labels overlap. Removing one obsolete member does not resolve other additions or differences in that region. Review both missing and unexpected members, not only totals.

Keep the resolved members in the existing structure/field/action inventories, with source citations and explicit decisions for exclusions. After reading contracts, map every retained member to its actual native component, property/Slot owner and business key. Query Items use the existing `components` entries with native `props.name`, label/labelContent and `owner`; Form/Descriptions fields retain their existing dedicated inventories. Do not add a parallel field schema or derive this expectation from generated markup.

Freeze this content expectation before selecting column density, copying a template or adapting a screenshot. Component choice, wrapping, collapse and visual adjustments preserve its members and meanings; they may change representation only under the owning rule. A native layout can hide a retained field temporarily but cannot justify omitting its model node or query behavior. A genuine scope change needs new source evidence or a current user decision, followed by an explicit inventory update.

Before business writes, compare the source with this expectation member by member; after generation, compare the same expectation with the saved model's keys, labels, owners and native identities, including hidden branches. Check query/reset and applicable role/state behavior in Preview. Missing content is repaired in the output, not erased from the expectation. Static checks can compare declared members with the model; they cannot establish that the declaration faithfully covers source prose or images.

## Visual sources and component rules

Read and inspect the selected visual source for business regions, hierarchy, grouping, field/action placement and intended states. Compose its resolved content with native components and the applicable composition rules. Adaptations to dimensions, wrapping, demo titles or control styling follow the owning component reference, including [protected configuration](design/component-policy.md#protected-configuration) and [admin content entry](design/layout.md#admin-content-entry); they do not reopen the resolved content decisions.

An instruction such as “界面以 .pen 为准” selects that visual source for presentation; still reconcile its content with current requirements under [content before presentation](#content-before-presentation). Do not silently select a screenshot's field list over the current requirement. Explicit layout/reproduction instructions take precedence over ordinary presentation defaults; resolve any remaining conflict before the affected composition.

Record the draft's intended region and its native implementation/adaptation in the existing reference-region decisions. Compare source and output at the intended viewport and equivalent state. Verify complete model content separately from initial visibility: collapsing, inactive Tabs and closed overlays can hide retained content. Visual acceptance checks source structure, resolved content and native presentation together. Apply the same comparison to later revisions.

## Inventory before routes

Create a table with one row per required surface: source section and brief excerpt, purpose, entry/return path, surface kind, shared page identity, type/role/state differences, in-scope decision and proposed route. Classify independent Page, shared-page variant, Tab, Modal/Drawer and overview frame separately. A record Page also declares its `routePattern`/`params`/`recordSource` and, when the same surface serves several actions, its `modes` and `readOnlyMode`; actions reference those modes rather than branching inside one page by hidden state. A separate screenshot/frame is not automatically a Page; an overview frame referencing a Page is not a duplicate route.

Declare every Page's `name` in that inventory before generating; directory names and business copy default to Chinese unless the current user specifies otherwise. Declare `page_layout.overviewName` (default 页面总览) in the suite. Follow [directory versus internal-node naming](design/naming.md#project-directory-names); English PascalCase applies to tree nodes, not Page/group labels. Keep routes/registered identities unchanged and do not add an in-page title to display a directory name.

When the requirement says common/shared detail or creation page, represent type differences through supported bindings, conditional nodes and slots in one Page. Different entity types or permissions alone do not justify another route. Conversely, retain separately specified flows with different entry contracts or business behavior even when their screenshots are similar. Record an explicit user-authorized split if one is required. Count routed Pages from this inventory, never from the number of types, screenshots or generated objects.

Derive the complete navigation tree separately: preserve the requirement's exact labels, parent hierarchy, order, visible/hidden status and destinations. Keep action-only routes under their business owner; a hidden creation/detail route does not become a top-level menu. Record role visibility and test it in live preview. Do not rename a product menu to its current implementation technology. If a host supplies navigation, use its verified contract rather than inventing another sidebar.

Before generation, review coverage in both directions: every in-scope requirement has an intended surface/behavior, and every proposed Page/menu/action has a source or explicit user decision. Mark inferred design choices as such. Keep the reviewed expectation separate from the generator's output plan and generated UUIDs. Updating it requires new source evidence or a user decision; a failed check is not a reason to redefine the expected result.

## Presentation, copy and native components

Before markup read [source presentation](design/source-presentation.md) for native roles, properties and ownership, and [authored content review](design/content-review.md) for the generation/acceptance schema for names and UI copy. Keep `pageHeader:null` unless the current user explicitly requests a heading.

## Behavior and field matrix

Map each flow's source rule to its native input fields/values, calculation or guard, event owner and observable output in the existing inventories and [business outcome cases](design/component-policy.md#business-outcome-cases). Include enums/defaults, editability, permissions, transitions and navigation. Required-only validation or a rule copied into help text does not implement a business algorithm.

Use [source-driven acceptance](behavior-acceptance.md#plan-from-the-source) to derive expected results before generation, review source coverage and verify business outcomes. Reuse the existing runtime case arrays; keep mock/API limits and excluded transitions explicit. Shared Pages cover distinct records/types, direct entry/back, field/Tab visibility and applicable role/state branches. Review editor/Preview pixels for grouping/alignment separately.

## Structural gate

Save a task-local `structure-expectation.json` before generating. It contains all planned Page paths and the full expected AppShell menu tree; give every Page and the navigation a requirement section/excerpt or explicit user-decision citation. Keys/routes are implementation choices; labels/hierarchy/ownership are source-derived. The following fragment illustrates navigation/binding fields only; combine it with the component/copy declarations above and derive routes from the source:

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

`rowActions` requires native ActionGroup inside the named Column.render with the declared handler for local effects. Every action key resolves to a declared surface: a record Page, a dedicated Page (for example an export configuration page) or a declared overlay with its own inventory entry. A surface that is not declared before generation must not be bolted onto an existing Page afterwards — inserted overlays materialize default Slot nodes and break naming/copy ownership. A record action additionally declares `kind`, `carries` and its destination record Page; see [record context](design/record-context.md) and `verify_structure.py → recordContext`: navigation alone never proves the clicked record reaches the destination, and globals/query strings are not a valid carrier. Navigation items use their actual href contract and source-derived runtime cases; do not invent an onClick/onAction merely to duplicate routing. A link-formatted text label is not a record action. Declare required overlays independently and check two different rows show their own details. Static wiring does not prove the click outcome.

Read the public MCP overview and all full Page models into separate JSON files. Run:

```bash
python3 scripts/verify_structure.py structure-expectation.json overview.json pages.json --report structure-report.json
```

The check rejects missing/extra/duplicate routes, incomplete full-page readback, missing/extra shells and different menu labels/hierarchy/order/visibility/destinations on any Page. It ignores unrelated menu appearance props. It checks standalone Overseas AppShell's static `menuItems` and the restricted, independently inventoried `navigation.roleQuery` transform described in [unified verification](verification.md#reviewed-suite-configuration). Other expressions remain statically unverified and require exercised role/state evidence; extracting a literal menu skeleton is insufficient. For host-owned navigation, record that verification separately rather than presenting this AppShell check as applicable.

This check proves agreement with the supplied expectation, not that the expectation faithfully interprets prose. Review its source citations against the original requirement before running the generator. The behavior matrix, role checks and complete-page screenshots remain necessary; structural success does not establish usability or runtime correctness.

Follow the actual [AppShell menu/context contract](libraries/overseas/components/app-shell.md#menu-routes-and-context). Static structure and runtime query/role behavior are separate evidence. The gate does not evaluate bindings, and an unresolved menu stays unverified by this static check; its nonzero exit is intentional. Do not delete required runtime behavior or replace a source-derived expected tree just to pass. Use the [unified verifier](verification.md) to collect all Pages and run applicable gates together; its report does not replace runtime evidence.

After saving/reopening, reread the overview and full Pages and rerun the gate. Report requirement coverage, structural results, visual review, actual interactions and persistence separately. Repeatability is a separate result: two equally wrong runs cannot establish requirement acceptance. Remove obsolete routes/menus/call sites only as part of an authorized correction, then recheck their replacements and incoming links.
