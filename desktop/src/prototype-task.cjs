const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { validatePlan, retains, intentNames } = require("./prototype-plan.cjs");
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
  constructor(profile, editor, build) { Object.assign(this, { profile, editor, build }); this.loading = this.restore(); }
  async restore() {
    try {
      const pointer = JSON.parse(await fs.readFile(path.join(this.profile, "prototype-task.json")));
      const directory = path.resolve(pointer.directory);
      if (path.dirname(directory) !== path.join(this.profile, "prototype-runs")) throw new Error("Invalid prototype task directory");
      const run = JSON.parse(await fs.readFile(path.join(directory, "task.json")));
      if (run.ended !== "complete") this.run = run;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  get active() { return !!this.run && !this.run.ended; }
  status() {
    if (!this.run) return null;
    const r = this.run, page = r.pages.find((p) => p.path === r.current);
    const current = r.currentCase, runtime = current && r.pages.find((p) => p.path === current.page).runtimeCases.find((c) => c.id === current.id);
    return { runId: r.id, projectId: r.projectId, resourceRelease: r.resourceRelease, suitePath: r.suitePath,
      currentComponentUuid: page ? this.componentFor(page.path) : null, currentIntent: page?.intent,
      status: r.ended || "in_progress", currentPage: r.current, phase: page?.phase || "reference-planning", completedPages: r.pages.filter((p) => p.phase === "complete").length, totalPages: r.pages.length,
      pendingCases: page ? (page.runtimeCases || []).filter((c) => !c.deferred && !page.cases[c.id]).map((c) => c.id) : [],
      pendingDeferredCases: r.pages.flatMap((p) => p.runtimeCases.filter((c) => c.deferred && !p.cases[c.id]).map((c) => ({ pagePath: p.path, caseId: c.id }))),
      ...(current ? { activeCase: { pagePath: current.page, id: current.id, step: current.step,
        ...(runtime.steps[current.step] ? { nextStep: runtime.steps[current.step] } : { assertions: runtime.assertions }) } } : {}), evidenceDirectory: r.directory, metrics: r.metrics,
      nextAction: r.ended === "complete" ? "none" : r.ended === "cancelled" ? "resume" : !r.current ? "begin_page" : page.phase === "complete" ? (r.pages.some((p) => p.phase !== "complete") ? "begin_page" : "deferred_cases_and_final_verification") : !page.structural ? "verify_current_page" : !page.visual ? "review_current_page_images" : page.runtimeCases.some((c) => !c.deferred && !page.cases[c.id]) ? "begin_case" : "complete_page" };
  }
  expectedTarget() {
    const current = this.run?.currentCase;
    return current ? this.run.pages.find((p) => p.path === current.page).runtimeCases.find((c) => c.id === current.id).steps[current.step] : undefined;
  }
  async pin(file) {
    const absolute = await fs.realpath(file), bytes = await fs.readFile(absolute);
    const digest = hash(bytes);
    if (this.run.pinned[absolute] && this.run.pinned[absolute] !== digest) throw new Error("Reviewed task input changed; restore its archived baseline or use revise: " + absolute);
    this.run.pinned[absolute] = digest;
    await this.archiveInput(absolute, bytes);
    return JSON.parse(bytes);
  }
  async archiveInput(file, bytes) {
    const digest = hash(bytes), snapshot = path.join(this.run.directory, "inputs", digest);
    await fs.mkdir(path.dirname(snapshot), { recursive: true });
    await fs.writeFile(snapshot, bytes, { mode: 0o600 });
    this.run.baseline[file] = { file: snapshot, sha256: digest };
  }
  async stablePlan() {
    for (const [file, digest] of Object.entries(this.run.pinned)) if (hash(await fs.readFile(file)) !== digest) throw new Error("Reviewed task input changed: " + file + "; restore the archived baseline or use revise for additive checks; never cancel to bypass acceptance");
  }
  async event(kind, detail = {}) {
    const record = { seq: ++this.run.seq, time: new Date().toISOString(), kind, ...detail };
    await fs.appendFile(path.join(this.run.directory, "events.jsonl"), JSON.stringify(record) + "\n", { mode: 0o600 });
    const temporary = path.join(this.run.directory, "task.json.tmp");
    await fs.writeFile(temporary, JSON.stringify(this.run, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temporary, path.join(this.run.directory, "task.json"));
    await fs.writeFile(path.join(this.profile, "prototype-task.json"), JSON.stringify({ directory: this.run.directory }), { mode: 0o600 });
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
      this.run.contracts = {};
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
    await this.loading;
    if (this.active) throw new Error("A prototype task is already active; finish or cancel it first");
    if (this.run?.ended === "cancelled") throw new Error("An incomplete task remains bound to its project and baseline; resume or revise it instead of replacing its checks");
    if (!path.isAbsolute(input.suitePath)) throw new Error("suitePath must be absolute");
    if (!path.isAbsolute(input.resourceRoot || "")) throw new Error("Use the resolved resourceRoot to pin the actual verification scripts");
    await this.command({ action: "validate_plan", suitePath: input.suitePath });
    input = { ...input, suitePath: await fs.realpath(input.suitePath) };
    const context = await this.editor("getEditorContext");
    if (context.projectId !== input.projectId || context.mode !== "edit" || !context.canEdit || !Array.isArray(input.referenceFiles) || input.referenceFiles.some((file) => !path.isAbsolute(file) || path.extname(file).toLowerCase() !== ".pen") || !/^[0-9a-f]{64}$/.test(input.resourceRelease || "")) throw new Error("start requires the current editable projectId, resourceRelease and original absolute .pen referenceFiles array");
    const id = randomUUID(), directory = path.join(this.profile, "prototype-runs", id);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    this.run = { id, directory, projectId: context.projectId, branchId: context.branchId, sessionId: context.sessionId, initialSessionId: context.sessionId, lastIdentity: identity(context), resourceRelease: input.resourceRelease, referenceFiles: input.referenceFiles.map((file) => path.resolve(file)), referenceHashes: {}, build: this.build, seq: 0, current: null, pinned: {}, baseline: {}, references: {}, contracts: {}, models: {}, layouts: {}, images: {}, pages: [], components: {}, metrics: { calls: 0, inputBytes: 0, rpcOutputBytes: 0, imageBytes: 0, largestRpcOutputBytes: 0 } };
    try {
      if (!input.sourceFiles?.length || input.sourceFiles.some((file) => !path.isAbsolute(file) || path.extname(file).toLowerCase() === ".pen")) throw new Error("Pin original requirement documents (or retained URL source copies) in sourceFiles; Pen documents use referenceFiles");
      const scripts = await fs.realpath(path.join(input.resourceRoot, "scripts"));
      const verifiers = (await fs.readdir(scripts)).filter((name) => /^verify_.*\.py$/.test(name));
      if (!verifiers.includes("verify_all.py")) throw new Error("Resolved resources must include verify_all.py");
      this.run.verifierFiles = [];
      for (const name of verifiers) {
        const file = path.join(scripts, name), bytes = await fs.readFile(file);
        this.run.pinned[file] = hash(bytes); await this.archiveInput(file, bytes); this.run.verifierFiles.push(file);
      }
      for (const file of input.sourceFiles) { const absolute = await fs.realpath(file), bytes = await fs.readFile(absolute); this.run.pinned[absolute] = hash(bytes); await this.archiveInput(absolute, bytes); }
      const suite = await this.pin(input.suitePath), base = path.dirname(input.suitePath);
      this.run.overviewName = suite.page_layout?.overviewName === undefined ? "页面总览" : suite.page_layout.overviewName;
      if (typeof this.run.overviewName !== "string" || !this.run.overviewName.trim()) throw new Error("Declare a reviewed overviewName; default is 页面总览");
      if (!suite.structure?.inventory || !suite.slots?.pages) throw new Error("Controlled generation requires source-reviewed structure and per-Page Slot intent");
      const structure = await this.pin(path.resolve(base, suite.structure.inventory));
      this.run.structurePath = await fs.realpath(path.resolve(base, suite.structure.inventory));
      if (!structure.pages?.length || new Set(structure.pages.map((p) => p.path)).size !== structure.pages.length) throw new Error("Distinct source-reviewed Page routes required");
      const documents = { structure };
      for (const name of ["forms", "descriptions", "overlays"]) {
        if (!suite[name]?.inventory) throw new Error("Required source inventory: " + name);
        documents[name] = await this.pin(path.resolve(base, suite[name].inventory));
      }
      this.run.inventoryPaths = Object.fromEntries(["forms", "descriptions", "overlays"].map((name) => [name, path.resolve(base, suite[name].inventory)]));
      this.run.planFiles = [input.suitePath, path.resolve(base, suite.structure.inventory), ...Object.values(this.run.inventoryPaths)];
      let references = { pages: [] };
      if (suite.references?.inventory) references = await this.pin(path.resolve(base, suite.references.inventory));
      if (suite.references?.inventory) documents.references = references;
      validatePlan(suite, documents);
      if (suite.references?.inventory) this.run.planFiles.push(path.resolve(base, suite.references.inventory));
      this.run.planFiles = await Promise.all(this.run.planFiles.map((file) => fs.realpath(file)));
      for (const file of this.run.referenceFiles) {
        const bytes = await fs.readFile(file), absolute = await fs.realpath(file);
        this.run.referenceHashes[file] = hash(bytes); this.run.pinned[absolute] = hash(bytes);
        await this.archiveInput(absolute, bytes);
      }
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
    await this.loading;
    if (input.action === "plan_schema") return require("./prototype-plan-schema.cjs");
    if (input.action === "validate_plan") {
      if (!path.isAbsolute(input.suitePath || "")) throw new Error("validate_plan requires an absolute suitePath");
      const suite = JSON.parse(await fs.readFile(input.suitePath)), base = path.dirname(input.suitePath), documents = {};
      for (const name of ["structure", "forms", "descriptions", "overlays", ...(suite.references ? ["references"] : [])]) {
        if (typeof suite[name]?.inventory !== "string") throw new Error("Invalid reviewed plan at " + name + "/inventory: expected path");
        documents[name] = JSON.parse(await fs.readFile(path.resolve(base, suite[name].inventory)));
      }
      return { passed: true, pages: validatePlan(suite, documents).length };
    }
    if (input.action === "start") return this.start(input);
    if (["resume", "revise"].includes(input.action)) {
      if (!this.run || ![undefined, "cancelled"].includes(this.run.ended)) throw new Error("An active or cancelled task is required");
      if (input.action === "revise") {
        const suite = JSON.parse(await fs.readFile(this.run.suitePath)), base = path.dirname(this.run.suitePath), documents = {};
        for (const name of ["structure", "forms", "descriptions", "overlays", ...(suite.references ? ["references"] : [])]) documents[name] = JSON.parse(await fs.readFile(path.resolve(base, suite[name].inventory)));
        validatePlan(suite, documents);
        if (canonical(documents.structure.pages.map((p) => p.path)) !== canonical(this.run.pages.map((p) => p.path))) throw new Error("A revision retains the task's reviewed Page routes");
        if (documents.references?.pages.some((p) => p.references.some((ref) => !this.run.referenceFiles.includes(path.resolve(ref.filePath))))) throw new Error("Reference revisions must use the original supplied Pen files");
        const changed = [], affected = new Set();
        for (const [file, digest] of Object.entries(this.run.pinned)) {
          const bytes = await fs.readFile(file);
          if (hash(bytes) === digest) continue;
          const original = await fs.readFile(this.run.baseline[file].file);
          const owner = this.run.pages.find((p) => p.intent === file);
          if (owner) {
            const beforeNames = intentNames(original.toString()), afterNames = intentNames(bytes.toString());
            if (!beforeNames.size || [...beforeNames].some((name) => !afterNames.has(name))) throw new Error("Slot intent revision must preserve the named source targets: " + file);
            changed.push({ file, bytes }); affected.add(owner.path); continue;
          }
          if (!this.run.planFiles.includes(file)) throw new Error("Original sources and verification scripts are immutable; restore " + file);
          let before, after;
          try { before = JSON.parse(original); after = JSON.parse(bytes); } catch { throw new Error("Original sources and Slot intents are immutable; restore " + file); }
          if (!retains(before, after)) throw new Error("Revision removes or rewrites a reviewed expectation; restore " + file);
          changed.push({ file, bytes });
          if (Array.isArray(before.pages) && Array.isArray(after.pages)) {
            for (const p of after.pages) if (canonical(p) !== canonical(before.pages.find((old) => old.path === p.path))) affected.add(p.path);
            if (canonical({ ...before, pages: null }) !== canonical({ ...after, pages: null })) for (const p of this.run.pages) affected.add(p.path);
          } else for (const p of this.run.pages) affected.add(p.path);
        }
        for (const item of changed) { this.run.pinned[item.file] = hash(item.bytes); await this.archiveInput(item.file, item.bytes); }
        if (changed.length) for (const page of this.run.pages) {
          page.runtimeCases = documents.structure.pages.find((p) => p.path === page.path).runtimeCases;
          const references = documents.references?.pages.find((p) => p.path === page.path);
          if (references) { page.references = references.references; page.regions = references.regions; }
          if (affected.has(page.path)) { this.invalidate(page); page.dirty = this.run.seq + 1; }
          for (const spec of page.runtimeCases) if (affected.has(spec.targetPath)) delete page.cases[spec.id];
        }
        this.run.currentCase = null;
        await this.event("plan_revised", { inputs: changed.map((item) => item.file), pages: [...affected] });
      }
      await this.stablePlan();
      if (this.build && canonical(this.run.build) !== canonical(this.build)) {
        this.run.build = this.build; this.run.contracts = {};
        this.run.currentCase = null;
        for (const page of this.run.pages) this.invalidate(page);
        await this.event("build_changed");
      }
      await this.context();
      this.run.ended = undefined;
      await this.event("resumed");
      return this.status();
    }
    if (input.action === "state" && this.run) return this.status();
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
      for (const ref of page.references) {
        if (hash(await fs.readFile(ref.filePath)) !== this.run.referenceHashes[ref.filePath]) throw new Error("Original Pen reference changed; restore the source before reusing its evidence");
        const observed = this.run.references[this.referenceKey(ref)];
        if (!observed?.complete || !observed?.image || observed.read.depth < 1 || !["id", "type", "layout", "width", "height", "padding", "gap", "justifyContent", "alignItems"].every((field) => observed.read.fields.includes(field))) throw new Error("Read complete paginated frame layout and acquire its screenshot through design_reference before content generation: " + ref.id);
        if (hash(await fs.readFile(observed.image.file)) !== observed.image.sha256) throw new Error("Reference screenshot changed after collection");
      }
      const structure = JSON.parse(await fs.readFile(this.run.structurePath));
      this.checkContractNames(structure.pages.find((p) => p.path === page.path).components.map((c) => c.component));
      this.checkContracts(await fs.readFile(page.intent, "utf8"));
      await this.pinIntent(page);
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
  checkContracts(markup) {
    const names = [...markup.matchAll(/data-plasmic-component\s*=\s*(["'])(.*?)\1/g)].map((match) => match[2]);
    this.checkContractNames(names);
  }
  checkContractNames(names) {
    const missing = [...new Set(names)].filter((name) => !this.run.contracts[name]);
    if (missing.length) throw new Error("Read current registered component contracts before markup (execute read, view:contract): " + missing.slice(0, 12).join(", "));
  }
  async invalidateReference(key) {
    const affected = [];
    for (const page of this.run.pages) if (page.references.some((ref) => this.referenceKey(ref) === key) && page.structural) {
      affected.push(page.path);
      this.invalidate(page); page.dirty = this.run.seq + 1;
      if (this.run.currentCase?.page === page.path) this.run.currentCase = null;
    }
    for (const page of this.run.pages) for (const spec of page.runtimeCases) if (affected.includes(spec.targetPath)) delete page.cases[spec.id];
    if (affected.length) await this.event("reference_changed", { pages: affected });
  }
  async pinIntent(page) {
    page.intent = await fs.realpath(page.intent);
    const bytes = await fs.readFile(page.intent), digest = hash(bytes);
    if (this.run.pinned[page.intent] && this.run.pinned[page.intent] !== digest) throw new Error("Page Slot intent changed after planning");
    this.run.pinned[page.intent] = digest;
    await this.archiveInput(page.intent, bytes);
  }
  async before(method, input) {
    await this.loading;
    if (method === "prototype_task") return;
    const bound = this.run && this.run.ended !== "complete" && this.run.ended !== "failed_start";
    if (bound && ((method === "open_design" && input.projectId !== this.run.projectId) || ["open_org", "open_workspace"].includes(method))) throw new Error("Controlled generation is bound to project " + this.run.projectId + "; reopen that project directly instead of navigating to another project/dashboard");
    const mutations = method === "execute_batch" ? input.operations : method === "execute" ? [{ name: input.name }] : [];
    if (bound && this.run.ended === "cancelled" && (mutations.some((op) => edits.has(op.name)) || ["import_reference", "import_image", "import_svg", "make_vector", "vectorize_image"].includes(method))) throw new Error("Task is incomplete and cancelled; resume the frozen plan before design writes");
    if (!this.active) return;
    if (this.run.currentCase && mutations.some((op) => edits.has(op.name))) throw new Error("Finish or cancel the runtime case before design writes; saved initial state changes cannot simulate Preview interactions");
    if (method === "import_reference") throw new Error("Reference import creates separate artboards; it is not a controlled native Page generation or runtime acceptance step");
    if (method === "preview" && this.run.currentCase) {
      const current = this.run.currentCase, page = this.run.pages.find((p) => p.path === current.page), spec = page.runtimeCases.find((c) => c.id === current.id);
      if (input.action === "assert") {
        if (current.step !== spec.steps.length || valueHash(input.checks) !== valueHash(spec.assertions)) throw new Error("Execute the pinned runtime steps and exact source-derived assertions");
      } else if (!["state", "screenshot", "close"].includes(input.action)) {
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
      if (op.name === "insertHtml" && typeof data.html === "string") this.checkContracts(data.html);
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
    const pageMetrics = (this.run.pageMetrics ||= {})[this.run.current || "planning"] ||= { calls: 0, inputBytes: 0, rpcOutputBytes: 0 };
    pageMetrics.calls++; pageMetrics.inputBytes += inputBytes; pageMetrics.rpcOutputBytes += outputBytes;
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
      if (changed.some((op) => ["installLibrary", "upgradeLibrary"].includes(op.name))) this.run.contracts = {};
      const global = !!scope?.global;
      for (const page of this.run.pages) {
        if (global || scope?.routes?.includes(page.path)) { this.invalidate(page); page.dirty = this.run.seq + 1; }
        else for (const spec of page.runtimeCases) if (scope?.routes?.includes(spec.targetPath)) delete page.cases[spec.id];
      }
      this.run.currentCase = null;
      await this.refreshPages();
      await this.context(true);
      await this.event("mutation", { page: this.run.current, global, emptyPagesOnly: !global && !scope?.routes?.length, operations: changed.map((o) => o.name) });
    }
    if (method === "execute" && input.name === "read" && result.read?.depth === "all") {
      for (const model of result.results || []) if (model.type === "page" && typeof model.baseVariantTplTree === "string") this.run.models[model.uuid] = { hash: valueHash(model), sessionId: this.run.sessionId, seq: this.run.seq + 1 };
      await this.event("model_read", { componentUuids: (result.results || []).map((m) => m.uuid), identity: this.run.lastIdentity });
    }
    if (method === "execute" && input.name === "read" && input.input?.view === "contract") {
      for (const component of result.results || []) if (component.name && Array.isArray(component.props)) this.run.contracts[component.name] = { hash: valueHash(component), sessionId: this.run.sessionId };
      await this.event("contracts_read", { names: Object.keys(this.run.contracts) });
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
          const sourceHash = hash(await fs.readFile(input.filePath));
          if (sourceHash !== this.run.referenceHashes[path.resolve(input.filePath)]) throw new Error("Original Pen reference changed after planning");
          if (result.read.offset === 0) {
            const next = { fields: result.read.fields, depth: result.read.depth, total: result.total };
            const reusable = record.complete && record.sourceHash === sourceHash && canonical(record.read) === canonical(next) && canonical(record.pages?.[0]) === canonical(result.items);
            if (!reusable) { await this.invalidateReference(key); record.pages = {}; record.image = null; }
            record.read = next; record.sourceHash = sourceHash;
          }
          if (!record.read || record.read.total !== result.total || canonical(record.read.fields) !== canonical(result.read.fields) || record.read.depth !== result.read.depth) throw new Error("Reference pagination scope changed; restart at offset 0");
          if (record.pages[result.read.offset] && canonical(record.pages[result.read.offset]) !== canonical(result.items)) { record.image = null; await this.invalidateReference(key); }
          record.pages[result.read.offset] = result.items;
          const items = [], offsets = Object.keys(record.pages).map(Number).sort((a, b) => a - b);
          let cursor = 0;
          for (const offset of offsets) { if (offset !== cursor) break; items.push(...record.pages[offset]); cursor += record.pages[offset].length; }
          record.complete = cursor === result.total && items.some((n) => n.id === input.nodeId && ["frame", "group"].includes(n.type));
        } else if (result.data) {
          if (record.image && hash(Buffer.from(result.data, "base64")) !== record.image.sha256) await this.invalidateReference(key);
          record.image = await this.archiveImage(result, null, "reference", result.source); result = { ...result, evidence: record.image };
        }
      }
      await this.event("reference_read", { action: input.action, source: result.source, read: result.read, evidence: result.evidence });
    }
    if ((method === "get_screenshot" || method === "preview") && result.data) {
      const page = this.run.components[method === "preview" ? result.context?.previewContext?.componentUuid : input.componentUuid];
      if (page) { const evidence = await this.archiveImage(result, page, method === "preview" ? "runtime" : "design"); result = { ...result, evidence }; await this.event("image", { page, evidence }); }
    }
    if (method === "preview") {
      const current = this.run.currentCase;
      if (current) {
        const page = this.run.pages.find((p) => p.path === current.page), spec = page.runtimeCases.find((c) => c.id === current.id);
        const step = spec.steps[current.step];
        if (input.action === "close" && step?.action !== "close") {
          this.run.currentCase = null;
          await this.event("case_cancelled", { page: current.page, caseId: current.id, step: current.step });
        }
        if (step?.action === input.action) {
          if (step.role && result.target?.role !== step.role || step.name !== undefined && result.target?.name !== step.name) throw new Error("Runtime action targeted a different control than its reviewed case");
          current.step++;
        }
        current.actions.push(input.action);
        const expectedPage = this.componentFor(spec.targetPath || page.path);
        if (input.action === "assert" && result.passed === true && result.checks?.length === spec.assertions.length && result.checks.every((c) => c.passed === true) && current.step === spec.steps.length && valueHash(input.checks) === valueHash(spec.assertions) && expectedPage && result.context?.previewContext?.componentUuid === expectedPage) {
          page.cases[spec.id] = { seq: this.run.seq + 1, actions: current.actions, checks: result.checks, identity: identity(result.context) };
          this.run.currentCase = null;
        }
      }
      const casePage = current && this.run.pages.find((p) => p.path === current.page);
      await this.event("preview", { page: this.run.components[result.context?.previewContext?.componentUuid], action: input.action, context: result.context, passed: result.passed, checks: result.checks, target: result.target, caseId: current?.id, step: current?.step, caseCompleted: !!(current && casePage.cases[current.id]) });
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
    if (!Array.isArray(inputs) || !this.run.verifierFiles.every((file) => inputs.some((item) => item.path === file && item.sha256 === this.run.pinned[file]))) throw new Error("Verification must use the pinned resource verifier and source-inventory hashes");
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
