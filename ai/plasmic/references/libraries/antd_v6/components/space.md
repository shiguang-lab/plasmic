# Space

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Space | `plasmic-antd6-space` |
| Space.Compact | `plasmic-antd6-space-compact` |

## Spaced siblings

Use Space for content-sized controls or inline groups; use [Flex](flex.md) when children need to fill the remaining region. The v6 registration uses orientation, numeric size, wrap, align and separator. Set the intended gap once and inspect native child margins before adding it. A separator is part of the group, not an extra surface or heading.

## Space.Compact

Compact joins related controls through native borders and sizing; it does not create a business field or an ordinary gapped toolbar. Read orientation, size and block from its own registration. Keep each real Form field's ownership and accessible label. Do not place a Compact wrapper between a named Item and its bound control without the actual supported nested-Item pattern.

## Acceptance

Verify alignment, wrapping, joined borders, disabled controls, mixed content heights and long labels. Check width filling only where intended, no duplicated component margins and complete keyboard traversal. Follow [shared layout](../../../design/layout.md) for responsive and spacing decisions.
