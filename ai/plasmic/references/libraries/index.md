# Component library index

Select the library and API version before reading component rules or composition recipes. Reuse the target project's actual installed libraries and the user's explicit choices. Read the project imports and each used registration through MCP; record the imported project ID/published version, registration key, importPath/importName and the native package version when available. Published Studio library versions, wrapper npm versions and native UI versions are separate facts. Display names such as Form or Button do not identify a library or version.

| Library scope | Registration identity | Applicable API family |
| --- | --- | --- |
| [Ant Design v6](antd_v6/index.md) | plasmic-antd6-*; @shiguang-lab/plasmic-antd6 | Ant Design 6 |
| [Ant Design v5](antd_v5/index.md) | plasmic-antd5-*; @plasmicpkgs/antd5 | Maintained wrapper declares antd ^5.12.7; verify actual native version |
| [Overseas](overseas/index.md) | plasmic-overseas-*; @shiguang-lab/plasmic-overseas | Current Overseas implementation using Ant Design 6 |
| [React UI](react_ui/index.md) | plasmic-react-ui-*; @shiguang-lab/plasmic-react-ui | Current @react/ui wrapper using Ant Design 6 |
| [Ant Design Icons](antd_icons/index.md) | plasmic-antd-icon-*; @shiguang-lab/plasmic-antd-icons | @ant-design/icons 6 |

## Read by actual library

1. Match the actual registration and implementation/API family to a scope above. A business-library prefix alone does not establish its underlying UI version; verify dependencies before selecting an Antd-v6 scope. Unknown versions remain unknown.
2. Read that scope's index, look up used registration keys in its linked catalog, and read only the affected main-component documents, including their relevant child/variant sections. Verify live Props, Slots, defaults, events and state against the current project; a reference baseline does not replace its contracts.
3. Read a composition recipe only when its declared participating libraries match the chosen components. Follow cross-library references only for components actually used. Keep each library's props, tokens, size values and behavior in its own scope; never apply Antd-v6 rules to Antd-v5 or another library solely because names look alike.
4. Select verifier scripts from the matching scope's index. Library-specific structural gates do not certify another library. Shared [layout](../design/layout.md), [keyboard/focus](../design/accessibility.md), [node naming](../design/naming.md) and [icon selection](../design/icons.md) rules apply independently of library choice.

## Missing or new library scopes

When no matching scope exists, use the current library's verified implementation/registration and the actual requirement with shared design rules; report the missing reference coverage. Do not silently fall back to Antd v6, install a different library to fit a recipe, copy its props, or mark unavailable gates passed. Ask only when an unresolved library/API choice blocks the affected design. A code-generation task selects design-side and target-side libraries separately and follows the [model-reading contract](../model-reading.md).

Add a registered library with its own index and verified main-component documents (child registrations and variants stay in their owner), version evidence, dependency declarations, composition recipes and applicable gates. Use one directory level for the library identity: antd_v6, antd_v5, overseas, react_ui or antd_icons. Directory names identify registered libraries; record underlying dependency versions in the index's dependency section, without appending them to the library directory name. Distinct registered libraries keep separate directories. Link a library here only after its references exist; do not create empty version placeholders or redirect them to another major's rules. Each concrete registration is listed in its main-component document and that library's linked catalog; icon-catalog registrations use the icon library's family reference. Recheck registration coverage, bundle links, reachability and reading budgets when extending the catalog.
