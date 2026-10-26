# Admin design reference index

Use [library and API selection](libraries/index.md) and [native component selection](libraries/index.md#native-component-selection) for the target project's libraries, then select affected references below. Shell reuse follows [shared layout](design/layout.md).

| Affected area | Read |
| --- | --- |
| A specific registered component | Its matching library index and component document |
| Page regions and their order (every Page) | [Page types](design/page-types.md) |
| Spacing, widths, component sizes, typography and density defaults (every Page) | [Admin design scale](design/scale.md) |
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

Read [admin templates](admin-templates.md) and [the catalog](templates/admin/catalog.json) when selecting or composing templates. A template's declared/source libraries must match the selected project components; the current catalog is not a default library choice for every project. When it does not fit, compose from the chosen registered library rather than install another library just to use that template. Keep one shell per standalone page and current-project business bindings.

Apply [source precedence and explicit project-policy exceptions](requirement-alignment.md#source-and-scope); live component contracts define available capabilities. Business language remains configured; persisted registrations/Props/Slots retain their identities. Read only affected rules. Run only gates applicable to the selected library/API scope and independently reviewed inventory, then check real Preview behavior under [evidence integrity](verification.md#evidence-integrity). Save/reopen and reread after edits; read-only reviews do not mutate designs. Keep inventories/evidence outside the product UI.

Wrapper or editor-runtime work additionally uses [shared engineering verification](engineering/component-contracts.md). Do not turn an ordinary design task into platform development when a capability is unavailable.
