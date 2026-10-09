# Admin design reference index

Use this index to select references for the affected regions. Read only those references before composing or reviewing that region; a small edit does not require unrelated rules. Live component registrations and the current requirement define Props, Slots, values and behavior.

Reuse registered Antd6 Flex, Row/Col, Space and Card; use the existing AppShell for standalone pages. Read [admin templates](admin-templates.md) and the [catalog](templates/admin/catalog.json) when selecting or composing templates. Keep one shell per standalone page and current-project business bindings.

| Affected region | Read before working on it |
| --- | --- |
| Shell, viewport, scrolling or Card surfaces | [Layout](design/layout.md) |
| Supporting text, read-only fields, metrics or headings | [Information hierarchy](design/information.md) |
| Creation, copy or renaming of editable nodes | [Node naming](design/naming.md) |
| Filters, Tabs, Tables, pagination or overflow | [Queries and lists](design/lists.md) and the live [SearchForm contract](search-form.md) when used |
| Buttons, navigation, feedback or confirmation | [Actions](design/actions.md) |
| Editable fields, Form validation or Modal/Drawer forms | [Forms](design/forms.md) |
| Record detail heading and return navigation | [Detail headers](design/detail.md) |

These are admin design conventions adapted from pen-antd-kit; they do not supply component identifiers or replace the actual registration. Explicit user-approved designs take precedence over defaults. Business language remains configured; Studio labels remain English.

Run the applicable structural gates and real Preview checks described in the selected references. For design edits, save/reopen and reread the changed model; read-only reviews do not save or alter designs. Model validation and screenshots answer different questions; neither alone proves behavior. Keep source inventories and evidence outside the product UI.

Component wrapper or editor runtime work additionally uses [engineering verification](engineering/component-contracts.md). Do not turn an ordinary design task into platform development when a capability is unavailable.
