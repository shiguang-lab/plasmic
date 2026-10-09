---
name: plasmic
description: Explain or review self-hosted Plasmic pages, components and templates; create or revise editable prototypes; implement or update native React project code from Plasmic designs. Use for Plasmic model/template inspection, prototype design and design-to-code work.
---

# Plasmic

This is a bootstrap skill. Workflows, component guidance and verification scripts live in a versioned resource bundle on the NAS, outside this installed skill.

Choose the task mode before work: `inspect` for read-only page/template explanation or design review, `prototype` for design edits, or `codegen` for native React implementation and updates. Run the matching command:

```sh
npx -y @plasmickit/cli@latest context resolve --mode inspect
npx -y @plasmickit/cli@latest context resolve --mode prototype
npx -y @plasmickit/cli@latest context resolve --mode codegen
```

Inspect uses accessible Desktop MCP reads and does not require edit permission or save/change designs. Prototype mutations require edit permission. Codegen reads models/contracts through MCP and writes code in the target architecture; it does not use `export_code` or official Plasmic sync. For explicitly requested official `@plasmicapp/cli` integration, resolve inspect and follow the guide's official-CLI reference instead of replacing that request with native coding.

The command checks the NAS release manifest every time, downloads changed resources and verifies their hashes before returning absolute paths. Read all returned `mustRead` files, starting with `referencePath`; resolve subsequent links relative to the reference file. Use the returned `resourceRoot` for verification scripts. For a task spanning multiple modes, resolve and read each mode before its work begins.

The runner uses the latest published `@plasmickit/cli`, distinct from official `@plasmicapp/cli`. Later commands can use `npx -y @plasmickit/cli@<cliVersion>` from the result to keep the task on that CLI version, or the global `plasmickit` after checking `plasmickit version check`.

If the command fails, stop dependent work and report the error. Do not silently use cached references. If it requires a newer CLI before npm has that version, install the returned `cliUrl` with `npm install -g <cliUrl>` and rerun. Do not copy the resource bundle into this skill or treat an old transcript as the current component contract.
