# Naming

## Project directory names

Default prototype Page names, task-owned canvas/group names and business UI copy to Simplified Chinese. Use concise business wording from the requirement; an explicit current user choice of another language or exact name takes precedence. Retain technical terms such as SQL/UID when needed. Do not infer English directory names from English routes, generated identifiers or this reference's examples.

Project-directory names are separate from editable internal node names. Declare each Page's native `name` alongside its route in the source inventory before creation, e.g. `{"path":"/groups","name":"客群列表"}`. For a shared overview declare `page_layout.overviewName`, e.g. `客群管理页面总览`; the default is `页面总览`. Avoid generated placeholders such as Custom arena 1, Pages overview, GroupList and GroupDetail. These names belong in Studio's directory, not a new heading inside the business Page.

Create Pages through `createComponent.name`. Reread canvases after creation: the native automatic overview may retain an English/default name. Rename that existing group through `updateCanvas` before business generation, preserving its frames and references; do not create a duplicate group merely to obtain a Chinese name. Existing Page renames use Studio's supported rename entry; do not delete/recreate Pages or invent a rename MCP operation. Preserve UUIDs, routes, business props, states and interactions. Do not translate registered library definitions, device preset names, route keys or internal code/state identifiers.

The full verifier requires reviewed Page names and compares both overview/full readbacks with them; page_layout compares the actual overview group name with overviewName. Exact name matching supports explicitly requested other languages; source review still checks language and meaning. Save/reopen and inspect directory labels. Frame captions unavailable in the public overview need direct Studio inspection rather than a claimed automated check.

## Editor node naming

Use English PascalCase (UpperCamelCase) for editable **internal tree node names**, including the root. This rule does not name Pages or canvas groups in the project directory. Preserve established component/acronym spelling such as `AppShell`, `SQL` and `ID`. Use words without spaces, hyphens or underscores; lowerCamelCase and temporary identifiers do not meet this node naming standard.

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
