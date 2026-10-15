# Naming

## Editor node naming

Use English PascalCase (UpperCamelCase) for editable node names, independent of the business UI language. Preserve established component/acronym spelling such as `AppShell`, `SQL` and `ID`. Use words without spaces, hyphens or underscores; lowerCamelCase and temporary identifiers do not meet this editor naming standard.

Choose the shortest name that accurately explains the node in its editing context:

- **Meaning:** Base the name on the actual component, action, field, content or layout responsibility. A registered display name works when it already explains the role. Use business semantics when they make the node easier to identify, even for a unique instance. Root position and component type do not prescribe a particular name.
- **Clarity:** Keep words that help a designer identify or distinguish the node. Omit library/registration prefixes, repeated page/product context and type suffixes when they add no useful meaning. Retain a qualifier or type word when removing it would make the name ambiguous or misleading. Native wrappers follow the same standard; use a simple layout/tag name when there is no more specific responsibility, without inventing one.
- **Scope:** Judge ambiguity in the owning page/component's authored tree, including inactive Tabs, overlays and copied content. Add the smallest stable role or business qualifier needed to distinguish authored instances. Unrelated pages/components may reuse names; runtime repetitions share their template's name. Row numbers, mock record names, random IDs and leftover copy suffixes do not explain a stable role.
- **Consistency:** Use the same vocabulary and naming pattern for equivalent roles. Reassess names when copying or changing a node's purpose. Preserve a clear existing name rather than replacing it merely to match a preferred example.

Examples illustrate these decisions; choose from the actual model and requirement:

| Context | Naming judgment |
| --- | --- |
| A shell whose display name already describes its responsibility | `AppShell` can be sufficient; add a qualifier only if it conveys a real distinction |
| A Button that creates a group | `CreateGroup` identifies its action more clearly than `Button` |
| Tables with different business scopes | `AllGroupsTable` and `MyGroupsTable` distinguish their roles |
| A wrapper arranging list actions | `ListToolbar` describes the layout responsibility without repeating the page name |

Set names during generation using `data-plasmic-name`; keep `data-plasmic-component` as the real component identity. Review default and copied names against the same standard. Rename existing nodes through MCP `changeElement.name`, which uses Studio's rename operation to maintain state/expression references. Preserve node UUIDs, slot names, business prop names, state identity, event/action keys, routes and interactions. Implicit state references may change when the node name changes; inspect readback instead of manually replacing arbitrary expression text. Editor names and normalized code/state reference identifiers have separate purposes; verify the actual node name in model readback. Do not rename registered components, imported library definitions or slots to implement instance naming.

Acceptance: read every changed node, including roots, inactive Tab/overlay children and copied nodes. Check PascalCase, accurate meaning, concise wording, scope and vocabulary consistency against the actual model. Review unnecessary qualifiers and ambiguous generic names in context. Inspect the editor tree/selection label, save/reopen, and confirm names persist, UUIDs remain, references resolve and affected interactions still work. A formatting check or successful `validate` alone does not establish semantic correctness.
