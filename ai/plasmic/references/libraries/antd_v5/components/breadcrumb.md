# Breadcrumb

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Breadcrumb | `plasmic-antd5-breadcrumb` |
| Breadcrumb Item | `plasmic-antd5-breadcrumb-item` |

## Generation rules

### Actual route ancestry

Read this wrapper's itemsRaw and separator. Breadcrumb Item provides its actual children/onClick editing contract, while native item arrays follow the registered raw data path. Keep genuine ancestors and destinations; do not invent a per-item href prop absent from the exposed child controls.

## Acceptance checks

### Acceptance

An existing host shell may already own breadcrumbs. Avoid duplicating that region; verify direct entry, nested/current routes, long labels and actual parent navigation. Check keyboard access and saved item/action bindings against the current implementation rather than v6's items contract.
