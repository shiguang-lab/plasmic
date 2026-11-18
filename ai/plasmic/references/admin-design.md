# Admin design reference index

Use [library and API selection](libraries/index.md) and [native component selection](libraries/index.md#native-component-selection) for the target project's libraries, then select affected references below. The admin scale, page recipes and published reference canvas apply to the supported Overseas/Antd6 suite; other libraries retain their own usage references and task-derived layout. Shell reuse follows [shared layout](design/layout.md).

| Affected area | Read |
| --- | --- |
| A specific registered component | Its matching library index and component document |
| Page task, region relationships and arrangement (before detailed planning; review per Page) | [Page structure design](design/page-structure.md), then [Page types](design/page-types.md) for starting skeletons |
| Spacing, widths, component sizes, typography and density defaults (supported admin suite only) | [Admin design scale](design/scale.md) |
| Shell, sizing, alignment, overflow, scrolling, responsive layouts or surfaces | [Shared layout](design/layout.md), then the chosen library's layout/shell/surface rules |
| Supporting text, read-only fields, metrics or headings | Selected library's typography, information/metric components and applicable composition |
| Queries, scopes, tables, pagination or overflow | Selected libraries' query, table, pagination and overflow components; a composition with matching participants |
| Actions, navigation, feedback or confirmation | Selected library's action/feedback contracts and matching action-bar recipe |
| Editable fields and validation | Selected library's Form/field contracts and applicable form-layout/gate rules |
| Overlay structure, dismissal or footer | Selected library's overlay/close contracts and matching recipe |
| Detail actions and return navigation | Selected navigation/action/icon contracts; read detail-header only for a current user-requested Page header |
| Node creation, copying or renaming | [Node naming](design/naming.md) |
| Library icons | [Icon selection](design/icons.md), then the actual icon-library scope |
| Keyboard, focus, accessible names or readable feedback | [Shared accessibility](design/accessibility.md), then the affected component contracts |

For Overseas/Antd6 admin design, select references from the [published template canvas](admin-templates.md). Keep one shell per standalone page and bind business behavior in the destination project.

Apply [source precedence and explicit project-policy exceptions](requirement-alignment.md#source-and-scope); live component contracts define available capabilities. Business language remains configured; persisted registrations/Props/Slots retain their identities. Read only affected rules. Run only gates applicable to the selected library/API scope and independently reviewed inventory, then check real Preview behavior under [evidence integrity](verification.md#evidence-integrity). Save/reopen and reread after edits; read-only reviews do not mutate designs. Keep inventories/evidence outside the product UI.

Wrapper or editor-runtime work additionally uses [shared engineering verification](engineering/component-contracts.md). Do not turn an ordinary design task into platform development when a capability is unavailable.
