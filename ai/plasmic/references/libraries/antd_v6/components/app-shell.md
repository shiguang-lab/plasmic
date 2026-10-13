# AppShell

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| AppShell | `plasmic-antd6-app-shell` |

## Registration and shared implementation

This Antd-v6 AppShell registration imports the maintained Overseas AppShell implementation under its own plasmic-antd6-app-shell identity. Select it only when it belongs to the target project's actual imported library. Read the shared [AppShell geometry, menus and breadcrumb rules](../../overseas/components/app-shell.md); reuse those implementation rules while retaining this registration key and import contract.

## Acceptance

Keep one shell per standalone page and no duplicate shell when the host owns navigation. Verify its actual children Slot, menu routes, current pagePath, breadcrumbs, viewport fill and shared Scrollbar behavior. Do not replace its identity with the Overseas key during editing or code generation. Save/reopen and check both its registered identity and delivered route/content behavior.
