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
- Tab-bar bottom to first panel content defaults to **0px**, including nested Tabs. Only an explicit requirement for nonzero spacing permits an exception; record its source. Apply and verify [panel entry spacing](#panel-entry-spacing) through the real supported styling contract.
- When a Tab identifies its only business content block, omit the block's repeated heading, including plain text and component title Slots. Follow [panel heading ownership](#panel-heading-ownership); helper text and toolbars do not make a second business block.
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

### Panel entry spacing

The boundary from the tab bar's bottom edge through the panel and every wrapper to the first visible business content box (a necessary heading, toolbar, Table, information group or nested Tabs) defaults to **0px**. This applies independently at every Tabs level and overrides a nonzero theme-provided bar-to-panel gap. Remove the bar's content-side gap and all contributing panel/wrapper top padding, first-child margins, extra gaps, empty leading children and reserved rows. Only an explicitly required nonzero value is an exception; record that requirement and value, rather than inferring an exception from a template or theme default.

Read the installed component's real styling contract and use its supported styling entry point for the tab bar/content boundary. Do not guess props, use negative margins/transforms to cancel another offset, or shrink label padding, click targets, tab height or the indicator to remove the gap. If no supported entry point is available, report the exact contract gap and leave this check unresolved. Preserve accessible Tab/panel association and native tab-label/indicator behavior. [Spacing ownership](../../../design/scale.md#spacing) still applies to the separate boundaries below the first content.

Within the panel, a necessary heading and its following Table are a separate boundary. Use the applicable [design scale](../../../design/scale.md#spacing) or source-defined spacing once on their parent layout, without child margins. Keep component-owned title/content spacing native; an authored heading-to-Table gap is not a reason to override every component's internal spacing.

### Panel heading ownership

The Tab label already identifies its content scope. When the panel contains one Table/list, Card, Form or Descriptions group, start with that content or its necessary controls; do not repeat the scope as a section heading, Card title, Table title or Descriptions title. This applies through layout wrappers and to a single shared Table after scope Tabs. A synonym such as `设备信息` → `设备清单` or `银行卡` → `卡列表` still repeats the same scope.

Count business regions, not child nodes: filters, actions, pagination, status and helper text supporting one block do not justify a heading. Assess whether each note needs display under [copy economy](../../../design/content-review.md#copy-economy); removing a heading does not automatically justify retaining its accompanying note. Keep record identities, field labels and necessary instructions; they are not repeated section headings.

Use subsection headings when multiple distinct business regions in the same panel need names to be understood. An explicit current user request for a visible heading takes precedence; a template title, source section name or screenshot alone does not require retaining it. A Card identified by its owning Tab follows heading ownership before the Card actions/header rule: use the existing tab-bar extra for shared actions or a panel toolbar for panel-scoped actions, without inventing a title to host them.

Remove obsolete heading nodes/Slot content and any now-empty heading wrapper, divider or reserved height. Do not hide the heading with CSS or offset its retained space. Apply [panel entry spacing](#panel-entry-spacing), preserving supported component structure, necessary content spacing and accessible Tab/panel association.

### Items

Each Tab Item is a separately registered child of [Tabs](tabs.md), with a unique key, label Slot and children content Slot. Independent content belongs in that Slot, including inactive branches. For source-defined shared-Table scopes, clear sample children and bind the active key to the single sibling Table's scope; reset pagination on changes. Check both directions and save/reopen ownership.

## Acceptance checks

- In every affected Tab, nested Tabs level and relevant conditional state, measure the tab bar bottom and the first visible business content box top; trace the bar's content-side spacing and every intervening panel/wrapper's padding, margin, gap and empty children. The measured boundary must be 0px unless an explicitly required nonzero value has a recorded source. Verify the supported styling change, unchanged label click targets/indicator, and a separate retained heading-to-content boundary against its own layout/native owner; repeat after save/reopen. A retained native 16px/12px gap does not pass this default.
- Visit every affected Tab, including initially inactive panels. Compare the Tab label with the visible business regions and check [panel heading ownership](#panel-heading-ownership) in both saved markup and the rendered scene. A single identified block has no repeated plain-text or component title, including synonymous wording; filters/help/actions/pagination do not exempt it. Record why any retained subsection heading is needed.
- After removing a heading, apply [copy economy](../../../design/content-review.md#copy-economy) to accompanying notes; preserve necessary help and actions, remove redundant notes, and verify that the first content/controls align normally with no empty header, divider, spacer or reserved height. Recheck after save/reopen; an empty title Slot alone does not prove the whole panel is free of repeated headings or notes.
- Read the saved instance props: initial-only Tabs leave `activeKey` absent and use `defaultActiveKey` only when needed. Controlled Tabs bind `activeKey` to state and update that same state through `onChange`; check any dependent content or pagination as well.
- In interactive mode or live Preview, use ordinary clicks to switch to another tab and back, checking both the selected indicator and the matching content. Editing selection and Command/Ctrl + Click do not pass this runtime check.
- Save/reopen and reread the key props, then recheck the initial tab and bidirectional switching. Temporary reveals and runtime clicks must not rewrite the saved initial key.
