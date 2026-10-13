# Skeleton

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Skeleton | `plasmic-antd6-skeleton` |
| Skeleton.Avatar | `plasmic-antd6-skeleton-avatar` |
| Skeleton.Button | `plasmic-antd6-skeleton-button` |
| Skeleton.Image | `plasmic-antd6-skeleton-image` |
| Skeleton.Input | `plasmic-antd6-skeleton-input` |
| Skeleton.Node | `plasmic-antd6-skeleton-node` |

## Initial loading structure

Use Skeleton when the actual initial content structure is known and placeholders help retain its layout. Match the expected region without inserting sample business values. Its registered loading default is true; bind real loading state so the delivered page does not remain a placeholder after data arrives. Use [Spin](spin.md) when an indeterminate operation over existing content is more appropriate.

## Skeleton variants

Button, Input, Avatar, Image and Node registrations are sections of this family. They expose their own active contract; do not assume every native Skeleton prop is available on each variant. They are non-interactive placeholders and must not replace the real actionable controls after loading.

## Acceptance

Verify placeholder-to-content transition, realistic bounds, long content and failure recovery under [content-state composition](../compositions/content-states.md). Preserve the owning region's spacing and scroll reachability without a large layout jump or leftover duplicate children.
