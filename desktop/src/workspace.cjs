const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Local navigation and viewport state; no design data or component props.
class DesktopWorkspace {
  constructor(userData, studioOrigin) {
    this.file = path.join(userData, "workspace.json");
    this.origin = studioOrigin;
    this.routeFile = path.join(userData, "workspace-route.json");
    this.lastUrl = studioOrigin + "/";
    try {
      const url = JSON.parse(fs.readFileSync(this.routeFile, "utf8"));
      if (this.isWorkspaceUrl(url)) {
        this.lastUrl = url;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("Cannot read desktop route:", error.message);
      }
    }
    this.recent = [];
    try {
      this.recent = JSON.parse(fs.readFileSync(this.file, "utf8"))
        .filter((entry) => this.projectId(entry.url))
        .slice(0, 8);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("Cannot read desktop workspace:", error.message);
      }
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
  isWorkspaceUrl(url) {
    try {
      const parsed = new URL(url);
      return (
        parsed.origin === this.origin &&
        /^\/(?:$|(?:projects|orgs|teams|workspaces|settings|playground|cms|content|copilot)(?:\/|$))/.test(
          parsed.pathname,
        )
      );
    } catch {
      return false;
    }
  }
  rememberUrl(url) {
    if (!this.isWorkspaceUrl(url) || url === this.lastUrl) {
      return false;
    }
    const temporary = this.routeFile + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(url));
    fs.renameSync(temporary, this.routeFile);
    this.lastUrl = url;
    return true;
  }
  remember(state) {
    const id = this.projectId(state.url);
    if (!id || !state.ready) {
      return false;
    }
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
    if (JSON.stringify(recent) === JSON.stringify(this.recent)) {
      return false;
    }
    const temporary = this.file + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(recent, null, 2));
    fs.renameSync(temporary, this.file);
    this.recent = recent;
    return true;
  }
  async startupUrl(session) {
    const home = this.origin + "/";
    const id = this.projectId(this.lastUrl);
    if (!id) {
      return this.lastUrl;
    }
    this.startupData = undefined;
    const url = new URL("/api/v1/editor-bootstrap/" + id, this.origin);
    const branchName =
      new URL(this.lastUrl).searchParams.get("branch") || "main";
    if (branchName) {
      url.searchParams.set("branchName", JSON.stringify(branchName));
    }
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
        const bootstrap = await response.json();
        const { projects } = bootstrap.projectData;
        if (!Array.isArray(projects)) {
          throw new Error("Invalid project response");
        }
        if (projects.some((project) => project.id === id)) {
          this.startupData = { data: bootstrap, expiresAt: Date.now() + 30000 };
          return this.lastUrl;
        }
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
      if (login.status === 401 && status.authenticated === false) {
        return this.lastUrl;
      }
      if (!login.ok || status.authenticated !== true) {
        throw new Error("Cannot confirm desktop login");
      }
      this.rememberUrl(home);
      this.saveRecent(
        this.recent.filter((item) => this.projectId(item.url) !== id),
      );
    } catch (error) {
      console.warn("Cannot check saved desktop project:", error.message);
    }
    return home;
  }
  consumeStartupData(projectId) {
    const data = this.startupData;
    this.startupData = undefined;
    return data?.data.projectId === projectId && Date.now() < data.expiresAt
      ? data.data
      : null;
  }
  async refreshRecent(session) {
    const entries = [...this.recent];
    if (!entries.length) {
      return false;
    }
    const options = {
      bypassCustomProtocolHandlers: true,
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    };
    try {
      const login = await session.fetch(
        this.origin + "/api/auth/session",
        options,
      );
      if (!login.ok || (await login.json()).authenticated !== true) {
        return false;
      }
      const unavailable = await Promise.all(
        entries.map(async (entry) => {
          const id = this.projectId(entry.url);
          const url = new URL("/api/v1/projects", this.origin);
          url.searchParams.set("query", JSON.stringify("byIds"));
          url.searchParams.set("projectIds", JSON.stringify([id]));
          try {
            const response = await session.fetch(url.toString(), options);
            if ([403, 404].includes(response.status)) {
              return id;
            }
            if (!response.ok) {
              return undefined;
            }
            const { projects } = await response.json();
            return Array.isArray(projects) &&
              !projects.some((project) => project.id === id)
              ? id
              : undefined;
          } catch {
            return undefined;
          }
        }),
      );
      return this.saveRecent(
        this.recent.filter(
          (entry) => !unavailable.includes(this.projectId(entry.url)),
        ),
      );
    } catch (error) {
      console.warn("Cannot refresh recent desktop projects:", error.message);
      return false;
    }
  }
  async capture(controller) {
    const state = await controller.state();
    return this.remember(state);
  }
  savedEditorView(url) {
    const id = this.projectId(url);
    return id
      ? (this.recent.find((entry) => this.projectId(entry.url) === id)
          ?.editorView ?? null)
      : null;
  }
}

function fileMenu({
  controller,
  workspace,
  session,
  getWindow,
  dialog,
  refresh,
  state: menuState,
  t = (x) => x,
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
        id: "desktop-open-project",
        label: t("Open Project…"),
        accelerator: "CmdOrCtrl+O",
        click: run(async () => {
          const state = await controller.state();
          if (state.ready && state.editorContext?.canEdit) {
            await controller.dispatch("execute", { name: "save", input: {} });
          }
          await getWindow().loadURL(workspace.origin + "/");
        }),
      },
      {
        label: t("Recent Projects"),
        submenu: (workspace?.recent || []).length
          ? workspace.recent.map((entry) => ({
              label: entry.name || workspace.projectId(entry.url),
              click: run(async () => {
                if (await workspace.refreshRecent(session)) {
                  refresh();
                }
                if (!workspace.recent.some((item) => item.url === entry.url)) {
                  return;
                }
                await controller.dispatch("open_design", {
                  projectId: workspace.projectId(entry.url),
                });
              }),
            }))
          : [{ label: t("No Recent Projects"), enabled: false }],
      },
      { type: "separator" },
      {
        id: "desktop-save",
        label: t("Save"),
        enabled: !!(menuState?.ready && menuState.editorContext?.canEdit),
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
          menuState?.ready &&
          menuState.editorContext?.mode === "edit" &&
          menuState.editorContext.frameUuid
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
          if (output.canceled || !output.filePath) {
            return;
          }
          const format = path.extname(output.filePath).slice(1).toLowerCase();
          if (!["png", "pdf", "html"].includes(format)) {
            throw new Error(t("Choose PNG, PDF, or HTML format."));
          }
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
      {
        id: "desktop-export-plasmic",
        label: t("Export .plasmic…"),
        enabled: !!(menuState?.ready && menuState.projectId),
        click: run(async () => {
          const state = await controller.state();
          if (!state.ready || !state.projectId) {
            refresh();
            return;
          }
          if (state.editorContext?.canEdit) {
            await controller.dispatch("execute", { name: "save", input: {} });
          }
          const options = {
            bypassCustomProtocolHandlers: true,
            credentials: "include",
            redirect: "manual",
            cache: "no-store",
            signal: AbortSignal.timeout(30000),
          };
          const res = await session.fetch(
            `${workspace.origin}/api/v1/projects/${state.projectId}`,
            options,
          );
          if (!res.ok) {
            throw new Error(t("Failed to export .plasmic file"));
          }
          const { project, rev, depPkgs } = await res.json();
          const projectName = project?.name || "project";
          const output = await dialog.showSaveDialog(getWindow(), {
            title: t("Export .plasmic"),
            defaultPath: `${projectName}.plasmic`,
            filters: [
              { name: "Plasmic Project", extensions: ["plasmic"] },
            ],
          });
          if (output.canceled || !output.filePath) {
            return;
          }
          const exportData = {
            format: "plasmic/project",
            version: 1,
            name: projectName,
            projectId: project?.id || state.projectId,
            exportedAt: new Date().toISOString(),
            bundles: [
              ...(depPkgs || []).map((info) => [
                info.id,
                typeof info.model === "string" ? JSON.parse(info.model) : info.model,
              ]),
              [
                project?.id || state.projectId,
                rev?.data
                  ? typeof rev.data === "string"
                    ? JSON.parse(rev.data)
                    : rev.data
                  : null,
              ],
            ],
          };
          fs.writeFileSync(output.filePath, JSON.stringify(exportData, null, 2), "utf-8");
        }),
      },
      {
        id: "desktop-import-plasmic",
        label: t("Import .plasmic…"),
        click: run(async () => {
          const output = await dialog.showOpenDialog(getWindow(), {
            title: t("Import .plasmic"),
            filters: [
              { name: "Plasmic Project", extensions: ["plasmic"] },
            ],
            properties: ["openFile"],
          });
          if (output.canceled || !output.filePaths?.length) {
            return;
          }
          const filePath = output.filePaths[0];
          if (path.extname(filePath).toLowerCase() !== ".plasmic") {
            throw new Error(t("Please select a valid .plasmic file."));
          }
          const content = fs.readFileSync(filePath, "utf-8");
          const options = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: content }),
            bypassCustomProtocolHandlers: true,
            credentials: "include",
            redirect: "manual",
            signal: AbortSignal.timeout(60000),
          };
          const res = await session.fetch(
            `${workspace.origin}/api/v1/projects/import`,
            options,
          );
          if (!res.ok) {
            throw new Error(t("Failed to import .plasmic file"));
          }
          const { projectId } = await res.json();
          if (projectId) {
            await controller.dispatch("open_design", { projectId });
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
  const exportPlasmic = menu.getMenuItemById("desktop-export-plasmic");
  if (exportPlasmic) {
    exportPlasmic.enabled = !!(state?.ready && state.projectId);
  }
}
module.exports = { DesktopWorkspace, fileMenu, updateFileMenuContext };
