const modelReads = new Set(["identify", "read", "queryElements", "readVector", "getEditorContext", "validate", "findEmptySpace"]);
const viewOperations = new Set(["navigate", "navigateCanvas", "restoreEditorView", "selectElement", "scrollElementIntoView"]);

function requiredContext(method, input = {}) {
  if (method === "browser" && input.action === "close") return null;
  if (method === "execute") {
    if (["preview", "executeBatch"].includes(input.name)) return null;
    if (modelReads.has(input.name) || input.name === "endCanvasInspection") return { surface: "editor" };
    if (input.name === "beginCanvasInspection") return { surface: "editor", ...(input.input?.componentUuid ? {} : { mode: "edit" }) };
    return { surface: "editor", mode: "edit", ...(["selectElement", "scrollElementIntoView"].includes(input.name) ? { canvas: true } : {}), ...(viewOperations.has(input.name) ? {} : { canEdit: true }) };
  }
  if (method === "execute_batch") return input.operations?.some((op) => ["preview", "executeBatch"].includes(op.name)) ? null : { surface: "editor", mode: "edit", canEdit: true };
  if (method === "preview") {
    return { surface: "editor", ...(input.action === "state" ? {}
      : input.action === "open" ? { previewKind: [null, "in-app"] }
      : input.action === "close" ? { previewKind: [null, "in-app", "interactive"] }
      : { mode: "preview", previewKind: "in-app" }) };
  }
  if (["get_editor_view"].includes(method)) return { surface: "editor" };
  if (["snapshot_layout", "get_screenshot", "export_design", "export_pages"].includes(method)) {
    return { surface: "editor", ...(input.componentUuid || method === "export_pages" ? {} : { mode: "edit", ...(!input.frameUuid ? { canvas: true } : {}) }) };
  }
  if (["import_image", "import_svg", "export_code", "import_reference", "capture_browser", "browser"].includes(method)
    || method === "reference_browser" && input.action !== "close"
    || ["make_vector", "vectorize_image"].includes(method) && input.componentUuid) {
    return { surface: "editor", mode: "edit", canEdit: true };
  }
  if (method === "read_image") return { surface: "editor", mode: "edit" };
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
    else if (/^\/projects\/[^/]+\/preview(?:\/|$|-full(?:\/|$))/.test(url.pathname)) { surface = "editor"; routeMode = "preview"; }
    else surface = "other";
  }
  const mode = routeMode || editor.mode || null;
  return {
    surface, ready: state.ready === true, projectId: state.projectId ?? null,
    branchId: editor.branchId ?? null, sessionId: editor.sessionId ?? null,
    mode,
    previewKind: editor.previewKind || (routeMode ? "in-app" : null),
    canEdit: state.ready === true && surface === "editor" && mode === "edit" && editor.canEdit === true,
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
  } else if (actual.surface === "editor" && actual.ready && required.mode === "edit" && actual.mode === "preview") {
    recovery = [{ tool: "preview", arguments: { action: "close" } }, { tool: "get_app_state", arguments: {} }];
  } else if (actual.surface === "editor" && actual.ready && required.mode === "preview") {
    recovery = [...(actual.previewKind === "interactive" ? [{ tool: "preview", arguments: { action: "close" } }] : []),
      { tool: "preview", arguments: { action: "open" }, requiresInput: ["componentUuid"] }, { tool: "preview", arguments: { action: "snapshot" } }];
  } else if (actual.previewKind === "interactive" && Array.isArray(required.previewKind)) {
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

function errorPayload(error) {
  return { message: error.message, ...(error.context || {}) };
}

module.exports = { requiredContext, currentContext, assertContext, contextError, errorPayload };
