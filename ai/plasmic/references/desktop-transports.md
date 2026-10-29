# Agent transports and tool routing

Prefer the native MCP stdio server configured in the **current Agent client/session**, using the verified installed executable with `--mcp`. A registration in another client does not make tools available here. Reload/reconnect when supported; otherwise start a new session after configuring it. Inspect the actual tool inventory and use MCP `tools/list` schemas.

## Automatic setup when session tools are absent

1. Identify the client hosting this session from trusted runtime context or its public CLI/help. Detecting several installed clients does not identify the current one. Inspect only that client's MCP configuration, respecting its config-directory overrides and project/global scope. For DeepSeek Harness, identify its profile and patch schema through public settings/help; Desktop and CLI profiles are separate. Do not assume another client's configuration applies.
2. Verify the installed Plasmic executable. macOS normally uses `/Applications/Plasmic.app/Contents/MacOS/Plasmic`; check that it exists. Use the verified installed path on other systems. Configure stdio with that command and `args:["--mcp"]`; no token or copied RPC credentials belong in this configuration.
3. Within the authorized Desktop task and the host's permissions, add only the missing `plasmic-desktop` entry. Use the client's public MCP add command where available; otherwise edit its verified configuration in its real format. Keep unrelated servers/settings/comments and extra options on an existing matching entry. If an entry already launches the verified executable with `--mcp`, do nothing. A disabled entry or different command is a conflict: report it without overwriting the user's choice. Do not add blanket approval or trust settings.
4. Parse/read back the result without printing secrets and verify it still contains the intended command/arguments and unrelated configuration. Repeating this procedure must leave one entry. A public server probe can check startup but does not prove this session loaded tools.
5. Use a documented client reload/reconnect action if supported. Otherwise tell the user the exact file changed and ask them to open a new session; do not terminate or restart their conversation automatically. Confirm the actual tool inventory and call native `get_app_state` before claiming native MCP is available. If config location/schema or reload support is unknown, name that missing contract instead of guessing. Missing tools never justify placing top-level tools inside `execute`.

## DeepSeek Harness Desktop profile

For DSH, read [profile patch setup](desktop-dsh.md) before configuring the connection. Other clients retain their own documented format.

## Prototype preflight

Through native MCP, call `get_app_state({toolNames:["read","queryElements","validate"]})`. Save the complete returned state object as `/task/mcp-state.json` (not the MCP envelope). Also save the current Desktop's MCP `tools/list` result (`{"tools":[...]}`, without the JSON-RPC envelope) as `/task/mcp-tools.json`, retaining the advertised `preview` input schema. If the list is paginated, collect all pages into that tools array. `preview` is a top-level MCP tool; its parameter schema does not belong in `get_app_state.toolNames` or `editorTools`. Then run:

```sh
python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --state /task/mcp-state.json --tools /task/mcp-tools.json --report /task/mcp-contract.json
```

This checks the supplied advertised contracts; collect both inputs from the same Desktop build and refresh them after a build or editor-session change. A replay of old state does not prove a current connection. On macOS/Linux, `--profile "/absolute/Desktop user-data"` instead of `--state` can collect the state via authenticated local RPC; `--tools` is still required because local RPC does not provide MCP schema discovery. If collection or validation fails, inspect the reported missing contract and its source before deciding whether Desktop needs an update.

Check collection capability before composition: the [full suite's live collector](verification.md#collect-and-verify) requires local macOS/Linux Desktop RPC. Native MCP access and successful contract preflight alone do not make that collector available on Windows or a remote-only client. Such clients can run gates against an existing complete capture using `--evidence`; record any unavailable current capture, runtime or persistence checks as unverified. Do not claim full acceptance from replay or invent another transport.

## Calls after connection

Authenticated local RPC is a script transport, not an editor operation namespace. Its `method` is a top-level Desktop tool name and `input` is that tool's arguments. It does not provide MCP's schema discovery or connection-scoped result references. Do not infer a native operation from a top-level tool name.

| Intent | Native MCP call | Local RPC `method` / `input` |
| --- | --- | --- |
| List organizations | `list_orgs({})` | `list_orgs` / `{}` |
| List projects | `list_projects({workspaceId})` | `list_projects` / `{workspaceId}` |
| Create a project | `create_project({name,workspaceId})` | `create_project` / `{name,workspaceId}` |
| Read a project by ID | `get_project({projectId})` | `get_project` / `{projectId}` |
| Read a workspace by ID | `get_workspace({workspaceId})` | `get_workspace` / `{workspaceId}` |
| Rename a project | `rename_project({projectId,name})` | `rename_project` / `{projectId,name}` |
| Move a project | `move_project({projectId,workspaceId})` | `move_project` / `{projectId,workspaceId}` |
| Copy a project | `clone_project({projectId,name?,workspaceId?})` | `clone_project` / `{projectId,name?,workspaceId?}` |
| Open a project | `open_design({projectId})` | `open_design` / `{projectId}` |
| Read model | `execute({name:"read",input:{collection:"components"}})` | `execute` / `{name:"read",input:{collection:"components"}}` |
| Save | `execute({name:"save",input:{}})` | `execute` / `{name:"save",input:{}}` |
| Preview | `preview({action:"state"})` | `preview` / `{action:"state"}` |

RPC envelopes also contain the local authentication token; never print or include it in evidence. `verify_all.Desktop.call(tool, arguments)` calls top-level tools; `.execute(operation, input)` wraps native editor operations only. `ready:false` on a project list is normal: discovery, creation and opening a project do not need an existing editor. `read` and `save` are not top-level tools.

Misplaced tool names return `INVALID_TOOL_ROUTE` with `operationExecuted:false` and a corrected `recovery` call, before editor-context checks or execution. Inspect the correction; supply any `requiresInput` fields from real identities. The server never silently reroutes or runs the correction. This differs from `CONTEXT_MISMATCH`, which means a correctly routed editor operation needs the stated editor context.

