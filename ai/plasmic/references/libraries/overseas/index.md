# Overseas reference index

Library: Overseas, registered by @shiguang-lab/plasmic-overseas (plasmic-overseas-*). Select this index by the actual registered library, then verify its imported version, implementation and dependencies against the reference baseline. Read [library selection](../index.md); wrapper source versions and Studio published versions are distinct.

One document owns each business component and its child contracts. SearchForm.Item is maintained inside SearchForm; its Studio registration remains unchanged.

## Dependencies

The current maintained implementation declares antd 6.6.5 and @ant-design/icons ^6.0.0. These dependency versions do not form part of the Overseas library name.

Read [Ant Design v6](../antd_v6/index.md) for actual Antd controls placed in SearchForm.Item and [Ant Design Icons](../antd_icons/index.md) when composing its icons. These components keep their own contracts; this business library does not redefine them.

Look up used registration keys in the [component catalog](catalog.md); read only their matching component documents. The catalog is a lookup table, not an additional mandatory full read.

## Composition and acceptance

[SearchForm + Tabs + Table](compositions/search-table.md) combines Overseas query/shell components with Antd-v6 content. For row operations, discover [React UI ActionGroup](../react_ui/components/action-group.md) before choosing the action implementation, including its library dependency and contract. Apply geometry and Preview checks; Form gates inspecting SearchForm controls use the matching Antd-v6 scope.
