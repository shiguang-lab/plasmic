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
        .filter((entry) => this.projectId(entry.url))
        .slice(0, 8);
    } catch (error) {
      if (error.code !== "ENOENT")
        console.warn("Cannot read desktop workspace:", error.message);
    }
  }
  projectId(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin === this.origin
        ? parsed.pathname.match(/^\/projects\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
        : undefined;
    } catch {
      return undefined;
    }
  }
  remember(state) {
    const id = this.projectId(state.url);
    if (!id || !state.ready) return false;
    const entry = {
      url: state.url,
      name: state.editorContext?.projectName || id,
      editorView: state.editorContext?.editorView ?? null,
    };
    const recent = [
      entry,
      ...this.recent.filter((item) => this.projectId(item.url) !== id),
    ].slice(0, 8);
    return this.saveRecent(recent);
  }
  saveRecent(recent) {
    if (JSON.stringify(recent) === JSON.stringify(this.recent)) return false;
    const temporary = this.file + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(recent, null, 2));
    fs.renameSync(temporary, this.file);
    this.recent = recent;
    return true;
  }
  async startupUrl(session) {
    const home = this.origin + "/";
    const entry = this.recent[0];
    if (!entry) return home;
    const id = this.projectId(entry.url);
    const url = new URL("/api/v1/projects", this.origin);
    url.searchParams.set("query", JSON.stringify("byIds"));
    url.searchParams.set("projectIds", JSON.stringify([id]));
    const options = {
      bypassCustomProtocolHandlers: true,
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    };
    try {
      const response = await session.fetch(url.toString(), options);
      if (response.ok) {
        const { projects } = await response.json();
        if (!Array.isArray(projects))
          throw new Error("Invalid project response");
        if (projects.some((project) => project.id === id)) return entry.url;
      } else if (![401, 403, 404].includes(response.status)) {
        throw new Error(
          "Project access check failed (HTTP " + response.status + ")",
        );
      }
      // Permission errors can also mean an expired login. Keep the saved route
      // for sign-in and remove it only after IAM confirms a valid session.
      const login = await session.fetch(
        this.origin + "/api/auth/session",
        options,
      );
      const status = await login.json();
      if (login.status === 401 && status.authenticated === false)
        return entry.url;
      if (!login.ok || status.authenticated !== true)
        throw new Error("Cannot confirm desktop login");
      this.saveRecent(
        this.recent.filter((item) => this.projectId(item.url) !== id),
      );
    } catch (error) {
      console.warn("Cannot check saved desktop project:", error.message);
    }
    return home;
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
    while (
      Date.now() < deadline &&
      !win.isDestroyed() &&
      win.webContents.getURL() === entry.url
    ) {
      const state = await controller.state();
      if (state.ready) {
        if (entry.editorView) {
          try {
            await controller.editor("restoreEditorView", entry.editorView);
          } catch (error) {
            console.warn("Saved editor view unavailable:", error.message);
          }
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

function fileMenu({
  controller,
  workspace,
  getWindow,
  dialog,
  refresh,
  state,
  t,
}) {
  const run = (action) => async () => {
    try {
      await action();
    } catch (error) {
      dialog.showErrorBox(t("Operation Failed"), t(error.message));
    }
  };
  return {
    id: "desktop-file",
    label: t("File"),
    submenu: [
      {
        label: t("Open Project…"),
        accelerator: "CmdOrCtrl+O",
        click: run(async () => {
          const state = await controller.state();
          if (state.ready && state.editorContext?.canEdit)
            await controller.dispatch("execute", { name: "save", input: {} });
          await getWindow().loadURL(workspace.origin + "/");
        }),
      },
      {
        label: t("Recent Projects"),
        submenu: workspace.recent.length
          ? workspace.recent.map((entry) => ({
              label: entry.name || workspace.projectId(entry.url),
              click: run(async () => {
                await controller.dispatch("open_design", {
                  projectId: workspace.projectId(entry.url),
                });
                if (entry.editorView)
                  await controller.dispatch("execute", {
                    name: "restoreEditorView",
                    input: entry.editorView,
                  });
              }),
            }))
          : [{ label: t("No Recent Projects"), enabled: false }],
      },
      { type: "separator" },
      {
        id: "desktop-save",
        label: t("Save"),
        enabled: !!(state?.ready && state.editorContext?.canEdit),
        accelerator: "CmdOrCtrl+S",
        click: run(async () => {
          const state = await controller.state();
          if (!state.ready || !state.editorContext?.canEdit) {
            refresh();
            return;
          }
          await controller.dispatch("execute", { name: "save", input: {} });
          await workspace.capture(controller);
          refresh();
        }),
      },
      {
        id: "desktop-export",
        label: t("Export Artboard…"),
        enabled: !!(
          state?.ready &&
          state.editorContext?.mode === "edit" &&
          state.editorContext.frameUuid
        ),
        click: run(async () => {
          const state = await controller.state();
          if (
            !state.ready ||
            state.editorContext?.mode !== "edit" ||
            !state.editorContext.frameUuid
          ) {
            refresh();
            return;
          }
          const output = await dialog.showSaveDialog(getWindow(), {
            title: t("Export Artboard"),
            defaultPath: "Artboard.png",
            filters: [
              { name: "PNG", extensions: ["png"] },
              { name: "PDF", extensions: ["pdf"] },
              { name: t("Static HTML Snapshot"), extensions: ["html"] },
            ],
          });
          if (output.canceled || !output.filePath) return;
          const format = path.extname(output.filePath).slice(1).toLowerCase();
          if (!["png", "pdf", "html"].includes(format))
            throw new Error(t("Choose PNG, PDF, or HTML format."));
          // The native dialog owns overwrite confirmation. The public exporter writes
          // a new sibling file; replace the destination only after a complete export.
          const temporary = path.join(
            path.dirname(output.filePath),
            `.${path.basename(output.filePath)}.${randomUUID()}.${format}`,
          );
          try {
            await controller.dispatch("export_design", {
              frameUuid: state.editorContext.frameUuid,
              format,
              outputPath: temporary,
            });
            fs.renameSync(temporary, output.filePath);
          } finally {
            fs.rmSync(temporary, { force: true });
          }
        }),
      },
      { type: "separator" },
      { role: "close", label: t("Close Window") },
    ],
  };
}
function updateFileMenuContext(menu, state) {
  menu.getMenuItemById("desktop-save").enabled = !!(
    state?.ready && state.editorContext?.canEdit
  );
  menu.getMenuItemById("desktop-export").enabled = !!(
    state?.ready &&
    state.editorContext?.mode === "edit" &&
    state.editorContext.frameUuid
  );
}
module.exports = { DesktopWorkspace, fileMenu, updateFileMenuContext };
