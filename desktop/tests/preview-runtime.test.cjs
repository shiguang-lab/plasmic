const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { runtimeCommand, previewFrame } = require("../src/preview-runtime.cjs");

function fixture(t) {
  const dom = new JSDOM('<body><label for="sql">SQL</label><textarea id="sql">SELECT old</textarea><button>查询</button><button disabled>保存</button><select aria-label="状态"><option value="active">启用</option><option value="disabled">停用</option></select><input type="password" value="secret"></body>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.innerWidth = 1440; w.innerHeight = 720;
  w.requestAnimationFrame = (callback) => callback();
  for (const el of w.document.querySelectorAll("*")) el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 });
  Object.defineProperty(w.document.body, "innerText", { get: () => w.document.body.textContent });
  const run = (input) => w.eval(`(${runtimeCommand.toString()})(${JSON.stringify({ pageIdentity: "session:page:/records", ...input })},"document-id")`);
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

test("fill/select dispatch DOM events and assertions observe actual runtime values", async (t) => {
  const { run, w } = fixture(t), events = [];
  w.document.getElementById("sql").addEventListener("input", (e) => events.push(e.target.value));
  const snapshot = await run({ action: "snapshot" });
  const sql = snapshot.elements.find((e) => e.name === "SQL");
  await run({ action: "fill", ref: sql.ref, value: "SELECT uid FROM cdm_users", expectedTarget: { role: "textbox", name: "SQL" } });
  assert.deepEqual(events, ["SELECT uid FROM cdm_users"]);
  assert.equal((await run({ action: "assert", checks: [{ kind: "value", role: "textbox", name: "SQL", value: events[0] }], timeoutMs: 0 })).passed, true);
  assert.equal((await run({ action: "assert", checks: [{ kind: "value", role: "textbox", name: "SQL", value: "wrong" }], timeoutMs: 0 })).passed, false);
  await run({ action: "select", ref: snapshot.elements.find((e) => e.name === "状态").ref, value: "disabled" });
  assert.equal(w.document.querySelector("select").value, "disabled");
  await assert.rejects(run({ action: "fill", ref: sql.ref, value: "wrong", expectedTarget: { name: "Other" } }), /does not match/);
  await assert.rejects(run({ action: "click", ref: snapshot.elements.find((e) => e.name === "保存").ref }), /disabled/);
  w.document.getElementById("sql").remove();
  await assert.rejects(run({ action: "fill", ref: sql.ref, value: "wrong" }), /Stale/);
});

test("background runtime discovery uses the committed Preview root and waits for the requested Page", { timeout: 2000 }, async (t) => {
  const dom = new JSDOM('<div class="live-root-container" data-plasmic-preview-component="old-page"><button>运行</button></div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() }; w.requestAnimationFrame = () => 0;
  w.document.querySelector(".live-root-container").getBoundingClientRect = () => ({ width: 1440, height: 720 });
  const frame = { url: w.location.href, executeJavaScript: (script) => w.eval(script) };
  const retained = { url: "https://canvas.example/#canvas=true", executeJavaScript: () => { throw new Error("Read stale editor frame"); } };
  const win = { webContents: { getURL: () => "https://studio.example/projects/p/preview/records", mainFrame: { framesInSubtree: [retained, frame] } } };
  setTimeout(() => w.document.querySelector(".live-root-container").setAttribute("data-plasmic-preview-component", "requested-page"), 20);
  const result = await previewFrame(win, "requested-page");
  assert.equal(result.frame, frame);
  assert.equal(result.layout.componentUuid, "requested-page");
});

test("Preview render errors surface immediately instead of a misleading missing-canvas timeout", async (t) => {
  const dom = new JSDOM('<div data-plasmic-preview-error>Invalid registered widget prop</div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() }; w.requestAnimationFrame = (cb) => cb();
  const win = { webContents: { getURL: () => "https://studio.example/projects/p/preview/records", mainFrame: { framesInSubtree: [{ url: w.location.href, executeJavaScript: (s) => w.eval(s) }] } } };
  await assert.rejects(previewFrame(win, "page"), /Native Preview render failed: Invalid registered widget prop/);
});
