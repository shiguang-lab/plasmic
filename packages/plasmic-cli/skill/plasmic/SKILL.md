---
name: plasmic
compatibility: Requires Node.js >=22.12, Python >=3.9 available as python3, and signed-in Plasmic Desktop MCP for design inspection or editing.
description: Create, revise and review editable UI prototypes in Plasmic (原型设计/修改/验收), and generate, repair or verify their application code (代码生成/修复/还原验收). Use for prototype design when no other tool is specified, explicit Plasmic work, and follow-ups in established Plasmic design/code context. Excludes unrelated application coding and Plasmic platform development.
---

# Plasmic

This is the entrypoint for resolving current resources and selecting a workflow. Component rules, design conventions and acceptance procedures are maintained in the resolved references; read the relevant documents before acting.

## Resolve the workflow

Choose by the task's artifact and intent, not whether it is new work or uses MCP:

- `inspect`: explain or review the design/model itself without changing it.
- `prototype`: create, revise or repair an editable design and verify the resulting prototype.
- `codegen`: generate, update, repair or review application code against a Plasmic design, including read-only implementation acceptance.

For an editable prototype request with no chosen tool or existing design source, use Plasmic; honor another explicitly selected tool or established source. Follow-up work keeps its design/code context without repeating the skill name. Switch workflows when the target changes; read-only code review still uses codegen. Review does not authorize repairs. If the intended artifact is unclear, clarify it rather than choosing an editor or codebase by keyword alone.

If this skill contains `local-source.json`, read its absolute `resolver` path and run `node RESOLVER_PATH --mode MODE`. This selects current local development resources. A missing resolver/resource is an error; do not fall back to published or cached resources.

Otherwise run the matching published command:

```sh
npx -y --prefer-online @plasmickit/cli@latest context resolve --mode inspect
npx -y --prefer-online @plasmickit/cli@latest context resolve --mode prototype
npx -y --prefer-online @plasmickit/cli@latest context resolve --mode codegen
```

Published `context resolve` first synchronizes existing installed skill entries from its CLI bundle, independently of resource updates. Local-source and symlinked entries are preserved. Report `skillUpdate` failures separately; they do not invalidate usable resources. Updated discovery instructions apply when the client reloads skills, not necessarily in this conversation.

Before work in a mode, resolve its resources and read every returned `mustRead` file, starting with `referencePath`; follow relevant links from `resourceRoot`. Within the same task, reuse known, already-read resources and retain pending checks; do not resolve again just because a new message arrived. Resolve/read a newly required mode or recover missing resource context before dependent work; reread affected design inputs when they change. Resource readiness or document reading alone does not establish workflow completion.

Both resolvers verify that Python 3.9+ is available as `python3` for reference readers and gates. The published resolver also checks the NAS release manifest and verifies resource hashes. Stop dependent work on failure; do not silently use stale references. If it requires a newer CLI before npm has that version, install its returned `cliUrl` and rerun. Relay meaningful preparation progress from stderr; stdout contains the result. Report local versus published resources accurately.

## Ensure Desktop MCP access

Before Desktop work, check the **current session's** actual tool inventory. When Plasmic Desktop MCP is present, use it directly; do not re-register it. An entry in another client or a skill installation is not a connection.

If tools are missing, read `references/desktop-transports.md` from the resolved `resourceRoot` and follow its automatic setup steps. Identify the current client, verify its active MCP configuration path/schema and installed Plasmic executable through public configuration/help, then add the missing `plasmic-desktop` stdio entry with arguments `["--mcp"]` within the user's authorized task and host permissions. Preserve unrelated settings, comments and existing server options. Do not register every installed Agent, guess a config path, overwrite a conflicting entry, add auto-approval rules or change credentials.

Use the client's documented MCP reload/reconnect if available; otherwise state which configuration was updated and that a new session is needed. Only a successful native `get_app_state` proves this session is connected. Never claim a config write loaded tools, or invent tool calls that the session cannot access. If setup cannot be verified, report the specific missing path/contract and continue independent work; authenticated script RPC follows the same routing document and must be described as script access, not native MCP.

## Prototype principles

Start with the workflow's **Before content writes** checkpoint and the resolved `references/planning.md`. For new Pages or structural changes, use the existing project/Page rules cards and selection preflight before composition. Local repairs read and check the affected rules without restarting unrelated Page planning. Tool availability, `validate` and `save` do not establish design-rule compliance.

Design the in-scope Pages' region relationships before detailed generation under `references/design/page-structure.md`; reconcile the current Page with live templates and component contracts, then generate and review against that structure. Requirements constrain business behavior and explicit presentation choices; use design reasoning for unspecified layout. Select components before composing markup. Discover existing business components and matching templates, prefer them and registered library components, and read their current Props, Slots and event contracts. Do not redraw available functional components with HTML/CSS. Follow `references/libraries/index.md` for selection and verified contract gaps.

For admin prototypes, read `references/admin-templates.md` and its catalog, inspect applicable live templates, then adapt the selected composition to the requirement. Read the relevant component and composition references before using them. A template or component must fit the current requirement and the project's actual library.

Keep plans and acceptance evidence outside the business UI. Prototype mutations require edit permission. Codegen follows the target application's architecture; an explicit official Plasmic CLI request follows the guide's official-CLI reference.

For prototype work, follow the workflow's execution-stage table. Derive observable acceptance cases from the current requirements before generation, prepare the current Page's detailed inputs, and retain actual gate/runtime results at each stage. Use existing preparation and verification commands; declarations, tool success and screenshots alone do not establish business acceptance.

Apply the workflow's Design, Saved-Page and Integration review checkpoints through its single review-mode policy: prefer an independent subagent, otherwise perform the same scoped checks in the current conversation and disclose the fallback. Resolve required findings before dependent work; retain runtime/persistence checks as pending until executed. Scope local edits without adding unrelated reviews.

## Client implementation boundary

Use documented Desktop MCP tools and resolved skill resources. Do not unpack, decompile or inspect Plasmic App/Desktop/Studio internals, packaged dependencies, copied artifacts or equivalent client repository source, including through delegated agents or scripts. Codegen may inspect the target application's source within the user's scope.

When public contracts or references are insufficient, retain the exact call/error, stop dependent work and report the missing contract. Do not reverse-engineer private interfaces to continue.
