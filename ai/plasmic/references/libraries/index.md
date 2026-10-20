# Component library index

Select the library and API version before reading component rules or composition recipes. Reuse the target project's actual installed libraries and the user's explicit choices. Read the project imports and each used registration through MCP; record the imported project ID/published version, registration key, importPath/importName and the native package version when available. Published Studio library versions, wrapper npm versions and native UI versions are separate facts. Display names such as Form or Button do not identify a library or version. Prototype evidence comes from public MCP contracts and provider documentation; implementation/version verification does not authorize reading client internals. Target-code source access follows [model reading](../model-reading.md#读取完整性与实现来源).

| Library scope | Registration identity | Applicable API family |
| --- | --- | --- |
| [Ant Design v6](antd_v6/index.md) | plasmic-antd6-*; @shiguang-lab/plasmic-antd6 | Ant Design 6 |
| [Ant Design v5](antd_v5/index.md) | plasmic-antd5-*; @plasmicpkgs/antd5 | Maintained wrapper declares antd ^5.12.7; verify actual native version |
| [Overseas](overseas/index.md) | plasmic-overseas-*; @shiguang-lab/plasmic-overseas | Current Overseas implementation using Ant Design 6 |
| [React UI](react_ui/index.md) | plasmic-react-ui-*; @shiguang-lab/plasmic-react-ui | Current @react/ui wrapper using Ant Design 6 |
| [Ant Design Icons](antd_icons/index.md) | plasmic-antd-icon-*; @shiguang-lab/plasmic-antd-icons | @ant-design/icons 6 |

## Native component selection

The skill's component-priority rule applies. Use the following roles to search the matching library catalog and select the relevant component/composition documents.

| Required role | Select from the actual installed library |
| --- | --- |
| Actions and editable values | Button/ActionGroup, actual Input/Select/date/numeric controls, Form ownership and validation |
| Navigation and repeated information | Tabs/Menu/Breadcrumb, Table/Column, Pagination, Descriptions, List |
| Feedback and overlays | Alert/Tag/Badge/Empty/Spin, Tooltip/Popconfirm/Modal/Drawer |
| Arrangement and surfaces | Flex/Row/Col/Space where their layout role fits; Card only for an independent business surface |

These are role examples, not cross-library API names. Classify the source purpose and read its applicable composition before selecting a registration. Record selected identities and ownership in the [native-component inventories](../requirement-alignment.md#presentation-copy-and-native-components). Discover a required composition's cross-library participants even when they are not installed yet; install the selected dependency and read its contract, or report the concrete gap. Inspect inactive states and their native visibility/content Slots.

Typography components are useful when their registered behavior or theme contract is needed. Root sizing and necessary Slot/semantic container styles follow [shared layout](../design/layout.md).

Record a fallback permitted by the skill using the [elementFallbacks format](../requirement-alignment.md#presentation-copy-and-native-components).

## Read by actual library

1. Match the actual registration and implementation/API family to a scope above. A business-library prefix alone does not establish its underlying UI version; verify dependencies before selecting an Antd-v6 scope. Unknown versions remain unknown.
2. Read that scope's index, look up used registration keys in its linked catalog, and read only the affected main-component documents, including their relevant child/variant sections. Verify live Props, Slots, defaults, events and state against the current project; a reference baseline does not replace its contracts.
3. Read a composition recipe only when its declared participating libraries match the chosen components. Follow cross-library references only for components actually used. Keep each library's props, tokens, size values and behavior in its own scope; never apply Antd-v6 rules to Antd-v5 or another library solely because names look alike.
4. Select verifier scripts from the matching scope's index. Library-specific structural gates do not certify another library. Shared [layout](../design/layout.md), [keyboard/focus](../design/accessibility.md), [node naming](../design/naming.md) and [icon selection](../design/icons.md) rules apply independently of library choice.

## Missing or new library scopes

When no matching scope exists, use the current library's verified implementation/registration and the actual requirement with shared design rules; report the missing reference coverage. Do not silently fall back to Antd v6, install a different library to fit a recipe, copy its props, or mark unavailable gates passed. Ask only when an unresolved library/API choice blocks the affected design. A code-generation task selects design-side and target-side libraries separately and follows the [model-reading contract](../model-reading.md).
