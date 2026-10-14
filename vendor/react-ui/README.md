# Local @react/ui dependency

Copied from `fintechgrowthui/node_modules/@react/ui`, version `1.0.12-alpha.23`.
This private local package exports ActionGroup and ResourceAuthorization (including
ResourceAuthorization.Record), with their ConfigProvider dependencies.

The copied ActionGroup logic and types are unchanged. Its LESS module is compiled
to scoped CSS in `styles.js`; obsolete Antd 5 side-effect style imports are removed
because the current App uses Antd 6, which supplies styles through CSS-in-JS.
ES module imports include file extensions for bundling.
ResourceAuthorization uses Antd 6's drawer `size` internally while retaining its
public `width` prop. Its body retains the component library's native Drawer
scrolling. `antd-style` supplies its existing token-based styles.

Requests resolve the host's `window.$$request` at call time. The private
`@lattebank/webadmin-http` fallback is removed; the host must inject an instance
with `get(url, params)`, `post(url, data)` and `delete(url)` returning `{ data }`.
Authentication and request interceptors belong to that host.

An internal canvas context suppresses requests, mutations, form editing and focus
trapping during noninteractive Studio editing. Preview uses the real component
behavior and API endpoints. Canvas state is not part of the business props.
The local manifest lists the public dependencies required by these modules.

The independent React UI registration package references this source with
`file:../../vendor/react-ui`. NAS distributes its hostless runtime and registration
package; do not publish this partial `@react/ui` package to npm. When the private
registry is available, replace the file dependency with the private package
version and verify its build/style entry.
