# Ant Design Icons installation

## Contract

- The top-level Icons entry uses the upstream project SVG asset list.
- Component Store → Icons contains one `@ant-design/icons` installation card.
- Installation imports an independent **Ant Design Icons** hostless library.
  Additional source libraries get separate Installed entries.
- Every icon uses its own official React component and import name. Standard
  Installed cards and slot editing handle insertion; no Icon/name wrapper or
  global icon registration is used.

## Verified locally

- The icon package builds with Rollup and TypeScript declarations.
- Fourteen registration tests pass, including official component identity,
  all 848 icons, thumbnail metadata and existing Ant Design 6 slot contracts.
- Two built browser runtime tests pass for the normal and v2 canvas bundles:
  the host and Ant Design 6 register zero library icons, loading `antd-icons`
  registers 848, and PlusOutlined renders with inherited color and rotation.
- The upstream `createSiteForHostlessProject()` test passes: 848 hostless
  components, zero image assets, official import path/name and native props.
- The host, canvas/server packages and self-hosted Studio build successfully.
- The native SVG resource generator accepts the store cover image.
- ESLint reports no errors in the changed implementation; InsertPanel has two
  existing unused-variable warnings. `git diff --check` passes.

## Live acceptance — 2026-10-05

- Published and deployed server/web images **0.0.28**, commit
  `c2b96911b93d9faa1e7d905c2d4790347ae9ce63`. Both services are healthy;
  the database migration check reports no pending migrations. Database and
  storage backups are retained on the NAS.
- `nas-icons.ts` registered 848 components in library
  `vuoraLeVbtw7rQTKJ6UKar`. The live catalog contains the Icons installation card.
- Clicked the native **Component Store → Icons → @ant-design/icons** card.
  **Ant Design Icons** appeared under Installed, and MCP read confirmed its
  imported project and all 848 independently named components.
- Migrated all six references in project `2DdvqnozKTQgbqsQAu4c4X`: PlusOutlined
  and DownOutlined on the list, ArrowLeftOutlined and RightOutlined on each
  detail page. Each node references the installed icon library. All five pages
  retain their states, interactions and routes; no old icon references or local
  legacy definitions remain.
- The final packaged desktop client is open. Its ASAR contains both icon library
  bundles and the standard host without temporary migration registrations.
  Ten desktop asset tests pass. Project loading has no missing-component dialog.
- Saved revision **135**, reloaded the final client, and read the project/pages
  again. All six references and the imported library persist; another save
  remains at revision 135. Validation passes with zero errors or warnings.

## Visual and interaction checks

- [Store card](antd-icons-installation/store-card.png): one package preview card
  under Component Store → Icons, using the standard installation UI.
- [Installed library](antd-icons-installation/installed-library.png): one
  Ant Design Icons entry, standard component thumbnails with individual names,
  and the Filled section visible. No obsolete local Outlined entry remains.
- [List, 1440 × 1024](antd-icons-installation/list.png): the leading plus and
  trailing down arrow remain aligned with the New group label and inherit its
  white color. Appearance matches the pre-migration screenshot.
- [Regular detail](antd-icons-installation/regular-detail.png) and
  [one-time detail](antd-icons-installation/onetime-detail.png), 1440 × 1024:
  the return arrow and trailing View SQL arrow render correctly and inherit the
  link colors. Both return links route to the list; both View SQL buttons open
  their read-only SQL dialog, and Close dismisses it. The
  [regular SQL dialog](antd-icons-installation/regular-sql.png) is captured.
- The existing New group trigger remains configured for hover. Native UI pointer
  actions did not expose that menu during this run, so its opening is unverified;
  no trigger or business interaction was changed by this migration.

[Acceptance result](antd-icons-installation/acceptance.json) records the release,
revision, validation and six imported node identities.
[Sanitized MCP transcript](antd-icons-installation/mcp-transcript.jsonl) retains
tool requests/results, replacing large page HTML with hashes and icon references.

Deployment entry point: `deploy/nas-icons.ts`. It creates or updates the icons
library/catalog inside one transaction and retains other library entries.
