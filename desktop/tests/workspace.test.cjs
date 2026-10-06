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
