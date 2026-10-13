# Upload

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Upload | `plasmic-antd6-upload` |
| Upload.Dragger | `plasmic-antd6-upload-dragger` |

Upload reads files locally as base64: done means local reading completed, not server upload success. Multiple selection preserves order; maxCount retains the newest files. Verify these semantics against actual file selections and do not report local completion as backend success.

## Local Upload wrapper

The registered Upload uses files/onFilesChange with metadata, base64 contents and reading status. Its beforeUpload prevents native server uploading. dragAndDropFiles selects a drag surface within this same local wrapper. Read accept, multiple, maxCount, listType and showUploadList; file-size validation and persistence exist only when implemented in the consuming workflow. Remove and error states must retain the intended remaining files, and an accept hint does not certify file content.

## Upload.Dragger

The separately registered Dragger forwards native action/name/multiple/accept/disabled and onChange(info). It does not expose the local wrapper's files/onFilesChange/base64 model. A drag surface therefore does not establish which upload workflow is active. Keep both registrations here, select the actual one and bind its real transport/status contract. Backend authentication, persistence and completion must be verified through the consuming project's actual implementation.

## Acceptance

Test one/multiple files, duplicate names, maxCount replacement, reading or transport failure, removing a file while pending, preview and reopening the record. Verify the actual payload/status and whether completion means local reading or server persistence. No success message or saved-file claim may be based only on the visible done label. Preserve Form ownership and permission/disabled behavior when used as a field.
