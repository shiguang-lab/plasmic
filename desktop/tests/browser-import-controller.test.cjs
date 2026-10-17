const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const original = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { ipcMain: { on() {}, removeListener() {} } }
    : original.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = original;

test("browser imports retain their source arena and locate the exact mixed-canvas artboard", async () => {
  const controller = new DesktopController(() => ({ show() {} }), {});
  controller.ready = async () => {};
  const calls = [];
  controller.editor = async (name, input) => {
    calls.push({ name, input });
    return name === "getEditorContext"
      ? {
          projectId: "project",
          canEdit: true,
          mode: "edit",
          browserImportCanvasName: "Workspace",
          editorView: { arenaId: "page", arenaType: "page" },
        }
      : {};
  };
  assert.deepEqual(await controller.browserImportContext(), {
    projectId: "project",
    destinationName: "Workspace",
    sourceArena: { id: "page", type: "page" },
  });
  await controller.locateBrowserImport({
    projectId: "project",
    canvasName: "Workspace",
    frameUuid: "frame",
    componentUuid: "scratch",
    elementUuids: ["section"],
  });
  assert.deepEqual(calls.slice(-2), [
    {
      name: "navigateCanvas",
      input: { canvasName: "Workspace", frameUuid: "frame" },
    },
    {
      name: "selectElement",
      input: {
        componentUuid: "scratch",
        elementUuid: "section",
        frameUuid: "frame",
      },
    },
  ]);
  controller.editor = async () => ({ canEdit: false, mode: "edit" });
  await assert.rejects(controller.browserImportContext(), /editable/);
  controller.close();
});
test("the import undo action cannot undo later user edits or a different project", async () => {
  const controller = new DesktopController(() => ({}), {});
  let context = { projectId: "project", changeCounter: 4 };
  let undos = 0;
  controller.editor = async (name) =>
    name === "getEditorContext" ? context : (undos++, { undone: true });
  const receipt = { projectId: "project", changeCounter: 4 };
  assert.deepEqual(await controller.undoBrowserImport(receipt), {
    undone: true,
  });
  context = { projectId: "project", changeCounter: 5 };
  await assert.rejects(controller.undoBrowserImport(receipt), /design changed/);
  context = { projectId: "other", changeCounter: 4 };
  await assert.rejects(controller.undoBrowserImport(receipt), /design changed/);
  assert.equal(undos, 1);
  controller.close();
});
