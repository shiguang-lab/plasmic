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
  workspace.remember({ url: origin + "/projects/saved?branch=main#page", ready: true });
  return { workspace, dir, savedUrl: workspace.recent[0].url };
}
test("startup validates the exact saved project before restoring its route", async (t) => {
  const { workspace, savedUrl } = startupFixture(t);
  const session = { fetch: async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, origin);
    assert.equal(request.pathname, "/api/v1/projects");
    assert.equal(JSON.parse(request.searchParams.get("query")), "byIds");
    assert.deepEqual(JSON.parse(request.searchParams.get("projectIds")), ["saved"]);
    assert.equal(options.bypassCustomProtocolHandlers, true);
    assert.equal(options.credentials, "include");
    assert.equal(options.redirect, "manual");
    return Response.json({ projects: [{ id: "saved" }] });
  } };
  assert.equal(await workspace.startupUrl(session), savedUrl);
  assert.equal(workspace.recent.length, 2);
});
for (const status of [200, 401, 403, 404]) test(`startup removes an unavailable project after confirming login (HTTP ${status})`, async (t) => {
  const { workspace, dir } = startupFixture(t);
  const checked = [];
  const session = { fetch: async (url) => {
    const request = new URL(url);
    if (request.pathname === "/api/auth/session") return Response.json({ authenticated: true });
    const [id] = JSON.parse(request.searchParams.get("projectIds"));
    checked.push(id);
    return Response.json({ projects: id === "saved" ? [] : [{ id }] }, { status: id === "saved" ? status : 200 });
  } };
  assert.equal(await workspace.startupUrl(session), origin + "/");
  assert.deepEqual(workspace.recent.map((entry) => workspace.projectId(entry.url)), ["other"]);
  const reopened = new DesktopWorkspace(dir, origin);
  assert.equal(await reopened.startupUrl(session), origin + "/projects/other");
  assert.deepEqual(checked, ["saved", "other"], "A later launch must not retry the removed project");
});
test("expired login keeps the saved project for sign-in continuation", async (t) => {
  const { workspace, dir, savedUrl } = startupFixture(t);
  const session = { fetch: async (url) => new URL(url).pathname === "/api/auth/session"
    ? Response.json({ authenticated: false }, { status: 401 })
    : Response.json({}, { status: 401 }) };
  assert.equal(await workspace.startupUrl(session), savedUrl);
  assert.equal(new DesktopWorkspace(dir, origin).recent[0].url, savedUrl);
});
for (const failure of ["network", "server", "redirect", "malformed", "login-network", "login-server", "login-malformed"]) test(`startup preserves history and opens home when access cannot be verified (${failure})`, async (t) => {
  const { workspace, dir, savedUrl } = startupFixture(t);
  const session = { fetch: async (url) => {
    const login = new URL(url).pathname === "/api/auth/session";
    if (failure === "network" || (login && failure === "login-network")) throw new Error("Network unavailable");
    if (failure === "server" || (login && failure === "login-server")) return Response.json({}, { status: 503 });
    if (failure === "redirect") return new Response(null, { status: 302 });
    if (failure === "malformed" || (login && failure === "login-malformed")) return Response.json({});
    return Response.json({}, { status: 403 });
  } };
  assert.equal(await workspace.startupUrl(session), origin + "/");
  assert.equal(new DesktopWorkspace(dir, origin).recent[0].url, savedUrl);
});
test("startup with no saved project opens home without a request", async (t) => {
  const { workspace } = startupFixture(t);
  workspace.saveRecent([]);
  assert.equal(await workspace.startupUrl({ fetch: async () => assert.fail("No request expected") }), origin + "/");
});
test("restart restores a trusted project and viewport without persisting design props", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-workspace-"));
  try {
    const workspace = new DesktopWorkspace(dir, origin);
    assert.equal(workspace.remember({ url: "https://other.example/projects/private", ready: true }), false);
    assert.equal(workspace.remember({ url: origin + "/projects/one", ready: false }), false);
    const editorView = { arenaId: "arena", arenaType: "custom", frameUuid: "frame", scale: 0.7, scroll: { x: 20, y: 40 } };
    workspace.remember({ url: origin + "/projects/one?arena_type=mixed", ready: true, editorContext: { editorView, componentProps: { activeKey: "secret" } } });
    const restored = new DesktopWorkspace(dir, origin);
    assert.equal(restored.recent.length, 1);
    assert.equal(JSON.stringify(restored.recent).includes("activeKey"), false);
    const calls = [];
    const win = { isDestroyed: () => false, webContents: { getURL: () => restored.recent[0].url } };
    await restored.restore(win, { state: async () => ({ ready: true }), editor: async (...args) => calls.push(args) });
    assert.deepEqual(calls, [["restoreEditorView", editorView]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("native save uses the same public operation and reports failures", async () => {
  const calls = [], errors = [];
  const controller = { state: async () => ({ ready: true, editorContext: { canEdit: true } }), dispatch: async (...args) => calls.push(args) };
  const menu = fileMenu({ controller, workspace: { recent: [], capture: async () => {} }, getWindow: () => ({}), dialog: { showErrorBox: (...args) => errors.push(args) }, refresh: () => {} });
  const save = menu.submenu.find((entry) => entry.label === "Save");
  await save.click();
  assert.deepEqual(calls, [["execute", { name: "save", input: {} }]]);
  controller.dispatch = async () => { throw new Error("保存失败"); };
  await save.click();
  assert.deepEqual(errors, [["Operation Failed", "保存失败"]]);
});
test("native menu availability follows ready, preview, permission and frame context", async () => {
  const calls = [], errors = [];
  let state = { ready: true, editorContext: { canEdit: false, mode: "preview", frameUuid: "frame" } };
  const menu = fileMenu({ state, controller: { state: async () => state, dispatch: async (...args) => calls.push(args) }, workspace: { recent: [] }, dialog: { showErrorBox: (...args) => errors.push(args) }, refresh: () => {} });
  const save = menu.submenu.find(entry => entry.id === "desktop-save");
  const exp = menu.submenu.find(entry => entry.id === "desktop-export");
  assert.equal(save.enabled, false);
  assert.equal(exp.enabled, false);
  await save.click();
  await exp.click();
  assert.deepEqual(calls, []);
  assert.deepEqual(errors, []);
  const { updateFileMenuContext } = require("../src/workspace.cjs");
  const native = { getMenuItemById: id => menu.submenu.find(entry => entry.id === id) };
  state = { ready: true, editorContext: { canEdit: true } };
  updateFileMenuContext(native, state);
  assert.equal(save.enabled, true);
  assert.equal(exp.enabled, false);
  updateFileMenuContext(native, { ready: true, editorContext: { mode: "edit", canEdit: false, frameUuid: "frame" } });
  assert.equal(save.enabled, false);
  assert.equal(exp.enabled, true);
  updateFileMenuContext(native, { ready: false });
  assert.equal(save.enabled, false);
});
for (const fail of [false, true]) test(`native export ${fail ? "failure preserves" : "confirmed overwrite replaces"} an existing file`, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-export-"));
  try {
    const dest = path.join(dir, "existing.png");
    fs.writeFileSync(dest, "original");
    const errors = [];
    const state = { ready: true, editorContext: { mode: "edit", frameUuid: "frame" } };
    const controller = { state: async () => state, dispatch: async (name,input) => {
      assert.equal(name, "export_design");
      assert.equal(input.format, "png");
      assert.notEqual(input.outputPath, dest);
      assert.equal(fs.existsSync(input.outputPath), false);
      fs.writeFileSync(input.outputPath, "new export");
      if (fail) throw new Error("export failed");
    } };
    const menu = fileMenu({ state, controller, workspace: { recent: [] }, getWindow: () => ({}), dialog: { showSaveDialog: async () => ({filePath:dest,canceled:false}), showErrorBox: (...args) => errors.push(args) } });
    await menu.submenu.find(entry => entry.id === "desktop-export").click();
    assert.equal(fs.readFileSync(dest,"utf8"), fail ? "original" : "new export");
    assert.deepEqual(fs.readdirSync(dir), ["existing.png"]);
    assert.equal(errors.length, fail ? 1 : 0);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
