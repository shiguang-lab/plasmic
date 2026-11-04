# Tabs

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tabs.TabPane | `plasmic-antd6-tab-item` |
| Tabs | `plasmic-antd6-tabs` |

**Hard constraints** (always delivered with any section):

- Tabs own content scopes or record sections; a field value choice uses Radio/Select/Segmented instead, and a single in-scope Tab is not rendered.
- Independent Tab content owns its Table, pagination and state. Source-defined scopes over one shared Table follow [query/list composition](../../overseas/compositions/search-table.md#query-and-list-structure).
- A Tabs-first Card is headerless with body `0 20px`; shared actions go in `tabBarExtraContentRight`. Tabs size is `medium`.
- Choose an initial tab with `defaultActiveKey` and leave `activeKey` unset. Never use a fixed `activeKey` as a default; controlled Tabs require a state binding and an `onChange(activeKey)` handler that updates that same state.

## Generation rules

### Design defaults

- Use for two or more mutually exclusive content scopes or record sections on one surface; a single in-scope Tab is not rendered as Tabs.
- Type `line`. Labels are short nouns from the source. Shared actions of the Tabs go in its extra.
- Tabs as first content of a Card makes the Card headerless with `0 20px` body padding ([Card](card.md#card-ownership)).

### Usage and behavior

Read the installed Tabs contract. Use actual [items](#items), never drawn tab labels. [SearchForm + Tabs + Table](../../overseas/compositions/search-table.md) owns independent/shared Table placement; [Card spacing](card.md#card-ownership) owns outer edge padding.

For ordinary content switching, set only `defaultActiveKey` when a specific initial tab is required; omit both key props when the component's default is sufficient. For example, `{"defaultActiveKey":"base"}` starts on Basic information and still allows user switching. Do not also set `activeKey` to that key.

Use controlled Tabs only when business behavior needs the active tab outside the component, such as a shared sibling Table's scope. Bind `activeKey` to writable state, initialize that state to the required key, and update it from the registered `onChange(activeKey)` argument. For example, pair `activeKey="{{ $state.selectedTab }}"` with `$state.selectedTab = activeKey` in `onChange`. A fixed `activeKey` keeps rendering that tab even after another tab is clicked; `defaultActiveKey` cannot override it.

Selection-driven reveals and Command/Ctrl + Click in the editing canvas are temporary editing behavior. They do not establish that runtime switching works and must not be implemented by rewriting either saved key prop.

Choose by the source's interaction role before markup. Switching a list's content scope, such as All/Mine, uses Tabs with source-defined Table ownership. Radio.Group selects one field value; its button appearance does not make it content navigation. An explicit current user control choice prevails. Declare the Tabs identity and content/action ownership before generation; two adjacent reference options do not establish Radio semantics.

Preserve registered motion defaults: animated=true, animateTabBar=true and animateTabContent=false. Do not disable all animation merely to switch Table content immediately; ink-bar and content animation are independent controls. Override these defaults only for an explicit requirement.

In live Preview, switch Tabs in both directions and verify the animated ink-bar class, correct indicator bounds and matching content. Recheck delivered props and motion after save/reopen; static screenshots alone do not prove motion.

`tabBarExtraContentRight` is the registered Slot for trailing tab-bar actions. Shared versus scope-specific list action placement follows [query/list composition](../../overseas/compositions/search-table.md#query-and-list-structure).

An Overseas/Antd-v6 tabbed result list keeps Tabs and its independent or shared Table(s) inside one Card. Do not add nested Cards around Tabs/Tables. Read [Card ownership](card.md#card-ownership) and the query/list structure before composition.

### Items

Each Tab Item is a separately registered child of [Tabs](tabs.md), with a unique key, label Slot and children content Slot. Independent content belongs in that Slot, including inactive branches. For source-defined shared-Table scopes, clear sample children and bind the active key to the single sibling Table's scope; reset pagination on changes. Check both directions and save/reopen ownership.

## Acceptance checks

- Read the saved instance props: initial-only Tabs leave `activeKey` absent and use `defaultActiveKey` only when needed. Controlled Tabs bind `activeKey` to state and update that same state through `onChange`; check any dependent content or pagination as well.
- In interactive mode or live Preview, use ordinary clicks to switch to another tab and back, checking both the selected indicator and the matching content. Editing selection and Command/Ctrl + Click do not pass this runtime check.
- Save/reopen and reread the key props, then recheck the initial tab and bidirectional switching. Temporary reveals and runtime clicks must not rewrite the saved initial key.
