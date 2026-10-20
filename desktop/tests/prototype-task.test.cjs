const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PrototypeTask, identity } = require("../src/prototype-task.cjs");

async function fixture(t, withReference = false, review = () => {}, prepare = () => {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-task-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const context = { projectId: "project", branchId: null, sessionId: "session", revision: 1, changeCounter: 0, mode: "edit", canEdit: true };
  const assertions = [{ kind: "value", role: "textbox", name: "SQL", value: "SELECT uid" }];
  const pages = ["list", "detail"].map((n) => ({ path: "/" + n, screen: "source.md §" + n, name: n === "list" ? "记录列表" : "记录详情", source: "source.md §" + n, bindings: [], bindingsNotApplicable: "Static native-control fixture; no business data binding", pageHeader: null, components: [{ nodeName: "SQLEditor", component: "plasmic-antd6-textarea", source: "source.md §editable", role: "widget", purpose: "Editable SQL value" }], copy: { source: "source.md §UI copy review", excluded: [], help: [] }, runtimeCases: [{ id: "edit", source: "source.md §editable", steps: [{ action: "fill", role: "textbox", name: "SQL", value: "SELECT uid" }], assertions }] }));
  review(pages);
  for (const p of pages) if (p.bindings?.length) delete p.bindingsNotApplicable;
  const suite = { structure: { inventory: "structure.json" }, slots: { pages: pages.map((p) => ({ path: p.path, intent: p.path.slice(1) + ".html" })) } };
  const write = (file, value) => fs.writeFile(path.join(dir, file), typeof value === "string" ? value : JSON.stringify(value));
  await write("structure.json", { pages, navigation: { source: "source.md §navigation", items: [] } }); await write("source.md", "Reviewed business source");
  for (const [name, key] of [["forms", "forms"], ["descriptions", "groups"], ["overlays", "overlays"]]) { suite[name] = { inventory: name + ".json" }; await write(name + ".json", { pages: pages.map((p) => ({ path: p.path, [key]: [] })) }); }
  const referenceFiles = withReference ? [path.join(dir, "original.pen")] : [];
  if (withReference) {
    await write("original.pen", "opaque source fixture");
    suite.references = { inventory: "references.json" };
    await write("references.json", { pages: pages.map((p) => ({ path: p.path, references: [{ id: "main", filePath: referenceFiles[0], nodeId: "frame" }], regions: [{ referenceId: "main", nodeNames: ["Content"], decision: "Preserve source hierarchy with native controls" }] })) });
  }
  await prepare(suite, dir);
  await write("suite.json", suite); await write("list.html", '<div data-plasmic-name="Content">Reviewed Slot intent</div>'); await write("detail.html", '<div data-plasmic-name="Content">Reviewed Slot intent</div>');
  const task = new PrototypeTask(dir, async (name) => {
    if (name === "getEditorContext") return { ...context };
    if (name === "read") return { results: [{ components: pages.map((p) => ({ uuid: p.path.slice(1), name: p.name, type: "page", pageMeta: { path: p.path } })) }] };
    throw Error(name);
  }, { rendererHash: "a".repeat(64), desktopHash: "b".repeat(64) });
  await task.command({ action: "start", projectId: "project", suitePath: path.join(dir, "suite.json"), resourceRoot: path.resolve(__dirname, "../../ai/plasmic"), resourceRelease: "c".repeat(64), sourceFiles: [path.join(dir, "source.md")], referenceFiles });
  await task.after("execute", { name: "read", input: { view: "contract" } }, { results: [{ name: "plasmic-antd6-textarea", props: [{ name: "value", type: "text" }] }] });
  return { task, context, dir, assertions, referenceFiles };
}

test("full generation cannot start without reviewed presentation/copy/component declarations", async (t) => {
  for (const key of ["name", "pageHeader", "components", "copy"]) {
    await assert.rejects(fixture(t, false, (pages) => { delete pages[0][key]; }), /Invalid reviewed plan|directory name|pageHeader|business regions|UI copy/);
  }
});

test("custom element exceptions must be source-reviewed and pinned before generation", async (t) => {
  for (const entries of [null, {}, [{}], [{ nodeName: "Custom", reason: "", source: "source.md" }],
    [{ nodeName: "Custom", reason: "Reviewed gap", source: "source.md" }, { nodeName: "Custom", reason: "Reviewed gap", source: "source.md" }]]) {
    await assert.rejects(fixture(t, false, (pages) => { pages[0].elementFallbacks = entries; }), /elementFallbacks/);
  }
  const { task, dir } = await fixture(t, false, (pages) => {
    pages[0].elementFallbacks = [{ nodeName: "CustomWidget", reason: "Candidate contracts lack the required domain interaction", source: "source.md §Special interaction + contract review" }];
  });
  const file = path.join(dir, "structure.json");
  const plan = JSON.parse(await fs.readFile(file));
  plan.pages[0].elementFallbacks[0].nodeName = "OtherWidget";
  await fs.writeFile(file, JSON.stringify(plan));
  await assert.rejects(task.command({ action: "begin_page", pagePath: "/list" }), /Reviewed task input changed/);
});

test("Page and overview creation obey pinned directory names before business content", async (t) => {
  const { task } = await fixture(t);
  await assert.rejects(task.before("execute", { name: "createComponent", input: { type: "page", path: "/list", name: "GroupList" } }), /reviewed business name/);
  await task.before("execute", { name: "createComponent", input: { type: "page", path: "/list", name: "记录列表" } });
  await assert.rejects(task.before("execute", { name: "createCanvas", input: { name: "Custom arena 1" } }), /reviewed overviewName/);
  await assert.rejects(task.before("execute", { name: "updateCanvas", input: { canvasName: "Custom arena 1", name: "Pages overview" } }), /reviewed overviewName/);
  const scope = await task.before("execute", { name: "updateCanvas", input: { canvasName: "Custom arena 1", name: "页面总览" } });
  assert.equal(scope.global, true);
  assert.equal(task.status().currentPage, null);
});

test("actual mutations require a current Page and reject sibling writes including batch aliases", async (t) => {
  const { task } = await fixture(t);
  await assert.rejects(task.before("execute", { name: "insertHtml", input: { componentUuid: "list" } }), /Begin/);
  await task.command({ action: "begin_page", pagePath: "/list" });
  assert.deepEqual((await task.before("execute", { name: "insertHtml", input: { componentUuid: "list" } })).routes, ["/list"]);
  await assert.rejects(task.before("execute", { name: "insertHtml", input: { componentUuid: "detail" } }), /Cross-Page/);
  await assert.rejects(task.before("execute_batch", { operations: [{ name: "createComponent", as: "other", input: { type: "page", name: "记录详情", path: "/detail" } }, { name: "insertHtml", input: { componentUuid: "$other" } }] }), /Cross-Page/);
  await assert.rejects(task.before("execute_batch", { operations: [{ name: "createComponent", as: "other", input: { type: "page", name: "记录详情", path: "/detail" } }, { name: "insertHtml", input: { componentUuid: "$other.0" } }] }), /Cross-Page/);
  await assert.rejects(task.before("execute", { name: "importWebPage", input: {} }), /Static reference/);
  await assert.rejects(task.command({ action: "begin_page", pagePath: "/detail" }), /Complete current/);
  await assert.rejects(task.before("import_reference", { action: "editable" }), /not a controlled/);
});

test("read-only calls collect byte metrics without invalidating checkpoints or retaining payload text", async (t) => {
  const { task, dir } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  const scope = await task.before("execute", { name: "read", input: { componentUuids: ["list"] } });
  await task.after("execute", { name: "read", input: { private: "DO_NOT_LOG" } }, { results: [] }, scope);
  assert.equal(task.status().metrics.calls, 2);
  assert.ok(task.status().metrics.rpcOutputBytes > 0);
  const log = await fs.readFile(path.join(dir, "prototype-runs", task.run.id, "events.jsonl"), "utf8");
  assert.equal(log.includes("DO_NOT_LOG"), false);
});

test("Pen-backed generation requires complete layout pagination plus an intact original image", async (t) => {
  const { task, referenceFiles } = await fixture(t, true);
  await assert.rejects(task.command({ action: "begin_page", pagePath: "/list" }), /Read complete/);
  const input = { action: "read", filePath: referenceFiles[0], nodeId: "frame" };
  const fields = ["id", "type", "layout", "width", "height", "padding", "gap", "justifyContent", "alignItems"];
  const read = (offset, items) => ({ source: { provider: "pen-mcp", filePath: referenceFiles[0], nodeId: "frame" }, read: { fields, depth: 1, offset }, items, total: 2 });
  await task.after("design_reference", input, read(0, [{ id: "frame", type: "frame" }]));
  await assert.rejects(task.command({ action: "begin_page", pagePath: "/list" }), /Read complete/);
  await task.after("design_reference", { ...input, offset: 1 }, read(1, [{ id: "child", type: "text" }]));
  await task.after("design_reference", { ...input, action: "screenshot" }, { source: read().source, data: Buffer.from("original image fixture").toString("base64") });
  await task.command({ action: "begin_page", pagePath: "/list" });
  assert.equal(task.status().currentPage, "/list");
});

test("runtime cases enforce source-pinned target/value/order and actual assertions; reopening invalidates them", async (t) => {
  const { task, context, assertions } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  const page = task.run.pages[0]; page.structural = { seq: 1 }; page.visual = { status: "review_recorded" };
  await task.command({ action: "begin_case", caseId: "edit" });
  await assert.rejects(task.before("preview", { action: "assert", checks: assertions }), /pinned runtime/);
  await assert.rejects(task.before("preview", { action: "fill", value: "wrong", ref: "runtime" }), /next pinned step/);
  const input = { action: "fill", value: "SELECT uid", ref: "runtime" };
  const scope = await task.before("preview", input);
  await task.after("preview", input, { target: { role: "textbox", name: "SQL" }, context: { ...context, previewContext: { componentUuid: "list", path: "/list/record-id" } } }, scope);
  const checks = assertions.map((check) => ({ check, passed: true, actual: "SELECT uid" }));
  await task.before("preview", { action: "assert", checks: assertions });
  await task.after("preview", { action: "assert", checks: assertions }, { passed: false, checks, context: { ...context, previewContext: { componentUuid: "list", path: "/list/record-id" } } });
  assert.equal(page.cases.edit, undefined);
  await task.after("preview", { action: "assert", checks: assertions }, { passed: true, checks, context: { ...context, previewContext: { componentUuid: "list", path: "/list/record-id" } } });
  assert.ok(page.cases.edit); assert.equal(task.run.currentCase, null);
  context.sessionId = "reopened"; await task.context();
  assert.deepEqual(page.cases, {}); assert.equal(page.structural, null); assert.equal(task.run.currentCase, null);
});

test("an unbound passed JSON file cannot serve as a structural checkpoint", async (t) => {
  const { task, dir } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  const file = path.join(dir, "report.json"); await fs.writeFile(file, JSON.stringify({ passed: true }));
  await assert.rejects(task.command({ action: "structural_check", reportPath: file }), /complete successful live/);
  assert.equal(identity({ projectId: "p", other: "omit" }).other, undefined);
});

test("saving an unchanged model preserves Page acceptance; an untracked edit invalidates it", async (t) => {
  const { task, context } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  const page = task.run.pages[0]; page.structural = { seq: 1 }; page.visual = { status: "review_recorded" };
  context.revision++;
  await task.context();
  assert.ok(page.structural); assert.ok(page.visual);
  context.changeCounter++;
  await task.context();
  assert.equal(page.structural, null); assert.equal(page.visual, null);
});

test("failed cases can be cancelled without being accepted and then retried", async (t) => {
  const { task } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  task.run.pages[0].structural = { seq: 1 };
  await task.command({ action: "begin_case", caseId: "edit" });
  assert.equal(task.status().activeCase.step, 0);
  await task.command({ action: "cancel_case" });
  assert.equal(task.status().activeCase, undefined);
  assert.deepEqual(task.status().pendingCases, ["edit"]);
  await task.command({ action: "begin_case", caseId: "edit" });
  assert.equal(task.status().activeCase.id, "edit");
});

test("native report binds validate, source files and model/layout calls through a symlink workspace", async (t) => {
  const { task, dir, context } = await fixture(t, false, () => {}, async (suite, dir) => {
    const alias = path.join(dir, "workspace-alias"); await fs.symlink(dir, alias, "dir");
    suite.slots.pages[1].intent = path.join(alias, "future", "detail.html");
  });
  assert.equal(task.run.suitePath, path.join(await fs.realpath(dir), "suite.json"));
  assert.equal(task.run.pages[1].intent, path.join(await fs.realpath(dir), "future", "detail.html"));
  await task.command({ action: "begin_page", pagePath: "/list" });
  const model = { uuid: "list", type: "page", baseVariantTplTree: "<div>Native model fixture</div>" };
  const snapshot = { frames: [{ ready: true }] };
  const call = async (method, input, result) => task.after(method, input, result, await task.before(method, input));
  await call("execute", { name: "read", input: { componentUuids: ["list"], view: "full", depth: "all" } }, { read: { depth: "all" }, results: [model] });
  await call("snapshot_layout", { componentUuid: "list", view: "full" }, snapshot);
  const validation = { componentUuids: ["list"], result: { check: "model", valid: true, errors: [], warnings: [] } };
  await call("execute", { name: "validate", input: { componentUuids: validation.componentUuids } }, validation.result);
  const { createHash } = require("node:crypto");
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const evidence = path.join(dir, "verification"); await fs.mkdir(evidence);
  const files = {};
  for (const [name, value] of Object.entries({ "overview.json": {}, "pages.json": { results: [model] }, "layouts.json": { list: { snapshot } } })) {
    const raw = JSON.stringify(value); await fs.writeFile(path.join(evidence, name), raw); files[name] = digest(raw);
  }
  const taskBytes = await fs.readFile(path.join(task.run.directory, "task.json"));
  await fs.writeFile(path.join(evidence, "reference-evidence.json"), taskBytes);
  const verifier = path.resolve(__dirname, "../../ai/plasmic/scripts/verify_all.py");
  const report = { passed: true, projectId: "project", pagePath: "/list", checks: ["evidence", "model", "rendering", "structure", "page_layout", "forms", "descriptions", "overlays", "slots", "shell_height"].map((gate) => ({ gate, status: "passed", report: { passed: true } })),
    capture: { before: identity(context), after: identity(context), build: task.build, files, validation, prototypeTask: { runId: task.run.id, sha256: digest(taskBytes) } },
    checkedInputs: { files: [...Object.entries(task.run.pinned).map(([file, sha256]) => ({ path: file, sha256 })), { path: verifier, sha256: digest(await fs.readFile(verifier)) }, { path: task.run.pages[1].intent, sha256: null }] } };
  const reportPath = path.join(evidence, "report.json");
  const write = () => fs.writeFile(reportPath, JSON.stringify(report));
  await write(); await task.command({ action: "structural_check", reportPath });
  assert.ok(task.run.pages[0].structural);
  report.capture.validation.result.valid = false;
  await write(); await assert.rejects(task.command({ action: "structural_check", reportPath }), /actual Desktop validate/);
  report.capture.validation = validation;
  // Both variables reference the same test result; restore it before next case.
  report.capture.validation.result.valid = true;
  report.checks.push({ ...report.checks[0] });
  await write(); await assert.rejects(task.command({ action: "structural_check", reportPath }), /complete successful/);
});

test("deferred navigation cases preserve completed Page phases", async (t) => {
  const { task, context, assertions } = await fixture(t, false, (pages) => {
    pages[0].runtimeCases.push({ id: "navigate", source: "source.md §Navigation", deferred: true, targetPath: "/detail", steps: [{ action: "snapshot" }], assertions: pages[0].runtimeCases[0].assertions });
  });
  await task.command({ action: "begin_page", pagePath: "/list" });
  for (const page of task.run.pages) { page.structural = { seq: 1 }; page.phase = "complete"; }
  task.run.current = "/detail";
  await task.command({ action: "begin_case", pagePath: "/list", caseId: "navigate" });
  assert.equal(task.run.pages[0].phase, "complete");
  await task.after("preview", { action: "snapshot" }, { context: { ...context, previewContext: { componentUuid: "detail", path: "/detail/record-id" } } });
  await task.after("preview", { action: "assert", checks: assertions }, { passed: true, checks: [{ passed: true }], context: { ...context, previewContext: { componentUuid: "detail", path: "/detail/record-id" } } });
  assert.ok(task.run.pages[0].cases.navigate);
  assert.ok(task.run.pages.every((p) => p.phase === "complete"));
});

test("cancellation and Desktop restart retain the baseline, Page gate and project scope", async (t) => {
  const { task, dir, context } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  await task.command({ action: "cancel" });
  await assert.rejects(task.before("execute", { name: "insertHtml", input: { componentUuid: "detail" } }), /cancelled/);
  await assert.rejects(task.before("open_design", { projectId: "unrelated" }), /bound to project/);
  await assert.rejects(task.command({ action: "start", projectId: "project" }), /resume or revise/);
  const recovered = new PrototypeTask(dir, task.editor, task.build);
  await recovered.command({ action: "resume" });
  assert.equal(recovered.run.id, task.run.id);
  assert.equal(recovered.status().currentPage, "/list");
  await assert.rejects(recovered.before("execute", { name: "insertHtml", input: { componentUuid: "detail" } }), /Cross-Page/);
  await recovered.before("open_design", { projectId: context.projectId, reopen: true });
});

test("revisions cannot remove dynamic binding or runtime requirements and can add checks", async (t) => {
  const { task, dir } = await fixture(t, false, (pages) => {
    pages[0].bindings = [{ nodeName: "Records", source: "source.md §query", props: ["data"], dynamicProps: ["data"] }];
  });
  await task.command({ action: "cancel" });
  const file = path.join(dir, "structure.json"), original = JSON.parse(await fs.readFile(file));
  const weakened = structuredClone(original); delete weakened.pages[0].bindings[0].dynamicProps;
  await fs.writeFile(file, JSON.stringify(weakened));
  await assert.rejects(task.command({ action: "resume" }), /Reviewed task input changed/);
  await assert.rejects(task.command({ action: "revise" }), /removes or rewrites/);
  const increased = structuredClone(original);
  increased.pages[0].bindings[0].propStateDependencies = { data: ["query"] };
  await fs.writeFile(file, JSON.stringify(increased));
  await task.command({ action: "revise" });
  assert.equal(task.active, true);
  assert.ok(task.run.baseline[await fs.realpath(file)]);
});

test("malformed source contracts and split logical screens fail before content generation", async (t) => {
  for (const change of [
    (pages) => { pages[0].bindings = [{ nodeName: "Rows", source: "source", propStateDependencies: ["query"] }]; },
    (pages) => { pages[0].controls = [{ nodeName: "Input", source: "source", props: ["value"] }]; },
    (pages) => { pages[1].screen = pages[0].screen; },
  ]) await assert.rejects(fixture(t, false, change), /Invalid reviewed plan/);
});

test("source roles reject the wrong component/capability before the plan is frozen", async (t) => {
  for (const use of [
    { role: "content-scope", component: "plasmic-antd6-radio-group" },
    { role: "category", component: "plasmic-antd6-table-column", props: { displayType: "text" } },
    { role: "row-actions", component: "plasmic-antd6-button" },
    { role: "pagination", component: "plasmic-antd6-table", props: { pagination: false } },
  ]) await assert.rejects(fixture(t, false, (pages) => Object.assign(pages[0].components[0], use)), /Invalid reviewed plan/);
  const uses = [
    { nodeName: "Scopes", component: "plasmic-antd6-tabs", role: "content-scope" },
    { nodeName: "Results", component: "plasmic-antd6-table", role: "pagination", props: { pagination: { defaultPageSize: 20 } }, dynamicProps: ["pagination.showTotal"] },
    { nodeName: "Category", component: "plasmic-antd6-table-column", role: "category", props: { displayType: "tag" } },
    { nodeName: "Operations", component: "plasmic-antd6-table-column", role: "widget", props: { fixed: "right", width: 200 } },
    { nodeName: "Actions", component: "plasmic-react-ui-action-group", role: "row-actions", owner: { nodeName: "Operations", slot: "render" } },
  ].map((use) => ({ ...use, purpose: "Reviewed native role", source: "source.md §Results" }));
  await fixture(t, false, (pages) => { pages[0].components = structuredClone(uses); });
  await fixture(t, false, (pages) => {
    pages[0].components = structuredClone(uses);
    pages[0].components.push({ nodeName: "ActionLayout", component: "plasmic-antd6-flex", role: "widget", purpose: "Action layout", source: "source.md §Results", owner: { nodeName: "Operations", slot: "render" } });
    pages[0].components[4].owner = { nodeName: "ActionLayout", slot: "children" };
  });
  for (const change of [
    (plan) => { plan[3].props.fixed = "left"; },
    (plan) => { plan[3].props.width = true; },
    (plan) => { plan[1].props.pagination = []; },
    (plan) => { delete plan[0].purpose; },
  ]) await assert.rejects(fixture(t, false, (pages) => { pages[0].components = structuredClone(uses); change(pages[0].components); }), /Invalid reviewed plan/);
});

test("omitting a planned widget from markup cannot bypass reading its expected contract", async (t) => {
  const { task } = await fixture(t, false, (pages) => {
    pages[0].components.push({ nodeName: "Category", component: "plasmic-antd6-tag", role: "category", purpose: "Category label", source: "source.md §Category" });
  });
  await assert.rejects(task.command({ action: "begin_page", pagePath: "/list" }), /plasmic-antd6-tag/);
  await task.after("execute", { name: "read", input: { view: "contract" } }, { results: [{ name: "plasmic-antd6-tag", props: [{ name: "value", type: "text" }] }] });
  await task.command({ action: "begin_page", pagePath: "/list" });
});

test("registered widgets require a real contract read and saved state cannot simulate an active runtime case", async (t) => {
  const { task } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  const insert = { name: "insertHtml", input: { componentUuid: "list", html: '<plasmic-component data-plasmic-component="domain-widget"></plasmic-component>' } };
  await assert.rejects(task.before("execute", insert), /registered component contracts/);
  await task.after("execute", { name: "read", input: { view: "contract" } }, { results: [{ name: "domain-widget", props: [{ name: "children", type: "slot" }] }] });
  await task.before("execute", insert);
  task.run.pages[0].structural = { seq: 1 };
  await task.command({ action: "begin_case", caseId: "edit" });
  await assert.rejects(task.before("execute", { name: "updateState", input: { componentUuid: "list", initialValue: "success" } }), /cannot simulate Preview/);
});

test("unchanged Pen evidence survives cancel/resume without another screenshot", async (t) => {
  const { task, referenceFiles } = await fixture(t, true);
  const input = { action: "read", filePath: referenceFiles[0], nodeId: "frame" };
  const source = { provider: "pen-mcp", filePath: referenceFiles[0], nodeId: "frame" };
  const result = { source, read: { fields: ["id", "type", "layout", "width", "height", "padding", "gap", "justifyContent", "alignItems"], depth: 1, offset: 0 }, items: [{ id: "frame", type: "frame" }], total: 1 };
  await task.after("design_reference", input, result);
  await task.after("design_reference", { ...input, action: "screenshot" }, { source, data: Buffer.from("reference").toString("base64") });
  await task.command({ action: "cancel" });
  await task.command({ action: "resume" });
  await task.command({ action: "begin_page", pagePath: "/list" });
  assert.equal(task.status().currentPage, "/list");
  task.run.pages[0].structural = { seq: 1 };
  await task.after("design_reference", input, result);
  assert.ok(task.run.pages[0].structural);
  await task.after("design_reference", input, { ...result, items: [{ id: "frame", type: "frame", width: 900 }] });
  assert.equal(task.run.pages[0].structural, null);
});

test("implementation intent revisions preserve business checks and invalidate only their owning Page", async (t) => {
  const { task, dir } = await fixture(t);
  await task.command({ action: "begin_page", pagePath: "/list" });
  task.run.pages[0].structural = { seq: 1 };
  task.run.pages[1].structural = { seq: 1 };
  const intent = path.join(dir, "list.html");
  await fs.writeFile(intent, '<div data-plasmic-name="Content" style="gap:16px">Reviewed Slot intent</div>');
  await task.command({ action: "revise" });
  assert.equal(task.run.pages[0].structural, null);
  assert.ok(task.run.pages[1].structural);
  await fs.writeFile(intent, '<div>Removed reviewed target</div>');
  await assert.rejects(task.command({ action: "revise" }), /preserve the named source targets/);
});

test("editing a destination invalidates dependent navigation cases without regenerating the source Page", async (t) => {
  const { task } = await fixture(t, false, (pages) => {
    pages[0].runtimeCases.push({ id: "navigate", source: "source.md §Navigation", deferred: true, targetPath: "/detail", steps: [{ action: "snapshot" }], assertions: pages[0].runtimeCases[0].assertions });
  });
  task.run.pages[0].phase = "complete"; task.run.pages[0].structural = { seq: 1 }; task.run.pages[0].cases.navigate = { seq: 2 };
  await task.command({ action: "begin_page", pagePath: "/detail" });
  const input = { name: "changeElement", input: { componentUuid: "detail", elementUuid: "element" } };
  const scope = await task.before("execute", input);
  await task.after("execute", input, {}, scope);
  assert.ok(task.run.pages[0].structural);
  assert.equal(task.run.pages[0].phase, "complete");
  assert.equal(task.run.pages[0].cases.navigate, undefined);
});

test("changed destination reference invalidates navigation evidence from another Page", async (t) => {
  const { task, referenceFiles } = await fixture(t, true, (pages) => {
    pages[0].runtimeCases.push({ id: "navigate", source: "source.md §Navigation", deferred: true, targetPath: "/detail", steps: [{ action: "snapshot" }], assertions: pages[0].runtimeCases[0].assertions });
  }, async (_suite, dir) => {
    const file = path.join(dir, "references.json"), references = JSON.parse(await fs.readFile(file));
    references.pages[1].references[0].nodeId = "detail-frame";
    await fs.writeFile(file, JSON.stringify(references));
  });
  for (const page of task.run.pages) { page.phase = "complete"; page.structural = { seq: 1 }; }
  task.run.pages[0].cases.navigate = { seq: 2 };
  await task.after("design_reference", { action: "read", filePath: referenceFiles[0], nodeId: "detail-frame" }, { read: { fields: ["id"], depth: 1, offset: 0 }, items: [{ id: "detail-frame", type: "frame" }], total: 1 });
  assert.ok(task.run.pages[0].structural);
  assert.equal(task.run.pages[0].cases.navigate, undefined);
  assert.equal(task.run.pages[1].structural, null);
});
