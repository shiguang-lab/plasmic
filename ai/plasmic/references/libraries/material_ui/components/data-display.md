# Data display

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Avatar | `plasmic-material-ui-avatar` |
| AvatarGroup | `plasmic-material-ui-avatar-group` |
| Badge | `plasmic-material-ui-badge` |
| Chip | `plasmic-material-ui-chip` |
| Divider | `plasmic-material-ui-divider` |
| List | `plasmic-material-ui-list` |
| ListItem | `plasmic-material-ui-list-item` |
| ListItemAvatar | `plasmic-material-ui-list-item-avatar` |
| ListItemButton | `plasmic-material-ui-list-item-button` |
| ListItemIcon | `plasmic-material-ui-list-item-icon` |
| ListItemText | `plasmic-material-ui-list-item-text` |
| ListSubheader | `plasmic-material-ui-list-subheader` |
| SvgIcon | `plasmic-material-ui-svg-icon` |
| Typography | `plasmic-material-ui-typography` |

## Generation rules

Choose Typography for themed text, List and its children for repeated information, Avatar/AvatarGroup for identities, Badge for attached counts/indicators and Chip for compact labels or choices. Set interactive Chip/ListItemButton behavior only when the requirement calls for it. Use primary/secondary and icon/avatar Slots on their actual owners.

SvgIcon is an SVG container, not an installed Material Icons catalog. Discover available icons separately; do not assume a MUI X or icon package is included. Typography's visual variant and rendered component should preserve the intended semantic hierarchy.

## Acceptance checks

Check actual text/data, long and empty values, zero counts and any selection/delete/navigation action. Verify semantic headings and accessible names for meaningful icons or avatars.
