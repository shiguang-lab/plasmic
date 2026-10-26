# Plasmic task guide

Read resolved `mustRead` files and [context/evidence rules](context-reading.md), then applicable conditional sections. Links are file-relative; commands use `resourceRoot`.

## Task routing

| Intent | Mode |
| --- | --- |
| Explain/review a page, component or template | [inspect](workflows/inspect.md), read-only |
| Create/revise an editable design | [prototype](workflows/prototype.md), requires `canEdit` |
| Implement/update native React project code | [codegen](workflows/codegen.md), reads design, writes target code |

Switch modes with the task; review never authorizes edits. Check only present/required behavior and reuse current evidence. Discover the accessible project and identify the session using configured Desktop MCP/live schemas. Save/reopen, installation and repair require edit authorization. Studio: `https://plasmic-studio.shiguanglab.com`.

## Tool choice

Admin: [design rules](admin-design.md), [source precedence/exceptions](requirement-alignment.md#source-and-scope).

- `@plasmickit/cli` installs this skill and updates references; it does not read/generate designs.
- Desktop MCP reads models, contracts, Slots, states and interactions; edits use [public operations](desktop-mcp.md).
- Official `@plasmicapp/cli`: explicit codegen/sync/watch/metadata tasks only; read [official CLI](official-cli.md). Metadata/JSX cannot replace editable models. Separate generated-code ownership.

Native coding excludes `export_code`, sync and Loader. Honor explicit official integration requests. Report MCP gaps; finish independent work without private globals/raw REST/platform development.

Props, Slots, defaults and event signatures retain public identities across UI languages. Follow [naming](design/naming.md); temporary reveals must not alter saved business state.

Keep plans/evidence/mock boundaries outside UI. Report source/resource versions, checks and limits. Save, publish and deploy require their respective authorization.

`context resolve` verifies freshness/integrity; failure blocks dependent work. `references path` is offline only. See CLI help.
