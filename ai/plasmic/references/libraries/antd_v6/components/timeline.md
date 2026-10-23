# Timeline

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Timeline | `plasmic-antd6-timeline` |

## Generation rules

### Ordered history

Use Timeline for actual ordered events. This registration uses items with title/content, mode=start/end/alternate and reverse. Preserve the requirement's chronology, timestamp meaning and distinction between completed, pending and failed events; do not present sample activity as real history or borrow another version's item field names.

## Acceptance checks

### Acceptance

Verify ordering in both display directions when used, complete long event text, missing optional metadata and empty history. The outer region owns width/scrolling and section spacing. Check that meaningful states have readable labels and save/reopen the real data binding.
