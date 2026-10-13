# Affix

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Affix | `plasmic-antd6-affix` |

## Affixed content

Use Affix when a region must remain visible within its actual scroll context. offsetTop/offsetBottom and onChange(affixed) follow the registration; choose an offset from real fixed headers/footers rather than from a screenshot. Affixed content retains its normal-flow space and does not become the business state owner.

## Acceptance

Discover the actual scroll target; the current registration does not imply an arbitrary target control. Test entering/leaving affixed state, short/long content, the final row and viewport resizing. Follow [sticky-region rules](../../../design/layout.md#sticky-regions-overlays-and-acceptance); overlapping controls or document-only behavior in a separately scrolling shell must be resolved or reported as a capability gap.
