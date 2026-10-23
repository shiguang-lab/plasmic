# ConfigProvider

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Ant Design System Settings | `plasmic-antd6-config-provider` |

## Generation rules

This registration is the project's **Ant Design System Settings global context**. Studio installs its instance at project level and wraps Pages automatically. A Page starts with its AppShell/content; choosing Message or inheriting Antd theme does not require another provider in its markup.

### Discover the existing context

Read `collection:"globalContexts"` in the consuming project to find the installed instance and stored setting overrides. Read its `componentUuid` with `view:"contract"` to obtain `isContext:true`, defaults and `globalActions` with qualified names and ordered parameters. An imported definition alone does not prove the consuming project has an installed instance. Empty stored properties mean no overrides, not missing defaults.

Classify this as project context in the selection plan, not an authored functional widget. Its `children` Slot describes runtime wrapping; it is not a composition instruction. Reuse the existing context and its theme. If the source explicitly requires changing project-wide settings, use the actual System Settings/public context-editing capability; report a missing MCP capability when none is advertised. Adding a local `ThemeProvider` through `insertHtml` does not configure the project context.

Use [feedback composition](../compositions/action-bars.md#feedback-and-row-confirmation) to select Message, Alert or Notification, then call the installed context's action below. Choosing Message is incomplete until the callback produces visible feedback.

### Feedback action calls

Global actions are a flat dictionary keyed by `contextName.actionName`. This registration's context name is `plasmic-antd6-config-provider`. In a custom callback or MCP `customFunction` interaction use:

```js
$globalActions["plasmic-antd6-config-provider.showMessage"]
  ("success", "保存成功", 3);
```

The ordered Message parameters are `(type, content, duration)`. `$globalActions.showMessage(...)` and `$globalActions["plasmic-antd6-config-provider"].showMessage(...)` address nonexistent entries. Do not catch and silently discard a missing-action error. Check the consuming project's installed context and the callback contract instead of adding a wrapper, drawing a replacement Toast or storing the last operation result in page Alert state.

Use the live interaction schema: if it supports `customFunction`, put the qualified call in its `code`; do not invent a `globalAction` actionName or wrapper object. Existing native action steps read back with the full qualified `actionName`; preserve that identity when inspecting them.

Verify the initiating action, actual data effect and Message **appearing immediately**, capture it while visible, then verify dismissal and unchanged content geometry. Absence several seconds later alone does not prove any message appeared. Check the error branch too. Missing feedback is a failed case; correct its action wiring before accepting the page.

### Theme and inherited defaults

Read the installed context's actual color, radius, line, control-height, size, wireframe, defaultDark and themeStyles controls together with registered theme tokens. Keep native semantic text/status mappings and verify inherited styling in nested controls and portal overlays. Its exposed token subset is not the entire native ConfigProvider theme API.

The implementation accepts locale in code but does not expose it as a registered Studio control. Studio UI language and business content language do not set the canvas component locale automatically. Do not invent a locale/direction/componentSize property in this registration. Verify the real provider and imported library before changing locale or another inherited native behavior.

### Notification actions and acceptance

Read ordered global-action parameters for showNotification(type, message, description, duration, placement) and hideNotifications(). These are global actions, not independent registered Message/Notification components. Message/Notification selection follows [content states](../compositions/content-states.md). Check theme changes, supported dark mode, complete feedback, duration/placement and cleanup through the actual consuming flow. Portal feedback must inherit the intended theme and remain visible for its required lifetime after an overlay closes; save/reopen to verify provider settings and action bindings.
