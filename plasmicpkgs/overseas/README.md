# Overseas component library

`@shiguang-lab/plasmic-overseas` contains shared Overseas business components. `registerAll()` registers AppShell, SearchForm and SearchForm.Item. React UI ActionGroup belongs to the independent [React UI library](../react-ui/README.md). Keep Ant Design 6 registrations in `plasmicpkgs/antd6`.

Build with `pnpm --filter @shiguang-lab/plasmic-overseas build`. The canvas bundle is `platform/canvas-packages/src/overseas.ts`; the NAS registration script publishes the independent `overseas` hostless library and component-store entry. Install it in Studio or through MCP `installLibrary`, then read its contracts before insertion.

See [AppShell configuration and preview](preview/README.md). Menu items accept `key`, `label`, `href`, `disabled`, `type` and nested `children`. Routes use the Plasmic Link provider, so the same links work in Studio preview and exported applications.

The already-published Ant Design library cannot delete registered component contracts. Its previous AppShell name delegates to this implementation and is hidden by the NAS component catalog. New designs and migrated REQ075 pages use only the Overseas registration.

ActionGroup item `confirm` accepts `title`, optional `description`, `okText`, and optional `cancelText`. Confirmation anchors an Antd Popconfirm to the row ActionGroup, including actions folded into More. Only confirmation calls the item callback and `onAction`; cancelling, clicking outside, or disabling the item while pending leaves the business data unchanged. `danger` also styles the confirmation button.

PC Dropdown menus open on hover: ActionGroup More and AppShell language/account menus. Hovering only opens the menu; selecting an item performs its action. ActionGroup respects an explicit `dropdownProps.trigger` for click-operated requirements such as touch interfaces. Form selects and row confirmations remain click-operated.

Run interaction tests with `vitest run tests/action-group-confirm.test.tsx --environment jsdom` from this package (Vitest and Testing Library are shared root development tools).

SearchForm supports an optional `labelWidth` in pixels. Unconfigured labels follow their content width. To align controls across rows, explicitly set a shared width that fits the longest label, including custom labels, required markers and punctuation, on one line. The editing canvas displays all fields with 收起 and an upward indicator. Interactive preview honors the actual collapse state and retains hidden field values.
