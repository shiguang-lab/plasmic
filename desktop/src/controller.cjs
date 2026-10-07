const { app, ipcMain, nativeImage } = require("electron");
const { randomUUID } = require("node:crypto");
const { EDITOR_METHODS } = require("./mcp.cjs");
const { canvasFrames, renderCanvas, exportCanvas } = require("./canvas.cjs");
class DesktopController {
  constructor(getWindow, config, waitForStartup = async () => {}) {
    this.getWindow = getWindow;
    this.config = config;
    this.waitForStartup = waitForStartup;
    this.operations = new Map();
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.receive = (event, id, result) => {
      const pending = this.pending.get(id);
      if (
        !pending ||
        event.sender !== pending.window.webContents ||
        event.senderFrame !== event.sender.mainFrame
      ) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(id);
      if (result?.success === false) {
        pending.reject(
          new Error(result.error?.message || "Editor command failed"),
        );
      } else {
        pending.resolve(result);
      }
    };
    ipcMain.on("desktop:result", this.receive);
  }
  invoke(method, input = {}, timeout = 90000) {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      throw new Error("Open the desktop editor window");
    }
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Editor command timed out: " + method));
      }, timeout);
      this.pending.set(id, { window, timer, resolve, reject });
      window.webContents.send("desktop:invoke", { id, method, input });
    });
  }
  async editor(name, input = {}) {
    if (!EDITOR_METHODS.includes(name)) {
      throw new Error("Unknown editor operation");
    }
    const result = await this.invoke(name, input);
    if (!result?.success) {
      throw new Error("Invalid editor response");
    }
    try {
      return JSON.parse(result.output);
    } catch {
      return { output: result.output };
    }
  }
  async state() {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) {
      return { running: true, windowOpen: false, ready: false };
    }
    let metadata = { ready: false, tools: {} };
    const url = new URL(win.webContents.getURL() || "about:blank");
    if (
      !win.webContents.isLoadingMainFrame() &&
      url.origin === this.config.studioOrigin &&
      url.pathname !== "/desktop/google-login"
    ) {
      metadata = await this.invoke("metadata", {}, 3000);
    }
    return {
      imageService: await require("./image-service.cjs").imageServiceStatus(
        app.getPath("userData"),
      ),
      running: true,
      windowOpen: true,
      version: require("../package.json").version,
      build: require("../renderer/desktop-assets.json").build,
      url: url.toString(),
      projectId: url.pathname.match(/^\/projects\/([^/]+)/)?.[1] || null,
      ready: metadata.ready,
      editorTools: metadata.tools,
      editorContext: metadata.editorContext ?? null,
      operations: [...this.operations.values()],
    };
  }
  async ready() {
    const end = Date.now() + 120000;
    while (Date.now() < end) {
      const win = this.getWindow();
      if (!win || win.isDestroyed()) {
        throw new Error("Open the desktop editor window");
      }
      if (win.webContents.isLoadingMainFrame()) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      if (
        win.webContents.getURL().includes("/login") ||
        new URL(win.webContents.getURL()).pathname === "/desktop/google-login"
      ) {
        throw new Error("Sign in to Plasmic first");
      }
      try {
        const metadata = await this.invoke("metadata", {}, 2000);
        if (metadata.ready) {
          return metadata;
        }
      } catch (error) {
        if (!error.message.includes("timed out")) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Design did not become ready");
  }
  dispatch(method, input) {
    if (method === "get_app_state") {
      return this.execute(method, input);
    }
    const id = randomUUID();
    this.operations.set(id, { id, method, phase: "queued" });
    const run = async () => {
      this.operations.set(id, {
        id,
        method,
        phase: "running",
        startedAt: new Date().toISOString(),
      });
      try {
        return await this.execute(method, input);
      } finally {
        this.operations.delete(id);
      }
    };
    if (
      [
        "list_projects",
        "search_stock_images",
        "generate_image",
        "browser",
        "capture_browser",
      ].includes(method) ||
      (["make_vector", "vectorize_image"].includes(method) &&
        !input?.componentUuid)
    ) {
      return run();
    }
    const result = this.queue.then(run, run);
    this.queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  async execute(method, input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Arguments must be an object");
    }
    if (method === "get_app_state") {
      return this.state();
    }
    const win = this.getWindow();
    if (!win || win.isDestroyed()) {
      throw new Error("Open the desktop editor window");
    }
    if (
      ![
        "list_projects",
        "search_stock_images",
        "generate_image",
        "browser",
        "capture_browser",
        "make_vector",
        "vectorize_image",
      ].includes(method)
    ) {
      await this.waitForStartup();
    }
    if (method === "list_projects") {
      const response = await win.webContents.session.fetch(
        this.config.studioOrigin + "/api/v1/projects?query=%22all%22",
        { bypassCustomProtocolHandlers: true, credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(
          "Cannot list projects; desktop login required (HTTP " +
            response.status +
            ")",
        );
      }
      return response.json();
    }
    if (method === "open_design") {
      if (
        typeof input.projectId !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(input.projectId)
      ) {
        throw new Error("Invalid projectId");
      }
      const state = await this.state();
      if (state.projectId !== input.projectId) {
        if (state.ready) {
          const identity = await this.editor("identify", {
            model: "unknown",
            client: "plasmic-desktop-mcp",
            skill: "plasmic",
          });
          if (identity.canEdit) {
            await this.editor("save");
          }
        }
        await win.loadURL(
          this.config.studioOrigin + "/projects/" + input.projectId,
        );
      }
      await this.ready();
      const identity = await this.editor("identify", {
        model: "unknown",
        client: "plasmic-desktop-mcp",
        skill: "plasmic",
      });
      if (identity.projectId !== input.projectId) {
        throw new Error("A different design was opened");
      }
      if (input.componentUuid) {
        await this.editor("navigate", { componentUuid: input.componentUuid });
      }
      return { opened: true, ...identity };
    }
    if (method === "execute_batch") {
      await this.ready();
      return this.editor("executeBatch", { operations: input.operations });
    }
    if (method === "execute") {
      await this.ready();
      return this.editor(input.name, input.input);
    }
    if (method === "search_stock_images") {
      return require("./stock-images.cjs").searchStockImages(input);
    }
    if (method === "generate_image") {
      return require("./image-service.cjs").requestImage(
        app.getPath("userData"),
        input,
        nativeImage,
      );
    }
    if (method === "vectorize_image") {
      const fs = require("node:fs/promises");
      const path = require("node:path");
      if (!path.isAbsolute(input.path)) {
        throw new Error("Image path must be absolute");
      }
      const stat = await fs.stat(input.path);
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024) {
        throw new Error("Image must be at most 10 MiB");
      }
      const image = nativeImage.createFromBuffer(await fs.readFile(input.path));
      if (image.isEmpty()) {
        throw new Error("Cannot decode image");
      }
      const result = require("./raster-vector.cjs").tracePng(
        image.toPNG(),
        input.colors,
      );
      if (input.outputPath) {
        if (
          !path.isAbsolute(input.outputPath) ||
          path.extname(input.outputPath).toLowerCase() !== ".svg"
        ) {
          throw new Error("Use an absolute new .svg outputPath");
        }
        await fs.writeFile(input.outputPath, result.svg, { flag: "wx" });
        result.path = input.outputPath;
      }
      if (input.componentUuid) {
        await this.ready();
        result.design = await this.editor("insertHtml", {
          componentUuid: input.componentUuid,
          elementUuid: input.elementUuid,
          location: input.location || "append",
          html: result.svg,
        });
      }
      return result;
    }
    if (method === "make_vector") {
      const result = require("./vector.cjs").makeVector(input);
      if (input.componentUuid) {
        await this.ready();
        result.design = await this.editor("insertHtml", {
          componentUuid: input.componentUuid,
          elementUuid: input.elementUuid,
          location: input.location || "append",
          html: result.svg,
        });
      }
      return result;
    }
    if (method === "export_code") {
      await this.ready();
      const identity = await this.editor("identify", {
        model: "unknown",
        client: "plasmic-desktop-mcp",
        skill: "plasmic",
      });
      await this.editor("save");
      const options = {
        bypassCustomProtocolHandlers: true,
        credentials: "include",
      };
      const csrfResponse = await win.webContents.session.fetch(
        this.config.studioOrigin + "/api/v1/auth/csrf",
        options,
      );
      if (!csrfResponse.ok) {
        throw new Error("Cannot obtain NAS CSRF token");
      }
      const { csrf } = await csrfResponse.json();
      const response = await win.webContents.session.fetch(
        this.config.studioOrigin +
          "/api/v1/projects/" +
          encodeURIComponent(identity.projectId) +
          "/code/components?export=true",
        {
          ...options,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
            Origin: this.config.studioOrigin,
          },
          body: JSON.stringify({
            platform: "react",
            version: "latest",
            componentIdOrNames: input.componentUuids,
            imageOpts: { scheme: "inlined" },
            stylesOpts: { scheme: "css" },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          "NAS React code generation failed: HTTP " + response.status,
        );
      }
      return require("./code-export.cjs").writeCodeBundle(
        input.outputPath,
        await response.json(),
      );
    }
    if (method === "browser") {
      return require("./browser-capture.cjs").browserCommand(input);
    }
    if (method === "capture_browser") {
      return require("./browser-capture.cjs").captureBrowser(input);
    }
    if (method === "import_image") {
      await this.ready();
      const fs = require("node:fs/promises");
      const path = require("node:path");
      if (!path.isAbsolute(input.path)) {
        throw new Error("Image path must be absolute");
      }
      const stat = await fs.stat(input.path);
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024) {
        throw new Error("Provide a raster image file up to 10 MiB");
      }
      const bytes = await fs.readFile(input.path);
      const image = nativeImage.createFromBuffer(bytes);
      if (image.isEmpty()) {
        throw new Error("Image format cannot be decoded");
      }
      const options = {
        bypassCustomProtocolHandlers: true,
        credentials: "include",
      };
      const csrfResponse = await win.webContents.session.fetch(
        this.config.studioOrigin + "/api/v1/auth/csrf",
        options,
      );
      if (!csrfResponse.ok) {
        throw new Error("Cannot obtain NAS CSRF token");
      }
      const { csrf } = await csrfResponse.json();
      const body = new FormData();
      body.append(
        "file",
        new Blob([image.toPNG()], { type: "image/png" }),
        path.parse(input.path).name + ".png",
      );
      const response = await win.webContents.session.fetch(
        this.config.studioOrigin + "/api/v1/image/upload",
        {
          ...options,
          method: "POST",
          body,
          headers: { "X-CSRF-Token": csrf, Origin: this.config.studioOrigin },
        },
      );
      if (!response.ok) {
        throw new Error("Image upload failed: HTTP " + response.status);
      }
      const result = await response.json();
      if (!result.dataUri) {
        throw new Error("NAS did not return an image source");
      }
      return {
        src: result.dataUri,
        width: result.width || image.getSize().width,
        height: result.height || image.getSize().height,
        mimeType: result.mimeType,
      };
    }
    if (method === "read_image") {
      await this.ready();
      const frames = await canvasFrames(win);
      const images = frames.flatMap(({ layout }) => layout.images);
      if (!images.some((image) => image.src === input.src)) {
        throw new Error(
          "Image source is not present in the current design; call snapshot_layout first",
        );
      }
      let data;
      if (input.src.startsWith("data:")) {
        const match = input.src.match(
          /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/,
        );
        if (!match) {
          throw new Error("Unsupported image data URL");
        }
        data = Buffer.from(match[1], "base64");
      } else {
        const response = await win.webContents.session.fetch(input.src);
        if (!response.ok) {
          throw new Error("Image request failed: HTTP " + response.status);
        }
        data = Buffer.from(await response.arrayBuffer());
      }
      if (data.length > 10 * 1024 * 1024) {
        throw new Error("Image exceeds 10 MiB");
      }
      const image = nativeImage.createFromBuffer(data);
      if (image.isEmpty()) {
        throw new Error("Image format cannot be decoded");
      }
      return { data: image.toPNG().toString("base64"), ...image.getSize() };
    }
    if (method === "export_pages") {
      await this.ready();
      const path = require("node:path");
      const fs = require("node:fs/promises");
      if (
        !path.isAbsolute(input.outputPath) ||
        path.extname(input.outputPath).toLowerCase() !== ".pdf"
      ) {
        throw new Error("outputPath must be an absolute .pdf file");
      }
      const { PDFDocument } = require("pdf-lib");
      const merged = await PDFDocument.create();
      for (const page of input.pages) {
        const rendered = await this.inspectCanvas(page, (inspectionId) =>
          renderCanvas(win, {
            ...page,
            inspectionId,
            format: "pdf",
          }),
          true,
        );
        const document = await PDFDocument.load(rendered.pdf);
        for (const copied of await merged.copyPages(
          document,
          document.getPageIndices(),
        )) {
          merged.addPage(copied);
        }
      }
      const data = await merged.save();
      await fs.writeFile(input.outputPath, data, { flag: "wx" });
      return {
        path: input.outputPath,
        pages: merged.getPageCount(),
        bytes: data.length,
        format: "pdf",
      };
    }
    if (
      ["snapshot_layout", "export_design", "get_screenshot"].includes(method)
    ) {
      await this.ready();
      return this.inspectCanvas(input, async (inspectionId) => {
        if (method === "snapshot_layout") {
          return {
            check: "layout",
            checked: ["horizontal-overflow", "image-load"],
            notChecked: [
              "interactions",
              "responsive-breakpoints",
              "content-overlap",
            ],
            frames: (await canvasFrames(win, inspectionId)).map(
              ({ layout }) => ({
                ...layout,
                problems: [
                  ...layout.elements
                    .filter((el) => el.horizontalOverflow)
                    .map((el) => ({
                      type: "horizontal-overflow",
                      elementUuid: el.elementUuid,
                      index: el.index,
                      bounds: { x: el.x, width: el.width },
                      viewportWidth: layout.width,
                    })),
                  ...layout.images
                    .filter((image) => !image.loaded)
                    .map((image) => ({
                      type: "image-unloaded",
                      src: image.src,
                    })),
                ],
              }),
            ),
          };
        }
        if (method === "export_design") {
          return exportCanvas(win, {
            ...input,
            inspectionId,
          });
        }
        if (input.mode !== "workspace") {
          if (input.rect) {
            throw new Error("rect requires mode workspace");
          }
          const result = await renderCanvas(win, {
            ...input,
            inspectionId,
          });
          return {
            data: result.image.toPNG().toString("base64"),
            width: result.width,
            height: result.height,
            rendering: "static",
            sourceViewport: result.sourceViewport,
            resized: result.resized,
          };
        }
        if (input.elementUuid) {
          throw new Error("elementUuid requires artboard mode");
        }
        await this.ready();
        await this.invoke("renderReady");
        if (input.rect) {
          const bounds = win.getContentBounds();
          if (
            !["x", "y", "width", "height"].every((key) =>
              Number.isInteger(input.rect[key]),
            ) ||
            input.rect.x < 0 ||
            input.rect.y < 0 ||
            input.rect.width <= 0 ||
            input.rect.height <= 0 ||
            input.rect.x + input.rect.width > bounds.width ||
            input.rect.y + input.rect.height > bounds.height
          ) {
            throw new Error(
              "Screenshot rectangle must fit within the viewport",
            );
          }
        }
        const image = await win.webContents.capturePage(input.rect);
        return {
          data: image.toPNG().toString("base64"),
          width: image.getSize().width,
          height: image.getSize().height,
        };
      }, method === "export_design");
    }
    throw new Error("Unknown desktop command");
  }
  async inspectCanvas(input, read, forExport = false) {
    if (input.mode === "workspace" && input.componentUuid) {
      throw new Error(
        "Workspace captures use the current canvas; use artboard mode to inspect componentUuid without navigation",
      );
    }
    if (!input.componentUuid && !forExport) {
      return read(undefined);
    }
    const inspectionInput = {};
    if (input.componentUuid)
      inspectionInput.componentUuid = input.componentUuid;
    if (forExport) {
      inspectionInput.forExport = true;
      if (input.frameUuid) inspectionInput.frameUuid = input.frameUuid;
      else if (!input.componentUuid) {
        const frames = await canvasFrames(this.getWindow());
        const matching = input.artboardElementUuid
          ? frames.filter(({ layout }) =>
              layout.elements.some(
                (element) => element.elementUuid === input.artboardElementUuid,
              ),
            )
          : frames;
        inspectionInput.frameUuid =
          matching.length === 1
            ? matching[0].layout.frameUuid
            : (await this.editor("getEditorContext", {})).frameUuid;
        if (!inspectionInput.frameUuid)
          throw new Error("Select an artboard or specify frameUuid");
      }
    }
    const inspection = await this.editor(
      "beginCanvasInspection",
      inspectionInput,
    );
    try {
      return await read(inspection.inspectionId);
    } finally {
      await this.editor("endCanvasInspection", {
        inspectionId: inspection.inspectionId,
      });
    }
  }
  cancelPending(window, message) {
    for (const [id, request] of this.pending) {
      if (window && request.window !== window) continue;
      clearTimeout(request.timer);
      request.reject(new Error(message));
      this.pending.delete(id);
    }
  }
  close() {
    ipcMain.removeListener("desktop:result", this.receive);
    this.cancelPending(undefined, "Desktop closed");
  }
}
module.exports = { DesktopController };
