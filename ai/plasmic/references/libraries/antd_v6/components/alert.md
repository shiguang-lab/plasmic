# Alert

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Alert | `plasmic-antd6-alert` |

## Generation rules

### Design defaults

- Use for a condition that stays relevant to a region; a finished operation result uses a Message.
- Type follows the condition (`info`, `success`, `warning`, `error`) with the icon shown; it spans the width of the affected surface, placed at its top or directly below the input it reports on.
- One short title; a description only for the reason and the recovery step.

### Persistent regional feedback

Use Alert for information, warning or failure that remains relevant to a region. Read its title, description, icon, action, type, banner and closable contract. Include the affected context and a useful recovery action when one exists; do not display a generic error as a successful empty list. Native semantic color is supplemental to readable text.

Choose the surface using [feedback selection](../compositions/action-bars.md#feedback-and-row-confirmation) before binding content. Routine operation success/failure, including an export task being created, uses the [ConfigProvider Message action](config-provider.md), not a persistent Alert. An Alert is justified by an ongoing condition in the affected region, such as unavailable data with a retry action or a restriction that still applies. Stable does not mean static text: bind its title/description through [native text bindings](../../../desktop-examples.md#dynamic-native-text) and its type to that ongoing condition; remove or update it when the condition resolves.

## Acceptance checks

### Acceptance

The current wrapper uses title rather than a copied v5 message prop. First verify that the Alert represents a continuing regional condition rather than the last operation result. Keep one spacing owner between the Alert and adjacent Form fields. Verify meaningful type/text, optional icon, closing/reappearance policy, recovery and error-expanded layout. Read [content-state composition](../compositions/content-states.md) for selection against Message, Notification and Result.
