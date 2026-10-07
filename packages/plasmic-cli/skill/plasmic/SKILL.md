---
name: plasmic
description: Design, revise, and verify editable product prototypes in self-hosted Plasmic, or read Plasmic pages and generate native React project code under maintained engineering standards. Use for Plasmic product prototyping and design-to-code development.
---

# Plasmic

This is a bootstrap skill. Workflows, component guidance and verification scripts live in a versioned resource bundle on the NAS, outside this installed skill.

At the start of each task, choose `prototype` for product design or `codegen` for code generation and integration. Run:

```sh
npx -y @plasmickit/cli@latest context resolve --mode prototype
# Or: npx -y @plasmickit/cli@latest context resolve --mode codegen
```

In `codegen` mode, read page models, component contracts and interactions through Desktop MCP, then implement code in the target project's architecture. Generation follows the returned standards; it does not use `export_code` or the official Plasmic CLI.

The command checks the NAS release manifest every time, downloads changed resources and verifies their hashes before returning absolute paths. Read all returned `mustRead` files, starting with `referencePath`; resolve subsequent links relative to the reference file. Use the returned `resourceRoot` for verification scripts. For a task spanning both modes, resolve and read each mode before its work begins.

The runner uses the latest published Plasmic CLI. Later commands can use `npx -y @plasmickit/cli@<cliVersion>` from the result to keep the task on that CLI version, or the global `plasmickit` after checking `plasmickit version check`.

If the command fails, stop dependent work and report the error. Do not silently use cached references. If it requires a newer CLI before npm has that version, install the returned `cliUrl` with `npm install -g <cliUrl>` and rerun. Do not copy the resource bundle into this skill or treat an old transcript as the current component contract.
