# Local @react/ui dependency

Copied from `fintechgrowthui/node_modules/@react/ui`, version `1.0.12-alpha.23`.
This private local package exports only ActionGroup and includes its ConfigProvider
dependencies. No other UI components are registered or copied.

The copied ActionGroup logic and types are unchanged. Its LESS module is compiled
to scoped CSS in `styles.js`; obsolete Antd 5 side-effect style imports are removed
because the current App uses Antd 6, which supplies styles through CSS-in-JS.
ES module imports include file extensions for bundling.
The local manifest lists only the public dependencies required by these modules.

The independent React UI registration package references this source with
`file:../../vendor/react-ui`. NAS distributes its hostless runtime and registration
package; do not publish this partial `@react/ui` package to npm. When the private
registry is available, replace the file dependency with the private package
version and verify its build/style entry.
