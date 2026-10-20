---
name: plasmic
description: Inspect self-hosted Plasmic pages and templates, create or revise editable prototypes, and implement native React code from Plasmic designs.
---

# Plasmic

This skill owns core constraints. Detailed workflows, component selection and usage guidance, and verification scripts live in a versioned resource bundle on the NAS, outside this installed skill.

## Client implementation boundary

Use the published CLI, documented Desktop MCP tools and resolved skill resources with the task's requirements and design files. Do not unpack, extract or decompile the Plasmic App, or read its internal Desktop/Studio implementation, packaged dependencies, extracted/copied artifacts or equivalent client repository source. This prohibition applies to the acting agent, delegated agents and their tool scripts, including troubleshooting and contract or validator discovery.

If public tool contracts or skill documents are insufficient, retain the exact call and error, stop dependent work and report the missing contract or documentation. Do not inspect client internals or reverse-engineer private interfaces to continue. Codegen may inspect and edit the target application's source within the user's task; this does not authorize reading the Plasmic client implementation.

## Component priority for prototype design

Choose components before markup for every prototype creation or edit. Discover reusable business components/templates and library registrations through Desktop MCP by the required role, then read candidate contracts. Prefer an existing business component or matching template, then registered library components, then compositions of those components. Preserve the user's library choices and the target project's actual APIs; a template must fit the requirement. Do not install another library or add a Card merely to satisfy this preference.

Use real Props, Slots, states and events for functional widgets, including actions, controls, navigation, repeated information, pagination, feedback and overlays. Do not redraw available components with HTML/CSS; visual similarity is not component reuse. Plain semantic text, necessary root/Slot/layout containers, genuine navigation anchors, read-only code and content graphics remain valid native elements; do not turn every text node or wrapper into a component or surface.

Use a custom element widget only when verified current components and their supported compositions cannot express the required behavior. Before writing it, record the exact named node, checked candidates/contracts, concrete gap and requirement source in the task plan. An unread contract, absent import, rendering error, styling convenience or missing binding is not a capability gap. Correct usage or report the blocker; ordinary design work does not create a new component library. A fallback cannot override a required native identity, Form ownership or another acceptance gate.

After resolving resources, use `references/libraries/index.md` for library/API matching and role-specific selection, and `references/requirement-alignment.md` for native-component inventories and the `elementFallbacks` format.

## Prototype execution boundary

Keep generation plans, progress, pending cases and acceptance records in the agent's working directory. Use Desktop MCP for individual design/read/Preview operations, with their target, permission and context checks. Verification scripts read explicit evidence and write local reports; they do not register workflows, persist project bindings or restrict project navigation.

## Task workflow

Choose the task mode before work: `inspect` for read-only page/template explanation or design review, `prototype` for selecting/creating the design project and design edits, or `codegen` for native React implementation and updates. Run the matching command:

```sh
npx -y @plasmickit/cli@latest context resolve --mode inspect
npx -y @plasmickit/cli@latest context resolve --mode prototype
npx -y @plasmickit/cli@latest context resolve --mode codegen
```

Inspect uses accessible Desktop MCP reads and does not require edit permission or save/change designs. Prototype mutations require edit permission. Codegen reads models/contracts through MCP and writes code in the target architecture; it does not use `export_code` or official Plasmic sync. For explicitly requested official `@plasmicapp/cli` integration, resolve inspect and follow the guide's official-CLI reference instead of replacing that request with native coding.

The command checks the NAS release manifest every time, downloads changed resources and verifies their hashes before returning absolute paths. Read all returned `mustRead` files, starting with `referencePath`; resolve subsequent links relative to the reference file. Use the returned `resourceRoot` for verification scripts and follow the guide's conditional section-reading/evidence rules. For a task spanning multiple modes, resolve and read each mode before its work begins.

Follow the resolved workflow for project selection, component discovery and acceptance; load detailed rules only for the affected scope. Switching from inspection to editing requires the corresponding user request and prototype workflow.

The CLI streams preparation progress to stderr and returns JSON on stdout. Relay meaningful version/download/verification changes; use incremental output for a long-running command. Report waiting honestly when output is buffered. Resource readiness means files are available, not that they have been read or their workflow completed.

The runner uses the latest published `@plasmickit/cli`, distinct from official `@plasmicapp/cli`. Later commands can use `npx -y @plasmickit/cli@<cliVersion>` from the result to keep the task on that CLI version, or the global `plasmickit` after checking `plasmickit version check`.

If the command fails, stop dependent work and report the error. Do not silently use cached references. If it requires a newer CLI before npm has that version, install the returned `cliUrl` with `npm install -g <cliUrl>` and rerun. Do not copy the resource bundle into this skill or treat an old transcript as the current component contract.
