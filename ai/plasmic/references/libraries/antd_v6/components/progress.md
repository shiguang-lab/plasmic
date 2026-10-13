# Progress

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Progress | `plasmic-antd6-progress` |

The omitted type is line, so step colors must work without explicitly setting type. Preserve an explicit zero success segment. Test omitted type and explicit zero separately when changing the wrapper.

## Meaning and acceptance

Use Progress for actual measured completion, with the registered type, percent, status, success and format/steps contracts. A sample percent or animation is not evidence of completed work. Distinguish determinate progress from [Spin](spin.md) and retain a readable status explanation for failures. Do not hard-code a success state independently of the actual result.

Verify zero/partial/complete, the required success segment, failed/paused status as supported, step/color configuration and complete labels. Inspect the native bounds and actual source values rather than silently changing out-of-range data to make the visual look correct. Save/reopen bindings and exercise the underlying workflow when progress is interactive.
