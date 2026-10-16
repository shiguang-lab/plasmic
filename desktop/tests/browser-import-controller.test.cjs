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

test("browser imports pin the project, create a page from the overview and only append to an explicit destination", async () => {
  const controller = new DesktopController(() => ({}), {});
  controller.ready = async () => {};
  controller.editor = async () => ({
    projectId: "project",
    componentUuid: "current",
    mode: "edit",
    canEdit: true,
  });
  assert.deepEqual(await controller.browserImportContext({}), {
    projectId: "project",
  });
  assert.deepEqual(
    await controller.browserImportContext({
      componentUuid: "explicit",
      elementUuid: "container",
    }),
    {
      projectId: "project",
      componentUuid: "explicit",
      elementUuid: "container",
    },
  );
  await assert.rejects(
    controller.browserImportContext({ elementUuid: "orphan" }),
    /component target/,
  );
  controller.editor = async () => ({
    projectId: "project",
    componentUuid: null,
    canEdit: true,
    mode: "edit",
  });
  assert.deepEqual(await controller.browserImportContext({}), {
    projectId: "project",
  });
  controller.editor = async () => ({ canEdit: false, mode: "edit" });
  await assert.rejects(controller.browserImportContext({}), /editable/);
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
