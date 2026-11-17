# Material UI Theme

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Material UI Theme | `plasmic-material-ui-theme-provider` |

## Generation rules

Material UI Theme is an installed global context, not a page widget. Read the project's globalContexts and reuse its current instance. Its theme prop accepts native ThemeOptions for palette, typography, spacing, shape, breakpoints and component overrides.

Use MUI theme/sx semantics within MUI components. Antd tokens, ConfigProvider and size values remain in their own library scope; selecting or installing MUI does not authorize changing Antd configuration. The wrapper creates a ThemeProvider without adding CssBaseline or forcing a locale. Read current theme overrides before assuming native defaults, and change shared theme settings only within the task's scope.

## Acceptance checks

Verify representative controls and surfaces under the configured theme and required viewports. On a mixed-library page, check both libraries after a theme change; independent references do not prove runtime CSS isolation.
