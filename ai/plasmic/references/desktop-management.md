# Select the design project

Resolve Team → Workspace → Project before entering design. Org and Team refer
to the same platform resource: MCP uses `orgId`, and responses retain `team` or
`teams`. Use public Desktop MCP tools and the signed-in account's permissions.
Discovery, resource creation and open_design work without a ready Studio editor. These are top-level tools, never execute operation names; use Desktop.call rather than Desktop.execute in public script clients. See [transport and routing](desktop-transports.md).

Queries/creation return resource IDs/names/parents only. No permissions, members, billing, configuration or full-detail bypass is exposed. The platform enforces access; confirm current edit capability with identify after opening. A creation result supplies project/workspace/team identity, not a revision object; read current revision from the opened editor context.

## Find or choose each level

| Level | Discovery | Authorized creation | ID to retain |
| --- | --- | --- | --- |
| Team / Org | `list_orgs({})`, optional name `query`; `get_org({orgId})` for a known ID | `create_org({name})` | `team.id` as `orgId` |
| Workspace | `list_workspaces({orgId})` within the chosen Team | `create_workspace({orgId, name, description?})` | `workspace.id` |
| Project | `list_projects({workspaceId})` within the chosen Workspace | `create_project({name, workspaceId})` | `project.id` |

Read `get_app_state` first and extract any Team, Workspace and Project names or
IDs from the request. Resolve the parent before selecting its child. Search for
each named resource in that scope; an ID or one exact name match can be used
directly. Name queries return substring suggestions, so verify the exact name
and parent rather than selecting the first result. Duplicate names require a
choice showing their IDs. All IDs come from actual responses.

When a named object is absent, say which scope was searched and show the
available list, with names, IDs and parents. Offer use of an existing item or
creation of a new one. Resolve only the current undecided level; retain prior
choices and resume at its child after the user's answer. If a level is omitted
and the target cannot be inferred unambiguously from established context, show
its available choices. An empty list should offer creation. Permission or
network errors do not prove that the requested object is absent.

Do not create a replacement merely because a name was not found. An explicit
request to create that missing object already authorizes creation; explain the
lookup result and use that authorization without asking again. Otherwise wait
for the user's choice to create and obtain its name before the write. For an open/select request, find existing named objects and reuse a unique match. An explicit new/fresh-project request creates a new object under the resolved parent, even if an older object has the same name; retain and use the returned new ID. A name search does not authorize reading an old project's content. Recheck the new object's
parent in the response and scoped list before proceeding. `create_org` also
creates a default Workspace, so list its Workspaces before selecting or creating
the requested Workspace. Workspace plan restrictions are errors even on HTTP
200; stop dependent creation when a tool reports an error.

When only a Workspace or Project is named, account-wide `list_workspaces({})` or
`list_projects({})` can locate it and reveal its actual parent. Verify the full
hierarchy before selecting it; duplicate names still need a choice. A Project
response carries `workspaceId` and `teamId`, and a Workspace carries `team.id`.
Never replace an explicitly requested parent with a similarly named child from
another parent. An already established current Project can be reused when no
requested hierarchy conflicts; check its current identity before editing.

## Open the resolved Project and design

Use the selected `workspace.id` in `create_project`; omitting `workspaceId`
creates in the personal Workspace and cannot satisfy a chosen Workspace.
Creation returns `project` identity and creates an empty private Project.
Creation and query tools do not navigate or save the active design.

Call `open_design({projectId: project.id})` only after the full target is resolved.
Team and Workspace selection does not require intermediate dashboard navigation.
Inspect the result, then read `get_app_state`: `projectId` must match and `ready`
must be true. Read its actual editor schemas and call `execute` → `identify`
with the actual model/client and skill `plasmic`; confirm the same Project and
`canEdit` before design writes. Read the live project model and installed library
contracts, then continue the [prototype workflow](workflows/prototype.md#resolve-scope-and-contracts).
Do not edit after a failed open, unexpected identity or missing edit permission.

`open_org({orgId})` opens `/orgs/:orgId`; `open_workspace({workspaceId})` opens
`/workspaces/:workspaceId` when the user requests those dashboards. They check
access and return `opened`, their resource ID and `url`. `get_app_state` reports
the dashboard's `orgId` or `workspaceId`; `ready` refers to Studio and can be
false there. All three open tools save an active editable design before leaving
it; a failed save blocks navigation. For read-only inspection, apply the
[core contract's save-side-effect rule](desktop-mcp.md#read-and-target).
