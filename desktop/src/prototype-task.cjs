const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonical = (value) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const valueHash = (value) => hash(canonical(value));
const identity = (context) => Object.fromEntries(["projectId", "branchId", "sessionId", "revision", "changeCounter"].map((key) => [key, context[key]]));
// Match Python Path.resolve() for planned intents that do not exist yet.
async function plannedPath(file) {
  try { return await fs.realpath(file); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return path.join(await plannedPath(path.dirname(file)), path.basename(file));
  }
}
const edits = new Set(["insertHtml", "importWebPage", "changeElement", "deleteElement", "createState", "updateState", "deleteState", "createInteraction", "updateInteraction", "deleteInteraction", "copyElement", "moveElement", "updateVector", "deleteComponent", "createComponent", "createStyleToken", "updateStyleToken", "deleteStyleToken", "createVariant", "createVariantGroup", "createGlobalVariant", "createGlobalVariantGroup", "createBreakpoint", "deleteBreakpoint", "setPageViewport", "createCanvas", "deleteCanvas", "updateCanvas", "createArtboard", "updateArtboard", "installLibrary", "upgradeLibrary", "undo"]);

// Task-local evidence/ordering, never a persisted Studio model or property schema.
class PrototypeTask {
  constructor(profile, editor, build) { Object.assign(this, { profile, editor, build }); }
  get active() { return !!this.run && !this.run.ended; }
  status() {
    if (!this.active) return null;
    const r = this.run, page = r.pages.find((p) => p.path === r.current);
    return { runId: r.id, currentPage: r.current, phase: page?.phase || "reference-planning", completedPages: r.pages.filter((p) => p.phase === "complete").length, totalPages: r.pages.length,
      pendingCases: page ? (page.runtimeCases || []).filter((c) => !c.deferred && !page.cases[c.id]).map((c) => c.id) : [],
      pendingDeferredCases: r.pages.flatMap((p) => p.runtimeCases.filter((c) => c.deferred && !p.cases[c.id]).map((c) => ({ pagePath: p.path, caseId: c.id }))),
      ...(r.currentCase ? { activeCase: { pagePath: r.currentCase.page, id: r.currentCase.id, step: r.currentCase.step } } : {}), evidenceDirectory: r.directory, metrics: r.metrics };
  }
  expectedTarget() {
    const current = this.run?.currentCase;
    return current ? this.run.pages.find((p) => p.path === current.page).runtimeCases.find((c) => c.id === current.id).steps[current.step] : undefined;
  }
  async pin(file) {
    const absolute = await fs.realpath(file), bytes = await fs.readFile(absolute);
    const digest = hash(bytes);
    if (this.run.pinned[absolute] && this.run.pinned[absolute] !== digest) throw new Error("Reviewed task input changed; start a new task with the revised plan: " + absolute);
    this.run.pinned[absolute] = digest;
    return JSON.parse(bytes);
  }
  async stablePlan() {
    for (const [file, digest] of Object.entries(this.run.pinned)) if (hash(await fs.readFile(file)) !== digest) throw new Error("Reviewed task input changed: " + file);
  }
  async event(kind, detail = {}) {
    const record = { seq: ++this.run.seq, time: new Date().toISOString(), kind, ...detail };
    await fs.appendFile(path.join(this.run.directory, "events.jsonl"), JSON.stringify(record) + "\n", { mode: 0o600 });
    const temporary = path.join(this.run.directory, "task.json.tmp");
    await fs.writeFile(temporary, JSON.stringify(this.run, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temporary, path.join(this.run.directory, "task.json"));
    return record;
  }
  async refreshPages() {
    const overview = await this.editor("read", { fields: ["components"] });
    this.run.components = Object.fromEntries(overview.results[0].components.filter((c) => c.type === "page").map((c) => [c.uuid, c.pageMeta.path]));
  }
  async context(expectedChange = false) {
    const context = await this.editor("getEditorContext");
    if (context.projectId !== this.run.projectId || context.branchId !== this.run.branchId) throw new Error("Controlled prototype task belongs to a different project/branch");
    if (this.run.sessionId !== context.sessionId) {
      this.run.sessionId = context.sessionId;
      for (const page of this.run.pages) this.invalidate(page);
      this.run.current = null;
      this.run.currentCase = null;
      await this.event("reopened", { identity: identity(context) });
    } else if (!expectedChange && this.run.lastIdentity && (this.run.lastIdentity.changeCounter !== context.changeCounter || context.revision < this.run.lastIdentity.revision)) {
      for (const page of this.run.pages) { this.invalidate(page); page.dirty = this.run.seq + 1; }
      this.run.currentCase = null;
      await this.event("external_change", { identity: identity(context) });
    } else if (!expectedChange && this.run.lastIdentity && this.run.lastIdentity.revision !== context.revision) {
      // Studio increments changeCounter for actual recorded model edits.
      // Saving the same model advances revision without changing that counter.
      await this.event("persistence_advanced", { identity: identity(context) });
    }
    this.run.lastIdentity = identity(context);
    return context;
  }
  invalidate(page) { page.structural = null; page.visual = null; page.cases = {}; page.phase = "content"; }
  async start(input) {
    if (this.active) throw new Error("A prototype task is already active; finish or cancel it first");
    if (!path.isAbsolute(input.suitePath)) throw new Error("suitePath must be absolute");
    input = { ...input, suitePath: await fs.realpath(input.suitePath) };
    const context = await this.editor("getEditorContext");
    if (context.projectId !== input.projectId || context.mode !== "edit" || !context.canEdit || !Array.isArray(input.referenceFiles) || input.referenceFiles.some((file) => !path.isAbsolute(file) || path.extname(file).toLowerCase() !== ".pen") || !/^[0-9a-f]{64}$/.test(input.resourceRelease || "")) throw new Error("start requires the current editable projectId, resourceRelease and original absolute .pen referenceFiles array");
    const id = randomUUID(), directory = path.join(this.profile, "prototype-runs", id);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    this.run = { id, directory, projectId: context.projectId, branchId: context.branchId, sessionId: context.sessionId, initialSessionId: context.sessionId, lastIdentity: identity(context), resourceRelease: input.resourceRelease, referenceFiles: input.referenceFiles.map((file) => path.resolve(file)), build: this.build, seq: 0, current: null, pinned: {}, references: {}, models: {}, layouts: {}, images: {}, pages: [], components: {}, metrics: { calls: 0, inputBytes: 0, rpcOutputBytes: 0, imageBytes: 0, largestRpcOutputBytes: 0 } };
    try {
      if (!input.sourceFiles?.length || input.sourceFiles.some((file) => !path.isAbsolute(file) || path.extname(file).toLowerCase() === ".pen")) throw new Error("Pin original requirement documents (or retained URL source copies) in sourceFiles; Pen documents use referenceFiles");
      for (const file of input.sourceFiles) { const absolute = await fs.realpath(file); this.run.pinned[absolute] = hash(await fs.readFile(absolute)); }
      const suite = await this.pin(input.suitePath), base = path.dirname(input.suitePath);
      this.run.overviewName = suite.page_layout?.overviewName === undefined ? "页面总览" : suite.page_layout.overviewName;
      if (typeof this.run.overviewName !== "string" || !this.run.overviewName.trim()) throw new Error("Declare a reviewed overviewName; default is 页面总览");
      if (!suite.structure?.inventory || !suite.slots?.pages) throw new Error("Controlled generation requires source-reviewed structure and per-Page Slot intent");
      const structure = await this.pin(path.resolve(base, suite.structure.inventory));
      if (!structure.pages?.length || new Set(structure.pages.map((p) => p.path)).size !== structure.pages.length) throw new Error("Distinct source-reviewed Page routes required");
      for (const name of ["forms", "descriptions", "overlays"]) {
        if (!suite[name]?.inventory) throw new Error("Required source inventory: " + name);
        await this.pin(path.resolve(base, suite[name].inventory));
      }
      this.run.inventoryPaths = Object.fromEntries(["forms", "descriptions", "overlays"].map((name) => [name, path.resolve(base, suite[name].inventory)]));
      let references = { pages: [] };
      if (suite.references?.inventory) references = await this.pin(path.resolve(base, suite.references.inventory));
      if (input.referenceFiles.length && !suite.references?.inventory) throw new Error("The supplied .pen references require a references inventory");
      const allowedFiles = new Set(input.referenceFiles.map((file) => path.resolve(file)));
      const usedFiles = new Set();
      for (const plan of structure.pages) {
        if (typeof plan.name !== "string" || !plan.name.trim()) throw new Error("Declare the source-reviewed Page directory name before generation; default to Chinese business wording");
        if (!Object.hasOwn(plan, "pageHeader") || plan.pageHeader !== null && (typeof plan.pageHeader !== "object" || !plan.pageHeader.nodeName || !plan.pageHeader.source?.trim())) throw new Error("Declare pageHeader:null by default; an explicitly requested header needs its nodeName and source");
        if (!Array.isArray(plan.components) || plan.components.some((c) => !c.nodeName || !c.component || !c.source?.trim())) throw new Error("Plan required business regions and registered component identities before generation");
        const fallbacks = plan.elementFallbacks === undefined ? [] : plan.elementFallbacks;
        if (!Array.isArray(fallbacks) || fallbacks.some((e) => !e || ["nodeName", "reason", "source"].some((k) => typeof e[k] !== "string" || !e[k].trim())) || new Set(fallbacks.map((e) => e.nodeName)).size !== fallbacks.length) throw new Error("elementFallbacks requires distinct named nodes, verified contract-gap reasons and source citations");
        if (!plan.copy?.source?.trim() || !Array.isArray(plan.copy.excluded) || !Array.isArray(plan.copy.help) || [...plan.copy.excluded, ...plan.copy.help].some((c) => !c.text?.trim() || !c.source?.trim()) || plan.copy.help.some((c) => !c.nodeName)) throw new Error("Review UI copy separately from requirement explanations before generation");
        const slot = suite.slots.pages.find((p) => p.path === plan.path);
        const source = references.pages.find((p) => p.path === plan.path);
        if (!slot?.intent || !plan.source || !Array.isArray(plan.runtimeCases) || !plan.runtimeCases.length) throw new Error("Each Page requires source, Slot intent and source-derived runtimeCases: " + plan.path);
        if (allowedFiles.size && (!source?.references?.length || !source.regions?.length)) throw new Error("Pen reference frames and semantic region mapping required: " + plan.path);
        for (const ref of source?.references || []) {
          if (!ref.id || !ref.nodeId || !path.isAbsolute(ref.filePath) || !allowedFiles.has(path.resolve(ref.filePath))) throw new Error("Reference frame must belong to an original supplied .pen file");
          usedFiles.add(path.resolve(ref.filePath));
        }
        if (source && (new Set(source.references.map((r) => r.id)).size !== source.references.length || source.regions.some((r) => !source.references.some((ref) => ref.id === r.referenceId) || !r.nodeNames?.length || r.nodeNames.some((n) => typeof n !== "string" || !n.trim()) || !r.decision?.trim()))) throw new Error("Every reference region needs an existing referenceId, planned native nodeNames and semantic decision");
        const cases = plan.runtimeCases;
        if (new Set(cases.map((c) => c.id)).size !== cases.length || cases.some((c) => !c.id || !c.source || !c.steps?.length || !c.assertions?.length || c.steps.some((s) => !["open", "close", "click", "hover", "fill", "select", "press", "scroll", "snapshot"].includes(s.action)))) throw new Error("Runtime cases require distinct IDs, source, ordered Preview steps and assertions");
        if (cases.every((c) => c.deferred)) throw new Error("A Page cannot defer every runtime case");
        this.run.pages.push({ path: plan.path, name: plan.name, source: plan.source, intent: await plannedPath(path.resolve(base, slot.intent)), references: source?.references || [], regions: source?.regions || [], runtimeCases: cases, phase: "planned", cases: {}, dirty: 0 });
      }
      if ([...allowedFiles].some((file) => !usedFiles.has(file))) throw new Error("Every supplied .pen file needs explicit reference coverage");
      this.run.suitePath = input.suitePath;
      await this.refreshPages();
      await this.event("started", { projectId: context.projectId, identity: identity(context), resourceRelease: input.resourceRelease, build: this.build });
      return this.status();
    } catch (error) { this.run.ended = "failed_start"; throw error; }
  }
  async command(input) {
    if (input.action === "start") return this.start(input);
    if (!this.active) throw new Error("Start a controlled prototype task first");
    if (input.action === "state") return this.status();
    if (input.action === "cancel") { this.run.ended = "cancelled"; await this.event("cancelled"); return { status: "incomplete", evidenceDirectory: this.run.directory }; }
    await this.stablePlan();
    const context = await this.context();
    const page = this.run.pages.find((p) => p.path === (input.pagePath || this.run.current));
    if (input.action === "begin_page") {
      if (!page) throw new Error("Unknown planned route");
      if (context.mode !== "edit") throw new Error("Close native Preview before beginning Page edits");
      const previous = this.run.pages.find((p) => p.path === this.run.current);
      if (previous && previous !== page && previous.phase !== "complete") throw new Error("Complete current Page before beginning another: " + previous.path);
      await this.pinIntent(page);
      for (const ref of page.references) {
        const observed = this.run.references[this.referenceKey(ref)];
        if (!observed?.complete || !observed?.image || observed.read.depth < 1 || !["id", "type", "layout", "width", "height", "padding", "gap", "justifyContent", "alignItems"].every((field) => observed.read.fields.includes(field))) throw new Error("Read complete paginated frame layout and acquire its screenshot through design_reference before content generation: " + ref.id);
        if (hash(await fs.readFile(observed.image.file)) !== observed.image.sha256) throw new Error("Reference screenshot changed after collection");
      }
      this.run.current = page.path;
      page.phase = page.phase === "complete" ? "complete" : "content";
      await this.event("begin_page", { page: page.path, intent: page.intent });
    } else if (input.action === "structural_check") {
      if (!page || page.path !== this.run.current) throw new Error("Structural checkpoint must target current Page");
      const report = await this.checkReport(input.reportPath, context, page.path);
      page.structural = { reportPath: input.reportPath, sha256: hash(await fs.readFile(input.reportPath)), identity: identity(context), seq: this.run.seq, modelHash: this.run.models[this.componentFor(page.path)]?.hash };
      page.visual = null; page.cases = {}; page.phase = "visual-review";
      await this.event("structural_check", { page: page.path, report: page.structural, capture: report.capture });
    } else if (input.action === "review_visual") {
      if (!page?.structural || page.path !== this.run.current) throw new Error("Current Page needs a successful structural checkpoint first");
      const observations = input.observations;
      const expected = page.references.length ? page.references.map((r) => r.id) : ["page"];
      if (!Array.isArray(observations) || observations.length !== expected.length || new Set(observations.map((o) => o.referenceId)).size !== expected.length || expected.some((id) => !observations.some((o) => o.referenceId === id))) throw new Error("Review every planned reference state (or page for a task without a visual reference)");
      if (new Set(observations.map((o) => o.generatedEvidenceId)).size !== expected.length) throw new Error("Distinct reference states need distinct generated screenshots; consolidate genuinely equivalent source frames in the reviewed inventory");
      for (const note of observations) {
        const image = this.run.images[note.generatedEvidenceId];
        if (!image || image.page !== page.path || image.seq <= page.dirty || image.seq <= page.structural.seq) throw new Error("Visual review requires a real current-Page screenshot acquired after its structural check");
        if (hash(await fs.readFile(image.file)) !== image.sha256) throw new Error("Generated screenshot changed after collection");
        if (!note.observation?.trim() || !["matched", "adapted"].includes(note.result) || (note.result === "adapted" && (!note.reason?.trim() || !note.source?.trim()))) throw new Error("Unresolved visual difference; correct the Page before advancing");
      }
      page.visual = { observations, seq: this.run.seq, status: "review_recorded" };
      await this.event("visual_review", { page: page.path, ...page.visual });
      page.phase = "runtime-check";
    } else if (input.action === "cancel_case") {
      if (!this.run.currentCase) throw new Error("No active runtime case");
      const current = this.run.currentCase;
      this.run.currentCase = null;
      await this.event("case_cancelled", { page: current.page, caseId: current.id, step: current.step });
    } else if (input.action === "begin_case") {
      if (this.run.currentCase) throw new Error("Finish the active runtime case before beginning another");
      if (!page?.structural) throw new Error("Runtime cases need a structural checkpoint");
      const spec = page.runtimeCases.find((c) => c.id === input.caseId);
      if (!spec) throw new Error("Unknown source-derived runtime case");
      if (page.path !== this.run.current && (!spec.deferred || this.run.pages.some((p) => p.phase !== "complete"))) throw new Error("Only deferred cross-Page cases may revisit an earlier Page after all Pages complete");
      this.run.currentCase = { page: page.path, id: spec.id, actions: [], step: 0, started: this.run.seq };
      if (page.phase !== "complete") page.phase = "runtime-check";
      delete page.cases[spec.id];
      await this.event("begin_case", { page: page.path, caseId: spec.id });
    } else if (input.action === "complete_page") {
      if (context.mode !== "edit") throw new Error("Close native Preview before completing a Page");
      if (!page?.structural || page.path !== this.run.current || !page.visual || this.run.currentCase || page.runtimeCases.some((c) => !c.deferred && !page.cases[c.id])) throw new Error("Current Page still lacks structural, image comparison or runtime case evidence");
      page.phase = "complete";
      await this.event("complete_page", { page: page.path });
    } else if (input.action === "finish") {
      if (this.run.pages.some((p) => p.phase !== "complete" || p.runtimeCases.some((c) => !p.cases[c.id]))) throw new Error("Complete all Pages and deferred runtime cases first");
      if (!this.run.saved || this.run.initialSessionId === context.sessionId || context.changeCounter !== 0 || this.run.saved.revision !== context.revision) throw new Error("Explicit save and reopen in a new editor session are required; rerun Page checks after reopening");
      await this.checkReport(input.reportPath, context, null);
      for (const image of Object.values(this.run.images)) if (hash(await fs.readFile(image.file)) !== image.sha256) throw new Error("Collected screenshot changed: " + image.file);
      this.run.ended = "complete";
      await this.event("finished", { reportPath: input.reportPath, sha256: hash(await fs.readFile(input.reportPath)), identity: identity(context) });
      return { status: "recorded_checks_complete", visualQuality: "requires independent review of recorded comparisons", evidenceDirectory: this.run.directory };
    } else throw new Error("Unknown prototype_task action");
    return this.status();
  }
  componentFor(route) { return Object.keys(this.run.components).find((id) => this.run.components[id] === route); }
  referenceKey(ref) { return JSON.stringify([path.resolve(ref.filePath), ref.nodeId]); }
  async pinIntent(page) {
    page.intent = await fs.realpath(page.intent);
    const bytes = await fs.readFile(page.intent), digest = hash(bytes);
    if (this.run.pinned[page.intent] && this.run.pinned[page.intent] !== digest) throw new Error("Page Slot intent changed after planning");
    this.run.pinned[page.intent] = digest;
  }
  async before(method, input) {
    if (!this.active || method === "prototype_task") return;
    if (method === "import_reference") throw new Error("Reference import creates separate artboards; it is not a controlled native Page generation or runtime acceptance step");
    if (method === "preview" && this.run.currentCase) {
      const current = this.run.currentCase, page = this.run.pages.find((p) => p.path === current.page), spec = page.runtimeCases.find((c) => c.id === current.id);
      if (input.action === "assert") {
        if (current.step !== spec.steps.length || valueHash(input.checks) !== valueHash(spec.assertions)) throw new Error("Execute the pinned runtime steps and exact source-derived assertions");
      } else if (!["state", "screenshot"].includes(input.action)) {
        const step = spec.steps[current.step];
        const discovery = input.action === "snapshot" && step?.action !== "snapshot";
        if (!discovery && (!step || step.action !== input.action || Object.entries(step).some(([key, value]) => !["role", "name"].includes(key) && canonical(input[key]) !== canonical(value)))) throw new Error("Runtime case expects its next pinned step: " + JSON.stringify(step));
      }
    }
    const operations = method === "execute_batch" ? input.operations : method === "execute" ? [{ name: input.name, input: input.input }] : ["import_image", "import_svg", "make_vector", "vectorize_image"].includes(method) && input.componentUuid ? [{ name: "insertHtml", input }] : [];
    const tracked = ["execute", "execute_batch", "snapshot_layout", "get_screenshot", "preview", "import_image", "import_svg", "make_vector", "vectorize_image"].includes(method);
    const context = tracked ? await this.context() : undefined;
    if (!operations.some((o) => edits.has(o.name))) return context ? { identity: identity(context) } : undefined;
    if (context.mode !== "edit") throw new Error("Close native Preview before design mutations");
    await this.stablePlan(); await this.refreshPages();
    const aliases = {}, scope = { global: false, routes: [], identity: identity(context) };
    for (const op of operations) {
      if (!edits.has(op.name)) continue;
      if (op.name === "importWebPage") throw new Error("Static reference artboard imports are not a controlled native Page generation step");
      const data = op.input || {};
      if (op.name === "createComponent" && (data.type || "page") === "page") {
        const plan = this.run.pages.find((p) => p.path === data.path);
        if (!plan) throw new Error("Page route is outside the source-reviewed task plan");
        if (data.name !== plan.name) throw new Error("Page directory name must match the reviewed business name: " + plan.name);
        if (op.as) aliases["$" + op.as] = data.path;
        continue;
      }
      const overview = ["createCanvas", "updateCanvas"].includes(op.name);
      if (overview && data.name !== this.run.overviewName) throw new Error("Canvas name must match the reviewed overviewName: " + this.run.overviewName);
      if (!this.run.current && !overview && !["installLibrary", "upgradeLibrary", "createStyleToken", "createGlobalVariant", "createGlobalVariantGroup"].includes(op.name)) throw new Error("Begin a reference-backed current Page before writing business content");
      const alias = typeof data.componentUuid === "string" ? data.componentUuid.replace(/\.(?:root|\d+)$/, "") : undefined;
      const route = aliases[alias] || this.run.components[data.componentUuid];
      if (route && route !== this.run.current) throw new Error("Cross-Page content write blocked; complete " + this.run.current + " first");
      if (route) scope.routes.push(route); else scope.global = true;
    }
    return scope;
  }
  async archiveImage(result, page, kind, source) {
    const id = randomUUID(), bytes = Buffer.from(result.data, "base64"), file = path.join(this.run.directory, id + ".webp");
    await fs.writeFile(file, bytes, { mode: 0o600 });
    const evidence = { id, file, sha256: hash(bytes), page, kind, source, seq: this.run.seq + 1 };
    this.run.images[id] = evidence;
    return evidence;
  }
  async after(method, input, result, scope) {
    if (!this.active || method === "prototype_task") return result;
    const inputBytes = Buffer.byteLength(JSON.stringify(input)), outputBytes = Buffer.byteLength(JSON.stringify(result));
    const metrics = this.run.metrics;
    metrics.calls++; metrics.inputBytes += inputBytes; metrics.rpcOutputBytes += outputBytes; metrics.largestRpcOutputBytes = Math.max(metrics.largestRpcOutputBytes, outputBytes);
    if (result.data) metrics.imageBytes += Buffer.from(result.data, "base64").length;
    await this.event("call", { method, operation: method === "execute" ? input.name : undefined, inputBytes, rpcOutputBytes: outputBytes, imageBytes: result.data ? Buffer.from(result.data, "base64").length : 0 });
    const ops = method === "execute_batch" ? input.operations : method === "execute" ? [{ name: input.name, input: input.input }] : [];
    const changed = ops.filter((o) => edits.has(o.name));
    if (scope?.routes?.length && !changed.length) changed.push({ name: method });
    const saved = method === "execute" && input.name === "save" && result.saved;
    if (saved) await this.context(true);
    if (!changed.length && !saved && scope?.identity) {
      const context = await this.context();
      if (canonical(scope.identity) !== canonical(identity(context))) throw new Error("Design/session changed during evidence acquisition; collect it again");
    }
    if (changed.length) {
      const global = !!scope?.global;
      for (const page of this.run.pages) if (global || scope?.routes?.includes(page.path)) { this.invalidate(page); page.dirty = this.run.seq + 1; }
      this.run.currentCase = null;
      await this.refreshPages();
      await this.context(true);
      await this.event("mutation", { page: this.run.current, global, emptyPagesOnly: !global && !scope?.routes?.length, operations: changed.map((o) => o.name) });
    }
    if (method === "execute" && input.name === "read" && result.read?.depth === "all") {
      for (const model of result.results || []) if (model.type === "page" && typeof model.baseVariantTplTree === "string") this.run.models[model.uuid] = { hash: valueHash(model), sessionId: this.run.sessionId, seq: this.run.seq + 1 };
      await this.event("model_read", { componentUuids: (result.results || []).map((m) => m.uuid), identity: this.run.lastIdentity });
    }
    if (method === "snapshot_layout" && input.view === "full") { this.run.layouts[input.componentUuid] = { hash: valueHash(result), sessionId: this.run.sessionId, seq: this.run.seq + 1 }; await this.event("layout_read", { componentUuid: input.componentUuid, identity: this.run.lastIdentity }); }
    if (method === "execute" && input.name === "validate") {
      this.run.validation = { hash: valueHash({ componentUuids: input.input?.componentUuids, result }), identity: this.run.lastIdentity };
      await this.event("model_validation", { componentUuids: input.input?.componentUuids, identity: this.run.lastIdentity });
    }
    if (method === "execute" && input.name === "save" && result.saved) { this.run.saved = result; await this.event("saved", { revision: result.revision }); }
    if (method === "design_reference") {
      if (input.action !== "index") {
        const key = this.referenceKey(input), record = this.run.references[key] ||= {};
        if (input.action === "read") {
          for (const page of this.run.pages) if (page.references.some((ref) => this.referenceKey(ref) === key) && page.structural) { this.invalidate(page); page.dirty = this.run.seq + 1; this.run.currentCase = null; }
          if (result.read.offset === 0) { record.pages = {}; record.image = null; record.read = { fields: result.read.fields, depth: result.read.depth, total: result.total }; }
          if (!record.read || record.read.total !== result.total || canonical(record.read.fields) !== canonical(result.read.fields) || record.read.depth !== result.read.depth) throw new Error("Reference pagination scope changed; restart at offset 0");
          record.pages[result.read.offset] = result.items;
          const items = [], offsets = Object.keys(record.pages).map(Number).sort((a, b) => a - b);
          let cursor = 0;
          for (const offset of offsets) { if (offset !== cursor) break; items.push(...record.pages[offset]); cursor += record.pages[offset].length; }
          record.complete = cursor === result.total && items.some((n) => n.id === input.nodeId && ["frame", "group"].includes(n.type));
        } else if (result.data) { record.image = await this.archiveImage(result, null, "reference", result.source); result = { ...result, evidence: record.image }; }
      }
      await this.event("reference_read", { action: input.action, source: result.source, read: result.read, evidence: result.evidence });
    }
    if ((method === "get_screenshot" || method === "preview") && result.data) {
      const page = method === "preview" ? result.context?.previewContext?.path : this.run.components[input.componentUuid];
      if (page) { const evidence = await this.archiveImage(result, page, method === "preview" ? "runtime" : "design"); result = { ...result, evidence }; await this.event("image", { page, evidence }); }
    }
    if (method === "preview") {
      const current = this.run.currentCase;
      if (current) {
        const page = this.run.pages.find((p) => p.path === current.page), spec = page.runtimeCases.find((c) => c.id === current.id);
        const step = spec.steps[current.step];
        if (step?.action === input.action) {
          if (step.role && result.target?.role !== step.role || step.name !== undefined && result.target?.name !== step.name) throw new Error("Runtime action targeted a different control than its reviewed case");
          current.step++;
        }
        current.actions.push(input.action);
        if (input.action === "assert" && result.passed === true && result.checks?.length === spec.assertions.length && result.checks.every((c) => c.passed === true) && current.step === spec.steps.length && valueHash(input.checks) === valueHash(spec.assertions) && result.context?.previewContext?.path === (spec.targetPath || page.path)) {
          page.cases[spec.id] = { seq: this.run.seq + 1, actions: current.actions, checks: result.checks, identity: identity(result.context) };
          this.run.currentCase = null;
        }
      }
      const casePage = current && this.run.pages.find((p) => p.path === current.page);
      await this.event("preview", { page: result.context?.previewContext?.path, action: input.action, context: result.context, passed: result.passed, checks: result.checks, target: result.target, caseId: current?.id, step: current?.step, caseCompleted: !!(current && casePage.cases[current.id]) });
    }
    return result;
  }
  async checkReport(file, context, route) {
    if (!path.isAbsolute(file)) throw new Error("Report path must be absolute");
    const report = JSON.parse(await fs.readFile(file, "utf8")), base = path.dirname(file), capture = report.capture;
    const gates = ["evidence", "model", "rendering", "structure", "page_layout", "forms", "descriptions", "overlays", "slots", "shell_height"];
    if (this.run.referenceFiles.length) gates.push("references");
    if (report.passed !== true || (report.pagePath ?? null) !== route || report.projectId !== this.run.projectId || !Array.isArray(report.checks) || new Set(report.checks.map((c) => c.gate)).size !== report.checks.length || !gates.every((name) => report.checks.some((c) => c.gate === name && c.status === "passed")) || report.checks.some((c) => !["passed", "not_applicable"].includes(c.status) || c.status === "passed" && c.report?.passed !== true)) throw new Error("A complete successful live verification report for this scope is required");
    if (canonical(capture?.before) !== canonical(identity(context)) || canonical(capture?.after) !== canonical(identity(context)) || canonical(capture.build) !== canonical(this.build)) throw new Error("Verification report is stale or from a different session/build");
    if (capture.prototypeTask?.runId !== this.run.id) throw new Error("Verification must be collected within this actual controlled task");
    if (this.run.validation?.hash !== valueHash(capture.validation) || canonical(this.run.validation.identity) !== canonical(identity(context))) throw new Error("Report validation was not collected through actual Desktop validate in the current model/session");
    const taskBytes = await fs.readFile(path.join(base, "reference-evidence.json"));
    const task = JSON.parse(taskBytes);
    if (hash(taskBytes) !== capture.prototypeTask.sha256 || task.id !== this.run.id || task.sessionId !== context.sessionId || canonical(task.build) !== canonical(this.build)) throw new Error("Task/reference evidence is stale or changed");
    for (const name of ["overview.json", "pages.json", "layouts.json"]) if (hash(await fs.readFile(path.join(base, name))) !== capture.files[name]) throw new Error("Captured evidence hash mismatch: " + name);
    const models = JSON.parse(await fs.readFile(path.join(base, "pages.json"), "utf8"));
    const layouts = JSON.parse(await fs.readFile(path.join(base, "layouts.json"), "utf8"));
    const selected = route ? [this.componentFor(route)] : this.run.pages.map((p) => this.componentFor(p.path));
    if (models.results.length !== selected.length || selected.some((id) => !models.results.some((p) => p.uuid === id))) throw new Error("Report must cover the exact current Page identities");
    for (const model of models.results) {
      if (this.run.models[model.uuid]?.hash !== valueHash(model) || this.run.models[model.uuid]?.sessionId !== context.sessionId || this.run.layouts[model.uuid]?.hash !== valueHash(layouts[model.uuid]?.snapshot) || this.run.layouts[model.uuid]?.sessionId !== context.sessionId) throw new Error("Report data was not collected through actual Desktop model/layout calls in this editor session");
    }
    const inputs = report.checkedInputs?.files;
    if (!Array.isArray(inputs) || !inputs.some((item) => path.basename(item.path) === "verify_all.py" && item.sha256)) throw new Error("Verification must retain checker and source-inventory hashes");
    const suite = JSON.parse(await fs.readFile(this.run.suitePath));
    const requiredInputs = await Promise.all([suite.structure.inventory, ...Object.values(this.run.inventoryPaths), ...(suite.references ? [suite.references.inventory] : []), ...this.run.pages.filter((p) => !route || p.path === route).map((p) => p.intent)].map((file) => fs.realpath(path.resolve(path.dirname(this.run.suitePath), file))));
    for (const file of requiredInputs) if (!inputs.some((item) => item.path === file && item.sha256 === this.run.pinned[file])) throw new Error("Report does not use the reviewed source input: " + file);
    for (const item of inputs) {
      // Future Pages may not have their detailed intent yet. A scoped report
      // records that absence; it cannot omit a required current-Page input.
      if (item.sha256 === null && route && this.run.pages.some((p) => p.path !== route && p.intent === item.path) && !this.run.pinned[item.path]) continue;
      if (item.sha256 !== hash(await fs.readFile(item.path))) throw new Error("Verifier inputs changed after the report");
    }
    return report;
  }
}
module.exports = { PrototypeTask, valueHash, identity };
