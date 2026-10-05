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
- Modal OK does not close automatically. Validate/save, then set `open=false`
  after success. Cancel and close synchronize `onOpenChange(false)`.
- Form validation rejects on failure. Submission disabling restores after success
  or failure and preserves explicit/inherited disabled settings. Its
  `extendedOnValuesChange(values)` event receives the complete form values.
- Table selection supports controlled keys or internal selection. Pagination
  initializes index states without firing `onChange` on mount.
- Tabs animates the ink bar by default. Tree expansion, Popover delays and date
  input behavior follow native defaults. Empty Tooltip titles suppress fallback.
- Upload reads files locally into base64 `contents`. `status="done"` means the
  local file is ready; no server upload occurs. Multiple files retain selection
  order; `maxCount` keeps the newest files.
- Semantic classes from native objects/functions combine with Studio scopes;
  editor styling props do not become DOM attributes. Modal honors `footer=null`,
  responsive/zero width and outside-click settings with boolean/object masks.
- Select and TreeSelect states support scalar, array and labeled values; Menu
  selection events receive native info objects. RangePicker preserves inherited
  disabling and explicit whole-control overrides over endpoint flags.

## Icons

Install the independent **Ant Design Icons** library from **Component Store → Icons**.
Each icon is an official `@ant-design/icons` component, with its own registration
and import name. Ant Design 6 does not register an icon library globally. Put the
installed icon components in icon slots using Studio's standard slot editing.
The top-level Icons section continues to list the project's SVG assets.

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
pnpm --filter @shiguang-lab/plasmic-antd6 test:interactions
pnpm --filter @shiguang-lab/plasmic-antd6... build
```
