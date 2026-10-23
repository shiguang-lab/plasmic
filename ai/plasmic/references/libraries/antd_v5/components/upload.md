# Upload

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Upload | `plasmic-antd5-upload` |

## Generation rules

### Local reading contract

This Upload wrapper prevents native server upload and exposes files/onFilesChange with metadata, base64 contents and reading status. dragAndDropFiles selects the native drag surface inside the same local-reading wrapper; this library has no separately registered v6 Upload.Dragger contract. A done file means local reading completed, not backend persistence.

Read accept, multiple, maxCount, listType and showUploadList. File validation, transport and saved-file identity belong to the actual consuming workflow; do not claim them from an accept hint or visible success state.

## Acceptance checks

### Acceptance

Test one/multiple files, limit replacement, duplicate names, read failure, removal while pending, preview and reopening. Verify order, base64 payload, actual completion semantics and Form/permission ownership. Save/reopen bindings without leaving demo files or an unverified server-success claim.
