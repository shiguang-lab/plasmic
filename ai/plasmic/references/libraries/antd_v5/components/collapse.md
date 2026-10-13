# Collapse

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Accordion | `plasmic-antd5-collapse` |
| Accordion Item | `plasmic-antd5-collapse-item` |
| Collapse | `plasmic-antd5-single-collapse` |

## Single and grouped sections

This library registers the single Collapse (`plasmic-antd5-single-collapse`), Accordion and Accordion Item under their actual keys. They share one Collapse document, with single open versus grouped activeKey/items ownership. Read label/label2/extra, forceRender, destroyInactivePanel, collapsible, disabled and onChange independently for the used variant.

## Acceptance

Keep stable group IDs and full real child content. Test default/open states, allowed multiple/accordion behavior, disabling, hidden field values/errors and destruction/preservation when configured. Verify callback/state conversion against the implementation; do not carry v6 Collapse.Panel metadata or items behavior across versions. Check keyboard access and scroll reachability after expansion.
