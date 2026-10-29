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

## UI scroll containers

- All application UI scroll regions, including panels, dialogs, lists, and AI assistant history or details, must use the shared `Scrollbar` component. Do not build scroll containers with plain elements and `overflow: auto` / `overflow: scroll`, draw custom scrollbars, or add a parallel scrolling implementation.
- Reuse existing wrappers that integrate `Scrollbar` when required by virtualized content. Layout containers may clip content with `overflow: hidden`, but scrolling belongs to `Scrollbar`.
- When adding or modifying a scroll region, verify bounded height, flex sizing, scroll direction, and that the shared component owns scrolling without a nested native scroll container. Check this requirement during code review.

## Studio property panel and component contracts

- Localize Studio and Desktop UI labels through the shared UI language packs. Keep English source wording for upstream UI. Component property names, slot names, descriptions, help text, enum captions and registered action labels must retain their English registration wording across UI languages. Business page content retains its configured language. Language selection must not translate persisted prop names, node names, component contracts, or force a locale in canvas components.
- Borrow Figma/Webflow patterns for panel organization, grouping, labels, and editing entry points. Do not introduce a separate designer-facing property model or a parallel persisted schema that translates into component props.
- The component implementation's real props, slots, defaults, and event signatures define the contract. Build property controls from component registration metadata and keep that metadata consistent with the implementation. Display names and localization must not change persisted prop names, types, defaults, or behavior.
- Declare necessary slot and edit-only/uncontrolled-prop mappings in the component registration or wrapper. Keep them explicit and verify the resulting runtime props; do not add another conversion layer in the property panel.
- Keep temporary canvas states, such as revealing an inactive tab or opening an overlay for editing, separate from business state. Selection and navigation must not rewrite initial/runtime props or leak temporary overrides into saved designs, previews, or exports. Explicit user edits to initial/runtime props still use the normal undo and save flow.
- Correct existing component contracts before reorganizing the panel. Verify the full path from registration metadata through the property control and saved Studio model to actual runtime props and rendered behavior.
- Use shared selection and editing-state contracts for content reveal. Do not add component-name special cases to global selection logic.

## Prototype editor node names

- Default project-directory Page names, task-owned canvas/group names and business UI copy to Simplified Chinese; explicit current user language/name choices take precedence. Choose concise requirement-derived business names before generation. Native automatic overview names may need updateCanvas; rename the existing group and preserve references. Keep routes, device preset names and registered component contracts unchanged; do not add an in-page title to show a directory name.
- Use English PascalCase for editable internal tree node names, independently of the business page language. This includes roots and descendants, and does not apply to Page or canvas/group directory names.
- Name nodes for their actual role using the shortest clear name in the owning page/component. A component display name is appropriate when it already explains the role; business actions, fields and content may need semantic names. Add scope or type words only when they improve understanding or distinguish instances. Apply this standard equally to roots and descendants; avoid redundant library/product prefixes, repeated context and arbitrary suffixes.
- Rename instances through Studio's rename operation so state and expression references stay valid. Preserve component identities, node UUIDs, props, slots, routes and interactions. Check the editor label and persisted readback after save/reopen.

## Admin prototype templates

- Admin prototypes inside AppShell start with business content, without a standalone page title/header/subtitle/intro unless the current user explicitly requests that area. This includes detail pages; template/reference headers do not opt in. Keep requirement scope, implementation notes, acceptance instructions and simulation controls outside the business UI. Preserve genuine field help and actionable feedback. Map each required table, submitted form and read-only information group to its registered Table, Form and Descriptions components before composition; do not imitate them with styled HTML/text.
- Apply the Header necessity assessment before the return-navigation decision in `ai/plasmic/references/design/layout.md#admin-content-entry`. A generic page title, repeated status/fields or actions with an existing owner do not justify a Header. Place a needed return action inside an explicitly requested Header; without a Header, use existing breadcrumbs and omit a standalone return button or return-only surface. Verify the parent destination is navigable.

- Before designing or composing admin prototypes, read `ai/plasmic/references/admin-templates.md` and `ai/plasmic/references/templates/admin/catalog.json`. Select page, section, and overlay templates by their scenarios and composition rules, then read the live template model and registered component contracts through Plasmic MCP. The catalog does not replace real Props or Slots.
- Before markup, discover existing business/library components by required role through MCP and read candidate contracts. Prefer registered components/compositions for every functional widget, including actions, controls, Tabs, pagination, feedback and overlays; ordinary text and necessary semantic/Slot containers remain valid. Record a verified contract gap and exact named target before using a custom element widget; do not redraw available components with HTML/CSS.
- Use Antd `Flex`, `Row`, `Col`, and `Space` for layout, and the existing `AppShell` for the shell. `Card` represents an independently justified business surface; do not wrap each section, Steps, or an already surfaced SearchForm in a Card. Use sections inside an existing shell; keep one shell per page.
- After copying or detaching a template, bind the consuming project's data, events, states, and routes using the current model. Verify native forms, pagination, tabs, and overlay behavior in Preview, then save and reread.
- Check the catalog's `directoryConfiguration` and the actual Studio UI before claiming that organization or workspace template menus are enabled. A prepared UI configuration file is not an applied setting.
