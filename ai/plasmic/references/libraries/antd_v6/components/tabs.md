# Tabs

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tabs.TabPane | `plasmic-antd6-tab-item` |
| Tabs | `plasmic-antd6-tabs` |

Read the installed Tabs contract. Use actual [items](#items) represented by Tab Item nodes; do not draw tab labels above sibling content. [SearchForm + Tabs + Table](../../overseas/compositions/search-table.md) owns data-scope composition; [Card spacing](card.md#card-ownership) owns outer edge padding.

Choose by the source's interaction role before markup. Switching a list's content scope, such as All/Mine or different result categories, uses Tabs with real Tab Item content. Radio.Group selects one field value; its button appearance does not make it content navigation. An explicit current user control choice prevails. Declare the selected Tabs identity in the source inventory and its content/action Slot ownership in the intent before generation; two adjacent options in a reference do not establish Radio semantics.

Preserve registered motion defaults: animated=true, animateTabBar=true and animateTabContent=false. Do not disable all animation merely to switch Table content immediately; ink-bar and content animation are independent controls. Override these defaults only for an explicit requirement.

In live Preview, switch Tabs in both directions and verify the animated ink-bar class, correct indicator bounds and matching content. Recheck delivered props and motion after save/reopen; static screenshots alone do not prove motion.

`tabBarExtraContentRight` is the registered Slot for trailing tab-bar actions. Shared versus scope-specific list action placement follows [query/list composition](../../overseas/compositions/search-table.md#query-and-list-structure).

For an Overseas/Antd-v6 tabbed result list, the shared outer Card contains Tabs, while each Tab Item owns its Table. The Card owns the surface and outer horizontal inset; do not remove that shared surface or add nested Cards around individual Tabs/Tables. Read [Card ownership](card.md#card-ownership) and the full query/list structure before composing this layout.

## Items

Each Tab Item is a separately registered child of [Tabs](tabs.md), with its unique key, label Slot and children content Slot. Place each scope's real Table, pagination and relevant state in that content Slot rather than under a sibling wrapper. Check inactive as well as active content and save/reopen ownership.
