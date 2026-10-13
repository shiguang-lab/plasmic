# ConfigProvider

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Ant Design System Settings | `plasmic-antd5-config-provider` |

## Global theme context

This registration is the library's global context, using its exposed colors, radius, line, control-height, size, wireframe, defaultDark and themeStyles/token mapping. It is not a second page shell or the whole native ConfigProvider API. Its implementation accepts locale in code but does not register a Studio locale control; Studio UI language does not force a canvas locale.

## Feedback actions and acceptance

Read actual showMessage, showNotification and hideNotifications global-action signatures and parameters before invoking them. Feedback uses the installed provider's theme and holders, not v6's App-context assumptions. Verify supported theme/dark settings, readable semantic colors, portal feedback and its lifetime after an overlay closes. Recheck actual global-action availability, saved settings and consuming callback behavior. This v5 provider does not inherit a v6 wrapper's contracts merely because its display name matches.
