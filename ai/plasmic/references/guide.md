# Plasmic task guide

The installed `plasmic` skill loads this NAS resource bundle through `plasmickit context resolve`. Its JSON result identifies the release, resource root and required task references. Read the returned `mustRead` files before using editor or code-generation tools; load conditional references only when applicable. References and `scripts/` are relative to `resourceRoot`, not the installed skill or the business repository.

## Task routing

- Product prototype design, revision or review: [prototype workflow](workflows/prototype.md). For admin pages read [admin design](admin-design.md) and [admin templates](admin-templates.md), including its bundled catalog, before composing pages; for requirement-driven work read [requirement alignment](requirement-alignment.md). Explicit regeneration/stability work also needs [reproducibility](reproducibility.md).
- Generate and integrate development code: [codegen workflow](workflows/codegen.md). Read the real page model and component contracts, then author native project code using the returned code-generation standards. The agent performs generation; the CLI delivers current guidance.
- Exact Desktop tool behavior: [Desktop MCP contract](desktop-mcp.md). Discover live operation schemas through `get_app_state`; bundled guidance does not override actual registrations or permissions.

Studio is `https://studio.plasmic.shiguanglab.com`. Start the user's Plasmic Desktop app, sign in, and use its configured MCP connection. Use `list_projects` / `open_design` when needed; call `get_app_state`, then `execute` → `identify` with skill `plasmic` and the actual model/client identity. Design edits require `canEdit`. Discover the target and contracts before mutations. Do not use private Studio globals, database bundles or raw REST to change designs.

Studio/editor UI and component registration labels stay English. Business page language comes from the requirement. Component props, slots, defaults and events remain the real implementation contract. Keep temporary editing/reveal state separate from persisted business state. Use English PascalCase for editable node names.

Keep source inventory, plans, simulated data notes and acceptance evidence in the task workspace, outside the product UI. Report source release/version, saved project revision or generated files, checks actually performed and remaining limitations. Save is distinct from publishing; publish only when the user's task authorizes it.

## Resource commands

```sh
plasmickit version check
plasmickit references check
plasmickit references update
plasmickit context resolve --mode prototype
plasmickit context resolve --mode codegen
plasmickit references path
```

`check` fetches the latest manifest and reports whether local resources differ. `update` checks and downloads when needed, verifies the whole installed bundle, and repairs missing/corrupt files. `context resolve` performs the same update before returning task paths. `path` inspects the verified local bundle without contacting the NAS; it does not establish that references are current and is only for explicit offline inspection. A failed freshness check blocks dependent execution.
