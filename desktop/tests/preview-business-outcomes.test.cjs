const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { runtimeCommand } = require("../src/preview-runtime.cjs");

// Run the reference's actual checks against observable DOM values/results.
// These isolated fixture algorithms are not business defaults or a prototype.
const reference = fs.readFileSync(path.join(__dirname, "../../ai/plasmic/references/design/component-policy.md"), "utf8");
const section = reference.split("## Business outcome cases\n")[1].split("## Native runtime evidence\n")[0];
const examples = JSON.parse(section.match(/```json\n([\s\S]*?)\n```/)[1]);

function fixture(t, { calculation = "correct", copying = "unique" } = {}) {
  const dom = new JSDOM(`<body>
    <label>数量<input type="number" aria-label="数量"></label>
    <label>单价<input type="number" aria-label="单价"></label>
    <label>合计<input readonly aria-label="合计" value="0.00"></label>
    <button id="copy">复制</button><div id="message"></div>
    <table><thead><tr><th>编号</th></tr></thead><tbody></tbody></table>
  </body>`, { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window, doc = w.document;
  w.requestAnimationFrame = (callback) => callback();
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 });
  Object.defineProperty(doc.body, "innerText", { get: () => doc.body.textContent });
  const quantity = doc.querySelector('[aria-label="数量"]');
  const price = doc.querySelector('[aria-label="单价"]');
  const total = doc.querySelector('[aria-label="合计"]');
  const calculate = () => {
    if (calculation === "disconnected") return;
    total.value = calculation === "constant" ? "36.00" : (Number(quantity.value) * Number(price.value)).toFixed(2);
  };
  quantity.addEventListener("input", calculate);
  price.addEventListener("input", calculate);
  const copyingCase = examples.find((example) => example.id === "copy-original-twice");
  const records = [...copyingCase.given.records];
  const render = () => {
    doc.querySelector("tbody").replaceChildren(...records.map((id) => {
      const row = doc.createElement("tr"), cell = doc.createElement("td");
      cell.textContent = id; row.append(cell); return row;
    }));
  };
  render();
  doc.getElementById("copy").addEventListener("click", () => {
    if (copying !== "message-only") {
      // The faulty branch repeats the first candidate for the same original.
      const next = copying === "duplicate" ? Number(copyingCase.given.copySource.slice(-3)) + 1 : records.length + 1;
      records.push("ITEM-" + String(next).padStart(3, "0"));
      render();
    }
    doc.getElementById("message").textContent = "已复制";
  });
  const run = (input) => w.eval(`(${runtimeCommand.toString()})(${JSON.stringify({ pageIdentity: "fixture:page:/records", ...input })},"fixture-document")`);
  return { run, doc };
}

async function calculateCase(run, example) {
  const snapshot = await run({ action: "snapshot", limit: 100 });
  for (const [name, value] of [["数量", example.given.quantity], ["单价", example.given.unitPrice]]) {
    const input = snapshot.elements.find((el) => el.name === name);
    await run({ action: "fill", ref: input.ref, value: String(value) });
  }
  return run({ action: "assert", timeoutMs: 0, checks: example.checks });
}

test("documented derived-value cases check the actual calculation for changed inputs", async (t) => {
  const { run } = fixture(t);
  for (const example of examples.filter((example) => example.kind === "derived-value")) {
    assert.equal((await calculateCase(run, example)).passed, true, example.id);
  }
});

test("connected controls with a constant/example result fail the changed-input case", async (t) => {
  const { run } = fixture(t, { calculation: "constant" });
  assert.equal((await calculateCase(run, examples[0])).passed, true);
  const changed = await calculateCase(run, examples[1]);
  assert.equal(changed.passed, false);
  assert.equal(changed.checks[0].actual, "36.00");
});

test("correct inputs without the calculation cannot pass a result assertion", async (t) => {
  const { run } = fixture(t, { calculation: "disconnected" });
  assert.equal((await calculateCase(run, examples[0])).passed, false);
});

for (const copying of ["unique", "duplicate", "message-only"]) {
  test(`documented repeat-action checks ${copying} record effects independently of success feedback`, async (t) => {
    const { run, doc } = fixture(t, { copying });
    const example = examples.find((example) => example.kind === "repeat-action");
    for (let i = 0; i < example.given.copyTimes; i++) doc.getElementById("copy").click();
    const feedback = await run({ action: "assert", timeoutMs: 0, checks: [{ kind: "text", text: "已复制", present: true }] });
    assert.equal(feedback.passed, true);
    const outcome = await run({ action: "assert", timeoutMs: 0, checks: example.checks });
    assert.equal(outcome.passed, copying === "unique");
    if (copying === "duplicate") {
      assert.deepEqual(Array.from(outcome.checks, (check) => check.actual), [4, 2, 0]);
    }
  });
}
