# Avatar

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Avatar | `plasmic-antd5-avatar` |
| AvatarGroup | `plasmic-antd5-avatar-group` |

## Generation rules

### Avatar and Avatar.Group

Read actual src/letters, href/target, size and shape for the individual Avatar. Group owns real child nodes and its maxCount/maxPopoverPlacement/size contract; these are not v6 max-object controls. Keep readable person/entity names alongside images as required and replace demo identities.

## Acceptance checks

### Acceptance

Test missing/failed images, letters, few/many members, overflow disclosure and any actual destination. Verify dimensions, keyboard navigation when actionable and saved member/route bindings. Do not force an overflow preset solely to reproduce a demo.
