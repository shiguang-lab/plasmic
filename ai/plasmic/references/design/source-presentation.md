# Source presentation and native components

Apply [admin content entry](layout.md#admin-content-entry). Record `pageHeader:null`, or an explicit current user exception as `{"nodeName":"EntityHeader","source":"user decision ..."}`. Native region titles remain with their owners.

Before markup apply [native selection](../libraries/index.md#native-component-selection) and [preflight](../libraries/antd_v6/selection.md), mapping required widgets, feedback and overlays in components/controls/region inventories. SearchForm owns filters, Form/Item submitted fields, Descriptions/Item read-only groups. Region/Slot gates check ownership and completeness.

Classify switches by source purpose before recording a component identity. In the Antd-v6 list composition, content-scope navigation follows [Tabs](../libraries/antd_v6/components/tabs.md); choosing a field value follows Radio.Group. Record the chosen native identity in components and real content/action Slot owners in the intent. A plan that merely repeats the generated selector has not reviewed this choice; structural identity checks cannot correct a wrongly classified source role.

For a fallback permitted by the skill's component-priority rule, add optional `elementFallbacks:[{"nodeName":"CustomWidget","reason":"Checked candidates/contracts and concrete unsupported behavior","source":"requirement section + contract evidence"}]` before generation. Each entry targets that exact node only, without covering descendants. The structure check rejects unreviewed raw controls/tables/dialogs, ARIA widgets and ordinary-element click targets. It verifies exception shape and exact targets, not the correctness of the rationale; independent contract review remains necessary.

Before markup follow [authored names and UI copy](content-review.md): reuse functional component names/purposes, declare other authored nodes and review every UI literal/binding at its actual owner/location. Keep source-specific excluded prose separate from useful field help. The saved-model gate checks coverage in both directions; source interpretation and rendered/runtime wording still require review. An absent Form does not prove none was required.

For Overseas/Antd-v6 checks, components also records role/purpose, native property constraints and Slot ownership. A source-driven result table can use these acceptance entries (illustrative names and widths; measure the actual operation content):

```json
[
  {"nodeName":"Results","component":"plasmic-antd6-table","role":"pagination","purpose":"Paged matching records with native total","source":"requirement §Results","rule":"references/libraries/antd_v6/components/table.md","props":{"size":"large","pagination":{"defaultPageSize":20,"pageSizeOptions":[20,50,100]},"scroll":{"x":568}},"dynamicProps":["pagination.showTotal"]},
  {"nodeName":"NameColumn","component":"plasmic-antd6-table-column","role":"widget","purpose":"Main record name absorbs remaining width","source":"requirement §Results","rule":"references/libraries/antd_v6/components/table.md#content-and-scroll-width","presentation":"text","props":{"dataIndex":"name","width":null},"owner":{"nodeName":"Results","slot":"children"}},
  {"nodeName":"CategoryColumn","component":"plasmic-antd6-table-column","role":"category","purpose":"Single-value category shown as plain text in the designated draft","source":"requirement §Category + visual draft category cells","rule":"references/libraries/antd_v6/components/tag.md#tag-or-text","presentation":"text","props":{"dataIndex":"category","width":128},"owner":{"nodeName":"Results","slot":"children"}},
  {"nodeName":"ActionColumn","component":"plasmic-antd6-table-column","role":"widget","purpose":"Final fixed operation column","source":"requirement §Actions","rule":"references/libraries/react_ui/components/action-group.md","presentation":"custom","props":{"fixed":"right","width":200},"owner":{"nodeName":"Results","slot":"children"}},
  {"nodeName":"RowActions","component":"plasmic-react-ui-action-group","role":"row-actions","purpose":"Permission-filtered record operations","source":"requirement §Actions","rule":"references/libraries/react_ui/components/action-group.md","props":{"max":3,"dropdownProps":{"trigger":["hover"]}},"owner":{"nodeName":"ActionColumn","slot":"render"}}
]
```

Inventory other Columns as well. Props are a partial match against actual native props, including nested objects; dynamicProps paths require actual bindings, not similar sibling text. A custom Tag uses its registered identity inside Column.render; Column `presentation` (text or custom) is a plan field matched against the render Slot. Record content scopes as content-scope with actual Tabs identity; field choices use field-choice; widget covers other controls only. Use source-reviewed roles/rules and event feedback from selection preflight. Plain semantic text/layout remains valid.

