const {
  app,
  WebContentsView,
  ipcMain,
  View,
  Menu,
  shell,
  clipboard,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { checkedUrl, captureReference } = require("./browser-capture.cjs");
const { installPicker, inPage } = require("./browser-page.cjs");

const CDP_READ_METHODS = new Set([
  "DOM.getDocument",
  "DOM.getFlattenedDocument",
  "DOM.describeNode",
  "DOM.getOuterHTML",
  "DOM.getAttributes",
  "DOM.getBoxModel",
  "DOM.getContentQuads",
  "DOM.querySelector",
  "DOM.querySelectorAll",
  "CSS.getComputedStyleForNode",
  "CSS.getMatchedStylesForNode",
  "Accessibility.getFullAXTree",
  "Accessibility.getPartialAXTree",
]);

class ReferenceBrowser {
  constructor({
    getParent,
    dispatch,
    getImportContext,
    importHtml,
    uploadImage,
    locate,
    undo,
    i18n,
    appearance,
  }) {
    Object.assign(this, {
      getParent,
      dispatch,
      getImportContext,
      importHtml,
      uploadImage,
      locate,
      undo,
      i18n,
      appearance,
    });
    this.pageUrl = pathToFileURL(
      path.join(__dirname, "reference-browser.html"),
    ).href;
    this.state = {
      url: "",
      title: "",
      loading: false,
      busy: null,
      selection: null,
      picking: false,
      width: 1440,
      height: 900,
      zoom: 1,
      device: "Desktop",
      importHeight: null,
      recent: [],
      error: null,
      notice: null,
      result: null,
    };
    this.historyFile = path.join(
      app.getPath("userData"),
      "browser-history.json",
    );
    try {
      this.state.recent = JSON.parse(fs.readFileSync(this.historyFile, "utf8"))
        .filter((url) => {
          try {
            return checkedUrl(url);
          } catch {
            return false;
          }
        })
        .slice(0, 30);
    } catch {
      /* Missing or invalid history starts empty. */
    }
    this.generation = 0;
    this.onCommand = async (event, input) => {
      if (
        !this.chrome ||
        event.sender !== this.chrome.webContents ||
        event.senderFrame !== event.sender.mainFrame ||
        event.senderFrame.url !== this.pageUrl
      )
        throw new Error("Invalid reference browser page");
      if (input.action === "panel_width") {
        if (!this.expanded && Number.isFinite(input.width)) {
          this.panelWidth = input.width;
          this.layout();
        }
        return this.chrome.getBounds();
      }
      if (input.action === "inspector_height") {
        if (Number.isFinite(input.height)) {
          this.inspectorHeight = Math.max(0, Math.min(144, input.height));
          this.publish();
        }
        return;
      }
      if (input.action === "overlay") {
        this.overlay = !!input.visible;
        this.window.contentView.addChildView(
          this.overlay || !this.view ? this.chrome : this.view,
        );
        return;
      }
      if (input.action === "menu_action") {
        if (this.state.busy)
          throw new Error("Wait for the browser import to finish");
        return this.menu(input.menu, input.index);
      }
      if (input.action === "copy_selection") {
        const details = this.state.selection?.details;
        const value = details?.[input.group];
        const text = input.property
          ? value?.[input.property]
          : typeof value === "string"
            ? value
            : value &&
              Object.entries(value)
                .map(([key, value]) => `${key}: ${value};`)
                .join("\n");
        if (typeof text !== "string")
          throw new Error("No selected style to copy");
        clipboard.writeText(text);
        return;
      }
      if (input.action === "application_menu") {
        Menu.getApplicationMenu()?.popup({ window: this.window });
        return;
      }
      if (input.action === "open_workspace") {
        const item = Menu.getApplicationMenu()?.getMenuItemById(
          "desktop-open-project",
        );
        if (item?.enabled) return item.click(item, this.window);
        return;
      }
      if (input.action === "initialize") return this.snapshot(true);
      if (input.action === "menu") return this.menu(input.menu);
      try {
        return await this.dispatch("browser", input);
      } catch (error) {
        this.state.error = error.message;
        this.publish();
        throw error;
      }
    };
    ipcMain.handle("desktop:reference-browser", this.onCommand);
    this.subscriptions = [
      i18n.subscribe(() => this.publish()),
      appearance.subscribe(() => this.publish()),
    ];
  }
  snapshot(includeUi = false) {
    const contents =
      this.view && !this.view.webContents.isDestroyed()
        ? this.view.webContents
        : undefined;
    return {
      ...this.state,
      visible: !!this.visible && !!this.window?.isVisible(),
      bounds: this.chrome?.getBounds(),
      expanded: !!this.expanded,
      platform: process.platform,
      nativeFullscreen: !!this.window?.isFullScreen(),
      canGoBack:
        /^https?:/.test(this.state.url) &&
        !!contents?.navigationHistory.canGoBack(),
      canGoForward:
        /^https?:/.test(this.state.url) &&
        !!contents?.navigationHistory.canGoForward(),
      locale: includeUi ? this.i18n.snapshot() : this.i18n.snapshot().locale,
      appearance: this.appearance.snapshot(),
    };
  }
  publish() {
    if (!this.chrome || this.chrome.webContents.isDestroyed()) return;
    this.layout();
    this.chrome.webContents.send(
      "desktop:reference-browser-state",
      this.snapshot(true),
    );
  }
  saveHistory() {
    const temporary = this.historyFile + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(this.state.recent), {
      mode: 0o600,
    });
    fs.renameSync(temporary, this.historyFile);
  }
  async open() {
    const parent = this.getParent();
    if (this.window !== parent) {
      this.releaseViews();
      for (const event of ["resize", "enter-full-screen", "leave-full-screen"])
        this.window?.removeListener(event, this.onResize);
      this.window?.removeListener("closed", this.onParentClosed);
      this.window?.webContents.removeListener(
        "did-start-navigation",
        this.onParentNavigation,
      );
      this.window = parent;
      this.onResize = () => this.publish();
      this.onParentClosed = () => {
        this.releaseViews();
        this.window = undefined;
      };
      this.onParentNavigation = (event) => {
        if (event.isMainFrame && !event.isSameDocument) this.hide();
      };
      for (const event of ["resize", "enter-full-screen", "leave-full-screen"])
        parent.on(event, this.onResize);
      parent.once("closed", this.onParentClosed);
      parent.webContents.on("did-start-navigation", this.onParentNavigation);
    }
    if (!this.chrome || this.chrome.webContents.isDestroyed()) {
      this.chrome = new WebContentsView({
        webPreferences: {
          preload: path.join(__dirname, "reference-browser-preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      this.background = new View();
      this.background.setBorderRadius(12);
      parent.contentView.addChildView(this.background);
      this.chrome.setBackgroundColor("#00000000");
      this.chrome.setBorderRadius(12);
      const contents = this.chrome.webContents;
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
      contents.on("will-navigate", (event) => event.preventDefault());
      contents.on("will-attach-webview", (event) => event.preventDefault());
      parent.contentView.addChildView(this.chrome);
      this.layout();
      await contents.loadURL(this.pageUrl);
    }
    this.visible = true;
    parent.contentView.addChildView(this.chrome);
    if (this.view && !this.overlay) parent.contentView.addChildView(this.view);
    this.publish();
    parent.show();
    this.chrome.webContents.focus();
    return this.snapshot();
  }
  hide() {
    void this.picker("clearRead").catch(() => {});
    this.visible = false;
    this.overlay = false;
    this.background?.setVisible(false);
    this.chrome?.setVisible(false);
    this.view?.setVisible(false);
    this.publish();
    if (this.window && !this.window.isDestroyed())
      this.window.webContents.focus();
    return this.snapshot();
  }
  panelBounds() {
    const [width, height] = this.window.getContentSize();
    const maximum = Math.max(1, width - 16);
    const panelWidth = this.expanded
      ? maximum
      : Math.min(
          Math.max(1, width - 360 - 16),
          Math.max(640, this.panelWidth ?? 640),
        );
    return {
      x: width - 8 - Math.round(panelWidth),
      y: 8,
      width: Math.round(panelWidth),
      height: Math.max(1, height - 16),
    };
  }
  resizeEditor(width) {
    if (!this.window || this.window.isDestroyed()) return;
    const contents = this.window.webContents;
    if (!width) {
      if (this.editorViewport) contents.disableDeviceEmulation();
      this.editorViewport = undefined;
      return;
    }
    const height = this.window.getContentSize()[1];
    if (
      this.editorViewport?.width === width &&
      this.editorViewport?.height === height
    )
      return;
    if (!contents.getURL()) return;
    // Resize the Studio viewport at 1:1 scale so its fixed UI and nested editor
    // frames reflow into the space left by the native browser panel.
    contents.enableDeviceEmulation({
      screenPosition: "desktop",
      viewSize: { width, height },
      deviceScaleFactor: 0,
      scale: 1,
    });
    this.editorViewport = { width, height };
  }
  releaseViews() {
    clearTimeout(this.pollTimer);
    this.resizeEditor();
    if (this.editorExpanded && this.window && !this.window.isDestroyed())
      this.window.webContents.send("desktop:reference-browser-mode", {
        expanded: false,
      });
    this.editorExpanded = false;
    this.editorViewport = undefined;
    if (this.chrome && this.window && !this.window.isDestroyed())
      this.window.contentView.removeChildView(this.chrome);
    if (this.view && this.window && !this.window.isDestroyed())
      this.window.contentView.removeChildView(this.view);
    if (this.view && !this.view.webContents.isDestroyed())
      this.view.webContents.close();
    if (this.chrome && !this.chrome.webContents.isDestroyed())
      this.chrome.webContents.close();
    if (this.background && this.window && !this.window.isDestroyed())
      this.window.contentView.removeChildView(this.background);
    this.background = undefined;
    this.overlay = false;
    this.chrome = undefined;
    this.view = undefined;
    this.visible = false;
    this.state.url = "";
    this.state.selection = null;
    this.state.picking = false;
  }
  createView() {
    if (this.view && !this.view.webContents.isDestroyed()) return;
    this.view = new WebContentsView({
      webPreferences: {
        partition: "plasmic-reference-browser",
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });
    const contents = this.view.webContents;
    contents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    contents.setWindowOpenHandler(({ url }) => {
      // Keep ordinary target=_blank links in the same isolated browser.
      try {
        const next = checkedUrl(url);
        void this.command({ action: "load_page", url: next.href }).catch(
          (error) => {
            this.state.error = error.message;
            this.publish();
          },
        );
      } catch {
        /* Ignore non-web popup destinations. */
      }
      return { action: "deny" };
    });
    const protect = (event) => {
      try {
        checkedUrl(event.url);
      } catch {
        event.preventDefault();
      }
      if (this.state.busy) event.preventDefault();
    };
    contents.on("will-navigate", protect);
    contents.on("will-redirect", protect);
    contents.on("did-start-navigation", (event) => {
      if (!event.isMainFrame || event.isSameDocument) return;
      this.generation++;
      this.state.selection = null;
      this.state.picking = false;
      this.state.loading = true;
      this.state.error = null;
      this.publish();
    });
    contents.on("dom-ready", () => {
      void inPage(contents, installPicker)
        .then(() => this.poll())
        .catch((error) => {
          this.state.error = error.message;
          this.publish();
        });
    });
    contents.on("did-stop-loading", () => {
      this.state.loading = false;
      this.state.url = /^https?:/.test(contents.getURL())
        ? contents.getURL()
        : "";
      this.state.title = contents.getTitle();
      if (/^https?:/.test(this.state.url)) {
        this.state.recent = [
          this.state.url,
          ...this.state.recent.filter((url) => url !== this.state.url),
        ].slice(0, 30);
        this.saveHistory();
      }
      this.publish();
    });
    contents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
      if (isMainFrame) {
        this.generation++;
        this.state.url = url;
        this.state.selection = null;
        this.state.picking = false;
        void this.picker("clear");
        this.publish();
      }
    });
    contents.on(
      "did-fail-load",
      (_event, code, description, _url, isMainFrame) => {
        if (isMainFrame && code !== -3) {
          this.state.loading = false;
          this.state.error = description;
          this.publish();
        }
      },
    );
    contents.on("render-process-gone", () => {
      this.state.error = this.i18n.t(
        "The reference page stopped. Reload to continue.",
      );
      this.state.loading = false;
      this.publish();
    });
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if ((input.meta || input.control) && input.key.toLowerCase() === "l") {
        event.preventDefault();
        this.chrome.webContents.focus();
        this.chrome.webContents.send("desktop:reference-browser-focus-url");
        return;
      }
      if (input.key === "Enter" && this.state.selection && !this.state.busy) {
        event.preventDefault();
        const action =
          input.meta || input.control
            ? "screenshot_to_canvas"
            : "import_to_canvas";
        void this.dispatch("browser", {
          action,
          target: "selection",
        }).catch((error) => {
          this.state.error = error.message;
          this.publish();
        });
      }
    });
    // Keep native web surfaces as siblings. A WebContentsView's Chromium surface
    // can occlude nested native child views on macOS.
    this.window.contentView.addChildView(this.view);
    this.layout();
  }
  layout() {
    if (!this.window || this.window.isDestroyed() || !this.chrome) return;
    const panel = this.panelBounds();
    const expanded = !!this.visible && !!this.expanded;
    if (this.editorExpanded !== expanded) {
      this.editorExpanded = expanded;
      this.window.webContents.send("desktop:reference-browser-mode", {
        expanded,
      });
    }
    // Studio already leaves 8 px at its right edge for the panel gap.
    this.resizeEditor(
      this.visible && !expanded ? Math.max(1, panel.x) : undefined,
    );
    this.background.setBounds(panel);
    this.background.setBackgroundColor(
      this.appearance.snapshot() === "light" ? "#eceef3" : "#15161b",
    );
    this.background.setVisible(!!this.visible);
    this.chrome.setBounds(panel);
    this.chrome.setVisible(!!this.visible);
    const top = 1 + 41 + (this.state.selection ? 28 : 0);
    const bottom =
      16 +
      (this.state.selection ? (this.inspectorHeight ?? 64) : 0) +
      (this.state.error || this.state.notice || this.state.busy ? 48 : 0);
    const availableWidth = panel.width - 7;
    const availableHeight = Math.max(1, panel.height - top - bottom - 1);
    this.state.maxImportHeight = availableHeight;
    this.state.viewportHeight =
      this.state.importHeight === null
        ? availableHeight
        : Math.min(availableHeight, this.state.importHeight);
    if (!this.view || this.view.webContents.isDestroyed()) return;
    const desktop = this.state.device === "Desktop";
    const bounds = {
      x:
        panel.x +
        6 +
        (desktop
          ? 0
          : Math.max(
              0,
              Math.floor(
                (availableWidth - this.state.width * this.state.zoom) / 2,
              ),
            )),
      y: panel.y + top,
      width: desktop
        ? availableWidth
        : Math.min(
            availableWidth,
            Math.round(this.state.width * this.state.zoom),
          ),
      height: desktop
        ? this.state.viewportHeight
        : Math.min(
            this.state.viewportHeight,
            Math.round(this.state.height * this.state.zoom),
          ),
    };
    this.view.setBounds(bounds);
    this.view.setVisible(!!this.visible && /^https?:/.test(this.state.url));
    if (!this.view.webContents.getURL() || this.state.loading) return;
    if (desktop) {
      this.view.webContents.disableDeviceEmulation();
      this.view.webContents.setZoomFactor(this.state.zoom);
      this.state.width = Math.round(bounds.width / this.state.zoom);
      this.state.height = Math.round(bounds.height / this.state.zoom);
      return;
    }
    this.view.webContents.setZoomFactor(1);
    this.view.webContents.enableDeviceEmulation({
      screenPosition: "desktop",
      viewPosition: { x: 0, y: 0 },
      viewSize: {
        width: this.state.width,
        height: this.state.height,
      },
      deviceScaleFactor: 0,
      scale: this.state.zoom,
    });
  }
  async picker(method, value) {
    if (!this.view || this.view.webContents.isDestroyed() || this.state.loading)
      return;
    return inPage(
      this.view.webContents,
      ({ method, value }) => globalThis.__plasmicWebPicker?.[method](value),
      { method, value },
    );
  }
  async poll() {
    clearTimeout(this.pollTimer);
    if (!this.view || this.view.webContents.isDestroyed()) return;
    try {
      const selected = await this.picker("snapshot");
      if (selected) {
        const previous = JSON.stringify([
          this.state.selection,
          this.state.picking,
        ]);
        this.state.selection = selected.selector ? selected : null;
        this.state.picking = selected.picking;
        if (
          previous !==
          JSON.stringify([this.state.selection, this.state.picking])
        )
          this.publish();
      }
    } catch {
      /* A navigation can replace the isolated world between polls. */
    }
    this.pollTimer = setTimeout(() => this.poll(), 180);
    this.pollTimer.unref();
  }
  async command(input) {
    if (input.action === "open") return this.open();
    if (input.action === "get_state") {
      await this.poll();
      return this.snapshot();
    }
    if (input.action === "close") {
      return this.hide();
    }
    if (input.action === "cancel") {
      if (this.state.busy !== "preparing")
        throw new Error("The editor transaction has already started");
      this.generation++;
      this.state.notice = this.i18n.t(
        "Import cancelled. The canvas was not changed.",
      );
      this.publish();
      return this.snapshot();
    }
    if (this.state.busy)
      throw new Error("Wait for the browser import to finish");
    if (input.action === "load_page") {
      const url = checkedUrl(input.url);
      await this.open();
      this.createView();
      if (input.width || input.height) this.state.device = "Custom";
      if (input.width) this.state.width = input.width;
      if (input.height) this.state.height = input.height;
      this.state.url = url.href;
      this.state.error = null;
      this.state.notice = null;
      this.layout();
      await this.view.webContents.loadURL(url.href);
      await inPage(this.view.webContents, installPicker);
      await this.poll();
      return this.snapshot();
    }
    if (input.action === "clear_page") {
      this.generation++;
      this.state.url = "";
      this.state.selection = null;
      this.state.picking = false;
      this.state.error = null;
      this.state.notice = null;
      if (this.view) {
        this.view.webContents.stop();
        this.view.setVisible(false);
        await this.view.webContents.loadURL("about:blank");
        this.view.webContents.navigationHistory.clear();
      }
      clearTimeout(this.pollTimer);
      this.publish();
      return this.snapshot();
    }
    if (input.action === "expand") {
      this.expanded = !this.expanded;
      this.publish();
      return this.snapshot();
    }
    if (input.action === "set_import_height") {
      if (
        input.height !== undefined &&
        (!Number.isInteger(input.height) ||
          input.height < 240 ||
          input.height > 16384)
      )
        throw new Error(
          "Import height must be between 240 and 16384 CSS pixels",
        );
      this.state.importHeight =
        input.height === undefined ||
        input.height >= this.state.maxImportHeight - 16
          ? null
          : input.height;
      this.publish();
      return this.snapshot();
    }
    if (input.action === "cycle_device") {
      const next = {
        Desktop: ["Phone", 390, 844],
        Phone: ["Tablet", 1180, 820],
        Tablet: ["Desktop", 1440, 900],
        Custom: ["Desktop", 1440, 900],
      }[this.state.device];
      [this.state.device, this.state.width, this.state.height] = next;
      await this.picker("clear");
      this.state.selection = null;
      this.state.picking = false;
      this.publish();
      return this.snapshot();
    }
    if (input.action === "clear_history") {
      this.state.recent = [];
      this.saveHistory();
      this.publish();
      return this.snapshot();
    }
    if (input.action === "locate") return this.locate(this.state.result);
    if (input.action === "undo_import") {
      const result = await this.undo(this.state.result);
      this.state.result = null;
      this.state.notice = this.i18n.t("Import undone.");
      this.publish();
      return result;
    }
    if (input.action === "show_warnings")
      return this.state.result?.warnings || [];
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed() || !/^https?:/.test(this.state.url))
      throw new Error("Call browser load_page first");
    if (input.action === "select_element") {
      await this.picker("select", input.selector);
      await this.poll();
      return this.snapshot();
    }
    if (input.action === "clear_selection") {
      await this.picker("clear");
      await this.poll();
      return this.snapshot();
    }
    if (input.action === "back" || input.action === "forward") {
      const nav = contents.navigationHistory;
      if (input.action === "back" && nav.canGoBack()) nav.goBack();
      if (input.action === "forward" && nav.canGoForward()) nav.goForward();
      return this.snapshot();
    }
    if (input.action === "reload") {
      this.state.error = null;
      contents.reload();
      return this.snapshot();
    }
    if (input.action === "reload_without_cache") {
      this.state.error = null;
      await contents.session.clearCache();
      contents.reloadIgnoringCache();
      return this.snapshot();
    }
    if (input.action === "screenshot") {
      if (this.state.selection)
        return this.dispatch("browser", {
          action: "screenshot_to_canvas",
          target: "selection",
        });
      return this.menu("screenshot");
    }
    if (input.action === "capture") {
      const generation = this.generation;
      const result = await captureReference(this.view, input);
      this.showReadFeedback(input, generation);
      return result;
    }
    if (
      input.action === "import_to_canvas" ||
      input.action === "screenshot_to_canvas"
    )
      return this.importToCanvas(input);
    if (input.action === "cdp") {
      if (
        !/^(DOM|Input|Page|Runtime|Emulation|CSS|Accessibility)\.[A-Za-z]+$/.test(
          input.method || "",
        )
      )
        throw new Error("Unsupported browser CDP domain");
      if (input.method === "Page.navigate") checkedUrl(input.params?.url);
      const screenshot = input.method === "Page.captureScreenshot";
      const read =
        screenshot ||
        CDP_READ_METHODS.has(input.method) ||
        (input.method === "Runtime.evaluate" &&
          input.params?.throwOnSideEffect === true);
      const generation = this.generation;
      if (read) await this.picker(screenshot ? "hide" : "clearRead");
      let result;
      try {
        result = await this.cdp(input.method, input.params);
      } finally {
        if (screenshot) await this.picker("restore");
      }
      if (read && !result.exceptionDetails)
        this.showReadFeedback(input, generation);
      return input.method === "Page.captureScreenshot"
        ? { data: result.data, url: contents.getURL() }
        : { result };
    }
    throw new Error("Unknown browser action");
  }
  async cdp(method, params = {}) {
    const api = this.view.webContents.debugger;
    if (!api.isAttached()) api.attach("1.3");
    return api.sendCommand(method, params);
  }
  showReadFeedback(input, generation) {
    if (!this.visible || generation !== this.generation) return;
    // Feedback runs in the isolated page world and never delays the read result.
    void this.picker("flashRead", { ...input, zoom: this.state.zoom }).catch(
      () => {},
    );
  }
  async importToCanvas(input) {
    if (
      input.target === "visible_area" &&
      input.action !== "screenshot_to_canvas"
    )
      throw new Error("visible_area is only supported for screenshots");
    if (this.state.loading)
      throw new Error("Wait for the page to finish loading");
    const generation = this.generation;
    const clipHeight =
      this.state.importHeight === null
        ? undefined
        : Math.round(this.view.getBounds().height / this.state.zoom);
    this.state.busy = "preparing";
    this.state.error = null;
    this.state.notice = null;
    this.publish();
    try {
      const context = await this.getImportContext(input);
      const target =
        input.target || (this.state.selection ? "selection" : "full_page");
      const capture = await captureReference(this.view, {
        ...input,
        target,
        clipHeight:
          target === "full_page" && !input.selector ? clipHeight : undefined,
        htmlOnly: true,
      });
      if (generation !== this.generation)
        throw new Error("Import cancelled or source page changed");
      if (input.action === "screenshot_to_canvas") {
        await this.picker("hide");
        try {
          const metrics = await this.cdp("Page.getLayoutMetrics");
          const selected = target === "selection" || input.selector;
          const viewport = metrics.cssVisualViewport;
          const rect = selected
            ? capture.bounds
            : input.target === "visible_area"
              ? {
                  x: viewport.pageX,
                  y: viewport.pageY,
                  width: viewport.clientWidth,
                  height: viewport.clientHeight,
                }
              : {
                  ...metrics.cssContentSize,
                  height:
                    clipHeight === undefined
                      ? metrics.cssContentSize.height
                      : Math.min(metrics.cssContentSize.height, clipHeight),
                };
          if (rect.width * rect.height > 20000000)
            throw new Error(
              "Screenshot exceeds 20 megapixels; select a smaller region",
            );
          const image = await this.cdp("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: {
              x: rect.x || 0,
              y: rect.y || 0,
              width: rect.width,
              height: rect.height,
              scale: 1,
            },
          });
          const asset = await this.uploadImage(
            Buffer.from(image.data, "base64"),
          );
          capture.html = `<img src="${asset.src.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" style="width:${rect.width}px;height:${rect.height}px">`;
        } finally {
          await this.picker("restore");
        }
      }
      if (generation !== this.generation)
        throw new Error("Import cancelled or source page changed");
      this.state.busy = "committing";
      this.publish();
      const result = await this.importHtml({
        ...context,
        html: capture.html,
        width: this.state.width,
        ...((target === "full_page" || target === "visible_area") &&
        !input.selector &&
        clipHeight !== undefined
          ? { height: clipHeight }
          : {}),
        name:
          input.name ||
          (target === "selection" ? "ImportedSection" : "ImportedPage"),
      });
      this.state.result = {
        ...result,
        warnings: [...capture.warnings, ...result.warnings],
        sourceUrl: capture.url,
      };
      this.state.notice = this.i18n.t(
        input.action === "screenshot_to_canvas"
          ? "Screenshot added to the canvas."
          : "Imported as editable layers.",
      );
      try {
        await this.locate(this.state.result);
      } catch (error) {
        this.state.result.warnings.push(error.message);
      }
      return this.state.result;
    } catch (error) {
      this.state.error = error.message;
      throw error;
    } finally {
      this.state.busy = null;
      this.publish();
    }
  }
  menu(name, index) {
    const t = this.i18n.t;
    const run = (input) => {
      void this.dispatch("browser", input).catch((error) => {
        this.state.error = error.message;
        this.publish();
      });
    };
    let items;
    if (name === "history")
      items = this.state.recent.length
        ? this.state.recent.map((url) => ({
            label: url.replace(/^https?:\/\//, ""),
            click: () => run({ action: "load_page", url }),
          }))
        : [{ label: t("No recent pages"), enabled: false }];
    else if (name === "screenshot")
      items = [
        {
          label: t("Full page"),
          click: () =>
            run({ action: "screenshot_to_canvas", target: "full_page" }),
        },
        {
          label: t("Visible area"),
          click: () =>
            run({ action: "screenshot_to_canvas", target: "visible_area" }),
        },
      ];
    else if (name === "more")
      items = [
        {
          label: t("Zoom In"),
          enabled: this.state.zoom < 3,
          click: () => {
            this.state.zoom = Math.min(3, this.state.zoom + 0.25);
            this.publish();
          },
        },
        {
          label: t("Zoom Out"),
          enabled: this.state.zoom > 0.25,
          click: () => {
            this.state.zoom = Math.max(0.25, this.state.zoom - 0.25);
            this.publish();
          },
        },
        {
          label: `${t("Zoom")}: ${Math.round(this.state.zoom * 100)}%`,
          enabled: false,
        },
        {
          label: t("Reset Zoom to 100%"),
          click: () => {
            this.state.zoom = 1;
            this.publish();
          },
        },
        { type: "separator" },
        {
          label: t("Empty Cache and Reload"),
          enabled: /^https?:/.test(this.state.url),
          click: () => run({ action: "reload_without_cache" }),
        },
        {
          label: t("Open in system browser"),
          enabled: /^https?:/.test(this.state.url),
          click: () => shell.openExternal(checkedUrl(this.state.url).href),
        },
      ];
    else throw new Error("Unknown browser menu");
    if (index !== undefined) {
      const item = items[index];
      if (!item?.click || item.enabled === false)
        throw new Error("Invalid browser menu item");
      return item.click();
    }
    return items.map(({ click, ...item }, index) => ({ ...item, index }));
  }
  dispose() {
    ipcMain.removeHandler("desktop:reference-browser");
    for (const stop of this.subscriptions) stop();
    if (this.window) {
      for (const event of ["resize", "enter-full-screen", "leave-full-screen"])
        this.window.removeListener(event, this.onResize);
      this.window.removeListener("closed", this.onParentClosed);
      this.window.webContents.removeListener(
        "did-start-navigation",
        this.onParentNavigation,
      );
    }
    this.releaseViews();
  }
}
module.exports = { ReferenceBrowser };
