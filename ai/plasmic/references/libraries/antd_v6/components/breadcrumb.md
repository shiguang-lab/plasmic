# Breadcrumb

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Breadcrumb | `plasmic-antd6-breadcrumb` |
| Breadcrumb.Item | `plasmic-antd6-breadcrumb-item` |

## Route ancestry

Use Breadcrumb to express the current route's actual ancestors, not a copied decorative label chain. This wrapper exposes itemsRaw and separator; use the actual raw-item shape with stable keys and verified destinations. Breadcrumb.Item is maintained here with its registered children/onClick contract; do not invent a separate child href control. The current page is identified without an invented navigation destination.

## Ownership and acceptance

An [AppShell](app-shell.md) that derives breadcrumbs from its menu/pagePath already owns this region; do not render another breadcrumb inside its business body. Verify direct entry, nested routes, hidden detail/create routes and returning to a parent. Check long labels, keyboard navigation and saved route bindings.
