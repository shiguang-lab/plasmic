# Naming

## Editor node naming

Use English PascalCase (UpperCamelCase) for editable node names, independent of the business UI language: `AppShell`, `PageBody`, `StatusFilter`, `ExportModal`. Preserve established component/acronym spelling such as `AppShell`, `SQL` and `ID`. Do not use lowerCamelCase, Chinese names, hyphens, underscores, library prefixes or temporary identifiers for instance names.

Choose names in this order:

- For a page-level structural component that has one instance in its owning page/component, prefer its actual registered display name: `AppShell`, `SearchForm`, `Tabs`, `Steps`, `Form`. In particular, every standalone page's single shell is `AppShell`, not `OverseasAppShell` or a page/product-prefixed variation. Count authored instances in the owning tree, including inactive Tabs and overlays; do not infer uniqueness from the current visible screen. A component appearing once is not by itself a reason to erase a useful business action or field name.
- For business controls and content regions, use their verified action, field or content role: `CreateGroup`, `StatusFilter`, `DetailSummary`, `ListToolbar`. An icon-only control uses its action; a decorative icon retains its actual component name, such as `ArrowLeftOutlined`.
- When multiple instances need distinction, add a stable business scope/role to the component name: `AllGroupsTable`, `MyGroupsTable`, `SelectionRecordsSearchForm`, `ApplicationRecordsSearchForm`, `ExportModal`. Do not add page prefixes to already unique structural components. Avoid redundant type suffixes when the name already explains the business action and Studio displays the type.
- Native layout wrappers use their semantic or layout role, such as `PageBody`, `DetailHeader` or `MetricGrid`. Nodes without meaningful business context use the actual registered display name or PascalCase layout/tag name. Do not invent a function for a spacer or create wrappers solely to carry a name.
- Repeated template instances may share a stable template name. Do not append row numbers, mock record names, random IDs, stale `Copy` suffixes or arbitrary numeric suffixes. Resolve authored-name collisions with meaningful scope, and read back the applied name after renaming.

| Actual node and purpose | Preferred editor name |
| --- | --- |
| Single standalone page shell | AppShell |
| Single page-level query form | SearchForm |
| Two query forms in record Tabs | SelectionRecordsSearchForm / ApplicationRecordsSearchForm |
| Dropdown offering group creation choices | CreateGroup |
| Button opening that creation menu | CreateGroupTrigger |
| Select filtering by status | StatusFilter |
| Tables in All/Mine scopes | AllGroupsTable / MyGroupsTable |
| Native wrapper arranging list actions | ListToolbar |

Set names during generation using `data-plasmic-name`; keep `data-plasmic-component` as the real component identity. Rename existing nodes through MCP `changeElement.name`, which uses Studio's rename operation to maintain state/expression references. Preserve node UUIDs, slot names, business prop names, state identity, event/action keys, routes and interactions. Implicit state references may change when the node name changes; inspect readback instead of manually replacing arbitrary expression text. Node names are editor metadata, not UI labels or routing keys. Do not rename registered components, imported library definitions or slots to implement instance naming. On copy/reuse or functional changes, update obsolete names to match the destination purpose.

Acceptance: read every changed node, including inactive Tab/overlay children and copied nodes, and compare PascalCase, uniqueness scope and semantic naming against its actual component/content/action. Every standalone page must have exactly one shell instance named `AppShell`. Inspect the editor tree/selection label, save/reopen, and confirm names persist, UUIDs remain, references resolve and affected interactions still work. A formatting check or successful `validate` alone does not establish semantic correctness.
