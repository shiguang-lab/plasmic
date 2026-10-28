const test = require("node:test");
const assert = require("node:assert/strict");
const { IslandActivity, operationKind } = require("../src/island-activity.cjs");

test("call lifetime holds cards through queues and concurrency, then expires after ten idle minutes", (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const activity = new IslandActivity();
  assert.equal(activity.keepExpanded(), false);
  activity.enqueue("read", "execute", { name: "read" });
  activity.start("read");
  activity.enqueue("next", "execute_batch", {});
  now = 700_000;
  assert.equal(activity.keepExpanded(), true, "long-running calls never time out the card");
  activity.finish("read");
  assert.equal(activity.keepExpanded(), true, "queued calls retain the card before they start");
  activity.start("next");
  activity.enqueue("parallel", "list_projects", {});
  activity.start("parallel");
  activity.finish("next", new Error("write failed"));
  now += 700_000;
  assert.equal(activity.keepExpanded(), true, "concurrent calls retain the card after failures");
  activity.finish("parallel");
  now += 599_999;
  assert.equal(activity.keepExpanded(), true);
  now++;
  assert.equal(activity.keepExpanded(), false, "expiry is measured from the last completion");
  activity.enqueue("metadata", "get_app_state", {});
  assert.equal(activity.keepExpanded(), true, "quiet external calls also expand the card");
  activity.finish("metadata", new Error("unavailable"));
  now += 599_999;
  assert.equal(activity.keepExpanded(), true, "failed calls also restart the idle lease");
  // Snapshot polling, old task metadata and repeated finishes cannot extend the lease.
  activity.reportTask({taskId:"t",projectId:"p",sequence:0,title:"Task",status:"running"}, "s");
  activity.snapshot("p", "s"); activity.snapshot("other", "new-session"); activity.finish("metadata");
  now++;
  assert.equal(activity.keepExpanded(), false);
});

test("pointer dismissal survives existing calls and results until a new call arrives", () => {
  const activity = new IslandActivity();
  activity.enqueue("running", "execute", { name: "read" });
  activity.start("running");
  activity.enqueue("queued", "execute", { name: "read" });
  activity.dismissExpansion();
  assert.equal(activity.keepExpanded(), false, "active and queued calls yield to pointer dismissal");
  activity.bind("running", { projectId: "p", sessionId: "s" });
  activity.reportTask({ taskId: "t", projectId: "p", sequence: 0, title: "Read", status: "running" }, "s");
  activity.finish("running");
  activity.start("queued");
  assert.equal(activity.keepExpanded(), false, "starting an already queued call does not reopen the card");
  activity.finish("queued", new Error("read failed"));
  assert.equal(activity.keepExpanded(), false, "completion and failure cannot undo dismissal");
  assert.equal(activity.snapshot("p", "s").operation.error, "read failed", "dismissal preserves operation feedback");
  activity.enqueue("metadata", "get_app_state", {});
  assert.equal(activity.keepExpanded(), true, "a new quiet call also reopens the card");
  activity.dismissExpansion();
  activity.enqueue("concurrent", "execute", { name: "read" });
  assert.equal(activity.keepExpanded(), true, "a new concurrent call reopens the card");
  activity.finish("metadata");
  activity.finish("concurrent");
  assert.equal(activity.keepExpanded(), true, "the new call retains its normal idle lease");
  activity.dismissExpansion();
  assert.equal(activity.keepExpanded(), false, "pointer dismissal also overrides an unexpired idle lease");
});

test("island reports real read/write/Preview activity and ignores metadata polling", () => {
  for (const name of ["identify", "getEditorContext", "endCanvasInspection"]) assert.equal(operationKind("execute", { name }), null);
  assert.equal(operationKind("get_app_state"), null);
  assert.equal(operationKind("report_task"), null);
  assert.equal(operationKind("preview", { action: "state" }), null);
  for (const name of ["read", "queryElements", "beginCanvasInspection"]) assert.equal(operationKind("execute", { name }), "read");
  assert.equal(operationKind("execute", { name: "changeElement" }), "write");
  for (const name of ["navigate", "selectElement", "restoreEditorView", "setCanvasPageHeight"]) assert.equal(operationKind("execute", { name }), "view");
  assert.equal(operationKind("execute_batch"), "write");
  for (const name of ["make_vector", "vectorize_image"]) {
    assert.equal(operationKind(name), "resource", "local vector output reports activity without canvas feedback");
    assert.equal(operationKind(name, { componentUuid: "page" }), "write");
  }
  assert.equal(operationKind("execute", { name: "save" }), "save");
  assert.equal(operationKind("preview", { action: "snapshot" }), "read");
  assert.equal(operationKind("preview", { action: "click" }), "preview");
});

test("queued operations cannot displace a running operation; results expire and sessions are isolated", () => {
  const activity = new IslandActivity();
  activity.enqueue("first", "execute", { name: "read" });
  activity.start("first"); activity.bind("first", { projectId: "p", sessionId: "s" });
  activity.enqueue("second", "execute_batch", {});
  const running = activity.snapshot("p", "s");
  assert.equal(running.operation.id, "first");
  assert.equal(running.queued, 1);
  assert.equal(running.task, null, "tool counts do not invent task plans");
  activity.finish("first"); activity.start("second");
  activity.bind("second", { projectId: "p", sessionId: "s" });
  assert.equal(activity.snapshot("p", "s").operation.id, "second");
  assert.equal(activity.snapshot("other", "s").operation, null);
  assert.equal(activity.snapshot("p", "other").operation, null);
  activity.finish("second");
  assert.equal(activity.snapshot("p", "s").operation.phase, "completed");
  assert.equal(activity.snapshot("p", "s", Date.now() + 3000).operation, null);
  activity.enqueue("poll", "preview", { action: "state" }); activity.start("poll"); activity.finish("poll");
  assert.equal(activity.latest.id, "second");
});

test("runtime blockers remain visible until a meaningful recovery operation replaces them", () => {
  const activity = new IslandActivity();
  activity.enqueue("preview", "preview", { action: "click" }); activity.start("preview");
  activity.bind("preview", { projectId: "p", sessionId: "s" });
  activity.finish("preview", Object.assign(new Error("Preview runtime unavailable"), { context: { runtimeAvailable: false, code: "PREVIEW_UNAVAILABLE" } }));
  assert.equal(activity.snapshot("p", "s", Date.now() + 10000).operation.blocked, true);
  activity.enqueue("recover", "preview", { action: "close" }); activity.start("recover");
  assert.equal(activity.snapshot("p", "s").operation.id, "recover");
  activity.finish("recover");
  assert.equal(activity.snapshot("p", "s", Date.now() + 3000).operation, null);
});

test("task reports reject stale sequences and invalid plans without changing the current task", () => {
  const activity = new IslandActivity();
  const task = { taskId: "t", projectId: "p", sequence: 0, title: "编辑审批页", stage: "读取现有结构", status: "running" };
  assert.deepEqual(activity.reportTask(task, "s"), { accepted: true });
  assert.deepEqual(activity.reportTask({ ...task, title: "old" }, "s"), { accepted: false });
  assert.equal(activity.snapshot("p", "other").task, null);
  for (const change of [{ stageIndex: 1 }, { stageIndex: 3, stageCount: 2 }, { extra: true }, { sequence: -1 }]) {
    assert.throws(() => activity.reportTask({ ...task, ...change, sequence: change.sequence ?? 1 }, "s"), /Invalid task/);
  }
  activity.reportTask({ ...task, sequence: 1, status: "blocked", error: "Library access denied" }, "s");
  assert.equal(activity.snapshot("p", "s", Date.now() + 10000).task.status, "blocked");
  activity.reportTask({ ...task, sequence: 2, status: "completed" }, "s");
  assert.equal(activity.snapshot("p", "s").task.status, "completed");
  assert.equal(activity.snapshot("p", "s", Date.now() + 3000).task, null);
  assert.throws(() => activity.reportTask({ ...task, taskId: "new", status: "completed" }, "s"), /Start the task/);
  assert.deepEqual(activity.reportTask(task, "fresh-session"), { accepted: true });
});

test("resource operations remain visible outside the editor, retain failures and never expose arbitrary payloads", () => {
  const activity = new IslandActivity();
  activity.enqueue("create", "create_project", {name:"审批项目",secret:"private"});
  activity.start("create");
  let operation=activity.snapshot(null,null).operation;
  assert.equal(operation.label,"Creating project");
  assert.equal(operation.subject,"审批项目");
  assert.equal(operation.kind,"resource");
  assert.deepEqual(operation.targets,[]);
  assert.ok(!JSON.stringify(operation).includes("private"));
  activity.finish("create",new Error("No permission"));
  assert.equal(activity.snapshot(null,null,Date.now()+60000).operation.error,"No permission");
  activity.enqueue("next","list_projects",{});activity.start("next");
  assert.equal(activity.snapshot(null,null).operation.id,"next");
  activity.finish("next");
  assert.equal(activity.snapshot(null,null).operation.phase,"completed");
  assert.equal(activity.snapshot(null,null,Date.now()+3000).operation,null);
});

test('parallel calls keep the first running subject stable and count running work separately from the queue',()=>{
  const activity=new IslandActivity();
  for(const id of ['first','second','queued']){activity.enqueue(id,'execute',{name:'read'});activity.bind(id,{projectId:'p',sessionId:'s'});}
  activity.start('first');activity.start('second');
  assert.equal(activity.snapshot('p','s').operation.id,'first');
  assert.equal(activity.snapshot('p','s').running,2);assert.equal(activity.snapshot('p','s').queued,1);
  assert.equal(activity.snapshot('other','s').running,0);
  activity.finish('first');assert.equal(activity.snapshot('p','s').operation.id,'second');
});
