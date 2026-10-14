# React UI reference index

Library: React UI, registered by @shiguang-lab/plasmic-react-ui (plasmic-react-ui-*), wrapping @react/ui. Select this index by the actual registered library, then verify its imported version, wrapper implementation and dependency/API version against the reference baseline. Read [library selection](../index.md).

## Dependencies

The current implementation uses the repository's @react/ui dependency and declares antd 6.6.5. The underlying Antd version does not form part of the React UI library name.

ActionGroup's underlying menus, confirmations and sizes follow this implementation's Ant Design 6 contract. Read [Ant Design v6](../antd_v6/index.md) for registered Antd components actually composed with it. Do not assume a target project's unrelated @react/ui installation has the same API as this Plasmic wrapper.

| Component | Covered Studio registrations |
| --- | --- |
| [ActionGroup](components/action-group.md) | ActionGroup (`plasmic-react-ui-action-group`) |
| [Resource authorization](components/resource-authorization.md) | ResourceAuthorization (`plasmic-react-ui-resource-authorization`), ResourceAuthorization.Record (`plasmic-react-ui-resource-authorization-record`) |

## Composition and acceptance

The relevant recipes are [row actions in query tables](../overseas/compositions/search-table.md) and [action bars](../antd_v6/compositions/action-bars.md) when those participants are present. Verify permission filtering, folding, hover, confirmation, navigation and callback timing through the real ActionGroup; no structural-only check proves these interactions.
