# Splitter

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Splitter | `plasmic-antd6-splitter` |
| Splitter.Panel | `plasmic-antd6-splitter-panel` |

## Generation rules

### Resizable sibling panels

Use Splitter for a real user-resizable layout, with direct Splitter.Panel children in the registered Slot. The current registration uses orientation and onResize(sizes); panels expose defaultSize, min, max, resizable and collapsible. Read supported units and native size constraints rather than guessing them from an ordinary Flex layout.

### Ownership and acceptance

Splitter needs a meaningful bounded region; remove its sample 240px height when that is not the actual requirement. Each panel's content retains its own supported scroll contract without adding a parallel outer scrollbar. Verify drag and keyboard resize when supported, minimum/maximum size, collapse/restore, long content and action reachability. Persist panel size only when the workflow requires it; canvas selection must not alter saved business state.
