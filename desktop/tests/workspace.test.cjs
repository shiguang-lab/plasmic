const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DesktopWorkspace, fileMenu } = require("../src/workspace.cjs");
const origin = "https://studio.example";
function startupFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-startup-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const workspace = new DesktopWorkspace(dir, origin);
  workspace.remember({ url: origin + "/projects/other", ready: true });
  workspace.remember({
    url: origin + "/projects/saved?branch=main#page",
    ready: true,
  });
  workspace.rememberUrl(workspace.recent[0].url);
  return { workspace, dir, savedUrl: workspace.recent[0].url };
}
test("startup validates the exact saved project before restoring its route", async (t) => {
  const { workspace, savedUrl } = startupFixture(t);
  const session = {
    fetch: async (url, options) => {
      const request = new URL(url);
      assert.equal(request.origin, origin);
      assert.equal(request.pathname, "/api/v1/editor-bootstrap/saved");
      assert.equal(JSON.parse(request.searchParams.get("branchName")), "main");
      assert.equal(options.bypassCustomProtocolHandlers, true);
      assert.equal(options.credentials, "include");
      assert.equal(options.redirect, "manual");
      return Response.json({ projectId: "saved", projectData: { projects: [{ id: "saved" }], perms: [] } });
    },
  };
  assert.equal(await workspace.startupUrl(session), savedUrl);
  assert.equal(workspace.recent.length, 2);
  assert.equal(workspace.consumeStartupData("saved").projectId, "saved");
  assert.equal(workspace.consumeStartupData("saved"), null);
});
for (const status of [200, 401, 403, 404]) {
  test(`startup removes an unavailable project after confirming login (HTTP ${status})`, async (t) => {
    const { workspace, dir } = startupFixture(t);
    const checked = [];
    const session = {
      fetch: async (url) => {
        const request = new URL(url);
        if (request.pathname === "/api/auth/session") {
          return Response.json({ authenticated: true });
        }
        const id = request.pathname.split("/").at(-1);
        checked.push(id);
        return Response.json(
          { projectData: { projects: id === "saved" ? [] : [{ id }], perms: [] } },
          { status: id === "saved" ? status : 200 },
        );
      },
    };
    assert.equal(await workspace.startupUrl(session), origin + "/");
    assert.deepEqual(
      workspace.recent.map((entry) => workspace.projectId(entry.url)),
      ["other"],
    );
    const reopened = new DesktopWorkspace(dir, origin);
    assert.equal(await reopened.startupUrl(session), origin + "/");
    assert.deepEqual(
      checked,
      ["saved"],
      "A later launch must not retry the removed project",
    );
  });
}
test("expired login keeps the saved project for sign-in continuation", async (t) => {
  const { workspace, dir, savedUrl } = startupFixture(t);
  const session = {
    fetch: async (url) =>
      new URL(url).pathname === "/api/auth/session"
        ? Response.json({ authenticated: false }, { status: 401 })
        : Response.json({}, { status: 401 }),
  };
  assert.equal(await workspace.startupUrl(session), savedUrl);
  assert.equal(new DesktopWorkspace(dir, origin).recent[0].url, savedUrl);
});
for (const failure of [
  "network",
  "server",
  "redirect",
  "malformed",
  "login-network",
  "login-server",
  "login-malformed",
]) {
  test(`startup preserves history and opens home when access cannot be verified (${failure})`, async (t) => {
    const { workspace, dir, savedUrl } = startupFixture(t);
    const session = {
      fetch: async (url) => {
        const login = new URL(url).pathname === "/api/auth/session";
        if (failure === "network" || (login && failure === "login-network")) {
          throw new Error("Network unavailable");
        }
        if (failure === "server" || (login && failure === "login-server")) {
          return Response.json({}, { status: 503 });
        }
        if (failure === "redirect") {
          return new Response(null, { status: 302 });
        }
        if (
          failure === "malformed" ||
          (login && failure === "login-malformed")
        ) {
          return Response.json({});
        }
        return Response.json({}, { status: 403 });
      },
    };
    assert.equal(await workspace.startupUrl(session), origin + "/");
    assert.equal(new DesktopWorkspace(dir, origin).recent[0].url, savedUrl);
  });
}
test("startup with no saved project opens home without a request", async (t) => {
  const { workspace } = startupFixture(t);
  workspace.saveRecent([]);
  workspace.rememberUrl(origin + "/");
  assert.equal(
    await workspace.startupUrl({
      fetch: async () => assert.fail("No request expected"),
    }),
    origin + "/",
  );
});
test("restart restores a trusted project and viewport without persisting design props", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-workspace-"));
  try {
    const workspace = new DesktopWorkspace(dir, origin);
    assert.equal(
      workspace.remember({
        url: "https://other.example/projects/private",
        ready: true,
      }),
      false,
    );
    assert.equal(
      workspace.remember({ url: origin + "/projects/one", ready: false }),
      false,
    );
    const editorView = {
      arenaId: "arena",
      arenaType: "custom",
      frameUuid: "frame",
      scale: 0.7,
      scroll: { x: 20, y: 40 },
    };
    workspace.remember({
      url: origin + "/projects/one?arena_type=mixed",
      ready: true,
      editorContext: { editorView, componentProps: { activeKey: "secret" } },
    });
    const restored = new DesktopWorkspace(dir, origin);
    assert.equal(restored.recent.length, 1);
    assert.equal(JSON.stringify(restored.recent).includes("activeKey"), false);
    assert.deepEqual(restored.savedEditorView(restored.recent[0].url), editorView);
    assert.equal(restored.savedEditorView("https://other.example/projects/one"), null);
    assert.equal(restored.savedEditorView(origin + "/projects/missing"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("native save uses the same public operation and reports failures", async () => {
  const calls = [],
    errors = [];
  const controller = {
    state: async () => ({ ready: true, editorContext: { canEdit: true } }),
    dispatch: async (...args) => calls.push(args),
  };
  const menu = fileMenu({
    t: (key) => key,
    controller,
    workspace: { recent: [], capture: async () => {} },
    getWindow: () => ({}),
    dialog: { showErrorBox: (...args) => errors.push(args) },
    refresh: () => {},
  });
  const save = menu.submenu.find((entry) => entry.label === "Save");
  await save.click();
  assert.deepEqual(calls, [["execute", { name: "save", input: {} }]]);
  controller.dispatch = async () => {
    throw new Error("保存失败");
  };
  await save.click();
  assert.deepEqual(errors, [["Operation Failed", "Please try again"]]);
});
test("native menu availability follows ready, preview, permission and frame context", async () => {
  const calls = [],
    errors = [];
  let state = {
    ready: true,
    editorContext: { canEdit: false, mode: "preview", frameUuid: "frame" },
  };
  const menu = fileMenu({
    t: (key) => key,
    state,
    controller: {
      state: async () => state,
      dispatch: async (...args) => calls.push(args),
    },
    workspace: { recent: [] },
    dialog: { showErrorBox: (...args) => errors.push(args) },
    refresh: () => {},
  });
  const save = menu.submenu.find((entry) => entry.id === "desktop-save");
  const exp = menu.submenu.find((entry) => entry.id === "desktop-export");
  const expPlasmic = menu.submenu.find((entry) => entry.id === "desktop-export-plasmic");
  const impPlasmic = menu.submenu.find((entry) => entry.id === "desktop-import-plasmic");
  assert.equal(save.enabled, false);
  assert.equal(exp.enabled, false);
  assert.equal(expPlasmic.enabled, false);
  assert.ok(impPlasmic);
  await save.click();
  await exp.click();
  assert.deepEqual(calls, []);
  assert.deepEqual(errors, []);
  const { updateFileMenuContext } = require("../src/workspace.cjs");
  const native = {
    getMenuItemById: (id) => menu.submenu.find((entry) => entry.id === id),
  };
  state = { ready: true, editorContext: { canEdit: true }, projectId: "proj-1" };
  updateFileMenuContext(native, state);
  assert.equal(save.enabled, true);
  assert.equal(exp.enabled, false);
  assert.equal(expPlasmic.enabled, true);
  updateFileMenuContext(native, {
    ready: true,
    editorContext: { mode: "edit", canEdit: false, frameUuid: "frame" },
  });
  assert.equal(save.enabled, false);
  assert.equal(exp.enabled, true);
  assert.equal(expPlasmic.enabled, false);
  updateFileMenuContext(native, { ready: false });
  assert.equal(save.enabled, false);
  assert.equal(expPlasmic.enabled, false);
});
for (const fail of [false, true]) {
  test(`native export ${fail ? "failure preserves" : "confirmed overwrite replaces"} an existing file`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-export-"));
    try {
      const dest = path.join(dir, "existing.png");
      fs.writeFileSync(dest, "original");
      const errors = [];
      const state = {
        ready: true,
        editorContext: { mode: "edit", frameUuid: "frame" },
      };
      const controller = {
        state: async () => state,
        dispatch: async (name, input) => {
          assert.equal(name, "export_design");
          assert.equal(input.format, "png");
          assert.notEqual(input.outputPath, dest);
          assert.equal(fs.existsSync(input.outputPath), false);
          fs.writeFileSync(input.outputPath, "new export");
          if (fail) {
            throw new Error("export failed");
          }
        },
      };
      const menu = fileMenu({
        t: (key) => key,
        state,
        controller,
        workspace: { recent: [] },
        getWindow: () => ({}),
        dialog: {
          showSaveDialog: async () => ({ filePath: dest, canceled: false }),
          showErrorBox: (...args) => errors.push(args),
        },
      });
      await menu.submenu.find((entry) => entry.id === "desktop-export").click();
      assert.equal(
        fs.readFileSync(dest, "utf8"),
        fail ? "original" : "new export",
      );
      assert.deepEqual(fs.readdirSync(dir), ["existing.png"]);
      assert.equal(errors.length, fail ? 1 : 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("native export .plasmic writes formatted json and saves first", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-plasmic-"));
  try {
    const dest = path.join(dir, "MyProject.plasmic");
    const errors = [];
    const calls = [];
    const state = {
      ready: true,
      projectId: "proj-abc",
      editorContext: { canEdit: true },
    };
    const controller = {
      state: async () => state,
      dispatch: async (name, input) => calls.push([name, input]),
    };
    const menu = fileMenu({
      controller,
      workspace: { origin: "https://studio.test", recent: [] },
      session: {
        fetch: async (url) => {
          assert.equal(url, "https://studio.test/api/v1/projects/proj-abc");
          return {
            ok: true,
            json: async () => ({
              project: { id: "proj-abc", name: "My Project" },
              rev: { data: JSON.stringify({ root: "r1", map: {} }) },
              depPkgs: [],
            }),
          };
        },
      },
      getWindow: () => ({}),
      dialog: {
        showSaveDialog: async () => ({ filePath: dest, canceled: false }),
        showErrorBox: (...args) => errors.push(args),
      },
    });
    await menu.submenu.find((entry) => entry.id === "desktop-export-plasmic").click();
    assert.deepEqual(calls, [["execute", { name: "save", input: {} }]]);
    assert.equal(errors.length, 0);
    const written = JSON.parse(fs.readFileSync(dest, "utf8"));
    assert.equal(written.format, "plasmic/project");
    assert.equal(written.name, "My Project");
    assert.equal(written.projectId, "proj-abc");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("native import .plasmic calls import api and opens design", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-plasmic-import-"));
  try {
    const filePath = path.join(dir, "Test.plasmic");
    fs.writeFileSync(
      filePath,
      JSON.stringify({ format: "plasmic/project", bundles: [] }),
    );
    const errors = [];
    const calls = [];
    const state = { ready: true };
    const controller = {
      state: async () => state,
      dispatch: async (name, input) => calls.push([name, input]),
    };
    const menu = fileMenu({
      controller,
      workspace: { origin: "https://studio.test", recent: [] },
      session: {
        fetch: async (url, opts) => {
          assert.equal(url, "https://studio.test/api/v1/projects/import");
          assert.equal(opts.method, "POST");
          return {
            ok: true,
            json: async () => ({ projectId: "imported-proj-xyz" }),
          };
        },
      },
      getWindow: () => ({}),
      dialog: {
        showOpenDialog: async (_window, options) => {
          assert.deepEqual(options.filters, [{ name: "Plasmic Project", extensions: ["plasmic"] }]);
          return { filePaths: [filePath], canceled: false };
        },
        showErrorBox: (...args) => errors.push(args),
      },
    });
    await menu.submenu.find((entry) => entry.id === "desktop-import-plasmic").click();
    assert.equal(errors.length, 0);
    assert.deepEqual(calls, [
      ["open_design", { projectId: "imported-proj-xyz" }],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("startup resumes dashboard routes independently of recent projects", async (t) => {
  const { workspace, dir } = startupFixture(t);
  for (const route of [
    "/projects",
    "/settings",
    "/workspaces/team-workspace",
    "/orgs/org",
  ]) {
    const url = origin + route;
    workspace.rememberUrl(url);
    const reopened = new DesktopWorkspace(dir, origin);
    assert.equal(
      await reopened.startupUrl({
        fetch: async () =>
          assert.fail("Dashboard must not check a recent project"),
      }),
      url,
    );
    assert.equal(reopened.recent.length, 2);
  }
  for (const url of [
    origin + "/desktop/unified-login",
    origin + "/login",
    "https://other.example/projects/secret",
  ]) {
    assert.equal(workspace.rememberUrl(url), false);
  }
  assert.equal(new DesktopWorkspace(dir, origin).lastUrl, origin + "/orgs/org");
});

test("initial viewport lookup uses the requested project, not the most recent project", (t) => {
  const { workspace } = startupFixture(t);
  const view = { scale: 0.5 };
  workspace.recent[1].editorView = view;
  assert.deepEqual(workspace.savedEditorView(origin + "/projects/other?arena=new"), view);
  assert.equal(workspace.savedEditorView(origin + "/settings"), null);
});

test("recent-project checkpoints do not overwrite the current Dashboard route", async (t) => {
  const { workspace, savedUrl } = startupFixture(t);
  workspace.rememberUrl(origin + "/settings");
  workspace.remember({ url: savedUrl, ready: true });
  assert.equal(
    await workspace.startupUrl({
      fetch: async () => assert.fail("Must resume settings"),
    }),
    origin + "/settings",
  );
});

test("recent projects discard only confirmed unavailable entries and persist across sessions", async (t) => {
  const { workspace, dir } = startupFixture(t);
  workspace.remember({ url: origin + "/projects/offline", ready: true });
  const session = {
    fetch: async (url) => {
      const request = new URL(url);
      if (request.pathname === "/api/auth/session")
        {return Response.json({ authenticated: true });}
      const [id] = JSON.parse(request.searchParams.get("projectIds"));
      if (id === "saved") {return Response.json({}, { status: 404 });}
      if (id === "offline") {throw new Error("offline");}
      return Response.json({ projects: [{ id }] });
    },
  };
  assert.equal(await workspace.refreshRecent(session), true);
  assert.deepEqual(
    new DesktopWorkspace(dir, origin).recent.map((x) =>
      workspace.projectId(x.url),
    ),
    ["offline", "other"],
  );
  assert.equal(await workspace.refreshRecent(session), false);
});
for (const status of [401, 503]) {
  test(`recent projects retain history when session cannot be confirmed (${status})`, async (t) => {
    const { workspace, dir } = startupFixture(t);
    const before = JSON.stringify(workspace.recent);
    assert.equal(
      await workspace.refreshRecent({
        fetch: async () => Response.json({ authenticated: false }, { status }),
      }),
      false,
    );
    assert.equal(
      JSON.stringify(new DesktopWorkspace(dir, origin).recent),
      before,
    );
  });
}
test("a stale recent menu item never opens a deleted project", async (t) => {
  const { workspace } = startupFixture(t);
  const menu = fileMenu({
    workspace,
    session: {
      fetch: async (url) =>
        new URL(url).pathname === "/api/auth/session"
          ? Response.json({ authenticated: true })
          : Response.json({ projects: [] }),
    },
    controller: {
      dispatch: async () => assert.fail("Unavailable project must not open"),
    },
    refresh: () => {},
    t: (x) => x,
    dialog: { showErrorBox: () => assert.fail("Expected stale item removal") },
  });
  await menu.submenu
    .find((x) => x.label === "Recent Projects")
    .submenu[0].click();
  assert.equal(workspace.recent.length, 0);
});

test("startup data expires and is scoped to the restored project", async (t) => {
  const { workspace } = startupFixture(t);
  const session = { fetch: async () => Response.json({ projectId: "saved", projectData: { projects: [{ id: "saved" }], perms: [] } }) };
  await workspace.startupUrl(session);
  assert.equal(workspace.consumeStartupData("other"), null);
  await workspace.startupUrl(session);
  const originalNow = Date.now;
  Date.now = () => originalNow() + 31000;
  try { assert.equal(workspace.consumeStartupData("saved"), null); }
  finally { Date.now = originalNow; }
});
