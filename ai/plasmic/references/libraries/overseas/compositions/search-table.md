# SearchForm + Tabs + Table

## Generation rules

Applies to [Overseas](../index.md) query/shell components and [Ant Design v6](../../antd_v6/index.md) controls, Tabs and Table. Lists with row operations also require discovering the registered [React UI ActionGroup](../../react_ui/components/action-group.md) and its library dependency before choosing the action implementation. Select these libraries through the [library index](../../index.md).

Read component rules only for the affected parts: [Card](../../antd_v6/components/card.md#card-ownership), [SearchForm](../components/search-form.md), [Tabs](../../antd_v6/components/tabs.md), [Table](../../antd_v6/components/table.md), [Pagination](../../antd_v6/components/pagination.md), [Dropdown](../../antd_v6/components/dropdown.md), [ActionGroup](../../react_ui/components/action-group.md), [Tooltip](../../antd_v6/components/tooltip.md) and [Badge](../../antd_v6/components/badge.md). This file owns query/list composition and cross-region acceptance.

### Query and list structure

Query → list toolbar/Tabs → Table → pagination. Every list query region uses the registered Overseas SearchForm and its real editable Item/control nodes. Keep applied filters separate from drafts; use the SearchForm contract for submitted/reset values and page-one updates. Derive filters from the current requirement.

Business actions such as create, import or launch are distinct from SearchForm's query/reset/expand controls. For a tabbed list, the shared primary action belongs once in Tabs `tabBarExtraContentRight`; this takes precedence over a separate toolbar above the filters. A separate business toolbar applies when the list has no scope Tabs, or the current user explicitly requests that placement. When it is above a SearchForm, align actions to the content region's left edge using normal flex flow (`justify-content: flex-start`), with an 8px action gap and 16px separation from the filter row. The button's outer left edge aligns with the SearchForm's inner content edge, not with the label glyphs or the input after labelWidth. Page-header actions, Modal footers and the SearchForm's own action column retain their respective contracts.

Select [Tabs](../../antd_v6/components/tabs.md) for content scopes such as All/Mine before freezing the source inventory; button-shaped Radio.Group options remain field choices. Each Tab Item children Slot owns its Table, pagination and relevant state. Keep one shared primary page action; scope-specific actions remain with their owning content. For this tabbed result-list composition, place Tabs and its Tab-owned Tables/pagination inside one registered Card children Slot. The Card supplies their shared background and left/right inset; apply [Card ownership](../../antd_v6/components/card.md#card-ownership) before markup for explicit empty header Slots, body padding and top/bottom spacing. This list surface has no Card header; clear its defaults during initial composition. Keep SearchForm outside that Card. Preserve identical column definitions for comparable scopes.

For a source-defined creation menu, follow [Dropdown grouping](../../antd_v6/components/dropdown.md) and place that Dropdown in Tabs `tabBarExtraContentRight` when it is the shared action. Bind each menu choice to its intended destination. Pin its native component identity and `owner:{nodeName:"ScopeTabs",slot:"tabBarExtraContentRight"}` in the source inventory before markup. Pin the trigger Button's owner as that Dropdown's `children` Slot. Verify the visible menu and each destination in Preview, including after switching Tabs.

### Pagination and scrolling

Default page size 20 with options 20/50/100 unless the requirement says otherwise. Prepare each scope's initial dataset and verify its actual records/total under [Table paging data and acceptance](../../antd_v6/components/table.md#pagination-test-data-and-acceptance); a few copied draft rows are insufficient. Let the Table grow naturally; scroll the AppShell content region to reach pagination. For a Table inside a Modal, bound and scroll the Modal content region instead of the Table body, keeping the title and footer reachable. Verify the configured page sizes, filter collapse when available and the actual content scopes: the whole business region moves vertically while shell navigation stays fixed, with no second Table body scrollbar. Do not force a tall empty card; leave bottom spacing 16px once.

Keep current/pageSize/total under one pagination owner. Prefer the Table's pagination for these lists; use its native showTotal(total, range) binding for total text before the pager controls. Never replace this capability with a sibling literal counter. A source-required standalone Pagination uses its own showTotal and requires disabling the duplicated Table pager. Bind totals to the full matching result set, then exercise zero results, reset, scope and page-size changes.

## Acceptance checks

### Region acceptance

Verify the shared Card contains Tabs and each Tab contains its Table; measure its body edges against the Card reference, including zero external top/bottom padding. Verify row operations against one current user and records with source-defined access differences; role simulation switches and current-role debug badges do not belong in the business page.

Inventory every SearchForm by Page/Tab, including inactive Tabs, and run its component acceptance. Record business-action grouping and Slot ownership independently of the generated output. For a tabbed list, verify the one shared action in the tab bar's right extra Slot; for an approved toolbar above filters, measure its outer left edge against the filter content edge within 1 CSS pixel. Exercise query/reset separately from business actions; actions must reach their intended destination with required permission/disabled behavior.

Combine applicable component checks in real Preview: configured page sizes, available expand/collapse controls, both directions of existing scope switches, longest values, overflow Tooltips, fixed-right operations and required horizontal scrolling. Verify that the shell stays fixed and the single content scroll owner reaches pagination. Save/reopen and reread changed props/Slots/bindings. Record model, geometry, screenshot and interaction outcomes separately; unvisited Tabs or unmeasured criteria remain unverified. Correct generation input and delivered models together when a rule fails.
