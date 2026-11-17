# Overlays

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Dialog | `plasmic-material-ui-dialog` |
| DialogActions | `plasmic-material-ui-dialog-actions` |
| DialogContent | `plasmic-material-ui-dialog-content` |
| DialogContentText | `plasmic-material-ui-dialog-content-text` |
| DialogTitle | `plasmic-material-ui-dialog-title` |
| Drawer | `plasmic-material-ui-drawer` |
| SwipeableDrawer | `plasmic-material-ui-swipeable-drawer` |
| Menu | `plasmic-material-ui-menu` |
| Tooltip | `plasmic-material-ui-tooltip` |
| Snackbar | `plasmic-material-ui-snackbar` |
| SnackbarContent | `plasmic-material-ui-snackbar-content` |

## Generation rules

Dialog composes its title, content and actions through children. Drawer/SwipeableDrawer use their actual anchor and variant contracts; Menu needs a real anchor or intended position, Tooltip a usable trigger, and Snackbar transient feedback. Choose placement, size and actions from content and the requirement; Antd Modal/Drawer widths and footer recipes do not apply.

The wrapper adds defaultOpen and onOpenChange(open) for Dialog, Drawer, SwipeableDrawer, Menu, Tooltip and Snackbar. Studio exposes the initial open control via editOnly/uncontrolledProp and writable open state. Native onClose/onOpen callbacks retain their original arguments; onOpenChange receives the boolean. Keep one business state owner and bind opening, dismissal and any confirmation separately. Do not interpret closing as confirmation.

Selecting a hidden overlay can reveal it temporarily in the canvas without changing saved initial values or firing business callbacks. Verify real triggers in Preview. Menu children must retain their native MenuItem structure; Tooltip needs a trigger that supports the native ref/events. Snackbar.children, when supplied instead of message/action content, accepts a single element. Native slots/anchorEl/container are expressions, not rendered-element Slots.

## Acceptance checks

Open and dismiss through the actual trigger, close action and supported Escape/backdrop behavior; verify callbacks and focus return in Preview. Test anchor position, viewport fit, long content and any Snackbar timeout. Save/reopen and confirm the initial open state did not inherit an editing reveal.
