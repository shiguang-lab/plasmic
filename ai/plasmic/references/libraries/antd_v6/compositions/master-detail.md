# Master-detail composition

Applies to the selected [Ant Design v6](../index.md) [Tree](../components/tree.md), [Menu](../components/menu.md), [List](../components/list.md) or [Table](../components/table.md), plus the actual detail components. Layout uses supported [Flex](../components/flex.md), [Grid](../components/grid.md) or [Splitter](../components/splitter.md); only use Splitter when user resizing is required. An existing host/AppShell remains the single page shell.

## Selection and dependent content

One parent region owns the selected stable business identity and passes verified data/state to the detail. Selection controls content; it does not fabricate a persisted route or save operation. Record direct-entry/default-selection behavior, missing/deleted/unauthorized selection and whether selection participates in a real route. A selection event's registered keys/info shape is not automatically an entity object.

Only valid current selection loads its dependent detail. Old responses must not overwrite a newer selection or a closed/reopened edit session. Keep required selected labels while data changes. Dirty edit, safe switch, reset and recovery behavior follow the actual workflow; do not silently discard input when users select another row/node.

## Layout and acceptance

Derive master/detail widths from real navigation labels and detail content, not fixed screenshot coordinates. For a short region use one growing page scroll; independently scrolling panels require actual bounded supported scroll integrations and remain distinct intentional owners without a nested outer scrollbar. Verify long tree/list labels, full detail content, narrow required widths and final actions through [shared layout](../../../design/layout.md).

Test initial/no selection, two distinct selections, rapid switching, loading/error/recovery, changed/deleted selection and direct-route entry where used. Verify the rendered detail matches its actual key, dirty-input policy, keyboard focus and scroll reachability. Save/reopen actual model bindings; sample detail text next to a highlighted row is not proof of a working relationship.
