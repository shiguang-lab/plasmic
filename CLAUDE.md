# CLAUDE.md

## Sandbox

You might be in a sandbox. Check out [safehouse.sb](docs/internal/ai-sandbox/macos/safehouse.sb).

## Key tools of root directory

This is root directory of the monorepo. Most development will be done in individual packages, but this directory is responsible for some centrally managed concerns:

- package.json - common devDependencies where we want to use the same version everywhere
- build.mjs - common build script for `packages/`
- .eslintrc.js - shared eslint lint configuration
- vitest.root.ts - shared Vitest unit test configuration for `packages/` and `plasmicpkgs/`
- knip.ts - checks for unused dependencies, run with `knip:deps`

## Key directories

Plasmic is an open-source visual web builder. This monorepo contains:

- **Platform** (`platform/`) - Apps that make up the Plasmic platform, such as the wab, img-optimizer, etc
- **SDK packages** (`packages/`) - npm packages for integrating with Plasmic
- **Plasmic packages** (`plasmicpkgs/`) - npm packages that provide code components on Plasmic
- **Examples** (`examples/`) - Miscellaneous reference implementations

## Tech Stack

- Infra: Docker, k8s, Terraform
- JavaScript tooling: asdf and pnpm
- Languages: Node.js, TypeScript
- Libraries: React, MobX, TypeORM, Vitest, Playwright, Storybook

## Instructions for AI assistant

- `CLAUDE.md` is the canonical instruction file, and `AGENTS.md` is a symlink to it. Edit `CLAUDE.md`, never `AGENTS.md`.
- Instructions are scoped by directory: the file nearest a path applies to it, and adds to the root file rather than contradicting it. Read `platform/wab/CLAUDE.md` before changing anything under `platform/wab`.
- Do not worry about styling/formatting. All files will be formatted to the same style in git hooks, which husky manages via the generated, gitignored `.husky/_` directory. In a fresh worktree that directory doesn't exist and git silently skips all hooks, so run `pnpm install` at the worktree root before your first commit.
- When searching files, you should almost never look through node_modules/ files and other gitignored files unless you have a explicit reason to.
- When you review a pull request or a diff, these files are the conventions to review it against.

## Studio property panel and component contracts

- Keep Studio and Desktop editor UI in English. Preserve upstream Plasmic wording for existing UI; use English for custom editor features and component registration labels. Business page content retains its configured language. Do not inject translated prop names or force a Chinese locale in Studio controls.
- Borrow Figma/Webflow patterns for panel organization, grouping, labels, and editing entry points. Do not introduce a separate designer-facing property model or a parallel persisted schema that translates into component props.
- The component implementation's real props, slots, defaults, and event signatures define the contract. Build property controls from component registration metadata and keep that metadata consistent with the implementation. Display names and localization must not change persisted prop names, types, defaults, or behavior.
- Declare necessary slot and edit-only/uncontrolled-prop mappings in the component registration or wrapper. Keep them explicit and verify the resulting runtime props; do not add another conversion layer in the property panel.
- Keep temporary canvas states, such as revealing an inactive tab or opening an overlay for editing, separate from business state. Selection and navigation must not rewrite initial/runtime props or leak temporary overrides into saved designs, previews, or exports. Explicit user edits to initial/runtime props still use the normal undo and save flow.
- Correct existing component contracts before reorganizing the panel. Verify the full path from registration metadata through the property control and saved Studio model to actual runtime props and rendered behavior.
- Use shared selection and editing-state contracts for content reveal. Do not add component-name special cases to global selection logic.

## Prototype editor node names

- Use English PascalCase for editable node names, independently of the business page language.
- Prefer the actual component display name for unique page-level structural components: a standalone page's single shell is `AppShell`. Add stable business scope when repeated components need distinction, such as `AllGroupsTable` and `MyGroupsTable`; business controls retain meaningful action/field names such as `CreateGroup` and `StatusFilter`.
- Rename instances through Studio's rename operation so state and expression references stay valid. Preserve component identities, node UUIDs, props, slots, routes and interactions. Check the editor label and persisted readback after save/reopen.

## Admin prototype templates

- Before designing or composing admin prototypes, read `ai/plasmic/references/admin-templates.md` and `ai/plasmic/references/templates/admin/catalog.json`. Select page, section, and overlay templates by their scenarios and composition rules, then read the live template model and registered component contracts through Plasmic MCP. The catalog does not replace real Props or Slots.
- Reuse existing registered components. Prefer Antd `Flex`, `Row`, `Col`, `Space`, and `Card` for layout, and the existing `AppShell` for the shell. Use sections inside an existing shell; keep one shell per page.
- After copying or detaching a template, bind the consuming project's data, events, states, and routes using the current model. Verify native forms, pagination, tabs, and overlay behavior in Preview, then save and reread.
- Check the catalog's `directoryConfiguration` and the actual Studio UI before claiming that organization or workspace template menus are enabled. A prepared UI configuration file is not an applied setting.
