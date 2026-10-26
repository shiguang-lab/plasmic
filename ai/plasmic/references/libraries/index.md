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

For the supported admin scope, read [protected composition policy](../design/component-policy.md) before choosing configuration. Native API capabilities do not authorize changing the owning reference's required generation baseline. The same inventory records source-backed exceptions, App context and business runtime cases; no detailed rule belongs in SKILL.md.

First distinguish insertable components from project contexts. MCP inventories and projected contracts retain `isContext:true` on global-context definitions. Read the consuming project's `collection:"globalContexts"` for installed instances/overrides, then their live `globalActions` contracts. These contexts already wrap Pages; reuse their actions/settings rather than selecting them as page widgets. A `children` Slot or shared `type:"code"` does not change that ownership.

Choose components before markup for every prototype creation or edit. Discover reusable business components/templates and library registrations through Desktop MCP by the required role, then read candidate contracts. Prefer an existing business component or matching template, then registered library components, then compositions of those components. Preserve the user's library choices and the target project's actual APIs; a template must fit the requirement. Do not install another library or add a Card merely to satisfy this preference.

Use real Props, Slots, states and events for functional widgets, including actions, controls, navigation, repeated information, pagination, feedback and overlays. Do not redraw available components with HTML/CSS; visual similarity is not component reuse. Plain semantic text, necessary root/Slot/layout containers, genuine navigation anchors, read-only code and content graphics remain valid native elements; do not turn every text node or wrapper into a component or surface.

Use a custom element widget only when verified current components and their supported compositions cannot express the required behavior. Before writing it, record the exact named node, checked candidates/contracts, concrete gap and requirement source in the task plan. An unread contract, absent import, rendering error, styling convenience or missing binding is not a capability gap. Correct usage or report the blocker; ordinary design work does not create a new component library. A fallback cannot override a required native identity, Form ownership or another acceptance gate.

For Overseas/Antd-v6 admin prototypes, use the registered AppShell for standalone Pages; reuse an existing host shell only with verified host ownership, without drawing another shell. Map filters to SearchForm, submitted fields to Form/Form.Item, tables to Table/Column and read-only groups to Descriptions/Item through the selected libraries' real registrations. Standalone input controls do not replace Form ownership and validation. Read the admin templates and live contracts before composition. Inside AppShell, start with business content; omit standalone Page titles, headers, subtitles and introductions unless the current user explicitly requests them. Keep requirement scope, implementation notes and acceptance instructions outside the business UI.

For the Overseas/Antd6 suite, read [purpose-first selection](antd_v6/selection.md) before choosing components, including competing candidates and feedback global actions. Keep source expectations independent of generated choices. Use the following roles to search other matching library catalogs and select relevant component/composition documents.

| Required role | Select from the actual installed library |
| --- | --- |
| Actions and editable values | Button/ActionGroup, actual Input/Select/date/numeric controls, Form ownership and validation |
| Navigation and repeated information | Tabs/Menu/Breadcrumb, Table/Column, Pagination, Descriptions, List |
| Feedback and overlays | Alert/Tag/Badge/Empty/Spin, Tooltip/Popconfirm/Modal/Drawer |
| Arrangement and surfaces | Flex/Row/Col/Space where their layout role fits; Card only for an independent business surface |

These are role examples, not cross-library API names. Classify the source purpose and read its applicable composition before selecting a registration. Record selected identities and ownership in the [native-component inventories](../requirement-alignment.md#presentation-copy-and-native-components). Discover a required composition's cross-library participants even when they are not installed yet; install the selected dependency and read its contract, or report the concrete gap. Inspect inactive states and their native visibility/content Slots.

Typography components are useful when their registered behavior or theme contract is needed. Root sizing and necessary Slot/semantic container styles follow [shared layout](../design/layout.md).

Record a verified fallback using the [elementFallbacks format](../requirement-alignment.md#presentation-copy-and-native-components).

## Read by actual library

1. Match the actual registration and implementation/API family to a scope above. A business-library prefix alone does not establish its underlying UI version; verify dependencies before selecting an Antd-v6 scope. Unknown versions remain unknown.
2. Read that scope's index, look up used registration keys in its linked catalog, and read only the affected main-component documents, including their relevant child/variant sections. Every component and composition document uses the stage template (preamble with optional hard constraints, Plan decisions when declared, Generation rules, optional Conditional rules and Acceptance checks); for a planned Page, the [rules card](../planning.md#rules-card-and-read-ledger) selects these sections from each library's `rules.json`. Verify live Props, Slots, defaults, events and state against the current project; a reference baseline does not replace its contracts.
3. Read a composition recipe only when its declared participating libraries match the chosen components. Follow the decision references for competing candidates before excluding them, then the selected components' cross-library contracts. Keep each library's props, tokens, size values and behavior in its own scope; never apply Antd-v6 rules to Antd-v5 or another library solely because names look alike.
4. The full automatic suite supports the [standalone fixed-viewport Overseas/Antd6 scope](../verification.md). For local edits or other/mixed libraries, preserve unrelated Pages, use focused scripts from the matching indexes and report uncovered checks; never change libraries to pass a gate. Selection preflight retains source-derived roles but does not certify foreign-library semantics. Shared [layout](../design/layout.md), [keyboard/focus](../design/accessibility.md), [node naming](../design/naming.md) and [icon selection](../design/icons.md) rules apply independently of library choice.

The project rules card requires this index, each selected registration's actual library index, and the Overseas/Antd6/React UI purpose-first selection rules when those libraries participate. Read them once before the first component decision; new library participants update that same project card. Page cards require the owning component rules and applicable compositions. Page-type recipes and the admin scale apply to the supported v6 suite, not an Antd-v5 page. A mixed-library page receives component-owned rules and applicable native compositions without treating one library's page recipe as another's contract. Conditional composition reads include selected Table rows, content states and Steps with Form even inside a list overlay. A rule card verifies delivery, not semantic coverage or cross-library compatibility; review the selected contracts and report unavailable scope-specific checks.

## Missing or new library scopes

When no matching scope exists, use the current library's verified implementation/registration and the actual requirement with shared design rules; report the missing reference coverage. Do not silently fall back to Antd v6, install a different library to fit a recipe, copy its props, or mark unavailable gates passed. Ask only when an unresolved library/API choice blocks the affected design. A code-generation task selects design-side and target-side libraries separately and follows the [model-reading contract](../model-reading.md).
