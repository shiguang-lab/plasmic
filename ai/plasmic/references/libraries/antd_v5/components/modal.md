# Modal

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Modal | `plasmic-antd5-modal` |

## Generation rules

### Slots and close timing

Read real title/children/footer/trigger/closeIcon, width, hideFooter, onOk/onCancel and onOpenChange. This maintained v5 wrapper requests onOpenChange(false) before invoking onOk; awaiting an onOk save does not automatically keep it open. Verify that the actual controlled workflow satisfies its required validation/failure close policy, and report a capability gap when it cannot. Do not describe the v6 Modal's explicit-success closing contract as this wrapper's behavior.

## Acceptance checks

### Acceptance

Choose native default footer or an actual required custom footer through its installed Slot contract. Verify opening, all supported dismissal paths, validation failure, failed save, correction/retry and reopening another record. Keep titles/fields/footer reachable with the shared scrolling contract and check focus return. A successful happy path does not certify async closing semantics or retained input.
