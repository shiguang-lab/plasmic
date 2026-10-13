# Steps

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Steps | `plasmic-antd6-steps` |

Preserve the installed Ant Design default current step unless the requirement supplies an explicit value. Registration hints must not seed a different runtime current step.

## Stages and outcomes

Steps describes the actual workflow's stages through items/current/status, not a fabricated progression animation. Use stable stage meaning and distinguish current stage from completed/failed status. A click/onChange reports the requested stage; it does not validate the Form, save data or authorize skipping prerequisites by itself.

## Acceptance

Use [step-form composition](../compositions/step-form.md) when stages own fields. Verify initial/current index, allowed forward/back transitions, errors, disabled stages as supported, long titles and the required orientation/size. Check changing content and saved business state rather than accepting only the visible step highlight.
