# Overseas component library

`@shiguang-lab/plasmic-overseas` contains shared Overseas business components. `registerAll()` currently registers `plasmic-overseas-app-shell` with an offline thumbnail and an editable `children` page-body slot. Add future Overseas components here, keeping Ant Design 6 registrations in `plasmicpkgs/antd6`.

Build with `pnpm --filter @shiguang-lab/plasmic-overseas build`. The canvas bundle is `platform/canvas-packages/src/overseas.ts`; the NAS registration script publishes the independent `overseas` hostless library and component-store entry. Install it in Studio or through MCP `installLibrary`, then read its contracts before insertion.

See [AppShell configuration and preview](preview/README.md). Menu items accept `key`, `label`, `href`, `disabled`, `type` and nested `children`. Routes use the Plasmic Link provider, so the same links work in Studio preview and exported applications.

The already-published Ant Design library cannot delete registered component contracts. Its previous AppShell name delegates to this implementation and is hidden by the NAS component catalog. New designs and migrated REQ075 pages use only the Overseas registration.
