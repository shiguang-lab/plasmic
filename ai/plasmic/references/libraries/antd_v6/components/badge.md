# Badge

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Badge | `plasmic-antd6-badge` |
| Badge.Ribbon | `plasmic-antd6-badge-ribbon` |

Use Badge `status` (a supported semantic preset) plus `text` for lifecycle/processing status. Categories choose text or Tag under the [Tag/text rules](tag.md#tag-or-text); an enum alone does not require either Badge or Tag. Read the installed `status`/`text` contract and keep status meaning consistent with the business value. Do not leave demo children/counts in status rendering.

## Count, dot and Badge.Ribbon

Count and dot are distinct from a text status. Read overflowCount/showZero and the supported size/color contract; zero is displayed or omitted intentionally rather than through a truthy fallback. Place a count on the actual related child control/content and avoid duplicating the same count in an unrelated decorative badge.

Ribbon owns its children, text/color and start/end placement. It is a surface annotation, not a substitute for an inline status or an authorization state. Keep complete readable business text and a single surface owner.

## Acceptance

Verify each actual status/count, zero, overflow threshold, missing values and long text. Status meaning remains readable independently of color. Check Ribbon placement, no overlap with actions and correct bindings after save/reopen.
