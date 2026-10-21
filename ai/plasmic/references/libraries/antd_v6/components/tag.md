# Tag

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tag | `plasmic-antd6-tag` |
| Tag.CheckableTag | `plasmic-antd6-tag-checkable` |

## Tag or text

Category is a business meaning, not a requirement to use Tag. Ordinary single-value attributes default to text, including type, market, source and department. A short enum or a field named “type” is insufficient reason to add a Tag. Lifecycle/processing states follow [Badge](badge.md).

| Source purpose and presentation | Choice |
| --- | --- |
| Ordinary single-value classification with no requested emphasis | Text |
| Independent business labels, often several per record and read individually | Tag |
| Classification explicitly shown as labels in the designated visual draft or required by an applicable design rule | Tag |
| Selected filter criteria that can be removed individually | Closable Tag; closing removes that criterion |
| A boolean selection expressed as a checkable label | Tag.CheckableTag |
| Name, identifier, time, amount or description | Text or its appropriate dedicated presentation |

Honor the current user's explicit presentation choice and applicable mandatory field rules; otherwise preserve the designated visual draft. This general Tag applicability guidance does not override a draft's plain text. Without a specified presentation, use the defaults above. Keep one presentation for the same field across rows and equivalent Tabs; Form choices, detail text and removable filters serve different purposes and need not share a renderer. Do not add colored labels just to decorate a dense table.

## Mapped values and color

This wrapper can map a bound value through options to its label/color. Use a fixed reviewed mapping across equivalent views. With no color requirement, use a neutral Tag; do not assign success/warning/error meaning to an ordinary category. Explicit children override mapped content, including a stale demo label: remove them when value mapping should own the text. Preserve zero/false and unknown values according to the requirement.

Read the live color precedence. Standalone Tag supports defaultColor and automaticColor; Table's tag preset enables automatic colors, so provide explicit tagOptions colors or a neutral tagColor rather than relying on that fallback. Using Tag does not itself authorize a multicolor scheme.

## Tag.CheckableTag

CheckableTag exposes checked and onChange(checked); the owning selection workflow controls the boolean. Closing an ordinary Tag is a distinct onClose action and must not silently imply deleting the source record. Use the actual supported variant, color, icon and closeIcon contracts.

## Acceptance

Before generation record the field's meaning, chosen text/Tag presentation and source in the existing inventory. For Table Columns declare native props.displayType as text, tag or custom; a custom Tag is a registered node with its actual render owner. After generation compare both meaning and presentation with that same source decision. Native identity checks cannot prove that a Tag was justified or that a custom styled text node visually matches plain text.

Test known/unmapped/empty values, mapping precedence, long labels, optional close/cancel and checked transitions. Keep label meaning readable independently of color, avoid layout jumps when tags wrap and save/reopen real value/options bindings. Review equivalent Tabs and the designated draft for unintended text/Tag or color changes.
