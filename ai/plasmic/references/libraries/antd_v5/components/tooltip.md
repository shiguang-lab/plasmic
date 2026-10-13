# Tooltip

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tooltip | `plasmic-antd5-tooltip` |

## Explanation and title ownership

Use the actual title Slot or titleText fallback and children/placement contract. A Tooltip explains its trigger; it does not carry the only visible required instruction or validate a field. This registration does not expose the v6 onlyWhenOverflow capability; do not claim overflow-only behavior without a supported implementation.

## Acceptance

Verify complete/empty title content, hover/focus, disabled/long triggers and viewport bounds. Use a real accessible action name for icon-only controls rather than assuming a popup supplies it. Save/reopen actual content and check that showing the explanation never triggers navigation or a mutation.
