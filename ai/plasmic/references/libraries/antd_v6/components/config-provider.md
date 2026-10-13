# ConfigProvider

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Ant Design System Settings | `plasmic-antd6-config-provider` |

This is the registered ConfigProvider wrapper. Its showMessage(type, content, duration) global action supplies themed Message feedback; generated previews must bind $globalActions for custom callbacks too. Verify actual callbacks in Preview; expressions and model validation do not prove runtime feedback. Use [feedback composition](../compositions/action-bars.md#feedback-and-row-confirmation) to choose Message, Alert or Notification.

## Theme and inherited defaults

This registration is a global context, not a second page shell. Read its actual color, radius, line, control-height, size, wireframe, defaultDark and themeStyles controls together with registered theme tokens. Keep native semantic text/status mappings and verify inherited styling in nested controls and portal overlays. A wrapper's exposed token subset is not the entire native ConfigProvider theme API.

The implementation accepts locale in code but does not expose it as a registered Studio control. Studio UI language and business content language do not set the canvas component locale automatically. Do not invent a locale/direction/componentSize property in this registration. Verify the real provider and imported library before changing locale or another inherited native behavior.

## Notification actions and acceptance

Read ordered global-action parameters for showNotification(type, message, description, duration, placement) and hideNotifications(). These are global actions, not independent registered Message/Notification components. Message/Notification selection follows [content states](../compositions/content-states.md). Check theme changes, supported dark mode, complete feedback, duration/placement and cleanup through the actual consuming flow. Portal feedback must inherit the intended theme and remain visible for its required lifetime after an overlay closes; save/reopen to verify provider settings and action bindings.
