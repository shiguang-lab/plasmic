# Listy

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Listy | `plasmic-antd6-listy` |

## Bounded or virtualized list

This maintained wrapper accepts items with key/content and renders content as text with rowKey=key. Read height, virtual and sticky from the actual registration. It does not expose the rich renderItem Slot of [List](list.md); select that component when the requirement needs editable item layouts and actions.

## Acceptance

Use stable unique keys, the actual data and a requirement-derived bounded height. Verify short/long content, the last item, scrolling and sticky/virtual behavior only when enabled. Reuse the existing component's virtualization/scroll integration rather than creating a second native scroll container. Report an unavailable shared-Scrollbar integration as a component capability gap instead of claiming conformance from a screenshot.
