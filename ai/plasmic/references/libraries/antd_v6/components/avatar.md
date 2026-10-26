# Avatar

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Avatar | `plasmic-antd6-avatar` |
| Avatar.Group | `plasmic-antd6-avatar-group` |

## Generation rules

### Avatar.Group

Preserve the installed Ant Design defaults unless explicitly overridden by the requirement. Do not force AvatarGroup overflow by injecting max through registration hints or runtime defaults.

### Avatar and acceptance

The standalone Avatar uses the native src, alt, icon, size, shape and onClick props; `letters` is its editable text content. Avatar has no link prop: for navigation place it inside a link element, or attach a page-navigation step to onClick. Use the real person's/entity's content; missing images follow the installed fallback rather than a copied demo user. Navigation is present only when that avatar actually links to a destination. An avatar next to a name does not replace the name or permission context.

Group owns its actual Avatar children and supported max configuration. Verify few/many members, long names, missing/failed images, overflow disclosure when configured and any real destination. Keep native dimensions/spacing and save/reopen the member and navigation bindings.
