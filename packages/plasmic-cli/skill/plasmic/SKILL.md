---
name: plasmic
description: Inspect self-hosted Plasmic pages and templates, create or revise editable prototypes, and implement native React code from Plasmic designs.
---

# Plasmic

This is the entrypoint for resolving current resources and selecting a workflow. Component rules, design conventions and acceptance procedures are maintained in the resolved references; read the relevant documents before acting.

## Resolve the workflow

Choose `inspect` for read-only explanation/review, `prototype` for editable design creation or revision, or `codegen` for native application implementation.

If this skill contains `local-source.json`, read its absolute `resolver` path and run `node RESOLVER_PATH --mode MODE`. This selects current local development resources. A missing resolver/resource is an error; do not fall back to published or cached resources.

Otherwise run the matching published command:

```sh
npx -y @plasmickit/cli@latest context resolve --mode inspect
npx -y @plasmickit/cli@latest context resolve --mode prototype
npx -y @plasmickit/cli@latest context resolve --mode codegen
```

Read every returned `mustRead` file, starting with `referencePath`. Resolve linked documents from the returned `resourceRoot`; follow the workflow's scenario-specific reading and evidence requirements. Resource readiness does not mean the documents have been read. For a task spanning modes, resolve and read each workflow before its work begins.

The published resolver checks the NAS release manifest and verifies resource hashes. Stop dependent work on failure; do not silently use stale references. If it requires a newer CLI before npm has that version, install its returned `cliUrl` and rerun. Relay meaningful preparation progress from stderr; stdout contains the result. Report local versus published resources accurately.

## Ensure Desktop MCP access

Before Desktop work, check the **current session's** actual tool inventory. When Plasmic Desktop MCP is present, use it directly; do not re-register it. An entry in another client or a skill installation is not a connection.

If tools are missing, read `references/desktop-transports.md` from the resolved `resourceRoot` and follow its automatic setup steps. Identify the current client, verify its active MCP configuration path/schema and installed Plasmic executable through public configuration/help, then add the missing `plasmic-desktop` stdio entry with arguments `["--mcp"]` within the user's authorized task and host permissions. Preserve unrelated settings, comments and existing server options. Do not register every installed Agent, guess a config path, overwrite a conflicting entry, add auto-approval rules or change credentials.

Use the client's documented MCP reload/reconnect if available; otherwise state which configuration was updated and that a new session is needed. Only a successful native `get_app_state` proves this session is connected. Never claim a config write loaded tools, or invent tool calls that the session cannot access. If setup cannot be verified, report the specific missing path/contract and continue independent work; authenticated script RPC follows the same routing document and must be described as script access, not native MCP.

## Prototype principles

Select components before composing markup. Discover existing business components and matching templates, prefer them and registered library components, and read their current Props, Slots and event contracts. Do not redraw available functional components with HTML/CSS. Follow `references/libraries/index.md` for selection and verified contract gaps.

For admin prototypes, read `references/admin-templates.md` and its catalog, inspect applicable live templates, then adapt the selected composition to the requirement. Read the relevant component and composition references before using them. A template or component must fit the current requirement and the project's actual library.

Use the selected workflow for source interpretation, project selection, editing and verification. Keep plans and acceptance evidence outside the business UI. Inspect is read-only; prototype mutations require edit permission. Codegen uses the target application's architecture and codegen workflow; an explicit official Plasmic CLI request follows the guide's official-CLI reference.

For prototype work, follow the workflow's execution-stage table. Derive observable acceptance cases from the current requirements before generation, prepare the current Page's detailed inputs, and retain actual gate/runtime results at each stage. Use existing preparation and verification commands; declarations, tool success and screenshots alone do not establish business acceptance.

Use the workflow's review-mode rules to prefer an independent subagent when available, otherwise perform the same checks in the current conversation and disclose the fallback.

## Client implementation boundary

Use documented Desktop MCP tools and resolved skill resources. Do not unpack, decompile or inspect Plasmic App/Desktop/Studio internals, packaged dependencies, copied artifacts or equivalent client repository source, including through delegated agents or scripts. Codegen may inspect the target application's source within the user's scope.

When public contracts or references are insufficient, retain the exact call/error, stop dependent work and report the missing contract. Do not reverse-engineer private interfaces to continue.
