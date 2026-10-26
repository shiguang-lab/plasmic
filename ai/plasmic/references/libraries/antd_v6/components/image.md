# Image

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Image | `plasmic-antd6-image` |
| Image.PreviewGroup | `plasmic-antd6-image-preview-group` |

## Generation rules

### Asset and geometry

Bind the actual asset src, supported alt, dimensions and fallback; the registration has no objectFit prop. Keep intended aspect ratio, preserve important image content and remove sample placeholder URLs. The Image wrapper disables native preview during non-interactive canvas editing; that editing behavior is not the runtime preview policy.

### Image.PreviewGroup

PreviewGroup owns the actual grouped image nodes or supported items array. Keep asset order and identity; do not turn unrelated decorative icons into a gallery. Its native preview is also suppressed only during non-interactive canvas editing. Discover any advanced preview capability through the installed registration.

## Acceptance checks

### Acceptance

Test loading/fallback, actual fit/crop, long adjacent content, opening/closing Preview and group navigation when enabled. Check returned focus and viewport bounds. Apply [media sizing](../../../design/layout.md#content-overflow-and-media), then save/reopen src/alt/group bindings.
