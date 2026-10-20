# Plasmic task guide

Read the resolved bundle's `mustRead` files; select conditional references by affected region. Links resolve relative to their file; sample `scripts/...` commands run from `resourceRoot` or use its absolute prefix. Downloading does not require reading every file. Read the [context reading and evidence rules](context-reading.md) before conditional references.

## Task routing

| Intent | Mode and scope |
| --- | --- |
| Explain a page, component or template; review a design | [inspect](workflows/inspect.md), read-only |
| Create or revise an editable design | [prototype](workflows/prototype.md), edits require `canEdit` |
| Implement or update native React project code from a design | [codegen](workflows/codegen.md), reads design and writes target code |

Switch modes when the user's task changes from analysis to edits. A review is not permission to apply its findings. Component checklists apply only to present or required behavior; they do not add features. Their save/reopen, installation and repair steps apply to authorized edits, never read-only inspection. Reuse the same current evidence across applicable component checks. Studio is `https://studio.plasmic.shiguanglab.com`; use the user's configured Desktop MCP, accessible project and live operation schemas. Discover the project and identify the session before work; only mutations require edit permission.

## Tool choice

For admin prototype design, use the [admin reference index](admin-design.md) to select the applicable layout, component and composition rules. [Requirement alignment](requirement-alignment.md#source-and-scope) owns source precedence and reviewed exceptions.

- `@plasmickit/cli` (`plasmickit`) installs the skill and delivers current references. It does not read or generate a design.
- Desktop MCP reads editable models, registrations, Slots, states and interactions; prototype edits use its public operations. Read the [Desktop contract](desktop-mcp.md).
- Official `@plasmicapp/cli` (`plasmic`) is for explicitly requested official code generation/sync/watch or project metadata. Design/template interpretation uses MCP; `info` metadata and exported JSX do not replace the editable model. For an explicit official integration task read [official CLI](official-cli.md); keep its generated-code ownership separate from native coding.

Native coding does not invoke `export_code`, official sync or a Loader. Do not reinterpret an explicit official integration request as native generation. MCP capability gaps are concrete limitations: complete independent work, report the blocked operation, and do not use private globals/raw design REST or turn the task into platform development.

Registered Props, Slots, defaults and event signatures retain their public identities across UI languages. Business content and directory/node names follow [naming](design/naming.md); temporary editing reveals must not change saved business state.

Keep source inventories, plans, mock-data boundaries and evidence in the task workspace outside the UI. Report actual source/resource versions, checks and limitations. Saving, publishing and deploying are distinct actions; follow the user's authorized scope.

`context resolve` checks freshness and verifies the complete bundle before returning absolute paths. Failure blocks dependent work. `references path` is explicit offline inspection and does not prove freshness. See the CLI help for update/check commands.
