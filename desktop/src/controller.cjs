const { app, ipcMain, nativeImage } = require("electron");
const { randomUUID, createHash } = require("node:crypto");
const { EDITOR_METHODS } = require("./mcp.cjs");
const { canvasFrames, renderCanvas, exportCanvas } = require("./canvas.cjs");
const { encodeImagePreview } = require("./image-preview.cjs");
const { managementResult } = require("./management-result.cjs");
const { editorOutput, editorOutputSchema } = require("./editor-output.cjs");
const { DesignReference } = require("./design-reference.cjs");
const { runPreview, previewFrame, previewError } = require("./preview-runtime.cjs");
const { prototypeTools } = require("./prototype-mcp.cjs");
const { requiredContext, currentContext, assertContext, contextError } = require("./tool-context.cjs");
const { IslandActivity } = require("./island-activity.cjs");
const buildIdentity = (build) => createHash("sha256").update(JSON.stringify(build)).digest("hex");
function validateResourceId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid " + label);
  }
}
function resourceName(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Name must be a non-empty string");
  }
  return value.trim();
}
class DesktopController {
  constructor(
    getWindow,
    config,
    waitForStartup = async () => {},
    prepareSession = async () => {},
  ) {
    this.getWindow = getWindow;
    this.config = config;
    this.waitForStartup = waitForStartup;
    this.prepareSession = prepareSession;
    this.activity = new IslandActivity();
    this.operations = this.activity.operations;
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.references = new DesignReference(app.getPath("userData"));
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
  invoke(method, input = {}, timeout = 600000) {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      throw new Error("Open the desktop editor window");
    }
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            "Editor command timed out: " +
              method +
              (method === "beginCanvasInspection"
                ? ". The background canvas re-render did not finish; on heavy multi-artboard canvases, navigate the artboard into view and capture with get_screenshot mode workspace instead of pinning componentUuid/frameUuid."
                : ""),
          ),
        );
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
  async state(toolNames = []) {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) {
      return { running: true, windowOpen: false, ready: false };
    }
    let metadata = { ready: false, tools: {} };
    const url = new URL(win.webContents.getURL() || "about:blank");
    if (
      !win.webContents.isLoadingMainFrame() &&
      url.origin === this.config.studioOrigin &&
      url.pathname !== "/desktop/unified-login"
    ) {
      metadata = await this.invoke("metadata", { toolNames }, 3000);
    }
    return {
      running: true,
      windowOpen: true,
      version: require("../package.json").version,
      build: require("../renderer/desktop-assets.json").build,
      url: url.toString(),
      orgId: url.pathname.match(/^\/orgs\/([^/]+)/)?.[1] || null,
      workspaceId: url.pathname.match(/^\/workspaces\/([^/]+)/)?.[1] || null,
      projectId: url.pathname.match(/^\/projects\/([^/]+)/)?.[1] || null,
      ready: metadata.ready,
      editorTools: metadata.tools,
      availableEditorTools: metadata.availableEditorTools || [],
      editorContext: metadata.editorContext ?? null,
      operations: [...this.operations.values()].filter((operation) => operation.kind),
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
        new URL(win.webContents.getURL()).pathname === "/desktop/unified-login"
      ) {
        throw new Error("Sign in to Plasmic first");
      }
      try {
        const metadata = await this.invoke("metadata", { toolNames: [] }, 2000);
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
  async requestStudio(path, body) {
    const response = await this.getWindow().webContents.session.fetch(
      this.config.studioOrigin + path,
      {
        bypassCustomProtocolHandlers: true,
        credentials: "include",
        redirect: "manual",
        method: body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          ...(body === undefined
            ? {}
            : {
                "Content-Type": "application/json",
                Origin: this.config.studioOrigin,
              }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    if (!response.ok) {
      throw new Error(
        "NAS request failed: HTTP " +
          response.status +
          (response.status === 401 ||
          (response.status >= 300 && response.status < 400)
            ? "; sign in to Plasmic first"
            : response.status === 403
              ? "; access denied"
              : ""),
      );
    }
    return response.json();
  }
  async saveBeforeNavigation(state) {
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
  }
  referenceUrl(source) {
    if (typeof source !== "string" || !source.trim()) throw new Error("Load an explicit external HTTP(S) reference URL through reference_browser load_page first");
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Reference browsing requires an external HTTP(S) URL");
    if (url.origin === this.config.studioOrigin) throw new Error("Reference source must be external to Studio; use the authenticated preview tool for runtime inspection.");
    return url.href;
  }
  async requireReferenceEditor() {
    await this.checkContext("import_reference", {});
  }
  async checkContext(method, input) {
    const required = requiredContext(method, input);
    if (!required) return;
    let state;
    try { state = await this.state(); }
    catch (error) {
      const url = this.getWindow()?.webContents?.getURL?.();
      const projectId = url ? new URL(url).pathname.match(/^\/projects\/([^/]+)/)?.[1] : null;
      throw contextError(required, currentContext({ ready: false, projectId, url }, this.config.studioOrigin),
        "Cannot verify tool execution context: " + error.message);
    }
    const url = state.url || this.getWindow()?.webContents?.getURL?.();
    return assertContext(required, { ...state, ...(url ? { url } : {}) }, this.config.studioOrigin);
  }
  dispatch(method, input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return Promise.reject(new Error("Arguments must be an object"));
    const id = randomUUID();
    this.activity.enqueue(id, method, input);
    const run = async () => {
      this.activity.start(id);
      let failure;
      try {
        if (method === "report_task") {
          const state = await this.state();
          const context = currentContext(state, this.config.studioOrigin);
          if (context.surface !== "editor" || !context.ready || context.sessionProjectId || context.routeProjectId || context.projectId !== input.projectId) throw new Error("The task project is not open");
          return this.activity.reportTask(input, context.sessionId);
        }
        if (["get_app_state", "get_build_info", "get_image_service_status"].includes(method)) return await this.execute(method, input);
        await this.prepareSession();
        if (!["list_projects", "search_stock_images", "generate_image", "browser", "reference_browser", "import_reference", "design_reference", "capture_browser", "make_vector", "vectorize_image"].includes(method)) await this.waitForStartup();
        this.activity.bind(id, await this.checkContext(method, input), this.getWindow()?.webContents?.getURL?.());
        return await this.execute(method, input);
      } catch (error) {
        failure = error;
        if (method === "preview" || (method === "execute" && input?.name === "preview")) {
          failure = previewError(error, input, { phase: "controller" });
          throw failure;
        }
        throw error;
      } finally {
        this.activity.finish(id, failure);
      }
    };
    if (
      [
        "report_task",
        "get_app_state",
        "get_build_info",
        "get_image_service_status",
        "get_org",
        "list_orgs",
        "list_workspaces",
        "list_projects",
        "search_stock_images",
        "generate_image",
      ].includes(method) ||
      method === "design_reference" ||
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
    if (["get_org", "list_orgs", "create_org", "create_workspace", "list_workspaces", "create_project", "list_projects"].includes(method)
      && Object.hasOwn(input, "view")) {
      throw new Error("Management tools return resource identities only; view is not supported");
    }
    if (method === "get_build_info") {
      const build = require("../renderer/desktop-assets.json").build;
      const fields = ["kind", "revision", "dirty", "builtAt", "sourceHash", "rendererHash", "desktopHash"];
      return { version: require("../package.json").version, buildId: buildIdentity(build),
        build: Object.fromEntries(fields.filter((key) => Object.hasOwn(build, key)).map((key) => [key, build[key]])) };
    }
    if (method === "get_image_service_status") return require("./image-service.cjs").imageServiceStatus(app.getPath("userData"));
    if (method === "get_app_state") {
      const { toolNames = [], schemaView = "input", view = "status" } = input;
      if (!["status", "tools"].includes(view)) throw new Error("Invalid app state view");
      if (!["input", "full"].includes(schemaView)) throw new Error("schemaView must be input or full");
      if (toolNames !== undefined && (!Array.isArray(toolNames) ||
          toolNames.some((name) => typeof name !== "string" || !name) ||
          new Set(toolNames).size !== toolNames.length)) {
        throw new Error("toolNames must be an array of distinct nonempty strings");
      }
      const state = await this.state(toolNames.filter((name) => name !== "executeBatch" || schemaView === "full"));
      if (toolNames.length && !state.ready) throw contextError({ surface: "editor" }, currentContext(state, this.config.studioOrigin), "Open the intended design before requesting editor contracts");
      const availableEditorTools = (state.availableEditorTools || []).filter((name) => EDITOR_METHODS.includes(name));
      for (const name of toolNames) {
        if (!availableEditorTools.includes(name)) {
          throw new Error(`Editor schema unavailable: ${name}`);
        }
      }
      const contracts = Object.fromEntries(toolNames.map((name) => {
          if (name === "executeBatch" && schemaView === "input") return [name, { mcpTool: "execute_batch" }];
          const { outputSchema, ...contract } = state.editorTools[name];
          return [name, schemaView === "full" ? { ...contract, outputSchema: editorOutputSchema(name, outputSchema) } : contract];
        }));
      const pick = (value, keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
      const identity = { ...pick(state, ["ready", "version", "orgId", "workspaceId", "projectId"]),
        context: currentContext(state, this.config.studioOrigin),
        ...(state.build ? { buildId: buildIdentity(state.build) } : {}),
        ...(state.editorContext ? { editorContext: pick(state.editorContext, ["branchId", "sessionId"]) } : {}),
      };
      if (toolNames.length || view === "tools") return {
        ...identity,
        runtimeCapabilities: Object.fromEntries(prototypeTools.map((tool) => [tool.name, tool.inputSchema.properties.action.enum])),
        ...(toolNames.length ? { editorTools: contracts } : { availableEditorTools }),
      };
      return {
        ...identity, ...pick(state, ["running", "windowOpen"]),
        ...(state.editorContext ? { editorContext: pick(state.editorContext, ["projectName", "branchId", "sessionId", "revision", "changeCounter", "componentUuid", "frameUuid", "selectedElementUuids", "mode", "canEdit", "previewContext"]) } : {}),
        ...(state.operations?.length ? { operations: state.operations } : {}),
      };
    }
    const win = this.getWindow();
    if (!win || win.isDestroyed()) {
      throw new Error("Open the desktop editor window");
    }
    if (method === "design_reference") return this.references.read(input);
    if (method === "preview") {
      const diagnostics = { phase: "validation", operationExecuted: false };
      try {
      const allowed = { open: ["componentUuid", "width", "height"], close: [], back: [], forward: [], refresh: [], state: [], snapshot: ["offset", "limit", "textOffset", "textLimit"], click: ["ref"], hover: ["ref"], fill: ["ref", "value"], select: ["ref", "value"], press: ["ref", "key"], scroll: ["ref", "x", "y"], screenshot: ["fullResolution"], assert: ["checks", "timeoutMs"] };
      if (!allowed[input.action] || Object.keys(input).some((key) => key !== "action" && !allowed[input.action].includes(key))) throw new Error("Invalid parameters for Preview action");
      if (["click", "hover", "fill", "select", "press"].includes(input.action) && !input.ref) throw new Error("Preview interaction requires a current snapshot ref");
      if (["fill", "select"].includes(input.action) && typeof input.value !== "string") throw new Error("Preview input requires a value string");
      if (input.action === "press" && !input.key) throw new Error("Preview press requires key");
      if (input.action === "assert" && !input.checks?.length) throw new Error("Preview assert requires checks");
      const before = await this.editor("getEditorContext");
      diagnostics.editorContext = before;
      let result;
      if (["open", "close", "back", "forward", "refresh"].includes(input.action)) {
        const { action, componentUuid, width, height } = input;
        diagnostics.phase = "transition"; diagnostics.operationExecuted = null;
        result = await this.editor("preview", { action, ...(componentUuid ? { componentUuid } : {}), ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) });
        diagnostics.operationExecuted = true;
        if (input.action !== "close") {
          diagnostics.phase = "frame-discovery";
          await previewFrame(win, result.componentUuid);
        }
      } else {
        if (input.action === "state" && (before.mode !== "preview" || !before.previewContext?.componentUuid)) result = { ready: false };
        else result = await runPreview(win, input, before);
      }
      diagnostics.phase = "context-read";
      if (input.action !== "state") diagnostics.operationExecuted = true;
      const after = await this.editor("getEditorContext");
      // An autosave already in flight can advance revision without a model edit.
      if (["projectId", "branchId", "sessionId", "changeCounter"].some((key) => before[key] !== after[key])) throw new Error("Preview operation changed the saved design/session; inspect the model before continuing");
      const actual = currentContext({ ready: true, projectId: after.projectId, editorContext: after, url: win.webContents?.getURL?.() }, this.config.studioOrigin);
      if (["open", "close"].includes(input.action) && (actual.surface !== "editor" || actual.routeProjectId || actual.sessionProjectId || actual.mode !== (input.action === "close" ? "edit" : "preview"))) {
        throw contextError({ surface: "editor", mode: input.action === "close" ? "edit" : "preview" },
          actual,
          "Preview transition did not reach the requested mode; inspect current state before retrying", null);
      }
      return { ...result,
        canGoBack: after.previewContext?.canGoBack ?? false,
        canGoForward: after.previewContext?.canGoForward ?? false,
        ...(input.action === "close" ? { view: after.editorView ?? null } : {}),
        context: Object.fromEntries(["projectId", "branchId", "sessionId", "revision", "changeCounter", "componentUuid", "frameUuid", "mode", "previewKind", "previewContext"].map((key) => [key, after[key]])) };
      } catch (error) {
        throw previewError(error, input, diagnostics);
      }
    }
    if (method === "get_org") {
      validateResourceId(input.orgId, "orgId");
      return managementResult(await this.requestStudio("/api/v1/teams/" + input.orgId));
    }
    if (method === "list_orgs") {
      const query =
        input.query === undefined
          ? undefined
          : resourceName(input.query).toLowerCase();
      const result = await this.requestStudio("/api/v1/teams");
      if (query !== undefined) {
        const teams = result.teams.filter((team) =>
          team.name.toLowerCase().includes(query),
        );
        return managementResult({
          ...result,
          teams,
        });
      }
      return managementResult(result);
    }
    if (method === "create_org") {
      return managementResult(await this.requestStudio("/api/v1/teams", {
        name: resourceName(input.name),
      }));
    }
    if (method === "create_workspace") {
      validateResourceId(input.orgId, "orgId");
      if (
        input.description !== undefined &&
        typeof input.description !== "string"
      ) {
        throw new Error("Description must be a string");
      }
      const result = await this.requestStudio("/api/v1/workspaces", {
        teamId: input.orgId,
        name: resourceName(input.name),
        description: input.description,
      });
      if (result.paywall !== "pass") {
        throw new Error(
          "Cannot create workspace: plan restriction (" +
            result.paywall +
            (result.description ? ": " + result.description : "") +
            ")",
        );
      }
      return managementResult(result.response);
    }
    if (method === "list_workspaces") {
      if (input.orgId !== undefined) {
        validateResourceId(input.orgId, "orgId");
        return managementResult(await this.requestStudio(
          "/api/v1/teams/" + input.orgId + "/workspaces",
        ));
      }
      return managementResult(await this.requestStudio("/api/v1/workspaces"));
    }
    if (method === "create_project") {
      if (input.workspaceId !== undefined) {
        validateResourceId(input.workspaceId, "workspaceId");
      }
      return managementResult(await this.requestStudio("/api/v1/projects", {
        name: resourceName(input.name),
        workspaceId: input.workspaceId,
      }));
    }
    if (method === "open_org" || method === "open_workspace") {
      const isOrg = method === "open_org";
      const key = isOrg ? "orgId" : "workspaceId";
      const id = input[key];
      validateResourceId(id, key);
      await this.requestStudio(
        isOrg
          ? "/api/v1/teams/" + id + "/workspaces"
          : "/api/v1/workspaces/" + id,
      );
      const url =
        this.config.studioOrigin + (isOrg ? "/orgs/" : "/workspaces/") + id;
      const state = await this.state([]);
      if (state.url !== url) {
        await this.saveBeforeNavigation(state);
        await win.loadURL(url);
      }
      if (win.webContents.getURL() !== url) {
        throw new Error(
          "The requested " +
            (isOrg ? "organization" : "workspace") +
            " page did not open",
        );
      }
      return { opened: true, [key]: id, url };
    }
    if (method === "list_projects") {
      const url = new URL("/api/v1/projects", this.config.studioOrigin);
      url.searchParams.set(
        "query",
        JSON.stringify(input.workspaceId === undefined ? "all" : "byWorkspace"),
      );
      if (input.workspaceId !== undefined) {
        validateResourceId(input.workspaceId, "workspaceId");
        url.searchParams.set("workspaceId", JSON.stringify(input.workspaceId));
      }
      return managementResult(await this.requestStudio(url.pathname + url.search));
    }
    if (method === "open_design") {
      if (
        typeof input.projectId !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(input.projectId)
      ) {
        throw new Error("Invalid projectId");
      }
      const state = await this.state([]);
      if (state.projectId !== input.projectId || input.reopen === true) {
        await this.saveBeforeNavigation(state);
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
      return { opened: true, projectId: identity.projectId, projectName: identity.projectName, canEdit: identity.canEdit };
    }
    if (method === "execute_batch") {
      if (input.operations.some((op) => ["preview", "executeBatch"].includes(op.name))) throw new Error("Use top-level preview for runtime operations and execute_batch for one native mutation batch");
      return this.editor("executeBatch", { operations: input.operations });
    }
    if (method === "execute") {
      if (["preview", "executeBatch"].includes(input.name)) throw new Error("Use top-level preview or execute_batch so operation context is checked");
      try { return editorOutput(input.name, await this.editor(input.name, input.input)); }
      catch (error) {
        if (["insertHtml", "changeElement", "updateState"].includes(input.name)) error.message += ". Read the affected registered component contract (view:contract) and owning state/event context (view:context); correct this operation without changing the source expectations.";
        throw error;
      }
    }
    if (method === "get_editor_view") {
      const context = await this.editor("getEditorContext");
      return { projectId: context.projectId, branchId: context.branchId, sessionId: context.sessionId, view: context.editorView ?? null };
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
      const fetchBundle = async (projectId, componentIds) => {
        const response = await win.webContents.session.fetch(
          this.config.studioOrigin +
            "/api/v1/projects/" +
            encodeURIComponent(projectId) +
            "/code/components",
          {
            ...options,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: this.config.studioOrigin,
            },
            body: JSON.stringify({
              platform: "react",
              version: "latest",
              componentIdOrNames: componentIds,
              imageOpts: { scheme: "files" },
              stylesOpts: { scheme: "css" },
            }),
          },
        );
        if (!response.ok) {
          throw new Error(
            "NAS React code generation failed: HTTP " + response.status,
          );
        }
        return response.json();
      };
      const {
        writeCodeBundle,
        getCssDependencyIds,
      } = require("./code-export.cjs");
      const resolved = await win.webContents.session.fetch(
        this.config.studioOrigin + "/api/v1/code/resolve-sync",
        {
          ...options,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: this.config.studioOrigin,
          },
          body: JSON.stringify({
            projects: [
              {
                projectId: identity.projectId,
                versionRange: "latest",
                componentIdOrNames: input.componentUuids,
              },
            ],
            recursive: true,
          }),
        },
      );
      if (!resolved.ok) {
        throw new Error(
          "React dependency resolution failed: HTTP " + resolved.status,
        );
      }
      const resolution = await resolved.json();
      const project = resolution.projects.find(
        (item) => item.projectId === identity.projectId,
      );
      if (!project) {
        throw new Error("Codegen did not resolve the active project");
      }
      const bundle = await fetchBundle(
        identity.projectId,
        project.componentIds,
      );
      const dependencies = [];
      const seen = new Set([identity.projectId]);
      const pending = [bundle];
      for (const current of pending) {
        for (const projectId of getCssDependencyIds(current)) {
          if (!seen.has(projectId)) {
            seen.add(projectId);
            const dependency = await fetchBundle(projectId, []);
            dependencies.push(dependency);
            pending.push(dependency);
          }
        }
      }
      for (const current of [bundle, ...dependencies]) {
        for (const asset of current.imageAssets || []) {
          if (/^https?:\/\//.test(asset.blob)) {
            const url = new URL(asset.blob);
            const response = await win.webContents.session.fetch(url.href, {
              bypassCustomProtocolHandlers: true,
              credentials:
                url.origin === this.config.studioOrigin ? "include" : "omit",
            });
            if (!response.ok) {
              throw new Error(
                `Image download failed: ${asset.fileName} (HTTP ${response.status})`,
              );
            }
            asset.blob = Buffer.from(await response.arrayBuffer()).toString(
              "base64",
            );
          }
        }
      }
      return writeCodeBundle(input.outputPath, bundle, dependencies);
    }
    if (method === "reference_browser" || method === "import_reference") {
      if (!this.browser) throw new Error("The desktop reference browser is not ready");
      if (method === "reference_browser" && input.action === "close") return this.browser.command(input);
      if (method === "reference_browser" && !["load_page", "get_state", "select_element", "set_import_height", "capture", "cdp"].includes(input.action)) throw new Error("Use reference_browser load_page with an explicit external URL; a source-free open is not supported");
      const source = method === "reference_browser" && input.action === "load_page" ? input.url : this.browser.state.url;
      this.referenceUrl(source);
      if (method === "import_reference") {
        if (!["editable", "screenshot"].includes(input.action)) throw new Error("Invalid reference import mode");
        if (input.action === "editable" && input.target === "visible_area") throw new Error("Editable import supports full_page or selection");
        return this.browser.command({ ...input, action: input.action === "editable" ? "import_to_canvas" : "screenshot_to_canvas" });
      }
      if (input.action === "cdp") {
        const methods = new Set(["DOM.getDocument", "DOM.getFlattenedDocument", "DOM.describeNode", "DOM.getOuterHTML", "DOM.getAttributes", "DOM.getBoxModel", "DOM.getContentQuads", "DOM.querySelector", "DOM.querySelectorAll", "CSS.getComputedStyleForNode", "CSS.getMatchedStylesForNode", "Accessibility.getFullAXTree", "Accessibility.getPartialAXTree", "Page.captureScreenshot"]);
        if (input.method === "Runtime.evaluate") input = { ...input, params: { ...input.params, throwOnSideEffect: true, awaitPromise: false } };
        else if (!methods.has(input.method)) throw new Error("reference_browser CDP is read-only; use native preview for interactions");
      }
      return this.browser.command(input);
    }
    if (method === "browser") {
      if (!this.browser)
        throw new Error("The desktop reference browser is not ready");
      if (input.action === "load_page") this.referenceUrl(input.url);
      return this.browser.command(input);
    }
    if (method === "capture_browser") {
      this.referenceUrl(input.url);
      return require("./browser-capture.cjs").captureBrowser(input);
    }
    if (method === "import_image") {
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
      return this.uploadImage(bytes, path.parse(input.path).name);
    }
    if (method === "read_image") {
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
      return encodeImagePreview(image.toPNG());
    }
    if (method === "export_pages") {
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
        const rendered = await this.inspectCanvas(
          page,
          (inspectionId) =>
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
      if (input.fullContent && input.mode === "workspace") {
        throw new Error("fullContent requires artboard mode; workspace captures only the visible editor");
      }
      return this.inspectCanvas(
        input,
        async (inspectionId) => {
          if (method === "snapshot_layout") {
            const frames = (await canvasFrames(win, inspectionId))
              .filter(({ layout }) => !input.frameUuid || layout.frameUuid === input.frameUuid);
            if (input.frameUuid && !frames.length) throw new Error("Requested frame has no rendered layout");
            return {
              check: "layout",
              checked: ["horizontal-overflow", "table-cell-control-overflow", "image-load"],
              notChecked: [
                "interactions",
                "responsive-breakpoints",
                "content-overlap",
              ],
              frames: frames.map(({ layout }) => require("./layout-read.cjs").readLayout(layout, input)),
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
              ...(await encodeImagePreview(result.image.toPNG(), { lossless: input.fullResolution ?? input.fullContent ?? false })),
              rendering: "static",
              sourceViewport: result.sourceViewport,
              resized: result.resized,
              ...(result.fullContent ? { fullContent: result.fullContent } : {}),
            };
          }
          if (input.elementUuid) {
            throw new Error("elementUuid requires artboard mode");
          }
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
          return encodeImagePreview(image.toPNG(), { lossless: input.fullResolution === true });
        },
        method === "export_design",
      );
    }
    throw new Error("Unknown desktop command");
  }
  async browserImportContext() {
    await this.ready();
    const context = await this.editor("getEditorContext");
    if (!context.canEdit || context.mode !== "edit")
      throw new Error("Open an editable current project before importing");
    return {
      projectId: context.projectId,
      destinationName: context.browserImportCanvasName,
      ...(context.editorView
        ? {
            sourceArena: {
              id: context.editorView.arenaId,
              type: context.editorView.arenaType,
            },
          }
        : {}),
    };
  }
  async importBrowserHtml(input) {
    const result = await this.editor("importWebPage", input);
    const context = await this.editor("getEditorContext");
    return {
      ...result,
      projectId: input.projectId,
      changeCounter: context.changeCounter,
    };
  }
  async locateBrowserImport(result) {
    if (!result) throw new Error("Import a page first");
    const context = await this.editor("getEditorContext");
    if (context.projectId !== result.projectId)
      throw new Error("Reopen the imported project first");
    await this.editor("navigateCanvas", {
      canvasName: result.canvasName,
      frameUuid: result.frameUuid,
    });
    if (result.elementUuids[0])
      await this.editor("selectElement", {
        componentUuid: result.componentUuid,
        elementUuid: result.elementUuids[0],
        frameUuid: result.frameUuid,
      });
    this.getWindow().show();
    return { located: true };
  }
  async undoBrowserImport(result) {
    if (!result) throw new Error("Import a page first");
    const context = await this.editor("getEditorContext");
    if (
      context.projectId !== result.projectId ||
      context.changeCounter !== result.changeCounter
    )
      throw new Error(
        "The design changed after import; use Studio undo history instead",
      );
    return this.editor("undo");
  }
  async uploadImage(bytes, name = "WebScreenshot") {
    if (bytes.length > 10 * 1024 * 1024)
      throw new Error("Image exceeds 10 MiB");
    const win = this.getWindow();
    const image = nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) {
      throw new Error("Image format cannot be decoded");
    }
    const options = {
      bypassCustomProtocolHandlers: true,
      credentials: "include",
    };
    const body = new FormData();
    body.append(
      "file",
      new Blob([image.toPNG()], { type: "image/png" }),
      name + ".png",
    );
    const response = await win.webContents.session.fetch(
      this.config.studioOrigin + "/api/v1/image/upload",
      {
        ...options,
        method: "POST",
        body,
        headers: { Origin: this.config.studioOrigin },
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
  async inspectCanvas(input, read, forExport = false) {
    if (input.mode === "workspace" && (input.componentUuid || input.frameUuid)) {
      throw new Error(
        "Workspace captures use the current canvas; use artboard mode to inspect componentUuid/frameUuid without navigation",
      );
    }
    if (!input.componentUuid && !input.frameUuid && !forExport) {
      return read(undefined);
    }
    const inspectionInput = {};
    if (input.componentUuid) {
      inspectionInput.componentUuid = input.componentUuid;
    }
    if (input.frameUuid) {
      inspectionInput.frameUuid = input.frameUuid;
    }
    if (forExport) {
      inspectionInput.forExport = true;
      if (!input.frameUuid && !input.componentUuid) {
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
        if (!inspectionInput.frameUuid) {
          throw new Error("Select an artboard or specify frameUuid");
        }
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
      if (window && request.window !== window) {
        continue;
      }
      clearTimeout(request.timer);
      request.reject(new Error(message));
      this.pending.delete(id);
    }
  }
  close() {
    this.browser?.dispose();
    void this.references.close().catch(() => {});
    ipcMain.removeListener("desktop:result", this.receive);
    this.cancelPending(undefined, "Desktop closed");
  }
}
module.exports = { DesktopController };
