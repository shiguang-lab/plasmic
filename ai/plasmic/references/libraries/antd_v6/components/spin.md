# Spin

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Spin | `plasmic-antd6-spin` |

## Generation rules

### Busy region

Use Spin for the actual busy region, keeping useful content visible during a background refresh when the flow permits it. spinning is business state; delay only controls presentation and must not become a submit lock. The native description, indicator, size and fullscreen controls follow this v6 registration.

## Acceptance checks

### Acceptance

The child region needs meaningful bounds; Spin does not create its scroll or height contract. Verify first load, refresh, fast completion, failure and repeated use with [content-state composition](../compositions/content-states.md). Use fullscreen only for an actual page-wide blocked operation, preserve keyboard/focus behavior and remove the spinner when work settles.
