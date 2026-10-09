# Admin template workflow

For admin prototype design or revision, read this reference and [the catalog](templates/admin/catalog.json) before composing pages. Both are distributed in the NAS resource bundle: resolve paths from `resourceRoot`, not from the user's business repository or this maintainer's local filesystem. The catalog identifies the published **Admin Templates** library and its ten design compositions. It is a selection index, not a component registration contract or a business requirement.

## Select by scenario

Derive page inventory, data scopes and required behavior from the current requirement first. Match catalog `useWhen`, `avoidWhen`, `kind`, `nestedTemplates` and `compositions`. Record the selected component names, source project/version, destination page and changes needed in the task plan outside the UI. If no template fits, record the unmet scenario and compose from existing registered components; do not force a list template onto a dashboard or invent an unpublished template.

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

1. Resolve the current skill bundle, read the catalog, and discover Desktop readiness, permissions and exact operation schemas through `get_app_state` and `identify`. Record the consuming project before switching to the source library. Use public project discovery/open/read operations to inspect the selected source components, including nested sections, hidden Tabs and Drawer/Form content. Treat catalog UUIDs, versions, Slot names, thumbnails and configuration status as published reference records; verify live identity and access before use. If source access fails, report that limitation rather than claiming the source was inspected.
2. Read the template's live editable model and the actual installed component contracts. Catalog `libraries` and `installed` describe the source project, not the consuming project. Return to the consuming project, inspect its imports, and use the available `installLibrary`/`upgradeLibrary` operations when needed. Read back the destination's actual component UUIDs, registered names, project IDs, Props, Slots, defaults and event/ref signatures. Do not reuse source node UUIDs or assume imported IDs resolve identically in the destination.
3. Choose the actual available composition mechanism. If the official template picker is configured, it may inline the layout. Ordinary library insertion creates an instance; editable internal layout/data/state may require Studio's **Detach instance**, including nested custom sections. Discover public MCP capabilities before insertion; `copyElement` is not a cross-project copier and a design component name is not automatically a registered code-component name accepted by `insertHtml`. If the exposed operations cannot insert/detach that design component, use the inspected live structure as the reference and compose the destination with existing registered components through MCP. Report which mechanism was used; do not simulate a private template API or claim an actual template import from a visual reconstruction.
4. Prefer Antd6 Flex, Row/Col, Space and Card for layout and surfaces, existing AppShell for the shell, Overseas SearchForm/SearchFormItem for query regions, and existing Antd controls/Table/Tabs/Form/Descriptions/Drawer for content. Read the real registrations; never draw replacement widgets or add a parallel component/prop schema. Preserve genuine editable Slot ownership. Clear unused imported demonstration Slots such as Card cover/actions or Form sample content.
5. Replace sample labels, fields, columns, options, records, owner scopes and menus with requirement-derived content. Inspect the consuming model again after insertion/detaching; rename editable nodes with meaningful English PascalCase through Studio's rename operation. Rebind expressions using current destination identities and native render-prop scopes rather than source node/state names.

Do not use a thumbnail, `.pen` screenshot or archived acceptance model as an editable layout. Access `.pen` only through its MCP when the task needs the original Pen source. The catalog's Pen path is provenance, not a required local path on other machines. Current registered Props and Slots remain authoritative even if the source template uses an older library version.

## Bind destination behavior

Official template insertion may remove source custom State, events and queries. Ordinary component imports and detachment have different ownership; none proves that page-level business bindings are ready. Read the resulting model and bind the current project's real contracts:

- SearchForm `onSearch`/`onReset` update applied filters and reset pagination; distinguish draft values from applied query state.
- Each Tab owns its intended Table/data scope. Catalog selection, pagination and row actions use current business state and permissions.
- Create/view/edit triggers control the native Drawer `open` state. For an imported overlay whose internals are private, detach the composition before binding page-level Drawer state and Form refs. Close and Cancel write the correct closed state; selection-only editor reveal must not persist `open=true`.
- Use native Form/Form.Item field ownership and validation. Read the registered rule shape; do not substitute raw Antd rule objects when the wrapper uses another shape. The advanced Form places fields in its real children Slot. Footer submission calls that Form's actual `submit` ref action, and `onFinish` performs the required save/navigation/close flow only after validation and successful business processing.
- Bind current page routes, menu hrefs, row actions and return navigation. The source preview's successful Submit closes a Drawer; it does not save a business record or supply a business API.

## Directory configuration

[The prepared UiConfig](templates/admin/ui-config.json) contains four `pageTemplates` and six `insertableTemplates`, with `componentResolution: "inline"` and `tokenResolution: "reuse-by-name"`. Its presence in the bundle does not enable an organization/workspace picker. Read catalog `directoryConfiguration` and inspect actual Studio access before claiming that configuration is applied. Preserve other UiConfig fields when applying the arrays through an authorized official configuration entry point. Do not change feature tiers or bypass permission checks to expose that entry point.

The skill's workflow tells an external AI how to find, inspect and compose templates. It does not implement Plasmic's built-in AI retrieval or automatic instantiation service.

## Acceptance

Record the selected source and the actual import/reference mechanism. Read back all affected destination Pages and hidden branches, then verify component/Slot ownership, one AppShell per standalone page, meaningful names and replacement of sample data/default content. Apply the existing requirement, Slot and Form checks; the template catalog does not define the consuming project's field inventory or expected routes.

In real Preview at the required viewport, inspect layout and exercise query/reset, page changes, every relevant Tab, row actions, Form errors/success and Drawer open/close/cancel/reopen behavior. Verify actual business save/navigation when required; report unconnected APIs or untested behavior explicitly. Save, reopen and reread to confirm that layout, current-project bindings and closed overlay defaults persist. Source-template acceptance does not pass the consuming project's acceptance.
