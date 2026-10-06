const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DesktopWorkspace, fileMenu } = require("../src/workspace.cjs");
const origin = "https://studio.example";
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
  const save = menu.submenu.find((entry) => entry.label === "保存");
  await save.click();
  assert.deepEqual(calls, [["execute", { name: "save", input: {} }]]);
  controller.dispatch = async () => { throw new Error("保存失败"); };
  await save.click();
  assert.deepEqual(errors, [["操作未完成", "保存失败"]]);
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
