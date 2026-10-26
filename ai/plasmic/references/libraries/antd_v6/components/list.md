# List

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| List | `plasmic-antd6-list` |
| List.Item | `plasmic-antd6-list-item` |
| List.Item.Meta | `plasmic-antd6-list-item-meta` |

## Generation rules

### Design defaults

- Use for a few repeated items without comparable columns (activity, notices, checklists); records with attributes use Table.
- Each item shows its title, short description and at most two actions.

### Static or data-driven items

Use List for repeated content whose structure is an item rather than a table column matrix. Static children and dataSource/renderItem are distinct ownership paths; choose the one required by the content. The registered renderItem Slot exposes item and index bindings. Keep stable item identity and use each row's actual data rather than duplicating the first sample item.

### List.Item and List.Item.Meta

An Item owns its content, extra and actions; Meta owns title, description and avatar. This wrapper converts action Slot children to the native actions array, so retain actual action nodes. Keep navigation/selection separate from destructive child actions and use native labels for icon-only operations.

## Acceptance checks

### Acceptance

Test multiple distinct items, long/empty values, loading, no results and permission-dependent actions. Verify headers/footers and item spacing, row bindings and each action in real Preview. Use [content states](../compositions/content-states.md) and [shared layout](../../../design/layout.md); no second native scrolling wrapper is needed for an ordinary growing List.
