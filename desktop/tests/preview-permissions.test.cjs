const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { JSDOM } = require("jsdom");
const { runtimeCommand } = require("../src/preview-runtime.cjs");

// Verify the actual reference predicate and runnable plan, not a duplicated
// expected policy. This fixture does not certify a delivered business Page.
const root = path.join(__dirname, "../..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-permissions-"));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const generated = JSON.parse(execFileSync("python3", ["-B",
  path.join(root, "ai/plasmic/scripts/prepare_plan.py"), "example", path.join(temporary, "example")], { encoding: "utf8" }));
const page = JSON.parse(fs.readFileSync(generated.plan, "utf8")).pages[0];
const reference = fs.readFileSync(path.join(root, "ai/plasmic/references/design/permissions.md"), "utf8");
const source = reference.match(/```javascript\n([\s\S]*?)\n```/)[1];
const sandbox = vm.createContext({});
vm.runInContext(source, sandbox);
const { allowed, commitDisable } = sandbox;
const contracts = Object.fromEntries(page.actionContracts.map((contract) => [contract.key, contract]));
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture(t, example, policy = allowed) {
  const state = clone(example.given);
  const dom = new JSDOM("<body><table><tbody></tbody></table><div id='message'></div></body>", { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window, doc = w.document;
  w.requestAnimationFrame = (callback) => callback();
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 });
  Object.defineProperty(doc.body, "innerText", { get: () => doc.body.textContent });
  const render = () => {
    doc.querySelector("tbody").replaceChildren(...state.records.filter((record) => policy(state.viewer, "view", record)).map((record) => {
      const row = doc.createElement("tr");
      for (const text of [record.id, record.status === "ACTIVE" ? "启用" : "停用"]) {
        const cell = doc.createElement("td"); cell.textContent = text; row.append(cell);
      }
      const actions = doc.createElement("td");
      for (const [key, label] of [["view", "详情"], ["disable", "停用"]]) {
        if (!policy(state.viewer, key, record)) continue;
        const button = doc.createElement("button"); button.textContent = label;
        actions.append(button);
      }
      row.append(actions); return row;
    }));
  };
  render();
  const run = (input) => w.eval(`(${runtimeCommand.toString()})(${JSON.stringify({ pageIdentity: "fixture:page:/records", ...input })},"fixture-document")`);
  const check = () => run({ action: "assert", timeoutMs: 0, checks: example.checks });
  return { state, doc, render, check };
}

for (const [action, contract] of Object.entries(contracts)) {
  for (const example of contract.cases.filter((item) => item.kind.startsWith("permission-"))) {
    test(`runnable ${action} case ${example.id} observes actual role and market outcomes`, async (t) => {
      assert.equal((await fixture(t, example).check()).passed, true);
    });
  }
}

test("administrator-only shortcut fails the source-allowed operator and reader cases", async (t) => {
  for (const role of ["operator", "reader"]) {
    const example = contracts.view.cases.find((item) => item.kind === "permission-allowed" && item.given.viewer.role === role);
    const faulty = (viewer, action, record) => viewer.role === "administrator" && allowed(viewer, action, record);
    assert.equal((await fixture(t, example, faulty).check()).passed, false, role);
  }
});

test("status-only actions and administrator market bypass fail independent denied fixtures", async (t) => {
  const statusOnly = (_viewer, action, record) => action === "view" || record.status === "ACTIVE";
  for (const example of contracts.disable.cases.filter((item) => item.kind === "permission-denied")) {
    assert.equal((await fixture(t, example, statusOnly).check()).passed, false, example.id);
  }
  const scopeCase = contracts.view.cases.find((item) => item.kind === "permission-denied");
  const allMarkets = (viewer, action, record) => viewer.role === "administrator" || allowed(viewer, action, record);
  assert.equal((await fixture(t, scopeCase, allMarkets).check()).passed, false);
});

test("confirmation and cancellation examples assert record effects as well as feedback", async (t) => {
  for (const example of contracts.disable.cases.filter((item) => ["confirm-cancel", "confirm-accept", "state-transition"].includes(item.kind))) {
    const f = fixture(t, example);
    if (example.given.decision === "accept") {
      assert.equal(commitDisable(f.state, example.given.recordId), true);
      f.doc.getElementById("message").textContent = "已停用";
    }
    f.render();
    assert.equal((await f.check()).passed, true, example.id);
  }
  const accepted = contracts.disable.cases.find((item) => item.kind === "confirm-accept");
  const messageOnly = fixture(t, accepted);
  messageOnly.doc.getElementById("message").textContent = "已停用";
  assert.equal((await messageOnly.check()).passed, false);
});

test("direct submission must reject nonadministrators and unauthorized markets without mutation", () => {
  const initial = contracts.disable.cases.find((item) => item.kind === "permission-allowed").given;
  const attempts = [
    { viewer: { id: "USER-001", role: "operator", authorizedMarkets: ["MX"] } },
    { viewer: { id: "USER-001", role: "reader", authorizedMarkets: ["MX"] } },
    { viewer: { id: "USER-001", role: "administrator", authorizedMarkets: ["VN"] } },
    { viewer: { id: "USER-001", role: "administrator" } },
    { viewer: { role: "administrator", authorizedMarkets: ["MX"] } },
    { viewer: { id: "USER-001", role: "unknown", authorizedMarkets: ["MX"] } },
    { viewer: null },
  ];
  for (const attempt of attempts) {
    const state = { ...clone(initial), ...attempt };
    const before = clone(state.records);
    assert.equal(commitDisable(state, initial.recordId), false);
    assert.deepEqual(state.records, before);
  }
  const state = clone(initial);
  assert.equal(commitDisable(state, "MISSING"), false);
  assert.deepEqual(state, initial);
});

test("button filtering cannot make an unguarded direct handler pass rejection checks", () => {
  const initial = clone(contracts.disable.cases.find((item) => item.kind === "permission-allowed").given);
  initial.viewer.role = "reader";
  assert.equal(allowed(initial.viewer, "disable", initial.records[0]), false);
  const unguarded = (state, id) => {
    const record = state.records.find((item) => item.id === id);
    record.status = "INACTIVE";
    return true;
  };
  const state = clone(initial);
  assert.equal(unguarded(state, initial.recordId), true);
  assert.notDeepEqual(state.records, initial.records);
  const guarded = clone(initial);
  assert.equal(commitDisable(guarded, initial.recordId), false);
  assert.deepEqual(guarded.records, initial.records);
});

test("confirmation reevaluates revoked role, scope and changed record state", () => {
  const initial = contracts.disable.cases.find((item) => item.kind === "permission-allowed").given;
  for (const revoke of [
    (state) => { state.viewer.role = "operator"; },
    (state) => { state.viewer.authorizedMarkets = []; },
    (state) => { state.records[0].market = "VN"; },
    (state) => { state.records[0].status = "INACTIVE"; },
    (state) => { state.records = []; },
  ]) {
    const state = clone(initial);
    assert.equal(allowed(state.viewer, "disable", state.records[0]), true);
    revoke(state);
    const before = clone(state.records);
    assert.equal(commitDisable(state, initial.recordId), false);
    assert.deepEqual(state.records, before);
  }
});
