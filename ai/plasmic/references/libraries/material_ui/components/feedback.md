# Feedback

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Alert | `plasmic-material-ui-alert` |
| AlertTitle | `plasmic-material-ui-alert-title` |
| Backdrop | `plasmic-material-ui-backdrop` |
| CircularProgress | `plasmic-material-ui-circular-progress` |
| LinearProgress | `plasmic-material-ui-linear-progress` |
| Skeleton | `plasmic-material-ui-skeleton` |

## Generation rules

Use Alert for visible feedback, progress components for actual loading/progress, Skeleton for a content placeholder, and Backdrop for an explicitly needed blocking layer. Read variant, severity and determinate value contracts from the selected registration; bind them to business state. AlertTitle is content inside Alert.

These components do not imply Antd message/notification global actions or an Antd App provider. For transient feedback use the registered [Snackbar](overlays.md).

## Acceptance checks

Verify loading completion, feedback text/severity and progress values. A Backdrop must not leave the user blocked after completion or failure. Ensure feedback is accessible and associated with the action or content it describes.
