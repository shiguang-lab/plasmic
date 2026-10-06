const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Local navigation and viewport state; no design data or component props.
class DesktopWorkspace {
  constructor(userData, studioOrigin) {
    this.file = path.join(userData, "workspace.json");
    this.origin = studioOrigin;
    this.recent = [];
    try {
      this.recent = JSON.parse(fs.readFileSync(this.file, "utf8"))
        .filter((entry) => this.projectId(entry.url)).slice(0, 8);
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("Cannot read desktop workspace:", error.message);
    }
  }
  projectId(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin === this.origin
        ? parsed.pathname.match(/^\/projects\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
        : undefined;
    } catch { return undefined; }
  }
  remember(state) {
    const id = this.projectId(state.url);
    if (!id || !state.ready) return false;
    const entry = { url: state.url, name: state.editorContext?.projectName || id, editorView: state.editorContext?.editorView ?? null };
    const recent = [entry, ...this.recent.filter((item) => this.projectId(item.url) !== id)].slice(0, 8);
    if (JSON.stringify(recent) === JSON.stringify(this.recent)) return false;
    const temporary = this.file + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(recent, null, 2));
    fs.renameSync(temporary, this.file);
    this.recent = recent;
    return true;
  }
  async capture(controller) {
    const state = await controller.state();
    return this.remember(state);
  }
  async restore(win, controller) {
    const entry = this.recent[0];
    if (!entry) return;
    // A fresh Studio takes time to initialize. Stop if the user navigates away.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !win.isDestroyed() && win.webContents.getURL() === entry.url) {
      const state = await controller.state();
      if (state.ready) {
        if (entry.editorView) {
          try { await controller.editor("restoreEditorView", entry.editorView); }
          catch (error) { console.warn("Saved editor view unavailable:", error.message); }
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!win.isDestroyed() && win.webContents.getURL() === entry.url) {
      await win.loadURL(this.origin + "/");
    }
  }
}

function fileMenu({ controller, workspace, getWindow, dialog, refresh, state }) {
  const run = (action) => async () => {
    try { await action(); }
    catch (error) { dialog.showErrorBox("操作未完成", error.message); }
  };
  return { id: "desktop-file", label: "文件", submenu: [
    { label: "打开项目…", accelerator: "CmdOrCtrl+O", click: run(async () => {
      const state = await controller.state();
      if (state.ready && state.editorContext?.canEdit) await controller.dispatch("execute", { name: "save", input: {} });
      await getWindow().loadURL(workspace.origin + "/");
    }) },
    { label: "最近项目", submenu: workspace.recent.length ? workspace.recent.map((entry) => ({
      label: entry.name || workspace.projectId(entry.url),
      click: run(async () => {
        await controller.dispatch("open_design", { projectId: workspace.projectId(entry.url) });
        if (entry.editorView) await controller.dispatch("execute", { name: "restoreEditorView", input: entry.editorView });
      }),
    })) : [{ label: "暂无最近项目", enabled: false }] },
    { type: "separator" },
    { id: "desktop-save", label: "保存", enabled: !!(state?.ready && state.editorContext?.canEdit), accelerator: "CmdOrCtrl+S", click: run(async () => {
      const state = await controller.state();
      if (!state.ready || !state.editorContext?.canEdit) { refresh(); return; }
      await controller.dispatch("execute", { name: "save", input: {} });
      await workspace.capture(controller);
      refresh();
    }) },
    { id: "desktop-export", label: "导出当前画板…", enabled: !!(state?.ready && state.editorContext?.mode === "edit" && state.editorContext.frameUuid), click: run(async () => {
      const state = await controller.state();
      if (!state.ready || state.editorContext?.mode !== "edit" || !state.editorContext.frameUuid) { refresh(); return; }
      const output = await dialog.showSaveDialog(getWindow(), {
        title: "导出当前画板", defaultPath: "画板.png",
        filters: [{ name: "PNG", extensions: ["png"] }, { name: "PDF", extensions: ["pdf"] }, { name: "静态 HTML 快照", extensions: ["html"] }],
      });
      if (output.canceled || !output.filePath) return;
      const format = path.extname(output.filePath).slice(1).toLowerCase();
      if (!["png", "pdf", "html"].includes(format)) throw new Error("请选择 PNG、PDF 或 HTML 格式。");
      // The native dialog owns overwrite confirmation. The public exporter writes
      // a new sibling file; replace the destination only after a complete export.
      const temporary = path.join(path.dirname(output.filePath), `.${path.basename(output.filePath)}.${randomUUID()}.${format}`);
      try {
        await controller.dispatch("export_design", { frameUuid: state.editorContext.frameUuid, format, outputPath: temporary });
        fs.renameSync(temporary, output.filePath);
      } finally {
        fs.rmSync(temporary, { force: true });
      }
    }) },
    { type: "separator" },
    { role: "close", label: "关闭窗口" },
  ] };
}
function updateFileMenuContext(menu, state) {
  menu.getMenuItemById("desktop-save").enabled = !!(state?.ready && state.editorContext?.canEdit);
  menu.getMenuItemById("desktop-export").enabled = !!(state?.ready && state.editorContext?.mode === "edit" && state.editorContext.frameUuid);
}
module.exports = { DesktopWorkspace, fileMenu, updateFileMenuContext };
