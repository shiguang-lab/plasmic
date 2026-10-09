# Product prototype workflow

Use for creating or revising editable designs. Read Desktop readiness and live operation schemas, identify the session and require `canEdit` before mutations. Explain/review-only tasks use inspect. Missing MCP capabilities do not authorize private design APIs or platform implementation.

## Scope and selected references

Read the actual requirement and target project before changing it. For requirement-driven generation or route/menu changes, read [requirement alignment](../requirement-alignment.md) and freeze source-derived acceptance inputs outside the UI. Previous generated output is reference evidence, not the requirement.

For admin composition read the [admin reference index](../admin-design.md), [template workflow](../admin-templates.md) and [catalog](../templates/admin/catalog.json). Select templates by scenario or record why none fits. Load only the index's references applicable to the affected regions before building them. Explicit regeneration/stability work also reads [reproducibility](../reproducibility.md).

## Build and bind

Read current component identities, Props, Slots, defaults, events/ref actions and imported project IDs. Install or upgrade a necessary published library through available public operations, then reread its destination contracts. A template composition and a code-component registration are different identities; follow the template workflow's actual insertion/detachment mechanism.

Create routed Pages, use registered components and preserve native editable Slot ownership. Standalone admin pages use one existing AppShell; hosted content uses its host shell. Configure routes from the reviewed inventory and read normalized paths before binding links. Name created/copied nodes through the [naming contract](../design/naming.md); rename through Studio operations so references remain valid.

`data-props` is JSON, not JSX. Dynamic values use supported `{{ expression }}` bindings. Discover real render-prop scopes before binding cells. Batches are atomic; discover newly created IDs in separate calls before using them. Preserve business UUIDs and interactions when moving existing nodes; remove obsolete structure only within the authorized change.

Build structure and behavior together: local state, events, query/reset, pagination, Tabs, forms, navigation and overlays as actually required. Keep draft/applied filters and temporary editor reveal distinct. [Actions](../design/actions.md) covers navigation/feedback; [forms](../design/forms.md) covers real validation/ref submission; [lists](../design/lists.md) covers native filter/Table contracts. Record simulated processing in the plan, not implementation notes in the UI. Remove unused imported demo Slot content before acceptance.

Use the requested platforms/viewport. For PC-only generation use the live Desktop preset, routed Pages and at most one overview Arena referencing them; do not add per-page duplicate Arenas or mobile layouts. [Layout](../design/layout.md) defines viewport, shell and scrolling ownership. For library icons read [icons](../design/icons.md).

## Verify the affected scope

Run relevant source-derived structural gates from the selected references against public readbacks: route/menu coverage, intended component/Slot ownership, information groups and Forms where applicable. A focused edit does not require rebuilding unrelated pages or expecting unrelated existing content to match a new design inventory. Full regeneration retains full-project gates.

Use [rendered inspection](../desktop-inspection.md) for screenshots, geometry and real Preview interactions at the actual viewport. Exercise required default/hidden states, Tabs, overlays, errors, processing and navigation. Inspect changed labels, content and long/empty values. Record identity, viewport, concrete observations and pass/fail; a list of captures is not visual review. `validate` proves model integrity only.

Save explicitly, record the available revision, reopen and reread affected models, bindings and initial closed overlays. Recheck relevant Preview behavior and images after reopen. Report sources/resource release, actual template mechanism, checks, mock/API boundaries and limitations. Saving alone does not pass acceptance; publishing requires the user's task to authorize it.
