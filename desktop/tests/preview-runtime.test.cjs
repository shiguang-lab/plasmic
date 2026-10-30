const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { runtimeCommand, previewFrame, runPreview } = require("../src/preview-runtime.cjs");

function fixture(t) {
  const dom = new JSDOM('<body><label for="sql">SQL</label><textarea id="sql">SELECT old</textarea><button>查询</button><button disabled>保存</button><select aria-label="状态"><option value="active">启用</option><option value="disabled">停用</option></select><input type="password" value="secret"></body>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.innerWidth = 1440; w.innerHeight = 720;
  w.requestAnimationFrame = (callback) => callback();
  for (const el of w.document.querySelectorAll("*")) el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 });
  Object.defineProperty(w.document.body, "innerText", { get: () => w.document.body.textContent });
  const run = (input, caller) => w.eval(`(${runtimeCommand.toString()})(${JSON.stringify({ pageIdentity: "session:page:/records", ...input })},"document-id",${JSON.stringify(caller)})`);
  return { run, w };
}

test("runtime snapshot is paged, redacts passwords, and expires refs on navigation", async (t) => {
  const { run } = fixture(t);
  const page = await run({ action: "snapshot", limit: 1 });
  assert.equal(page.elements.length, 1); assert.equal(page.nextOffset, 1);
  const full = await run({ action: "snapshot" });
  assert.equal(full.elements.find((e) => e.name === "SQL").value, "SELECT old");
  assert.equal(full.elements.at(-1).value, "[redacted]");
  await assert.rejects(run({ action: "fill", ref: page.elements[0].ref, value: "bad", pageIdentity: "session:other:/other" }), /Stale/);
});

test("snapshot continuation traverses both independent collections without repeating output", async (t) => {
  for (const limits of [{ limit: 1, textLimit: 1000 }, { limit: 100, textLimit: 3 }, { limit: 2, textLimit: 5 }]) {
    const { run } = fixture(t);
    const full = await run({ action: "snapshot", limit: 100, textLimit: 1000 });
    let input = { action: "snapshot", ...limits }, text = "", refs = [], steps = 0;
    while (input) {
      const part = await run(input);
      refs.push(...part.elements.map((e) => e.ref));
      text += part.text.value;
      if (part.continuation) {
        assert.equal(part.continuation.tool, "preview");
        assert.ok(part.nextOffset !== undefined || part.text.nextOffset !== undefined);
        assert.equal(part.continuation.arguments.limit, limits.limit);
        assert.equal(part.continuation.arguments.textLimit, limits.textLimit);
      } else {
        assert.equal(part.nextOffset, undefined);
        assert.equal(part.text.nextOffset, undefined);
      }
      input = part.continuation?.arguments;
      assert.ok(++steps < 100, "continuation must terminate");
    }
    assert.deepEqual(refs, Array.from(full.elements, (e) => e.ref));
    assert.equal(new Set(refs).size, refs.length);
    assert.equal(text, full.text.value);
  }
});

test("fill/select dispatch DOM events and assertions observe actual runtime values", async (t) => {
  const { run, w } = fixture(t), events = [];
  w.document.getElementById("sql").addEventListener("input", (e) => events.push(e.target.value));
  const snapshot = await run({ action: "snapshot" });
  const sql = snapshot.elements.find((e) => e.name === "SQL");
  await run({ action: "fill", ref: sql.ref, value: "SELECT uid FROM cdm_users" });
  assert.deepEqual(events, ["SELECT uid FROM cdm_users"]);
  assert.equal((await run({ action: "assert", checks: [{ kind: "value", role: "textbox", name: "SQL", value: events[0] }], timeoutMs: 0 })).passed, true);
  assert.equal((await run({ action: "assert", checks: [{ kind: "value", role: "textbox", name: "SQL", value: "wrong" }], timeoutMs: 0 })).passed, false);
  await run({ action: "select", ref: snapshot.elements.find((e) => e.name === "状态").ref, value: "disabled" });
  assert.equal(w.document.querySelector("select").value, "disabled");
  await assert.rejects(run({ action: "click", ref: snapshot.elements.find((e) => e.name === "保存").ref }), /disabled/);
  w.document.getElementById("sql").remove();
  await assert.rejects(run({ action: "fill", ref: sql.ref, value: "wrong" }), /Stale/);
});

test("Preview feedback follows real targets, keeps reads silent, and clears failed interactions", async (t) => {
  const { run, w } = fixture(t), feedback = [];
  w.addEventListener("plasmic-agent-cursor", (e) => feedback.push(e.detail));
  const snapshot = await run({ action: "snapshot" });
  assert.equal(feedback.filter((e) => e.action === "move").length, 0);
  const query = snapshot.elements.find((e) => e.name === "查询");
  w.document.elementFromPoint = () => w.document.querySelector("button");
  w.document.querySelector("button").scrollIntoView = () => {};
  const result = await run({ action: "hover", ref: query.ref }, { id: "codex", name: "Codex" });
  assert.equal(feedback.at(-1).caller.name, "Codex");
  assert.equal(feedback.at(-1).element, w.document.querySelector("button"));
  assert.deepEqual({ ...feedback.at(-1).point }, { x: result.point.x, y: result.point.y });
  await run({ action: "fill", ref: snapshot.elements.find((e) => e.name === "SQL").ref, value: "new" }, { id: "chatgpt", name: "ChatGPT" });
  assert.equal(feedback.at(-1).caller.name, "ChatGPT");
  assert.equal(feedback.at(-1).element, w.document.querySelector("textarea"));
  await assert.rejects(run({ action: "click", ref: snapshot.elements.find((e) => e.name === "保存").ref }), /disabled/);
  assert.equal(feedback.at(-1).action, "clear");
});

test("Preview screenshots hide feedback and restore it even when capture fails", async () => {
  const calls = [];
  const frame = { url: "https://canvas.example/#live=true", executeJavaScript: async (script) => {
    if (script.includes("inspectPreview")) return { ready: true, width: 800, height: 600 };
    calls.push(script.includes('action:"hide"') ? "hide" : script.includes('action:"clear"') ? "clear" : "show");
  } };
  const win = { getContentBounds: () => ({ width: 800, height: 600 }), webContents: {
    getURL: () => "https://studio.example/projects/p/preview#/records", getZoomFactor: () => 1,
    mainFrame: { framesInSubtree: [frame] }, capturePage: async () => { calls.push("capture"); throw new Error("capture failed"); },
  } };
  await assert.rejects(runPreview(win, { action: "screenshot" }, { sessionId: "s" }), /capture failed/);
  assert.deepEqual(calls, ["hide", "capture", "show", "clear"]);
});

test("background runtime discovery uses the committed Preview root and waits for the requested Page", { timeout: 2000 }, async (t) => {
  const dom = new JSDOM('<div class="live-root-container" data-plasmic-preview-component="old-page"><button>运行</button></div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() }; w.requestAnimationFrame = () => 0;
  w.document.querySelector(".live-root-container").getBoundingClientRect = () => ({ width: 1440, height: 720 });
  const frame = { url: w.location.href, executeJavaScript: (script) => w.eval(script) };
  const retained = { url: "https://canvas.example/#canvas=true", executeJavaScript: () => { throw new Error("Read stale editor frame"); } };
  const win = { webContents: { getURL: () => "https://studio.example/projects/p/preview#/records", mainFrame: { framesInSubtree: [retained, frame] } } };
  setTimeout(() => w.document.querySelector(".live-root-container").setAttribute("data-plasmic-preview-component", "requested-page"), 20);
  const result = await previewFrame(win, "requested-page");
  assert.equal(result.frame, frame);
  assert.equal(result.layout.componentUuid, "requested-page");
});

test("navigation waits for both the requested DOM identity and a committed runtime", { timeout: 2000 }, async (t) => {
  const dom = new JSDOM('<div class="live-root-container" data-plasmic-preview-component="old-page">Old data</div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() }; w.requestAnimationFrame = (cb) => cb();
  const runtime = { generation: 2, componentUuid: "new-page", status: "loading", errors: [] };
  w.__plasmicLive = { getDiagnostics: () => ({ ...runtime }) };
  const frame = { url: w.location.href, executeJavaScript: (script) => w.eval(script) };
  const win = { webContents: { getURL: () => "https://studio.example/projects/p/preview#/new", mainFrame: { framesInSubtree: [frame] } } };
  const context = { previewContext: { componentUuid: "new-page" } };
  assert.equal((await runPreview(win, { action: "state" }, context)).ready, false);
  runtime.status = "ready";
  assert.equal((await runPreview(win, { action: "state" }, context)).ready, false, "An old DOM must not be relabelled by runtime metadata");
  runtime.status = "loading";
  w.document.querySelector(".live-root-container").setAttribute("data-plasmic-preview-component", "new-page");
  assert.equal((await runPreview(win, { action: "state" }, context)).ready, false, "DOM alone cannot certify a commit");
  let accepted = false;
  const opening = previewFrame(win, "new-page").then((result) => { accepted = true; return result; });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(accepted, false);
  runtime.status = "ready";
  assert.equal((await opening).layout.componentUuid, "new-page");
  assert.equal((await runPreview(win, { action: "state" }, context)).ready, true);
});

test("Preview render errors surface immediately instead of a misleading missing-canvas timeout", async (t) => {
  const dom = new JSDOM('<div data-plasmic-preview-error>Invalid registered widget prop</div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() }; w.requestAnimationFrame = (cb) => cb();
  const failure = w.document.querySelector("[data-plasmic-preview-error]");
  failure.setAttribute("data-plasmic-error-name", "TypeError");
  failure.setAttribute("data-plasmic-error-stack", "TypeError: Invalid registered widget prop\n at preparePreview");
  const win = { webContents: { getURL: () => "https://studio.example/projects/p/preview#/records", mainFrame: { framesInSubtree: [{ url: w.location.href, executeJavaScript: (s) => w.eval(s) }] } } };
  await assert.rejects(previewFrame(win, "page"), (error) => {
    assert.equal(error.message, "Invalid registered widget prop");
    assert.equal(error.context.code, "PREVIEW_RUNTIME_ERROR");
    assert.equal(error.context.runtime.status, "failed");
    return true;
  });
  const state = await runPreview(win, { action: "state" }, {});
  assert.equal(state.ready, false);
  assert.equal(state.runtime.errors[0].message, "Invalid registered widget prop");
  assert.equal(state.runtime.errors[0].name, "TypeError");
  assert.match(state.runtime.errors[0].stack, /at preparePreview/);
});

test("committed Pages with a display:contents root are ready without a root border box", { timeout: 25000 }, async (t) => {
  const dom = new JSDOM('<div class="live-root-container" style="display:contents" data-plasmic-preview-component="page"><button>运行</button></div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() };
  w.requestAnimationFrame = (cb) => cb();
  assert.equal(w.document.querySelector(".live-root-container").getBoundingClientRect().width, 0);
  const frame = { url: w.location.href, executeJavaScript: (s) => w.eval(s) };
  const win = { webContents: { getURL: () => "https://studio.example/projects/p/preview#/records", mainFrame: { framesInSubtree: [frame] } } };
  assert.equal((await previewFrame(win, "page")).layout.ready, true);
});

function pendingRuntime(stage) {
  const calls = [], abort = new AbortController();
  let release, entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const hang = () => { entered(); return new Promise((resolve) => { release = resolve; }); };
  const layout = { ready: true, width: 1440, height: 720, componentUuid: "page" };
  const target = { point: { x: 50, y: 15 }, target: { role: "button", name: "跳转" } };
  const parent = { frames: [], executeJavaScript: async () => stage === "geometry" ? hang() : { x: 0, y: 0, sx: 1, sy: 1 } };
  const frame = { parent, url: "https://canvas.example/#live=true", executeJavaScript: async (script) => {
    if (script.includes("inspectPreview")) return stage === "discovery" ? hang() : layout;
    if (script.startsWith("Promise.race")) return hang(); // Old iframe no longer answers after a click.
    return stage === "target" ? hang() : { result: target };
  } };
  parent.frames = [frame];
  const win = { webContents: {
    getURL: () => "https://studio.example/projects/p/preview#/records",
    mainFrame: { framesInSubtree: [frame] }, getZoomFactor: () => 1,
    capturePage: hang,
    debugger: { isAttached: () => true, sendCommand: async (method, input) => {
      calls.push({ method, ...input });
      if (stage === "input") return hang();
    } },
  }, getContentBounds: () => ({ width: 1440, height: 720 }) };
  return { win, abort, calls, started, release: (value = target) => release(value) };
}

for (const stage of ["discovery", "target", "geometry", "input", "settle", "capture"]) {
  test(`Preview cancellation releases a stalled ${stage} wait without late input`, { timeout: 2000 }, async () => {
    const f = pendingRuntime(stage);
    const operation = runPreview(f.win, { action: stage === "capture" ? "screenshot" : "click", ref: "ref" }, { sessionId: "s", previewContext: { componentUuid: "page" } }, f.abort.signal);
    const failed = assert.rejects(operation, /Preview deadline/);
    await f.started;
    f.abort.abort(new Error("Preview deadline"));
    await failed;
    const count = f.calls.length;
    assert.equal(count, stage === "input" ? 1 : stage === "settle" ? 3 : 0);
    f.release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.calls.length, count, "An expired command dispatched more input");
  });
}

test("a cancelled Preview action releases the actual controller queue for close and model reads", { timeout: 2000 }, async (t) => {
  const Module = require("node:module"), originalLoad = Module._load;
  Module._load = function (name, ...args) {
    return name === "electron" ? { app: { getPath: () => require("node:os").tmpdir() }, ipcMain: { on() {}, removeListener() {} } } : originalLoad.call(this, name, ...args);
  };
  const { DesktopController } = require("../src/controller.cjs");
  Module._load = originalLoad;
  const f = pendingRuntime("settle");
  f.win.isDestroyed = () => false;
  let mode = "preview";
  f.win.webContents.getURL = () => `https://studio.example/projects/p${mode === "preview" ? "/preview#/records" : ""}`;
  const controller = new DesktopController(() => f.win, { studioOrigin: "https://studio.example" });
  t.after(() => controller.close());
  controller.checkContext = async () => {};
  const events = [];
  t.mock.method(AbortSignal, "timeout", (ms) => {
    assert.equal(ms, 30000);
    return f.abort.signal;
  });
  controller.editor = async (name, input) => {
    if (name === "getEditorContext") return { mode, projectId: "p", sessionId: "s", changeCounter: 0, previewContext: { componentUuid: "page" } };
    if (name === "preview") { events.push(input.action); mode = "edit"; return { closed: true }; }
    events.push(name);
    return { resumed: name };
  };
  const failed = assert.rejects(controller.dispatch("preview", { action: "click", ref: "ref" }), (error) => {
    assert.match(error.message, /runtime timed out after 30 seconds/);
    assert.equal(error.context.code, "PREVIEW_TIMEOUT");
    assert.equal(error.context.operationExecuted, true);
    assert.equal(error.context.canContinueRound, false);
    assert.equal(error.context.recovery[0].arguments.action, "close");
    return true;
  });
  await f.started;
  const close = controller.dispatch("preview", { action: "close" });
  const read = controller.dispatch("execute", { name: "read", input: {} });
  f.abort.abort(new DOMException("deadline", "TimeoutError"));
  await failed;
  assert.equal((await close).context.mode, "edit");
  assert.deepEqual(await read, { resumed: "read" });
  assert.deepEqual(events, ["close", "read"]);
  assert.equal(controller.operations.size, 0);
  f.release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 3);
});
