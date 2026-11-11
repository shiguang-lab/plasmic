const modelReads = new Set(["identify", "read", "listLibraries", "getLibrary", "searchLibraryComponents", "reviewComponentReuse", "queryElements", "readVector", "getEditorContext", "validate", "findEmptySpace"]);
const viewOperations = new Set(["navigate", "navigateCanvas", "restoreEditorView", "selectElement", "scrollElementIntoView", "setCanvasPageHeight", "setInteractiveMode"]);
const editableContext = { surface: "editor", previewKind: [null, "interactive"], canEdit: true };

function requiredContext(method, input = {}) {
  if (method === "browser" && input.action === "close") return null;
  if (method === "execute") {
    if (input.name === "setInteractiveMode") return { surface: "editor", previewKind: [null, "interactive"] };
    if (["preview", "executeBatch"].includes(input.name)) return null;
    if (modelReads.has(input.name) || input.name === "endCanvasInspection") return { surface: "editor" };
    if (input.name === "beginCanvasInspection") return { surface: "editor", ...(input.input?.componentUuid || input.input?.frameUuid ? {} : { previewKind: [null, "interactive"] }) };
    return viewOperations.has(input.name)
      ? { surface: "editor", previewKind: [null, "interactive"], ...(["selectElement", "scrollElementIntoView"].includes(input.name) ? { canvas: true } : {}) }
      : { ...editableContext };
  }
  if (method === "execute_batch") return input.operations?.some((op) => ["preview", "executeBatch"].includes(op.name)) ? null : { ...editableContext };
  if (method === "preview") {
    if (input.frameUuid !== undefined) return { surface: "editor", previewKind: "interactive" };
    return { surface: "editor", ...(input.action === "state" ? {}
      : input.action === "open" ? { previewKind: [null, "in-app"] }
      : input.action === "close" ? { previewKind: [null, "in-app", "interactive"] }
      : { mode: "preview", previewKind: ["back", "forward", "refresh"].includes(input.action) ? "in-app" : ["in-app", "interactive"] }) };
  }
  if (["get_editor_view"].includes(method)) return { surface: "editor" };
  if (["snapshot_layout", "get_screenshot", "export_design", "export_pages"].includes(method)) {
    if (["snapshot_layout", "get_screenshot"].includes(method) && input.frameUuid && !input.liveCanvas && input.mode !== "workspace") {
      return { surface: "editor" };
    }
    if (input.liveCanvas) return { surface: "editor", previewKind: [null, "interactive"] };
    return { surface: "editor", ...(input.componentUuid || method === "export_pages" ? {} : { previewKind: [null, "interactive"], ...(!input.frameUuid ? { canvas: true } : {}) }) };
  }
  if (["import_image", "import_svg", "export_code", "import_reference", "capture_browser", "browser"].includes(method)
    || method === "reference_browser" && input.action !== "close"
    || ["make_vector", "vectorize_image"].includes(method) && input.componentUuid) {
    return { ...editableContext };
  }
  if (method === "read_image") return { surface: "editor", previewKind: [null, "interactive"] };
  return null;
}

function currentContext(state, studioOrigin) {
  const editor = state.editorContext || {};
  let surface = state.projectId ? "editor" : "unavailable";
  let routeMode;
  let routeProjectId;
  if (state.url) {
    const url = new URL(state.url);
    routeProjectId = url.pathname.match(/^\/projects\/([^/]+)/)?.[1];
    if (studioOrigin && url.origin !== studioOrigin) surface = "other";
    else if (/\/(?:login|unified-login)(?:\/|$)/.test(url.pathname)) surface = "login";
    else if (/^\/(?:orgs|workspaces)(?:\/|$)/.test(url.pathname)) surface = "dashboard";
    else if (/^\/projects\/[^/]+(?:\/-\/[^/]+)?\/?$/.test(url.pathname)) surface = "editor";
    else if (/^(?:\/projects\/[^/]+\/preview\/?|\/d\/[\w-]{10})$/.test(url.pathname)) { surface = "editor"; routeMode = "preview"; }
    else surface = "other";
  }
  const mode = routeMode || editor.mode || null;
  return {
    surface, ready: state.ready === true, projectId: state.projectId ?? null,
    branchId: editor.branchId ?? null, sessionId: editor.sessionId ?? null,
    mode,
    previewKind: editor.previewKind || (routeMode ? "in-app" : null),
    canEdit: state.ready === true && surface === "editor" && (mode === "edit" || mode === "preview" && editor.previewKind === "interactive") && editor.canEdit === true,
    arenaId: editor.editorView?.arenaId ?? null,
    componentUuid: editor.componentUuid ?? null, frameUuid: editor.frameUuid ?? null,
    ...(editor.projectId && editor.projectId !== state.projectId ? { sessionProjectId: editor.projectId } : {}),
    ...(routeProjectId && routeProjectId !== state.projectId ? { routeProjectId } : {}),
  };
}

function contextError(required, actual, message, operationExecuted = false) {
  let recovery = [];
  if (actual.previewKind === "external") {
    message += " Close the external Preview window before using in-app tools.";
  } else if (required.previewKind === "interactive" && actual.surface === "editor" && actual.ready) {
    recovery = [
      ...(actual.previewKind === "in-app" ? [{ tool: "preview", arguments: { action: "close" } }] : []),
      { tool: "execute", arguments: { name: "setInteractiveMode", input: { enabled: true } } },
    ];
  } else if (actual.surface === "editor" && actual.ready && required.mode === "edit" && actual.mode === "preview") {
    recovery = [actual.previewKind === "interactive"
      ? { tool: "execute", arguments: { name: "setInteractiveMode", input: { enabled: false } } }
      : { tool: "preview", arguments: { action: "close" } }, { tool: "get_app_state", arguments: {} }];
  } else if (actual.surface === "editor" && actual.ready && required.mode === "preview") {
    recovery = [...(actual.previewKind === "interactive" ? [{ tool: "preview", arguments: { action: "close" } }] : []),
      { tool: "preview", arguments: { action: "open" }, requiresInput: ["componentUuid"] }, { tool: "preview", arguments: { action: "snapshot" } }];
  } else if (["interactive", "in-app"].includes(actual.previewKind) && Array.isArray(required.previewKind) && !required.previewKind.includes(actual.previewKind)) {
    recovery = [{ tool: "preview", arguments: { action: "close" } }];
  } else if (required.canvas && actual.mode === "edit" && actual.ready) {
    recovery = [{ tool: "execute", arguments: { name: "read", input: { collection: "components", fields: ["uuid", "name", "type", "pageMeta"] } } }];
  } else {
    recovery = [{ tool: "get_app_state", arguments: {} }];
  }
  return Object.assign(new Error(message), { context: {
    code: "CONTEXT_MISMATCH", operationExecuted, required, actual, recovery,
  } });
}

function assertContext(required, state, studioOrigin) {
  const actual = currentContext(state, studioOrigin);
  if (actual.surface !== required.surface || !actual.ready || actual.sessionProjectId || actual.routeProjectId
    || required.mode && required.mode !== actual.mode
    || required.previewKind && !(Array.isArray(required.previewKind) ? required.previewKind.includes(actual.previewKind) : required.previewKind === actual.previewKind)
    || required.canvas && !actual.arenaId && !actual.frameUuid
    || required.canEdit && !actual.canEdit) {
    throw contextError(required, actual,
      `Tool requires ${JSON.stringify(required)}; current context is ${JSON.stringify(actual)}. Use the explicit recovery tools; the requested operation was not executed.`);
  }
  return actual;
}

function errorPayload(error, depth = 0) {
  // WebFrameMain.executeJavaScript can reject with a string containing the
  // renderer's message and stack, even when the renderer threw an Error.
  return {
    message: typeof error?.message === "string" ? error.message : String(error),
    ...(typeof error?.name === "string" ? { name: error.name } : {}),
    ...(typeof error?.stack === "string" ? { stack: error.stack }
      : typeof error === "string" && error.includes("\n") ? { stack: error } : {}),
    ...(error?.cause !== undefined && depth < 4 ? { cause: errorPayload(error.cause, depth + 1) } : {}),
    ...(error?.context || {}),
  };
}

module.exports = { requiredContext, currentContext, assertContext, contextError, errorPayload };
