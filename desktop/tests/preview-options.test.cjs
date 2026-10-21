const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { runtimeCommand } = require("../src/preview-runtime.cjs");

function fixture(t) {
  // Mirrors the virtual Select's hidden ARIA list and separately rendered rows.
  const dom = new JSDOM(`<body>
    <input role="combobox" aria-label="市场" aria-expanded="true" aria-controls="markets_list">
    <div class="ant-select-dropdown">
      <div id="markets_list" role="listbox" data-a11y style="width:0;height:0;overflow:hidden">
        <div role="option" aria-label="MX 墨西哥">MX</div>
        <div role="option" aria-label="VN 越南">VN</div>
      </div>
      <div class="ant-select-item-group">市场分组</div>
      <div id="mx" class="ant-select-item ant-select-item-option" title="MX 墨西哥"><div>MX 墨西哥</div></div>
      <div id="vn" class="ant-select-item ant-select-item-option" title="VN 越南"><div>VN 越南</div></div>
      <div id="disabled" class="ant-select-item ant-select-item-option" title="不可用市场" aria-disabled="true"><div>不可用市场</div></div>
      <div class="ant-select-item-option" aria-hidden="true">隐藏市场</div>
    </div>
    <div class="ant-select-item-option">弹层外的同名样式</div>
    <div class="ant-select-dropdown"><div role="listbox" id="unowned_list"></div><div class="ant-select-item-option">未关联市场</div></div>
  </body>`, { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.requestAnimationFrame = (callback) => callback();
  for (const el of w.document.querySelectorAll("*")) {
    el.getBoundingClientRect = () => {
      const size = el.closest("[data-a11y]") ? 0 : 30;
      return { x: 0, y: 0, left: 0, top: 0, width: size, height: size, right: size, bottom: size };
    };
    el.scrollIntoView = () => {};
  }
  w.document.elementFromPoint = () => w.document.querySelector("#vn > div");
  Object.defineProperty(w.document.body, "innerText", { get: () => w.document.body.textContent });
  const run = (input) => w.eval(`(${runtimeCommand.toString()})(${JSON.stringify({ pageIdentity: "session:page:/records", ...input })},"document-id")`);
  return { run, w };
}

test("virtual Select exposes exactly the rendered option rows to snapshots and assertions", async (t) => {
  const { run } = fixture(t);
  const snapshot = await run({ action: "snapshot", limit: 100 });
  assert.deepEqual(Array.from(snapshot.elements.filter((el) => el.role === "option"), (el) => el.name),
    ["MX 墨西哥", "VN 越南", "不可用市场"]);
  assert.equal((await run({ action: "assert", timeoutMs: 0, checks: [
    { kind: "count", role: "option", count: 3 },
    { kind: "count", role: "option", name: "VN 越南", count: 1 },
    { kind: "visible", role: "option", name: "VN 越南", present: true },
    { kind: "visible", role: "option", name: "未关联市场", present: false },
  ] })).passed, true);
  assert.match(snapshot.text.value, /VN 越南/);
});

test("option refs target the rendered row and preserve disabled/hidden/stale checks", async (t) => {
  const { run, w } = fixture(t);
  const snapshot = await run({ action: "snapshot", limit: 100 });
  const option = snapshot.elements.find((el) => el.role === "option" && el.name === "VN 越南");
  assert.ok(option?.ref, "Visible VN option needs an actionable ref");
  const click = await run({ action: "click", ref: option.ref });
  assert.equal(click.target.role, "option");
  assert.equal(click.target.name, "VN 越南");
  const disabled = snapshot.elements.find((el) => el.name === "不可用市场");
  assert.equal(disabled.disabled, true);
  await assert.rejects(run({ action: "click", ref: disabled.ref }), /disabled/);
  w.document.querySelector(".ant-select-dropdown").setAttribute("aria-hidden", "true");
  await assert.rejects(run({ action: "click", ref: option.ref }), /hidden/);
  w.document.getElementById("vn").remove();
  await assert.rejects(run({ action: "click", ref: option.ref }), /Stale/);
});

test("virtual option inference requires an expanded combobox and its actual listbox", async (t) => {
  const { run, w } = fixture(t);
  const control = w.document.querySelector("input");
  for (const change of [
    () => control.setAttribute("aria-expanded", "false"),
    () => { control.setAttribute("aria-expanded", "true"); control.setAttribute("aria-controls", "missing_list"); },
    () => { control.setAttribute("aria-controls", "markets_list"); w.document.getElementById("markets_list").setAttribute("role", "group"); },
  ]) {
    change();
    assert.equal((await run({ action: "assert", timeoutMs: 0, checks: [{ kind: "count", role: "option", count: 0 }] })).passed, true);
  }
});

test("aria-owns and native option roles retain their existing semantics without duplicates", async (t) => {
  const { run, w } = fixture(t);
  const control = w.document.querySelector("input");
  control.setAttribute("aria-owns", "markets_list");
  let snapshot = await run({ action: "snapshot", limit: 100 });
  assert.equal(snapshot.elements.filter((el) => el.role === "option").length, 3);
  control.removeAttribute("aria-controls");
  w.document.getElementById("mx").setAttribute("role", "option");
  w.document.getElementById("vn").setAttribute("role", "menuitem");
  snapshot = await run({ action: "snapshot", limit: 100 });
  assert.equal(snapshot.elements.filter((el) => el.role === "option").length, 2);
  assert.equal(snapshot.elements.find((el) => el.name === "VN 越南").role, "menuitem");
});

test("option refs remain available through normal snapshot pagination", async (t) => {
  const { run } = fixture(t);
  const elements = [];
  let offset = 0;
  do {
    const page = await run({ action: "snapshot", offset, limit: 2 });
    elements.push(...page.elements);
    offset = page.nextOffset;
  } while (offset !== undefined);
  assert.equal(elements.filter((el) => el.role === "option").length, 3);
  assert.equal(new Set(elements.map((el) => el.ref)).size, elements.length);
});
