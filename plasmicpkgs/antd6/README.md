# Ant Design 6 for Plasmic

Registers Ant Design 6.6.5 visual component families and their design-oriented
subcomponents. Requires React and React DOM 18 or newer. The implementation uses
the official Plasmic antd5 registrations as its starting point.

```ts
import { registerAll } from "@shiguang-lab/plasmic-antd6";

registerAll(); // Codegen / host API
// registerAll(PLASMIC); // Loader
```

Run registrations before rendering the app host or Plasmic content. Generated
pages import the same wrappers from the package's `skinny` entry points.

## Design behavior

- ConfigProvider and App are supplied by the registered global context. Theme
  tokens use `--antd6-*` CSS variables and `antd6-*` registration names.
- Date and time controls expose ISO strings; range controls expose arrays.
- Menus, breadcrumbs, tabs and collapse convert editable slots into native item
  data. Card and list actions convert slots into arrays of React nodes.
- Message and notification are exposed as global-context actions. Grid hooks
  are not draggable components; Row and Col provide editable grid layouts.
- Tour targets use `targetSelector` within the rendering document. Listy items
  use `{key, content}`; Masonry items use `{key, data: {content}}`.

## Version 6 APIs

Input controls use `variant`, Tabs uses `tabPlacement`, Steps uses `orientation`
and item `content`, and Avatar.Group uses `max`. Popup styles use semantic
`classNames`; components use `destroyOnHidden`. Modal exposes
`closeOnOutsideClick`, which sets `mask.closable`. Size controls use `medium`
where v6 replaces `middle` or `default`. Card, Steps and Progress offer only
`small` / `medium`; deprecated List retains its own size enum. Input addons are
composed with Space.Compact instead of `addonBefore` / `addonAfter`. BackTop uses FloatButton.BackTop and the
timer uses Statistic.Timer. Ant Design's deprecated List remains available;
Listy is registered separately.

```sh
pnpm --filter @shiguang-lab/plasmic-antd6 typecheck
pnpm --filter @shiguang-lab/plasmic-antd6 test
pnpm --filter @shiguang-lab/plasmic-antd6... build
```
