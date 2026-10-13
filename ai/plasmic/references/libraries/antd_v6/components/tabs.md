# Tabs

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tabs.TabPane | `plasmic-antd6-tab-item` |
| Tabs | `plasmic-antd6-tabs` |

Read the installed Tabs contract. Use actual [items](#items) represented by Tab Item nodes; do not draw tab labels above sibling content. [SearchForm + Tabs + Table](../../overseas/compositions/search-table.md) owns data-scope composition; [Card spacing](card.md#card-ownership) owns outer edge padding.

Preserve registered motion defaults: animated=true, animateTabBar=true and animateTabContent=false. Do not disable all animation merely to switch Table content immediately; ink-bar and content animation are independent controls. Override these defaults only for an explicit requirement.

In live Preview, switch Tabs in both directions and verify the animated ink-bar class, correct indicator bounds and matching content. Recheck delivered props and motion after save/reopen; static screenshots alone do not prove motion.

## Items

Each Tab Item is a separately registered child of [Tabs](tabs.md), with its unique key, label Slot and children content Slot. Place each scope's real Table, pagination and relevant state in that content Slot rather than under a sibling wrapper. Check inactive as well as active content and save/reopen ownership.
