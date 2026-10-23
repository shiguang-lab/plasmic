# Progress

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Progress | `plasmic-antd5-progress` |

## Generation rules

### Actual measured work

Read percent/type/status and this wrapper's successPercent/successStrokeColor, stepColors, gradient and infoFormat controls. These map through the v5 implementation rather than a v6 success/format object assumed from a native API. Meaningful zero must remain distinguishable from missing values.

## Acceptance checks

### Acceptance

Test zero/partial/complete and required failure/success segments, steps/gradient and complete status text. The displayed percent/status reflects actual work and does not certify backend completion. Inspect the implementation's omitted defaults and saved bindings independently of v6 fixes.
