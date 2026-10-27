const reads = new Set(["read", "queryElements", "readVector", "validate", "findEmptySpace", "beginCanvasInspection"]);
const passive = new Set(["identify", "getEditorContext", "endCanvasInspection"]);
const operationLabels = {
  create_project: "Creating project", create_workspace: "Creating workspace", create_org: "Creating organization",
  open_design: "Opening project", open_workspace: "Opening workspace", open_org: "Opening organization",
  list_projects: "Reading projects", list_workspaces: "Reading workspaces", list_orgs: "Reading organizations", get_org: "Reading organizations",
  generate_image: "Generating image", search_stock_images: "Searching images", export_code: "Exporting code",
};
const quiet = new Set(["get_app_state", "get_build_info", "get_image_service_status", "report_task"]);
const view = new Set(["navigate", "navigateCanvas", "restoreEditorView", "selectElement", "scrollElementIntoView"]);

function operationTargets(method, input = {}) {
  const target = (value) => Object.fromEntries(["componentUuid", "elementUuid", "frameUuid", "ref"].flatMap((key) => typeof value?.[key] === "string" ? [[key, value[key]]] : []));
  if (method === "execute_batch") return Array.isArray(input.operations) ? input.operations.flatMap((op) => op && typeof op === "object" ? operationTargets("execute", op) : []) : [];
  const value = method === "execute" ? input.input || {} : input;
  if (value.fromProject) return [];
  if (method === "preview") return typeof input.ref === "string" ? [target(input)] : [{ viewport: true }];
  if (method === "export_pages") return Array.isArray(input.pages) ? input.pages.map(target).filter((t) => t.componentUuid) : [];
  if (Array.isArray(value.elements) && value.elements.length) return value.elements.map(target).filter((t) => t.componentUuid);
  if (Array.isArray(value.componentUuids) && value.componentUuids.length) return value.componentUuids.filter((id) => typeof id === "string").map((componentUuid) => ({ componentUuid }));
  if (typeof value.componentUuid === "string" || typeof value.frameUuid === "string") return [target(value)];
  return operationKind(method, input) === "read" ? [{ viewport: true }] : [];
}

function operationKind(method, input = {}) {
  if (method === "preview") return ["state"].includes(input.action) ? null
    : ["snapshot", "screenshot", "assert"].includes(input.action) ? "read" : "preview";
  if (method === "execute") return passive.has(input.name) ? null
    : reads.has(input.name) ? "read" : view.has(input.name) ? "view" : input.name === "save" ? "save" : "write";
  if (["snapshot_layout", "get_screenshot", "export_design", "export_pages", "read_image"].includes(method)) return "read";
  if (["make_vector", "vectorize_image"].includes(method)) return input.componentUuid ? "write" : "resource";
  if (["execute_batch", "import_image", "import_svg", "import_reference"].includes(method)) return "write";
  return quiet.has(method) ? null : "resource";
}

/** Ephemeral desktop activity. Never written into a design or its undo history. */
class IslandActivity {
  operations = new Map();
  listeners = new Set();
  latest = null;
  task = null;
  idleUntil = null;
  expansionDismissed = false;
  keepExpanded(now = performance.now()) {
    return !this.expansionDismissed && (this.operations.size > 0 || this.idleUntil !== null && now < this.idleUntil);
  }
  dismissExpansion() {
    this.expansionDismissed = true;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    for (const listener of this.listeners) listener();
  }
  enqueue(id, method, input, caller) {
    const operation = { id, method, operation: method === "execute" ? input.name : input.action || method,
      kind: operationKind(method, input), label: operationLabels[method], ...(caller ? { caller } : {}),
      ...(["create_project", "create_workspace", "create_org"].includes(method) && typeof input.name === "string" ? { subject: input.name.trim().slice(0, 120) } : {}), targets: operationTargets(method, input), phase: "queued" };
    this.operations.set(id, operation);
    this.expansionDismissed = false;
    this.notify();
  }
  start(id) {
    const operation = this.operations.get(id);
    if (!operation) return;
    Object.assign(operation, { phase: "running", startedAt: new Date().toISOString() });
    if (operation.kind) this.notify();
  }
  bind(id, context, url) {
    const operation = this.operations.get(id);
    if (operation && context) {
      Object.assign(operation, { projectId: context.projectId, sessionId: context.sessionId, mode: context.mode, arenaId: context.arenaId, url });
      if (operation.kind) this.notify();
    }
  }
  finish(id, error) {
    const operation = this.operations.get(id);
    if (!operation) return;
    this.operations.delete(id);
    // Start the idle lease only after the whole queue/concurrent group has drained.
    // A monotonic clock keeps wall-clock changes from shortening or extending it.
    if (!this.operations.size) this.idleUntil = performance.now() + 10 * 60 * 1000;
    if (operation.kind) this.latest = { ...operation, phase: error ? "failed" : "completed", finishedAt: Date.now(),
      ...(error ? { error: String(error.message || error).slice(0, 1600),
        blocked: error.context?.runtimeAvailable === false,
        code: error.context?.code } : {}) };
    this.notify();
  }
  reportTask(input, sessionId) {
    const allowed = ["taskId", "projectId", "sequence", "title", "stage", "status", "stageIndex", "stageCount", "error"];
    if (!input || Object.keys(input).some((key) => !allowed.includes(key)) ||
      !["taskId", "projectId", "title"].every((key) => typeof input[key] === "string" && input[key].trim() && input[key].length <= 240) ||
      !Number.isSafeInteger(input.sequence) || input.sequence < 0 ||
      !["running", "blocked", "completed", "failed"].includes(input.status) ||
      input.stage !== undefined && (typeof input.stage !== "string" || input.stage.length > 240) ||
      input.error !== undefined && (typeof input.error !== "string" || input.error.length > 1600) ||
      (input.stageIndex !== undefined || input.stageCount !== undefined) &&
        (!Number.isSafeInteger(input.stageIndex) || !Number.isSafeInteger(input.stageCount) || input.stageCount < 1 || input.stageIndex < 1 || input.stageIndex > input.stageCount)) {
      throw new Error("Invalid task activity");
    }
    const sameTask = this.task?.taskId === input.taskId && this.task.projectId === input.projectId && this.task.sessionId === sessionId;
    if (sameTask && input.sequence <= this.task.sequence) return { accepted: false };
    if (!sameTask && input.status !== "running") throw new Error("Start the task before reporting its result");
    this.task = { ...input, sessionId, ...(["completed", "failed"].includes(input.status) ? { finishedAt: Date.now() } : {}) };
    this.notify();
    return { accepted: true };
  }
  snapshot(projectId, sessionId, now = Date.now()) {
    const matches = (op) => (!op.projectId || op.projectId === projectId) && (!op.sessionId || op.sessionId === sessionId);
    const active = [...this.operations.values()].filter((op) => op.kind && matches(op));
    const operation = active.find((op) => op.phase === "running") || active[0] ||
      (this.latest && matches(this.latest) && (this.latest.phase === "failed" || now - this.latest.finishedAt < 2200) ? this.latest : null);
    const task = this.task?.projectId === projectId && matches(this.task) && (!this.task.finishedAt || now - this.task.finishedAt < 2200) ? this.task : null;
    return { operation, task, queued: active.filter((op) => op.phase === "queued").length,
      running: active.filter((op) => op.phase === "running").length };
  }
}
module.exports = { IslandActivity, operationKind, operationTargets };
