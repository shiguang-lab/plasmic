# Steps

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Steps | `plasmic-antd5-steps` |

## Actual workflow stage

Read items/current/status and this registration's size/direction/progressDot/type/percent/responsive/onChange controls. A highlighted stage is presentation; the owning workflow determines whether navigation is allowed and whether fields validate before proceeding. Inspect this implementation's actual initial current value instead of carrying the v6 default-preservation rule across versions.

## Acceptance

Test initial and requested stage, permitted forward/back transitions, validation failure and final submission if stages own fields. Preserve entered values and stable stage meaning, complete labels, focus and required layout. Verify actual callbacks and saved state.
