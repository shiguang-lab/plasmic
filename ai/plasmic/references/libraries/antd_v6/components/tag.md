# Tag

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tag | `plasmic-antd6-tag` |
| Tag.CheckableTag | `plasmic-antd6-tag-checkable` |

## Category and mapped values

Use Tag for category/attribute labels; [Badge](badge.md) owns compact semantic status when that fits the business field. This wrapper can map a bound value through options to its label/color, then use defaultColor or explicit automaticColor. Explicit children override mapped content, including a stale demo label: remove them when value mapping should own the text. Preserve zero/false and unknown values according to the requirement.

## Tag.CheckableTag

CheckableTag exposes checked and onChange(checked); the owning selection workflow controls the boolean. Closing an ordinary Tag is a distinct onClose action and must not silently imply deleting the source record. Use the actual supported variant, color, icon and closeIcon contracts.

## Acceptance

Test known/unmapped/empty values, mapping precedence, long labels, optional close/cancel and checked transitions. Keep label meaning readable independently of color, avoid layout jumps when tags wrap and save/reopen real value/options bindings.
