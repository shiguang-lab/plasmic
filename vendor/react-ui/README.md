# Local @react/ui dependency

This private package vendors selected ESM implementations and declarations from
`fintechgrowthui/node_modules/@react/ui`. ActionGroup and ResourceAuthorization
(including ResourceAuthorization.Record) come from `1.0.12-alpha.23`.
IntlUserSelect, IntlUserView, IntlDictSelect, IntlDictView, IntlDepartmentSelect
and IntlDepartmentView come from `1.0.13`. The six Intl modules share the local
ConfigProvider and their original data formatting and request logic. Their
LESS modules are compiled to scoped CSS in `esm/intl-styles.js` and use
Ant Design 6's shared component exports.

The Intl modules accept local data through their upstream props. The Plasmic
registrations always supply local data and keep the app's request client out of
the prototype. Direct use of a vendored Intl module can still use an explicit
`request` or the host's `window.$$request`.

The copied ActionGroup logic and types are unchanged. Its LESS module is compiled
to scoped CSS in `styles.js`; obsolete Antd 5 side-effect style imports are removed
because the current App uses Antd 6, which supplies styles through CSS-in-JS.
ES module imports include file extensions for bundling.
ResourceAuthorization uses Antd 6's drawer `size` internally while retaining its
public `width` prop. Its body retains the component library's native Drawer
scrolling. `antd-style` supplies its existing token-based styles.

ResourceAuthorization requests resolve the host's `window.$$request` at call time. The private
`@lattebank/webadmin-http` fallback is removed; the host must inject an instance
with `get(url, params)`, `post(url, data)` and `delete(url)` returning `{ data }`.
Authentication and request interceptors belong to that host.

An internal canvas context suppresses requests, mutations, form editing and focus
trapping during noninteractive Studio editing. Preview uses the real component
behavior and API endpoints. Canvas state is not part of the business props.
The local manifest lists the public dependencies required by these modules.

The independent React UI registration package uses this source as a development
input and bundles the maintained modules and declarations into its own artifact.
The distributed package declares its public runtime dependencies and does not
require this checkout or a private registry. Do not publish this partial
`@react/ui` package under the original package name.
