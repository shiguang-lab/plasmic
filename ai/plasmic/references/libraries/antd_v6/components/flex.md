# Flex

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Flex | `plasmic-antd6-flex` |

## Generation rules

### Design defaults

- Content root inside AppShell: vertical, gap 16, filling the width. Stacked blocks inside one surface: vertical, gap 16.
- Horizontal rows of mixed items use `align: "center"`; wrapping groups of Tags or filters use wrap with gap 8.

### Row and column flow

Use registered Flex for related siblings and page/section columns. vertical controls the axis; align, justify, wrap and numeric gap follow this registration. Choose alignment from the content roles rather than forcing every row to center. Filling children need supported sizing and minWidth/minHeight constraints along the actual ancestor chain; Flex alone does not establish a bounded height or a scroll owner.

### Spacing and acceptance

Read [shared layout](../../../design/layout.md) for sizing, spacing ownership and reflow. Flex does not supply Card surfaces or Form field binding. Avoid a Flex wrapper between a named Form.Item and its bound control without the verified nested noStyle Item composition. Inspect long/wrapped/hidden siblings, remaining-space behavior, error expansion and footer reachability in real Preview; do not add another gap on component-owned margins.
