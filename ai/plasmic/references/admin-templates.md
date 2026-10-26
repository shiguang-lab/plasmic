# Admin template workflow

For admin prototype design or revision, read this reference and [the catalog](templates/admin/catalog.json) before composing pages. Both are distributed in the NAS resource bundle: resolve paths from `resourceRoot`, not from the user's business repository or this maintainer's local filesystem. The catalog identifies the published **Admin Templates** library and its ten design compositions. It is a selection index, not a component registration contract or a business requirement.

For composition, read `select-by-scenario`, `read-and-compose-through-public-tools`, `source-evidence-before-composition`, `bind-destination-behavior` and `acceptance` with `scripts/read_reference.py`. Read `directory-configuration` when configuring or assessing template-picker availability. The complete catalog and live selected template contracts remain required.

## Select by scenario

The current catalog uses Ant Design 6, Overseas, React UI and Ant Design Icons. Match its live source dependencies to the target's scopes from the [library index](libraries/index.md). A same-named component from v5 or another library is not an interchangeable template dependency. Do not install/migrate a different library solely to fit this catalog; when the selected library has no compatible template, use its verified components and matching rules.

Derive page inventory, data scopes and required behavior from the current requirement first. Match catalog `useWhen`, `avoidWhen`, `kind`, `nestedTemplates` and `compositions`. Record the selected component names, source project/version, destination page and changes needed in the task plan outside the UI. If no template fits, record the unmet scenario and compose from existing registered components; do not force a list template onto a dashboard or invent an unpublished template.

Select by structure and interaction scope. Different business fields, data, Tab labels or overlays are normal adaptations, not evidence that no template fits. A missing installation is an acquisition state, not a scenario mismatch. For All/Mine views inside AppShell, inspect TabsTableSection before deriving the consuming composition; the scenario match does not authorize copying sample content.

Match per region, not only per Page. A Page whose overall flow matches no template still has regions that do: a create/edit field group matches BasicFormPage's FormCard and formFields, a read-only group matches DetailSection's information Card, a list matches SearchTableSection or TabsTableSection. Inspect and record each matching region's template. Template field arrangement, label direction, Descriptions column and Card header are drafts: [Form layout](libraries/antd_v6/compositions/form-layout.md), [Descriptions columns](libraries/antd_v6/components/descriptions.md#column-and-span) and [Card headers](libraries/antd_v6/components/card.md#card-headers) take precedence.

Apply [content entry](design/layout.md#admin-content-entry) and [native component planning](requirement-alignment.md#presentation-copy-and-native-components) when adapting the template. Decorative template content does not create a business requirement.

| Scenario | Template composition |
| --- | --- |
| Standalone filterable resource list | StandardListPage |
| Filterable list inside an existing shell | SearchTableSection |
| All/Mine or other mutually exclusive list scopes | Existing shell + TabsTableSection |
| Standalone catalog with a tabbed workspace | SplitTabsPage |
| Catalog workspace inside an existing shell | CatalogTabsSection |
| Independent short create/edit form | BasicFormPage |
| Complete record detail with related records | RecordDetailPage |
| Detail content inside an existing layout | DetailSection |
| Quick record summary retaining list context | DrawerDetailSection |
| Short create/edit flow retaining list context | DrawerFormSection |

The `page` kind describes a complete page layout; the source definitions are ordinary Plasmic Components, not routed Pages. Create the consuming project's routed Page according to its real page inventory. Use section/overlay templates when a shell already exists. Keep exactly one AppShell per standalone page; never nest a page template inside another shell. A full-page template already includes the `nestedTemplates` listed in the catalog; do not insert those sections a second time. Place Drawers at page scope with a closed business initial state. Choose a separate form/detail page for long or deep content when the requirement calls for it.

## Read and compose through public tools

Acquire the selected live model before composing business content. Record the consuming project and check [navigation/save side effects](desktop-mcp.md#read-and-target) before opening another project. When the source is not imported, prefer source inspection for reference composition; install only for intended actual reuse with compatible dependencies. Do not install solely to satisfy a reading check or silently replace destination libraries.

| Need | Public path |
| --- | --- |
| Template already imported | Read `collection:"importedProjects"`; use its actual dependency ID with `fromProject` to inspect selected components and nested definitions. No project switch is needed. |
| Import a compatible published template for authorized composition | Discover `installLibrary` through `get_app_state`; call `execute {name:"installLibrary",input:{projectId:"CATALOG_PROJECT_ID"}}`, then reread installed versions and contracts. Inspect its dependency graph before separately installing/upgrading libraries. |
| Read-only source inspection or reference composition | Use the already open source or imported dependency first. Open the catalog source only when navigation will not save unrelated edits, or that save is already authorized; otherwise report the blocked source read. Inspect selected live models and return to the consuming project under the same condition. Read-only inspection does not install libraries. |

`fromProject` addresses an already imported dependency; a catalog ID does not install or open it. Access/publication/dependency failures block the affected template path, not independent work. Never substitute an old business project or claim inaccessible source was inspected. Catalog UUIDs, versions, thumbnails and Slots are published index records; confirm live identity and access.

Inspect the selected definition's complete tree/layout, Props/Slots/defaults, state and events, plus nested compositions and relevant library contracts. Return to the consuming project and reread its identity/registrations. Record which structure is retained and which fields, surfaces, defaults or interactions change. A directory description or thumbnail cannot supply this decision.

Template publication pins its dependency versions. Confirm the installed graph and AppShell's saved defaults and instance dimensions against the [fluid shell contract](design/layout.md#standalone-appshell-golden-boilerplate); a current host implementation does not update an older published library model. When maintaining a template, upgrade its affected dependency, repair stale instance dimensions, save/publish, and then record the actual published versions in the catalog. The catalog's viewport is an artboard size, not a fixed Page or AppShell width.

Read the destination's actual UUIDs, registered keys, Props, Slots, defaults and event/ref signatures. Source identifiers and dependency versions do not establish destination identities. Select the available composition mechanism:

- A configured official template picker may inline the layout. Its presence requires actual UI/configuration evidence.
- Ordinary library insertion creates an instance; editable internal layout/data/state may require Studio's **Detach instance**, including nested custom sections. Discover that capability before choosing this path.
- If public tools cannot insert/detach the composition, use its inspected structure as reference and compose with verified destination registrations. `copyElement` is not a cross-project copier; a design component's name is not automatically an `insertHtml` code-component key. Report reference composition rather than claiming template import.

Use the selected library's native layout/surface components under [shared layout](design/layout.md) and [component selection](libraries/index.md#native-component-selection). Preserve real Slot ownership; clear unused demonstration content. Replace sample fields, columns, records, scopes and menus from the requirement. After insertion/detachment, reread the result, apply [node naming](design/naming.md), and bind current destination state/render scopes.

Supplied Pen references follow [Pen evidence](design-references.md); the catalog's Pen path is provenance, not a required local file. Screenshots and archived acceptance models do not replace the live editable template model.

## Source evidence before composition

Keep selections in each Page of the existing structure expectation, without a parallel prop model. This is a Page fragment; replace identities/evidence with actual reads:

```json
{
  "path":"/records",
  "templates":[{
    "sourceProjectId":"SOURCE_PROJECT_ID",
    "componentName":"TabsTableSection",
    "mode":"reference",
    "adaptation":"Retain the inspected Tabs/Table hierarchy; use requirement fields, actions and current destination contracts",
    "evidence":{"path":"/absolute/task/template-source.json","sha256":"CAPTURE_SHA256"}
  }]
}
```

`mode` declares planned `reference` or `import`, not proof of actual reuse. If no scenario fits, declare `templates:[]` and a nonempty `templatesNotApplicable` reason that names each region of the Page (form, read-only group, list, overlay) and its source-backed structural mismatch; a mismatch of the whole flow does not exempt its regions. “Not preinstalled” or “different fields” is not a mismatch. An inaccessible selected source remains blocked/unverified, not a no-fit exemption.

Use the read-only collector while the source is open or already imported:

```sh
python3 RESOURCE_ROOT/scripts/verify_templates.py \
  --profile "/absolute/Desktop user-data" \
  --source-project-id SOURCE_PROJECT_ID --names TabsTableSection \
  --output /absolute/task/template-source.json
```

It uses public model reads, resolves real UUIDs by name, includes catalog-owned nested compositions and retains full models/contracts with stable editor/build identity and the observed dependency version (null when unknown). It prints the evidence path/hash and requires a new output file. It never navigates, saves or installs; explicitly acquire unavailable sources through the paths above. Keep failed calls and report blocked acquisition.

Open and interpret the captured model before composing; acquisition alone does not establish understanding. Record its evidence, complete the [compose-card reads](planning.md#rules-card-and-read-ledger), then run `verify_selection.py structure-expectation.json --reads /task/reference-reads.jsonl --report selection-plan.json` with that actual ledger. Run it before generation; the saved/reopened structure gate rechecks template evidence and read coverage. Any failure blocks composition or delivery until fixed. Do not generate, deliver or relabel to pass. Missing captures, catalog-only summaries, partial models, wrong identities and missing contracts fail the template-source check. Inspect all findings before generation instead of acquiring source during a later repair round.

## Bind destination behavior

Official template insertion may remove source custom State, events and queries. Ordinary component imports and detachment have different ownership; none proves that page-level business bindings are ready. Read the resulting model and bind the current project's real contracts:

- SearchForm `onSearch`/`onReset` update applied filters and reset pagination; distinguish draft values from applied query state.
- Adapt Tab/Table ownership to the source: independent Tab content owns its Table; explicit shared-Table scopes follow [query/list composition](libraries/overseas/compositions/search-table.md#query-and-list-structure). Catalog selection, pagination and row actions use current business state and permissions.
- Create/view/edit triggers control the native Drawer `open` state. For an imported overlay whose internals are private, detach the composition before binding page-level Drawer state and Form refs. Close and Cancel write the correct closed state; selection-only editor reveal must not persist `open=true`.
- Use native Form/Form.Item field ownership and validation. Read the registered rule shape; do not substitute raw Antd rule objects when the wrapper uses another shape. The advanced Form places fields in its real children Slot. Footer submission calls that Form's actual `submit` ref action, and `onFinish` performs the required save/navigation/close flow only after validation and successful business processing.
- Bind current page routes, menu hrefs, row actions and return navigation. The source preview's successful Submit closes a Drawer; it does not save a business record or supply a business API.

## Directory configuration

[The prepared UiConfig](templates/admin/ui-config.json) contains four `pageTemplates` and six `insertableTemplates`, with `componentResolution: "inline"` and `tokenResolution: "reuse-by-name"`. Its presence in the bundle does not enable an organization/workspace picker. Read catalog `directoryConfiguration` and inspect actual Studio access before claiming that configuration is applied. Preserve other UiConfig fields when applying the arrays through an authorized official configuration entry point. Do not change feature tiers or bypass permission checks to expose that entry point.

The skill's workflow tells an external AI how to find, inspect and compose templates. It does not implement Plasmic's built-in AI retrieval or automatic instantiation service.

## Acceptance

Record catalog reading, live-model reading, actual import and reference reconstruction separately. The structure/selection gate verifies source-read captures; it does not certify insertion/detachment or adaptation. Report actual import only with operation/UI evidence and destination readback; installation alone is insufficient. Missing live-model evidence leaves template workflow completion unverified even when the page renders. Read back destination Pages/hidden branches and check component/Slot ownership, one AppShell, meaningful names and replacement of sample content. Apply existing requirement, Slot and Form checks; the catalog does not define business fields or routes.

In real Preview at the required viewport, inspect layout and exercise query/reset, page changes, every relevant Tab, row actions, Form errors/success and Drawer open/close/cancel/reopen behavior. Verify actual business save/navigation when required; report unconnected APIs or untested behavior explicitly. Save, reopen and reread to confirm that layout, current-project bindings and closed overlay defaults persist. Source-template acceptance does not pass the consuming project's acceptance.

Measure the selected [AppShell outer inset](libraries/overseas/components/app-shell.md#standalone-page-boilerplate) and composition spacing after save/reopen. Preserve component-internal padding and verify each boundary has one spacing owner.
