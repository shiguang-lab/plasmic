# Popover

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Popover | `plasmic-antd5-popover` |

## Content and trigger

Read title/content/contentText/children, trigger, open/onOpenChange, placement and mouse enter/leave delays. Interactive supplemental content belongs in Popover; a short non-interactive explanation belongs in [Tooltip](tooltip.md). Native arrow/style props follow this v5 wrapper and are not interchangeable with v6 semantic classNames.

## Acceptance

Verify native versus fallback content, explicit empty values, entering/interacting with the popup, dismissal and keyboard/focus behavior. Hover never mutates business state. Inspect viewport bounds and saved open state rather than using a forced persisted opening for editor inspection.
