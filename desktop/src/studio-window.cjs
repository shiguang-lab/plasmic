const { app, WebContentsView } = require("electron");
const { EventEmitter } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");

// Keep the lightweight browser warm; only project renderers are disposable.
class StudioWindow extends EventEmitter {
  constructor(window, { webPreferences, projectId, beforeNavigate, backgroundColor, studioOrigin }) {
    super();
    this.window = window;
    this.webPreferences = webPreferences;
    this.projectId = projectId;
    this.origin = studioOrigin;
    this.beforeNavigate = beforeNavigate;
    this.backgroundColor = backgroundColor;
    this.navigation = Promise.resolve();
    this.retiredEditorPids = new Set();
    this.dashboard = this.createContents("dashboard");
    this.view = this.dashboard;
    window.contentView.addChildView(this.view, 0);
    this.resize = () => {
      const [width, height] = window.getContentSize();
      for (const view of [this.dashboard, this.editor]) view?.setBounds({ x: 0, y: 0, width, height });
    };
    this.resize();
    window.on("resize", this.resize);
    window.once("closed", () => {
      window.removeListener("resize", this.resize);
      this.view = undefined;
      this.release(this.editor);
      this.release(this.dashboard);
    });
  }
  get webContents() { return this.view?.webContents; }
  owns(contents) { return [this.dashboard, this.editor].some(view => view?.webContents === contents); }
  createContents(kind) {
    const view = new WebContentsView({ webPreferences: { ...this.webPreferences, backgroundThrottling: kind === "dashboard" } });
    view.setBackgroundColor(this.backgroundColor);
    const [width, height] = this.window.getContentSize();
    view.setBounds({ x: 0, y: 0, width, height });
    const contents = view.webContents;
    contents.on("page-title-updated", (_event, title) => {
      if (this.view === view && !this.window.isDestroyed()) this.window.setTitle(title);
    });
    const navigate = (event, url) => {
      if (new URL(url).origin === this.origin && this.projectId(contents.getURL()) !== this.projectId(url)) {
        event.preventDefault();
        if (contents !== this.webContents) return;
        void this.loadURL(url).catch(error => this.emit("navigation-error", error));
      }
    };
    contents.on("will-navigate", navigate);
    contents.on("will-redirect", navigate);
    this.emit("contents-created", contents);
    return view;
  }
  activate(view, url) {
    const previous = this.view;
    if (previous !== view) {
      if (previous) {
        this.emit("contents-deactivated", previous.webContents);
        previous.webContents.send("desktop:view-state", { active: false });
        previous.setVisible(false);
        this.window.contentView.removeChildView(previous);
      }
      this.view = view;
      view.setVisible(true);
      this.window.contentView.addChildView(view, 0);
    }
    view.webContents.send("desktop:view-state", { active: true, url });
    const title = view.webContents.getTitle();
    if (title) this.window.setTitle(title);
    if (this.window.isFocused()) view.webContents.focus();
    this.emit("contents-activated", view.webContents);
  }
  release(view) {
    if (!view) return;
    if (this.editor === view) this.editor = undefined;
    if (this.dashboard === view) { this.dashboard = undefined; this.dashboardLoad = undefined; }
    this.emit("contents-released", view.webContents);
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
  }
  releaseEditor(view) {
    if (!view) return;
    this.pruneRetiredEditors();
    if (!view.webContents.isDestroyed()) {
      const pid = view.webContents.getOSProcessId();
      if (pid) this.retiredEditorPids.add(pid);
    }
    this.release(view);
  }
  pruneRetiredEditors() {
    if (!this.retiredEditorPids.size) return;
    const running = new Set(app.getAppMetrics().map(process => process.pid));
    for (const pid of this.retiredEditorPids) {
      if (!running.has(pid)) this.retiredEditorPids.delete(pid);
    }
  }
  // WebContents destruction can precede OS process exit. Only thumbnail
  // admission waits for that exit; Dashboard activation stays immediate.
  async waitForEditorExit(signal) {
    this.pruneRetiredEditors();
    while (this.retiredEditorPids.size) {
      await delay(25, undefined, { signal });
      this.pruneRetiredEditors();
    }
  }
  invalidateDashboard() {
    // Never reveal a previous account's cached UI after session replacement.
    if (this.dashboard && this.dashboard !== this.view) this.release(this.dashboard);
    else this.dashboardInvalid = true;
  }
  async prepareDashboard() {
    if (!this.dashboard) this.dashboard = this.createContents("dashboard");
    if (this.dashboardLoad) return this.dashboardLoad;
    const current = this.dashboard.webContents.getURL();
    if (current && !this.dashboardInvalid && !new URL(current).pathname.startsWith("/desktop/")) return;
    this.dashboardInvalid = false;
    return this.loadDashboard(this.origin + "/projects");
  }
  loadDashboard(url) {
    const view = this.dashboard;
    const pending = view.webContents.loadURL(url).then(() => {
      if (!this.window.isDestroyed() && this.dashboard === view) {
        view.webContents.send("desktop:view-state", { active: view === this.view });
      }
    }).catch(error => {
      if (this.dashboard === view) this.dashboardInvalid = true;
      throw error;
    });
    this.dashboardLoad = pending;
    const clear = () => { if (this.dashboardLoad === pending) this.dashboardLoad = undefined; };
    void pending.then(clear, clear);
    return pending;
  }
  loadURL(url, startupCheck) {
    if (new URL(url).origin !== this.origin) return Promise.reject(new Error("Invalid Studio destination"));
    const navigate = async () => {
      if (this.window.isDestroyed()) throw new Error("Desktop window closed");
      const previous = this.webContents.getURL();
      const nextProject = this.projectId(url);
      const currentProject = this.projectId(previous);
      if (previous && previous !== "about:blank" && currentProject !== nextProject) {
        await this.beforeNavigate();
        if (this.window.isDestroyed()) throw new Error("Desktop window closed");
      }
      if (nextProject) {
        if (!this.editor || currentProject !== nextProject) {
          const retired = this.editor;
          this.editor = this.createContents("editor");
          this.activate(this.editor);
          this.releaseEditor(retired);
        }
        const [, restoredUrl] = await Promise.all([
          this.editor.webContents.loadURL(url),
          startupCheck,
        ]);
        if (restoredUrl && restoredUrl !== url) {
          // The project document was only preparing its shell. It cannot
          // consume a model or accept edits before the access check succeeds.
          url = restoredUrl;
        } else {
          // Direct project launches also prepare the browser once.
          void this.prepareDashboard().catch(error => console.warn("Cannot prepare Dashboard:", error.message));
        }
      }
      if (!this.projectId(url)) {
        if (!this.dashboard) this.dashboard = this.createContents("dashboard");
        const contents = this.dashboard.webContents;
        const current = contents.getURL();
        // Standalone auth documents and explicit reload/recovery need a fresh
        // document. Ordinary returns reuse the mounted Dashboard and its state.
        const auth = value => new URL(value || this.origin).pathname.startsWith("/desktop/");
        if (!current || this.dashboardInvalid || contents.isCrashed() || auth(url) || auth(current)) {
          this.dashboardInvalid = false;
          await this.loadDashboard(url);
        } else if (this.dashboardLoad) await this.dashboardLoad;
        const retired = this.editor;
        this.activate(this.dashboard, url);
        this.releaseEditor(retired);
      }
      if (this.window.isFocused()) this.webContents.focus();
    };
    const next = this.navigation.then(navigate);
    this.navigation = next.catch(() => {});
    return next;
  }
}
module.exports = { StudioWindow };
