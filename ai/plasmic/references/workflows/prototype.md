# Product prototype workflow

Create or revise editable designs; explanation/review uses inspect. Resolve the project before editor readiness checks; mutations require `canEdit`.

## Target project

Resolve Team → Workspace → Project through [project management](../desktop-management.md) before reading libraries or editing. Reuse a unique named match or an established target within scope. Otherwise show scoped existing/new choices. Open the chosen Project, reread its identity/schemas and require `canEdit` before edits.

## Scope and selected references

Read the actual requirement and target project before changing it. For requirement-driven generation or route/menu changes, read [requirement alignment](../requirement-alignment.md) and freeze source-derived acceptance inputs outside the UI. Previous generated output is reference evidence, not the requirement.

Read the [library index](../libraries/index.md) first. Identify actual project imports, registration keys and implementation/API versions; record the selected scopes and unknowns. Read only matching component rules and recipes whose participating libraries fit. Missing coverage uses verified live contracts and shared rules, never another major's defaults. For admin work read the [admin index](../admin-design.md), [template workflow](../admin-templates.md) and [catalog](../templates/admin/catalog.json); choose a template only when its scenario and library scope fit. Stability work also reads [reproducibility](../reproducibility.md).

## Build and bind

Read current component identities, Props, Slots, defaults, events/ref actions and imported project IDs. Install or upgrade a necessary published library through available public operations, then reread its destination contracts. A template composition and a code-component registration are different identities; follow the template workflow's actual insertion/detachment mechanism.

Create routed Pages with registered components and native editable Slots. Reuse one standalone AppShell or the host shell. Configure reviewed routes; read normalized paths before binding links. Before creating/copying/renaming, read the [naming standard](../design/naming.md): concise English PascalCase for actual roles and useful scope, equally for roots and descendants. Rename through Studio operations to preserve references.

`data-props` is JSON, not JSX. Dynamic values use supported `{{ expression }}` bindings. Discover real render-prop scopes before binding cells. Preserve business UUIDs and interactions when moving existing nodes; remove obsolete structure only within the authorized change.

Build structure and behavior together: local state, query/reset, pagination, scopes, forms, navigation and overlays as actually required. Keep drafts/applied values and temporary editor reveal distinct. Use the selected library's component rules and applicable compositions/gates; preserve real Slots and handlers. Record simulated processing in the plan, not the UI, and remove unused demo Slot content before acceptance.

Use the requested platforms/viewport. For PC-only generation use the live Desktop preset, routed Pages and at most one overview Arena referencing them; do not add per-page duplicate Arenas or mobile layouts. [Layout](../design/layout.md) defines viewport, shell and scrolling ownership. For library icons read [icon selection](../design/icons.md).

## Verify the affected scope

Run relevant source-derived structural gates from the selected references against public readbacks: route/menu coverage, intended component/Slot ownership, information groups and Forms where applicable. A focused edit does not require rebuilding unrelated pages or expecting unrelated existing content to match a new design inventory. Full regeneration retains full-project gates.

For full-project acceptance use the [unified verifier](../verification.md): supply reviewed inventories, collect overview/full Pages and targeted layouts once per design state, and aggregate all existing gates from those files. Reuse through its identity/hash checks; fresh collection is required after save/reopen. Inspect the compact statuses and failed report sections instead of printing full evidence. Missing expectations remain unverified; runtime and save/reopen evidence are separate.

Use [rendered inspection](../desktop-inspection.md) for screenshots, geometry and real Preview interactions at the actual viewport. Every affected standalone AppShell Page must pass [viewport shell height acceptance](../design/layout.md#viewport-shell-height-acceptance), including its model/geometry gate, shorter live Preview and post-reload height check. Exercise required default/hidden states, Tabs, overlays, errors, processing and navigation. Inspect persisted node names, labels, content and long/empty values. Record identity, viewport, concrete observations and pass/fail; a list of captures is not visual review. `validate` proves model integrity only.

Save explicitly and record the revision. Reopen, reread affected models/bindings and initial closed overlays; recheck Preview behavior and images. Report sources/resource release, template mechanism, checks, mock/API boundaries and limitations.
