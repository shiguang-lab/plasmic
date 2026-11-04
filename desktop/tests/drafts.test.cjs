require("./fixtures/background.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DesktopDraftStore, createDraftHandler } = require("../src/drafts.cjs");

const encode = value => new TextEncoder().encode(JSON.stringify(value));
const decode = bytes => bytes === null ? null : JSON.parse(new TextDecoder().decode(bytes));
const scope = { origin: "https://studio.test", userId: "user", projectId: "project", branchId: null };
const draft = (overrides = {}) => ({
  format: 1, id: randomUUID(), projectId: "project", projectName: "项目", branchId: null,
  baseRevision: 10, sequence: 1, savedAt: 100, modelVersion: 1, hostlessDataVersion: 1,
  bundle: { root: "site", map: { site: { name: "未同步" } }, deps: [], version: "1" }, dependencies: [], ...overrides,
});
async function fixture(t, options) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-drafts-"));
  const store = new DesktopDraftStore(directory, options);
  t.after(async () => { await store.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return store;
}

test("drafts survive recreation, stay isolated, and retain two checkpoints per editor", async t => {
  const store = await fixture(t), a = draft(), b = draft();
  await store.write(scope, encode(a));
  await store.write(scope, encode(b));
  await store.write(scope, encode({ ...a, sequence: 2 }));
  await store.write(scope, encode({ ...a, sequence: 3 }));
  const reopened = new DesktopDraftStore(store.directory);
  t.after(() => reopened.close());
  assert.equal(decode(await reopened.read(scope, a.id)).sequence, 3);
  assert.equal((await reopened.list(scope)).length, 2);
  assert.equal((await fs.readdir(path.dirname(store.file(scope, a.id)))).length, 3);
  for (const other of [{ userId: "other" }, { origin: "https://other.test" }, { projectId: "other" }, { branchId: "feature" }]) {
    assert.deepEqual(await reopened.list({ ...scope, ...other }), []);
  }
  assert.equal((await fs.stat(store.file(scope, a.id))).mode & 0o777, process.platform === "win32" ? (await fs.stat(store.file(scope, a.id))).mode & 0o777 : 0o600);
});

test("late writes and acknowledgements never erase newer edits or other sessions", async t => {
  const store = await fixture(t), a = draft(), b = draft();
  await Promise.all([store.write(scope, encode({ ...a, sequence: 3 })), store.write(scope, encode(a)), store.write(scope, encode(b))]);
  assert.equal(await store.remove(scope, a.id, 1), false);
  assert.equal(decode(await store.read(scope, a.id)).sequence, 3);
  assert.equal(await store.remove(scope, a.id, 3), true);
  assert.ok(await store.read(scope, b.id));
  assert.deepEqual((await store.list(scope)).map(item => item.id), [b.id]);
});

test("storage limits preserve unsynced drafts and allow cleanup", async t => {
  const store = await fixture(t, { maxBytes: 1600 }), a = draft();
  await store.write(scope, encode(a));
  await assert.rejects(store.write(scope, encode(draft({ projectName: "x".repeat(2000) }))), /storage is full/);
  assert.equal(decode(await store.read(scope, a.id)).sequence, 1);
  assert.equal((await store.list(scope)).length, 1);
  await store.remove(scope, a.id, 1);
  await store.write(scope, encode(draft()));
  assert.equal((await store.list(scope)).length, 1);
});

test("opening a project reads only its own branch while the directory still lists every project", async t => {
  const store = await fixture(t), a = draft();
  await store.write(scope, encode(a));
  const otherProject = { ...scope, projectId: "other" };
  const otherBranch = { ...scope, branchId: "feature" };
  const b = draft({ projectId: "other" }), c = draft({ branchId: "feature" });
  await store.write(otherProject, encode(b));
  await store.write(otherBranch, encode(c));
  const reopened = new DesktopDraftStore(store.directory);
  t.after(() => reopened.close());
  assert.deepEqual((await reopened.list(scope)).map(item => item.id), [a.id]);
  assert.deepEqual([...reopened.summaries.keys()], [store.file(scope, a.id)]);
  assert.deepEqual(new Set((await reopened.list(scope, true)).map(item => item.id)), new Set([a.id, b.id, c.id]));
  assert.equal(reopened.summaries.size, 3);
});

test("interrupted writes preserve the last valid checkpoint and corrupted JSON recovers the previous one", async t => {
  const store = await fixture(t), a = draft();
  await store.write(scope, encode(a));
  await store.write(scope, encode({ ...a, sequence: 2 }));
  const file = store.file(scope, a.id);
  await fs.writeFile(file, "{incomplete");
  assert.equal(decode(await store.read(scope, a.id)).sequence, 1);
  await store.write(scope, encode({ ...a, sequence: 3 }));
  await fs.mkdir(file + ".tmp");
  await assert.rejects(store.write(scope, encode({ ...a, sequence: 4 })));
  assert.equal(decode(await store.read(scope, a.id)).sequence, 3);
});

test("the draft bridge authenticates opening, binds scope, and then writes without network", async t => {
  const store = await fixture(t), frame = { url: scope.origin + "/projects/project" };
  let online = true, authenticated = "user";
  const handler = createDraftHandler({ store, origin: scope.origin, trustedSender: e => e.trusted,
    projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => { if (!online) {throw new Error("offline");} return authenticated; } });
  const event = { trusted: true, senderFrame: frame };
  await assert.rejects(handler.command({ ...event, trusted: false }, "open", scope), /Invalid Studio/);
  await assert.rejects(handler.command(event, "open", { ...scope, userId: "other" }), /Invalid draft account/);
  const { handle } = await handler.command(event, "open", scope), a = draft();
  online = false;
  await handler.command(event, "write", { handle, draftData: encode(a) });
  assert.deepEqual(decode(await handler.command(event, "read", { handle, id: a.id })), a);
  await assert.rejects(handler.command(event, "write", { handle, draftData: new TextEncoder().encode("{broken") }), SyntaxError);
  await assert.rejects(handler.command(event, "write", { handle, draftData: a }), /Invalid draft payload/);
  await assert.rejects(handler.command({ ...event, senderFrame: { ...frame } }, "write", { handle, draftData: new TextEncoder().encode("{broken") }), /Invalid draft session/);
  await assert.rejects(handler.command(event, "write", { handle, draftData: encode(draft({ projectId: "other" })) }), /Invalid draft/);
  await assert.rejects(handler.command({ ...event, senderFrame: { ...frame } }, "read", { handle, id: a.id }), /Invalid draft session/);
  handler.reset();
  await assert.rejects(handler.command(event, "read", { handle, id: a.id }), /Invalid draft session/);
  online = true; authenticated = "other";
  assert.deepEqual(await handler.command(event, "list", { userId: "other" }), []);
});

test("account resets fence draft opening during identity and file reads", async () => {
  for (const waitingFor of ["identity", "files"]) {
    let release, reached;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { reached = resolve; });
    const frame = { url: scope.origin + "/projects/project" };
    const handler = createDraftHandler({
      store: { list: async () => { if (waitingFor === "files") { reached(); await gate; } return []; } },
      origin: scope.origin, trustedSender: () => true,
      projectId: url => new URL(url).pathname.split("/")[2],
      currentUser: async () => { if (waitingFor === "identity") { reached(); await gate; } return "user"; },
    });
    const opening = handler.command({ senderFrame: frame }, "open", scope);
    const rejected = assert.rejects(opening, /Invalid draft account/);
    await started; handler.reset(); release(); await rejected;
    const { handle } = await handler.command({ senderFrame: frame }, "open", scope);
    assert.ok(handle, "the new account generation can open a fresh session");
  }
});

test("session rotation reauthorizes existing draft handles for the same account and rejects a replacement account", async t => {
  const store = await fixture(t), frame = { url: scope.origin + "/projects/project" };
  let userId = "user", reads = 0;
  const handler = createDraftHandler({ store, origin: scope.origin, trustedSender: () => true,
    projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => { reads++; return userId; } });
  const event = { senderFrame: frame }, { handle } = await handler.command(event, "open", scope), a = draft();
  await handler.command(event, "write", { handle, draftData: encode(a) }); assert.equal(reads, 1);
  handler.invalidate();
  await handler.command(event, "write", { handle, draftData: encode({ ...a, sequence: 2 }) }); assert.equal(reads, 2);
  assert.equal(decode(await handler.command(event, "read", { handle, id: a.id })).sequence, 2); assert.equal(reads, 2);
  userId = "replacement"; handler.invalidate();
  await assert.rejects(handler.command(event, "read", { handle, id: a.id }), /Invalid draft session/);
  assert.equal(reads, 3);
});

test("another auth change during reauthorization requires retry without destroying a same-account handle", async () => {
  let wait = false, release, reached;
  const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { reached = resolve; });
  const frame = { url: scope.origin + "/projects/project" }, event = { senderFrame: frame };
  const handler = createDraftHandler({ store: { list: async () => [], read: async () => new TextEncoder().encode(JSON.stringify({ id: "draft" })) }, origin: scope.origin,
    trustedSender: () => true, projectId: url => new URL(url).pathname.split("/")[2],
    currentUser: async () => { if (wait) { reached(); await gate; } return "user"; } });
  const { handle } = await handler.command(event, "open", scope);
  handler.invalidate(); wait = true;
  const reading = handler.command(event, "read", { handle, id: "draft" });
  const rejected = assert.rejects(reading, /Invalid draft session/);
  await started; handler.invalidate(); release(); await rejected;
  wait = false;
  assert.equal(decode(await handler.command(event, "read", { handle, id: "draft" })).id, "draft");
});

test("an auth change while reading a draft prevents returning its contents", async () => {
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { reached = resolve; });
  const frame = { url: scope.origin + "/projects/project" }, event = { senderFrame: frame };
  const handler = createDraftHandler({ store: { list: async () => [], read: async () => { reached(); await gate; return { id: "draft" }; } },
    origin: scope.origin, trustedSender: () => true, projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => "user" });
  const { handle } = await handler.command(event, "open", scope);
  const reading = handler.command(event, "read", { handle, id: "draft" });
  const rejected = assert.rejects(reading, /Invalid draft session/);
  await started; handler.invalidate(); release(); await rejected;
});

test("serialized writes retain canonical bytes and close drains accepted durable writes", async t => {
  const store = await fixture(t), value = draft();
  const writing = store.write(scope, new TextEncoder().encode(JSON.stringify(value, null, 2)));
  const closing = store.close();
  await writing; await closing;
  assert.equal(await fs.readFile(store.file(scope, value.id), "utf8"), JSON.stringify(value));
  const reopened = new DesktopDraftStore(store.directory); t.after(() => reopened.close());
  assert.deepEqual(decode(await reopened.read(scope, value.id)), value);
});

test("idle storage workers release model heaps, preserve summaries and restart for recovery", async t => {
  const store = await fixture(t), value = draft();
  store.worker.idleMs = 30;
  await store.write(scope, encode(value));
  const first = store.worker.worker.pid;
  const summaries = [...store.summaries];
  for (let i = 0; store.worker.worker && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(store.worker.worker, null);
  assert.deepEqual([...store.summaries], summaries);
  assert.deepEqual((await store.list(scope)).map(value => value.id), [value.id]);
  assert.notEqual(store.worker.worker.pid, first);
  const interrupted = store.write(scope, encode({ ...value, sequence: 2 }));
  const rejected = assert.rejects(interrupted, /Background worker exited/);
  store.worker.worker.kill(); await rejected;
  assert.equal(decode(await store.read(scope, value.id)).sequence, 1);
});
