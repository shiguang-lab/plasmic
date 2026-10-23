# ConfigProvider

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Ant Design System Settings | `plasmic-antd5-config-provider` |

## Generation rules

### Global theme context

This registration is the library's project-wide global context, using its exposed colors, radius, line, control-height, size, wireframe, defaultDark and themeStyles/token mapping. Studio wraps Pages with installed contexts automatically. Read the consuming project's `collection:"globalContexts"`, then the matching definition's `view:"contract"` for `isContext:true` and `globalActions`. Reuse that installed instance; its `children` Slot is runtime ownership, not an instruction to insert a page wrapper. Explicit project theme changes use System Settings/the advertised context-editing capability; a missing MCP capability is a gap to report. Its implementation accepts locale in code but does not register a Studio locale control; Studio UI language does not force a canvas locale.

### Feedback actions and acceptance

Read actual showMessage, showNotification and hideNotifications global-action signatures and parameters before invoking them. Feedback uses the installed provider's theme and holders, not v6's App-context assumptions. Verify supported theme/dark settings, readable semantic colors, portal feedback and its lifetime after an overlay closes. Recheck actual global-action availability, saved settings and consuming callback behavior. This v5 provider does not inherit a v6 wrapper's contracts merely because its display name matches.
