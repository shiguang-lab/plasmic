# Tour

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tour | `plasmic-antd6-tour` |

## Generation rules

### Guided steps

Tour steps use the wrapper's title, description and targetSelector contract. Targets resolve inside the delivered canvas/page document, not Studio's outer document. Use stable actual targets and real step text; a missing target follows the native untargeted-step behavior rather than silently pointing to another control.

## Acceptance checks

### Acceptance

Bind open/close only through the actual registered contract. Test each target, relevant hidden or offscreen content, step transitions, dismissal and repeated entry. Guidance does not execute the underlying business action. Verify focus, viewport bounds and no persisted canvas-inspection state after save/reopen.
