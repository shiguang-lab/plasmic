# Anchor

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Anchor | `plasmic-antd6-anchor` |

## Generation rules

### In-page navigation

Use Anchor for actual sections in the same scroll context. Each items entry retains a stable key, target href and meaningful title, and the target node exists in the delivered page. The registered affix, offsetTop, direction and onChange(href) describe navigation presentation/state; changing the active anchor does not submit or mutate business data.

## Acceptance checks

### Acceptance

Verify every target, selection while scrolling, direct fragment navigation and target visibility below fixed headers. Discover the actual scroll container instead of inventing an unregistered container prop. Test long labels and relevant hidden sections; apply [shared layout](../../../design/layout.md) so an affixed anchor does not overlap content or create another scroll owner.
