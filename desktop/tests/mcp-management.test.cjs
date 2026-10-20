const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? {
        ipcMain: { on() {}, removeListener() {} },
        app: { getPath: () => os.tmpdir() },
      }
    : originalLoad.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = originalLoad;

const origin = "https://studio.example";
function fixture(t, response = {}) {
  const calls = [];
  let url = origin + "/projects/current";
  const win = {
    isDestroyed: () => false,
    loadURL: async (target) => {
      calls.push({ method: "loadURL", url: target });
      url = target;
    },
    webContents: {
      getURL: () => url,
      isLoadingMainFrame: () => false,
      session: {
        fetch: async (target, options) => {
          calls.push({ method: "fetch", url: target, options });
          return { ok: true, json: async () => response };
        },
      },
    },
  };
  const controller = new DesktopController(() => win, { studioOrigin: origin });
  controller.state = async () => ({ ready: true, projectId: "current", url });
  controller.editor = async (method) => {
    calls.push({ method });
    return { canEdit: true };
  };
  controller.ready = async () => {
    throw new Error("Dashboard tools must not wait for an editor");
  };
  t.after(() => controller.close());
  return { controller, win, calls };
}

test("management tools expose strict MCP schemas and forward valid calls through stdio and RPC", async (t) => {
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "plasmic-management-"),
  );
  const forwarded = [];
  const stop = await startRpc(profile, async (method, input) => {
    forwarded.push({ method, input });
    return { method, input };
  });
  const client = new Client({ name: "management-test", version: "1.0.0" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "-e",
          `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`,
        ],
        stderr: "pipe",
      }),
    );
    const tools = (await client.listTools()).tools;
    const valid = [
      ["get_app_state", {}],
      ["get_app_state", { toolNames: [] }],
      ["get_app_state", { toolNames: ["read", "identify"] }],
      ["get_app_state", { view: "tools" }],
      ["get_app_state", { schemaView: "full", toolNames: ["executeBatch"] }],
      [
        "reference_browser",
        { action: "load_page", url: "https://example.org", width: 1440 },
      ],
      ["reference_browser", { action: "select_element", selector: "main" }],
      [
        "import_reference",
        {
          action: "editable",
          target: "selection",
          name: "ImportedSection",
        },
      ],
      ["import_reference", { action: "screenshot", target: "full_page" }],
      ["import_reference", { action: "screenshot", target: "visible_area" }],
      ["get_org", { orgId: "org" }],
      ["list_orgs", {}],
      ["list_orgs", { query: "Design" }],
      ["create_org", { name: "Design" }],
      ["open_org", { orgId: "org" }],
      [
        "create_workspace",
        { orgId: "org", name: "Apps", description: "Internal apps" },
      ],
      ["list_workspaces", {}],
      ["list_workspaces", { orgId: "org" }],
      ["list_projects", {}],
      ["list_projects", { workspaceId: "workspace" }],
      ["open_workspace", { workspaceId: "workspace" }],
      ["create_project", { name: "App", workspaceId: "workspace" }],
      ["create_project", { name: "Personal" }],
    ];
    for (const [name, input] of valid) {
      const tool = tools.find((entry) => entry.name === name);
      assert.ok(tool, name);
      assert.equal(tool.inputSchema.additionalProperties, false);
      const result = await client.callTool({ name, arguments: input });
      assert.equal(result.isError, false);
      if (name !== "reference_browser") assert.deepEqual(JSON.parse(result.content[0].text), { method: name, input });
    }
    assert.deepEqual(
      forwarded,
      valid.map(([method, input]) => ({ method, input })),
    );
    const invalid = [
      ["execute", { name: "preview", input: { action: "open" } }],
      ["execute", { name: "executeBatch", input: { operations: [] } }],
      ["execute_batch", { operations: [{ name: "preview", input: { action: "open" } }] }],
      ["get_app_state", { toolNames: "read" }],
      ["get_app_state", { toolNames: [""] }],
      ["get_app_state", { toolNames: ["read", "read"] }],
      ["get_app_state", { view: "everything" }],
      ["get_app_state", { view: "full" }],
      ["list_projects", { view: "full" }],
      ["list_projects", { view: "everything" }],
      ["reference_browser", { action: "implicit_import" }],
      ["reference_browser", { action: "open" }],
      ["reference_browser", { action: "load_page" }],
      ["reference_browser", { action: "load_page", url: "file:///tmp/reference.html" }],
      ["reference_browser", { action: "import_to_canvas" }],
      ["browser", { action: "open" }],
      ["import_reference", { action: "editable", target: "viewport" }],
      ["import_reference", { action: "editable", destination: "current" }],
      [
        "import_reference",
        {
          action: "editable",
          componentUuid: "page",
          elementUuid: "container",
        },
      ],
      ["import_reference", { action: "editable", name: "bad-name" }],
      ["get_org", {}],
      ["get_org", { orgId: "../private" }],
      ["get_org", { orgId: "org", extra: true }],
      ["list_orgs", { query: "  " }],
      ["create_org", { name: "\n\t" }],
      ["open_org", { orgId: "https://other.example/org" }],
      ["create_workspace", { name: "Apps" }],
      ["create_workspace", { orgId: "org", name: "Apps", description: 5 }],
      ["list_workspaces", { orgId: "" }],
      ["list_projects", { workspaceId: "../workspace" }],
      ["open_workspace", { workspaceId: "../workspace" }],
      ["create_project", { name: "App", isPublic: "false" }],
      ["create_project", { name: "App", workspaceId: "workspace?other" }],
    ];
    for (const [name, input] of invalid) {
      const result = await client.callTool({ name, arguments: input });
      assert.equal(result.isError, true, name);
    }
    assert.equal(forwarded.length, valid.length);
  } finally {
    await client.close();
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("management tools return only resource identities and parents", async (t) => {
  const team = { id: "design", name: "Design", members: [{ email: "private@example.com" }], defaultAccessLevel: "editor" };
  const backend = { teams: [team], perms: [{ teamId: team.id, accessLevel: "owner" }], members: team.members };
  const { controller, calls } = fixture(t, backend);
  assert.deepEqual(await controller.dispatch("list_orgs", {}), { teams: [{ id: "design", name: "Design" }] });
  assert.deepEqual(await controller.dispatch("list_orgs", { query: "DESIGN" }), { teams: [{ id: "design", name: "Design" }] });
  assert.deepEqual(await controller.dispatch("list_orgs", { query: "missing" }), { teams: [] });
  controller.requestStudio = async () => ({ team, perms: backend.perms, members: team.members });
  assert.deepEqual(await controller.dispatch("get_org", { orgId: team.id }), { team: { id: "design", name: "Design" } });
  assert.ok(calls.every((call) => call.options.credentials === "include" && call.options.redirect === "manual"));
});

test("management creation excludes permissions, settings and credentials without a full bypass", async (t) => {
  const project = { id: "project", name: "Orders", workspaceId: "workspace", teamId: "org", projectApiToken: "never-return-token",
    featureTier: { capabilities: "x".repeat(5000) }, createdAt: "audit", uiConfig: { templates: true }, readableByPublic: true, isMainBranchProtected: true };
  const raw = { projects: [project], perms: [{ projectId: "project", userId: "user", accessLevel: "editor" }] };
  const { controller, calls } = fixture(t, raw);
  await assert.rejects(controller.dispatch("create_project", { name: "Orders", view: "full" }), /view is not supported/);
  assert.equal(calls.length, 0);
  const identity = { id: "project", name: "Orders", workspaceId: "workspace", teamId: "org" };
  assert.deepEqual(await controller.dispatch("list_projects", {}), { projects: [identity] });
  controller.requestStudio = async () => ({ project, rev: { revision: 7, branchId: null } });
  assert.deepEqual(await controller.dispatch("create_project", { name: "Orders" }), { project: identity });
});

test("workspace lists use the account or organization access scope", async (t) => {
  const data = { workspaces: [{ id: "workspace" }] };
  const { controller, calls } = fixture(t, data);
  assert.deepEqual(await controller.dispatch("list_workspaces", {}), data);
  assert.deepEqual(
    await controller.dispatch("list_workspaces", { orgId: "org" }),
    data,
  );
  assert.deepEqual(
    calls.map((call) => call.url),
    [origin + "/api/v1/workspaces", origin + "/api/v1/teams/org/workspaces"],
  );
});

test("project lists use the selected workspace and preserve platform permissions", async (t) => {
  const projects = [
    { id: "project", name: "Orders", workspaceId: "chosen" },
    { id: "other", name: "Orders", workspaceId: "other-workspace" },
  ];
  const perms = projects.map((project) => ({
    projectId: project.id,
    accessLevel: "editor",
  }));
  const { controller, win, calls } = fixture(t);
  win.webContents.session.fetch = async (target, options) => {
    const url = new URL(target);
    assert.equal(url.pathname, "/api/v1/projects");
    assert.equal(options.credentials, "include");
    const scope = url.searchParams.get("workspaceId");
    assert.equal(
      JSON.parse(url.searchParams.get("query")),
      scope ? "byWorkspace" : "all",
    );
    const visible = scope
      ? projects.filter((project) => project.workspaceId === JSON.parse(scope))
      : projects;
    return {
      ok: true,
      json: async () => ({
        projects: visible,
        perms: perms.filter((perm) =>
          visible.some((project) => project.id === perm.projectId),
        ),
      }),
    };
  };
  assert.deepEqual(
    await controller.dispatch("list_projects", { workspaceId: "chosen" }),
    { projects: [projects[0]] },
  );
  assert.deepEqual(await controller.dispatch("list_projects", {}), {
    projects,
  });
  assert.deepEqual(calls, []);
  await assert.rejects(
    controller.dispatch("list_projects", { workspaceId: "../chosen" }),
    /Invalid workspaceId/,
  );
});

test("MCP can reuse or create the selected hierarchy and enter its Project before design edits", async (t) => {
  for (const scenario of ["existing", "create-children", "create-hierarchy"]) {
    const create = scenario !== "existing",
      createTeam = scenario === "create-hierarchy";
    await t.test(scenario, async (t) => {
      const { controller, win, calls } = fixture(t);
      await win.loadURL(origin + "/");
      calls.length = 0;
      const team = {
        id: createTeam ? "created-team" : "chosen-team",
        name: "Design",
      };
      const teams = createTeam ? [] : [team];
      const workspaces = [
        ...(!createTeam
          ? [{ id: "default-workspace", name: "Workspace", team }]
          : []),
        {
          id: "other-workspace",
          name: "Apps",
          team: { id: "other-team", name: "Other" },
        },
        ...(!create ? [{ id: "chosen-workspace", name: "Apps", team }] : []),
      ];
      const projects = [
        {
          id: "other-project",
          name: "Orders",
          workspaceId: "other-workspace",
          teamId: "other-team",
        },
        ...(!create
          ? [
              {
                id: "chosen-project",
                name: "Orders",
                workspaceId: "chosen-workspace",
                teamId: team.id,
              },
            ]
          : []),
      ];
      const requests = [],
        edits = [];
      let identified = false,
        modelRead = false;
      const projectId = () =>
        new URL(win.webContents.getURL()).pathname.match(
          /^\/projects\/([^/]+)/,
        )?.[1] || null;
      controller.state = async () => ({
        availableEditorTools: ["identify", "createComponent"],
        url: win.webContents.getURL(),
        projectId: projectId(),
        ready: projects.some((project) => project.id === projectId()),
        editorContext: { projectId: projectId(), mode: "edit", canEdit: true },
        editorTools: {
          identify: { inputSchema: { type: "object" } },
          createComponent: {
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { enum: ["page", "component"] },
                path: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
      });
      controller.ready = async () =>
        assert.ok(projects.some((project) => project.id === projectId()));
      controller.editor = async (name, input) => {
        if (name === "identify") {
          if (input.client === "management-workflow-test") identified = true;
          return { projectId: projectId(), canEdit: true };
        }
        assert.ok(
          identified,
          "identify the chosen Project before design operations",
        );
        if (name === "read") {
          modelRead = true;
          return {
            __type: "Resources",
            results: [{ id: projectId(), components: [] }],
          };
        }
        assert.equal(name, "createComponent");
        assert.ok(modelRead, "read the opened Project before editing");
        edits.push({ projectId: projectId(), input });
        return {
          __type: "Resources",
          results: [{ uuid: "page", name: input.name }],
        };
      };
      win.webContents.session.fetch = async (target, options) => {
        const url = new URL(target),
          body = options.body ? JSON.parse(options.body) : undefined;
        requests.push({ path: url.pathname, method: options.method, body });
        let result;
        if (url.pathname === "/api/v1/teams" && body) {
          assert.equal(body.name, team.name);
          teams.push(team);
          workspaces.push({ id: "default-workspace", name: "Workspace", team });
          result = { team };
        } else if (url.pathname === "/api/v1/teams")
          result = { teams, perms: [] };
        else if (url.pathname === "/api/v1/teams/" + team.id + "/workspaces")
          result = {
            team,
            workspaces: workspaces.filter(
              (workspace) => workspace.team.id === team.id,
            ),
            perms: [],
          };
        else if (url.pathname === "/api/v1/workspaces" && body) {
          assert.equal(body.teamId, team.id);
          const workspace = { id: "created-workspace", name: body.name, team };
          workspaces.push(workspace);
          result = { paywall: "pass", response: { workspace } };
        } else if (url.pathname === "/api/v1/projects" && body) {
          const workspace = workspaces.find(
            (workspace) => workspace.id === body.workspaceId,
          );
          assert.equal(workspace?.team.id, team.id);
          const project = {
            id: "created-project",
            name: body.name,
            workspaceId: workspace.id,
            teamId: team.id,
          };
          projects.push(project);
          result = { project, rev: { revision: 1 } };
        } else if (url.pathname === "/api/v1/projects") {
          assert.equal(
            JSON.parse(url.searchParams.get("query")),
            "byWorkspace",
          );
          const scope = JSON.parse(url.searchParams.get("workspaceId"));
          result = {
            projects: projects.filter(
              (project) => project.workspaceId === scope,
            ),
            perms: [],
          };
        } else throw new Error("Unexpected platform request: " + target);
        return { ok: true, json: async () => result };
      };
      const profile = await fs.mkdtemp(
        path.join(os.tmpdir(), "plasmic-hierarchy-"),
      );
      const stop = await startRpc(profile, (method, input) =>
        controller.dispatch(method, input),
      );
      const client = new Client({ name: "hierarchy-test", version: "1.0.0" });
      try {
        await client.connect(
          new StdioClientTransport({
            command: process.execPath,
            args: [
              "-e",
              `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`,
            ],
            stderr: "pipe",
          }),
        );
        async function call(name, input = {}) {
          const result = await client.callTool({ name, arguments: input });
          assert.equal(result.isError, false, result.content?.[0]?.text);
          return JSON.parse(result.content[0].text);
        }
        assert.equal((await call("get_app_state")).ready, false);
        let chosenTeam = (
          await call("list_orgs", { query: "Design" })
        ).teams.find((entry) => entry.name === "Design");
        if (!chosenTeam)
          chosenTeam = (await call("create_org", { name: "Design" })).team;
        const workspaceList = await call("list_workspaces", {
          orgId: chosenTeam.id,
        });
        assert.ok(
          workspaceList.workspaces.every(
            (entry) => entry.team.id === chosenTeam.id,
          ),
        );
        let workspace = workspaceList.workspaces.find(
          (entry) => entry.name === "Apps",
        );
        if (!workspace)
          workspace = (
            await call("create_workspace", {
              orgId: chosenTeam.id,
              name: "Apps",
            })
          ).workspace;
        assert.equal(workspace.team.id, chosenTeam.id);
        assert.ok(
          (
            await call("list_workspaces", { orgId: chosenTeam.id })
          ).workspaces.some((entry) => entry.id === workspace.id),
        );
        const projectList = await call("list_projects", {
          workspaceId: workspace.id,
        });
        assert.ok(
          projectList.projects.every(
            (entry) => entry.workspaceId === workspace.id,
          ),
        );
        let project = projectList.projects.find(
          (entry) => entry.name === "Orders",
        );
        if (!project)
          project = (
            await call("create_project", {
              name: "Orders",
              workspaceId: workspace.id,
            })
          ).project;
        assert.equal(project.workspaceId, workspace.id);
        assert.equal(project.teamId, chosenTeam.id);
        assert.ok(
          (
            await call("list_projects", { workspaceId: workspace.id })
          ).projects.some((entry) => entry.id === project.id),
        );
        const opened = await call("open_design", { projectId: project.id });
        assert.equal(opened.opened, true);
        assert.equal(opened.projectId, project.id);
        const state = await call("get_app_state", { toolNames: ["createComponent"] });
        assert.equal(state.ready, true);
        assert.equal(state.projectId, project.id);
        assert.ok(state.editorTools.createComponent.inputSchema);
        const identity = await call("execute", {
          name: "identify",
          input: {
            model: "test",
            client: "management-workflow-test",
            skill: "plasmic",
          },
        });
        assert.equal(identity.projectId, project.id);
        assert.equal(identity.canEdit, true);
        await call("execute", { name: "read", input: {} });
        await call("execute", {
          name: "createComponent",
          input: { name: "Orders", type: "page", path: "/orders" },
        });
        assert.equal(edits.length, 1);
        assert.equal(edits[0].projectId, project.id);
        assert.deepEqual(
          calls
            .filter((entry) => entry.method === "loadURL")
            .map((entry) => entry.url),
          [origin + "/projects/" + project.id],
        );
        assert.deepEqual(
          requests
            .filter((entry) => entry.method === "POST")
            .map((entry) => entry.path),
          createTeam
            ? ["/api/v1/teams", "/api/v1/workspaces", "/api/v1/projects"]
            : create
              ? ["/api/v1/workspaces", "/api/v1/projects"]
              : [],
        );
      } finally {
        await client.close();
        await stop();
        await fs.rm(profile, { recursive: true, force: true });
      }
    });
  }
});

test("creation uses authenticated platform requests without leaving or saving the active project", async (t) => {
  const { controller, win, calls } = fixture(t);
  win.webContents.session.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/teams"))
      return { ok: true, json: async () => ({ team: { id: "org" } }) };
    if (url.endsWith("/workspaces"))
      return {
        ok: true,
        json: async () => ({
          paywall: "pass",
          response: { workspace: { id: "workspace" } },
        }),
      };
    return {
      ok: true,
      json: async () => ({ project: { id: "project" }, rev: { revision: 1 } }),
    };
  };
  assert.deepEqual(
    await controller.dispatch("create_org", { name: " Design " }),
    { team: { id: "org" } },
  );
  assert.deepEqual(
    await controller.dispatch("create_workspace", {
      orgId: "org",
      name: " Apps ",
      description: "Internal apps",
    }),
    { workspace: { id: "workspace" } },
  );
  assert.deepEqual(
    await controller.dispatch("create_project", {
      name: " App ",
      workspaceId: "workspace",
    }),
    { project: { id: "project" } },
  );
  await controller.dispatch("create_project", { name: "Personal" });
  assert.deepEqual(
    calls.map((call) => JSON.parse(call.options.body)),
    [
      { name: "Design" },
      { teamId: "org", name: "Apps", description: "Internal apps" },
      { name: "App", workspaceId: "workspace" },
      { name: "Personal" },
    ],
  );
  for (const call of calls) {
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.credentials, "include");
    assert.equal(call.options.bypassCustomProtocolHandlers, true);
    assert.equal(call.options.headers.Origin, origin);
    assert.equal(call.options.headers["Content-Type"], "application/json");
  }
});

test("workspace plan restrictions return errors even on HTTP 200", async (t) => {
  for (const paywall of ["upsell", "requireTeam"]) {
    const { controller } = fixture(t, {
      paywall,
      description: "moreWorkspaces",
    });
    await assert.rejects(
      controller.dispatch("create_workspace", { orgId: "org", name: "Apps" }),
      new RegExp("plan restriction.*" + paywall + ".*moreWorkspaces"),
    );
  }
});

test("opening dashboards checks access, saves editable designs, and verifies the resulting URL", async (t) => {
  for (const [method, key, id, route, api] of [
    ["open_org", "orgId", "org", "/orgs/org", "/api/v1/teams/org/workspaces"],
    [
      "open_workspace",
      "workspaceId",
      "workspace",
      "/workspaces/workspace",
      "/api/v1/workspaces/workspace",
    ],
  ]) {
    const { controller, calls } = fixture(t);
    assert.deepEqual(await controller.dispatch(method, { [key]: id }), {
      opened: true,
      [key]: id,
      url: origin + route,
    });
    assert.deepEqual(
      calls.map((call) => call.method),
      ["fetch", "identify", "save", "loadURL"],
    );
    assert.equal(calls[0].url, origin + api);
    assert.equal(calls.at(-1).url, origin + route);
    calls.length = 0;
    await controller.dispatch(method, { [key]: id });
    assert.deepEqual(
      calls.map((call) => call.method),
      ["fetch"],
    );
  }
});

test("dashboards and read-only designs navigate without saving", async (t) => {
  for (const ready of [false, true]) {
    const { controller, calls } = fixture(t);
    controller.state = async () => ({ ready, url: origin + "/" });
    controller.editor = async (method) => {
      calls.push({ method });
      return { canEdit: false };
    };
    await controller.dispatch("open_workspace", { workspaceId: "workspace" });
    assert.deepEqual(
      calls.map((call) => call.method),
      ready ? ["fetch", "identify", "loadURL"] : ["fetch", "loadURL"],
    );
  }
});

test("failed saves and redirects cannot report a successfully opened dashboard", async (t) => {
  const first = fixture(t);
  first.controller.editor = async (method) => {
    if (method === "save") throw new Error("Save failed");
    return { canEdit: true };
  };
  await assert.rejects(
    first.controller.dispatch("open_org", { orgId: "org" }),
    /Save failed/,
  );
  assert.ok(first.calls.every((call) => call.method !== "loadURL"));
  const second = fixture(t);
  second.win.loadURL = async () => {};
  await assert.rejects(
    second.controller.dispatch("open_workspace", { workspaceId: "workspace" }),
    /page did not open/,
  );
});

test("login, permission, missing-resource and redirect failures cannot save or navigate", async (t) => {
  for (const [status, message] of [
    [401, /sign in/],
    [403, /access denied/],
    [404, /HTTP 404/],
    [302, /sign in/],
  ]) {
    const { controller, win, calls } = fixture(t);
    win.webContents.session.fetch = async () => ({ ok: false, status });
    await assert.rejects(
      controller.dispatch("open_org", { orgId: "org" }),
      message,
    );
    assert.deepEqual(calls, []);
  }
});

test("invalid resource IDs and creation inputs never reach the NAS", async (t) => {
  const { controller, calls } = fixture(t);
  for (const [method, input] of [
    ["get_org", { orgId: "../org" }],
    ["open_org", { orgId: "org?query" }],
    ["list_workspaces", { orgId: "" }],
    ["open_workspace", { workspaceId: "/workspace" }],
    ["create_org", { name: " " }],
    ["create_workspace", { orgId: "org", name: "Apps", description: 3 }],
    ["create_project", { name: "App", workspaceId: "../workspace" }],
    ["create_project", { name: 5 }],
  ]) {
    await assert.rejects(controller.dispatch(method, input));
  }
  assert.deepEqual(calls, []);
});

test("opening dashboards waits for desktop startup", async (t) => {
  const { controller, calls } = fixture(t);
  let resolve;
  let entered;
  const started = new Promise((done) => { entered = done; });
  controller.waitForStartup = () =>
    new Promise((done) => {
      resolve = done;
      entered();
    });
  const opening = controller.dispatch("open_org", { orgId: "org" });
  await started;
  assert.deepEqual(calls, []);
  resolve();
  await opening;
  assert.equal(calls.at(-1).url, origin + "/orgs/org");
});

test("app state identifies organization and workspace dashboards without editor readiness", async (t) => {
  t.mock.method(Module, "_load", function (name, ...args) {
    return name === "../renderer/desktop-assets.json"
      ? { build: "management-test" }
      : originalLoad.call(this, name, ...args);
  });
  const { controller, win } = fixture(t);
  controller.state = DesktopController.prototype.state;
  controller.invoke = async () => ({ ready: false, tools: {} });
  for (const [route, expected] of [
    ["/orgs/org", { orgId: "org", workspaceId: null, projectId: null }],
    [
      "/workspaces/workspace",
      { orgId: null, workspaceId: "workspace", projectId: null },
    ],
    [
      "/projects/project",
      { orgId: null, workspaceId: null, projectId: "project" },
    ],
  ]) {
    await win.loadURL(origin + route);
    const state = await controller.dispatch("get_app_state", {});
    for (const [key, value] of Object.entries(expected))
      assert.equal(state[key], value);
    assert.equal(state.ready, false);
  }
});
