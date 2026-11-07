const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { EventEmitter } = require("node:events");
const { ComponentReuse, ComponentVectorCache, hash, terms } = require("../src/component-reuse.cjs");
const { createComponentReuseHandler } = require("../src/component-reuse-handler.cjs");
const vector = index => Array.from({ length: 768 }, (_, i) => i === index ? 1 : 0);
const doc = (id, description = "Switch between content panels") => ({ componentUuid: id, name: id, fromProject: "installed-library", version: "1", description, sections: [description], props: ["activeKey"], slots: ["children"], events: ["onChange"] });
const scope = { account: hash("one-account"), project: "project-a" };
const wait = async predicate => { for (let i = 0; i < 300; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } throw new Error("Test timed out waiting for indexing"); };
async function fixture(t, encode = async () => vector(0)) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "component-reuse-"));
  const embedding = { signature: "fixture-v1", calls: [], async encode(text, options) { this.calls.push(text); return encode(text, options); }, async stop() {}, async close() {} };
  const service = new ComponentReuse({ directory, embedding, backgroundDelayMs: 1, idlePauseMs: 0 });
  t.after(async () => { await service.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { directory, service, embedding };
}
const region = { componentUuid: "page", elementUuid: "native-custom", intent: "Switch between content panels", usedComponentUuids: [], facts: ["button"] };

test("restart, another project and library version changes reuse persisted content vectors", async t => {
  const f = await fixture(t); await f.service.sync(scope, [doc("Tabs")]); await wait(() => f.service.coverage().indexed === 1);
  assert.equal(f.embedding.calls.length, 1);
  await f.service.sync(scope, [doc("Tabs")]); assert.equal(f.embedding.calls.length, 1);
  const restarted = new ComponentReuse({ directory: f.directory, embedding: f.embedding, backgroundDelayMs: 1 }); t.after(() => restarted.close());
  const coverage = await restarted.sync({ ...scope, project: "project-b" }, [{ ...doc("CopiedTabs"), name: "Tabs", version: "2" }]);
  assert.deepEqual(coverage, { indexed: 1, total: 1 }); assert.equal(f.embedding.calls.length, 1);
});
test("only changed content recomputes; removals disappear immediately", async t => {
  const f = await fixture(t); await f.service.sync(scope, [doc("Tabs"), doc("Select", "Choose one form value")]); await wait(() => f.service.coverage().indexed === 2);
  assert.equal(f.embedding.calls.length, 2);
  await f.service.sync(scope, [doc("Tabs", "Switch between named content panels"), doc("Select", "Choose one form value")]); await wait(() => f.service.coverage().indexed === 2);
  assert.equal(f.embedding.calls.length, 3);
  await f.service.sync(scope, [doc("Select", "Choose one form value")]);
  assert.deepEqual(f.service.state.documents.map(d => d.componentUuid), ["Select"]); assert.equal(f.embedding.calls.length, 3);
});
test("cache integrity, account isolation and model signatures prevent invalid reuse", async t => {
  const f = await fixture(t); const cache = new ComponentVectorCache(f.directory, "model-1"); const key = cache.key("same text");
  await cache.put(scope.account, key, vector(0));
  assert.equal(await cache.get(hash("another-account"), key), null);
  assert.notEqual(new ComponentVectorCache(f.directory, "model-2").key("same text"), key);
  const file = path.join(f.directory, scope.account, key + ".bin"); const bytes = await fs.readFile(file); bytes[40] ^= 1; await fs.writeFile(file, bytes);
  assert.equal(await new ComponentVectorCache(f.directory, "model-1").get(scope.account, key), null);
});
test("a foreground query goes before remaining indexing jobs", async t => {
  let firstResolve; let started = false;
  const f = await fixture(t, async text => { if (!started) { started = true; return new Promise(resolve => { firstResolve = resolve; }); } return vector(0); });
  await f.service.sync(scope, [doc("One"), doc("Two"), doc("Three")]); await wait(() => started);
  const query = f.service.enqueue("task: search result | query: current edit", AbortSignal.timeout(1000));
  firstResolve(vector(0)); await query;
  assert.match(f.embedding.calls[1], /current edit/);
  await wait(() => f.service.coverage().indexed === 3);
});
test("user activity pauses background indexing without blocking a direct query", async t => {
  const f = await fixture(t); f.service.idlePauseMs = 50; f.service.activity();
  await f.service.sync(scope, [doc("Tabs")]);
  const result = await f.service.enqueue("active query", AbortSignal.timeout(1000)); assert.equal(result[0], 1);
  assert.deepEqual(f.embedding.calls, ["active query"]);
  await wait(() => f.service.coverage().indexed === 1);
});
test("queries never rebuild documents and an incomplete catalogue is reported partial", async t => {
  const f = await fixture(t); await f.service.sync(scope, [doc("Tabs")], 1); await wait(() => f.service.coverage().indexed === 1);
  const first = await f.service.review(scope, [region]); const second = await f.service.review(scope, [region]);
  assert.equal(first.status, "partial"); assert.equal(first.total, 2); assert.equal(first.indexed, 1);
  assert.equal(second.suggestions[0].candidates[0].componentUuid, "Tabs");
  assert.equal(f.service.stats.documentEmbeddings, 1); assert.equal(f.service.stats.queryEmbeddings, 1); assert.equal(f.service.stats.queryCacheHits, 1);
});
test("already-used relevant components and low-similarity custom UI do not generate suggestions", async t => {
  const f = await fixture(t, async text => text.startsWith("task:") ? vector(1) : vector(0));
  await f.service.sync(scope, [doc("Tabs")]); await wait(() => f.service.coverage().indexed === 1);
  const unrelated = await f.service.review(scope, [{ ...region, intent: "拖动地理围栏顶点" }]); assert.equal(unrelated.suggestions.length, 0);
  f.embedding.encode = async () => vector(0);
  const existing = await f.service.review(scope, [{ ...region, usedComponentUuids: ["Tabs"] }]); assert.equal(existing.suggestions.length, 0);
});
test("weak semantic matches need enough meaningful lexical coverage, not two incidental words", async t => {
  const mixed = vector(0); mixed[0] = .66; mixed[1] = Math.sqrt(1 - .66 * .66);
  const f = await fixture(t, async text => text.startsWith("task:") ? mixed : vector(0));
  await f.service.sync(scope, [doc("Grid", "Input nodes"), ...[1, 2, 3, 4].map(i => doc("Other" + i, "Unrelated information"))]);
  await wait(() => f.service.coverage().indexed === 5);
  const irrelevant = await f.service.review(scope, [{ ...region, intent: "input nodes graph canvas ports zoom pan connect edges coordinates" }]);
  assert.equal(irrelevant.suggestions.length, 0);
  const relevant = await f.service.review(scope, [{ ...region, intent: "Input nodes" }]);
  assert.equal(relevant.suggestions[0].candidates[0].componentUuid, "Grid");
});
test("a cancelled query settles without a late suggestion", async t => {
  const f = await fixture(t); await f.service.sync(scope, [doc("Tabs")]); await wait(() => f.service.coverage().indexed === 1);
  f.embedding.encode = (_text, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  const controller = new AbortController(); const pending = f.service.review(scope, [region], { signal: controller.signal }); controller.abort();
  const result = await pending; assert.equal(result.status, "cancelled"); assert.deepEqual(result.suggestions, []);
});
test("IPC rejects untrusted frames and mismatched accounts/projects before touching the index", async t => {
  const f = await fixture(t); const event = { senderFrame: { url: "/projects/p" } };
  const handler = createComponentReuseHandler({ service: f.service, origin: "https://studio.example", trustedSender: e => e === event, projectId: url => url.split("/").at(-1), currentUser: async () => "user-1" });
  await assert.rejects(handler.command({}, "sync", { projectId: "p", documents: [], unavailable: 0 }), /sender/);
  await assert.rejects(handler.command(event, "sync", { projectId: "other", documents: [], unavailable: 0 }), /project/);
  await handler.command(event, "sync", { projectId: "p", documents: [], unavailable: 0 });
  assert.deepEqual(f.service.coverage(), { total: 0, indexed: 0 }); handler.reset(); assert.equal(f.service.state, null);
});
test("a project/branch navigation clears active indexing and query caches", async t => {
  const f = await fixture(t); const sender = new EventEmitter();
  const event = { sender, senderFrame: { url: "https://studio.example/projects/one" } };
  const handler = createComponentReuseHandler({ service: f.service, origin: "https://studio.example", trustedSender: e => e === event, projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => "user" });
  await handler.command(event, "sync", { projectId: "one", documents: [], unavailable: 0 });
  f.service.queryCache.set("private intent", vector(0));
  sender.emit("did-navigate-in-page", {}, "https://studio.example/projects/one/-/branch", true);
  assert.equal(f.service.state, null); assert.equal(f.service.queryCache.size, 0);
});

test("keyword retrieval normalizes inflections without changing Chinese terms", () => {
  assert.deepEqual(terms("paginated pagination paginate"), ["paginat", "paginat", "paginat"]);
  assert.deepEqual(terms("sort sorting filter filtering columns"), ["sort", "sort", "filter", "filter", "column"]);
  assert.deepEqual(terms("客户信息"), ["客户", "信息"]);
});

test("keyword-only child hits retain their parents within the candidate budget", async t => {
  const f = await fixture(t); f.service.backgroundDelayMs = 60000;
  const parent = doc("Table", "Display records");
  const child = { ...doc("Column", "Sort filter paginated records"), parent: parent.name };
  await f.service.sync(scope, [parent, child, ...[1, 2, 3, 4].map(i => doc("Other" + i, "Unrelated content"))]);
  const target = { ...region, intent: "sort filter paginated" };
  const result = await f.service.review(scope, [target]);
  assert.equal(result.status, "indexing"); assert.deepEqual(result.issues, ["indexing"]);
  const candidates = result.suggestions[0].candidates;
  assert.deepEqual(candidates.map(c => c.name), ["Table", "Column"]);
  assert.deepEqual(candidates[0].requiredBy, ["Column"]);
  assert.equal(candidates[1].similarity, null); assert.ok(candidates[1].keywordScore > 0); assert.ok(candidates[1].rankScore > 0);
  assert.equal("score" in candidates[1], false);
  assert.deepEqual(f.service.rank(f.service.state, { ...target, ancestorComponentUuids: ["Table"] }, null).map(c => c.name), ["Column"]);
  await f.service.sync(scope, [child, ...[1, 2, 3, 4].map(i => doc("Other" + i, "Unrelated content"))]);
  assert.deepEqual(f.service.rank(f.service.state, target, null), []);
});

test("parent lookup uses library identity and never returns an incomplete cyclic chain", async t => {
  const f = await fixture(t); f.service.backgroundDelayMs = 60000;
  const child = { ...doc("Column", "Sort filter records"), parent: "Table" };
  await f.service.sync(scope, [child, { ...doc("OtherTable"), name: "Table", fromProject: "other-library" }]);
  assert.deepEqual(f.service.rank(f.service.state, { ...region, intent: "sort filter records" }, null), []);
  await f.service.sync(scope, [child, { ...doc("Table", "Unrelated content"), parent: "Column" }]);
  assert.deepEqual(f.service.rank(f.service.state, { ...region, intent: "sort filter records" }, null), []);
});

test("contract summaries prioritize requested controls and explicitly report truncation", async t => {
  const f = await fixture(t);
  const props = ["a", "b", "c", "d", "e", "f", "g", "h", "selectedRowKeys"];
  await f.service.sync(scope, [{ ...doc("Table", "Select table records"), props }]);
  await wait(() => f.service.coverage().indexed === 1);
  const result = await f.service.review(scope, [{ ...region, intent: "Control selected row keys for table records" }]);
  const contract = result.suggestions[0].candidates[0].contract;
  assert.equal(contract.props[0], "selectedRowKeys"); assert.equal(contract.truncated, true); assert.equal(contract.props.length, 8);
});

test("runtime failure is diagnosed and explicit retry resumes unchanged catalogue indexing", async t => {
  const f = await fixture(t, async () => { throw new Error("missing runtime library"); });
  await f.service.sync(scope, [doc("Tabs")]); await wait(() => f.service.failure);
  const failed = await f.service.review(scope, [region]);
  assert.equal(failed.status, "partial"); assert.deepEqual(failed.issues, ["embedding-failed"]); assert.match(failed.diagnostic, /missing runtime library/);
  await f.service.sync(scope, [doc("Tabs")]); assert.equal(f.embedding.calls.length, 1);
  f.embedding.encode = async () => vector(0);
  await f.service.sync(scope, [doc("Tabs")], 0, true); await wait(() => f.service.coverage().indexed === 1);
  assert.equal((await f.service.review(scope, [region])).status, "completed");
});

test("failed runtime verification can be retried after repair", async () => {
  const { ComponentEmbedding } = require("../src/component-embedding.cjs");
  const embedding = new ComponentEmbedding("unused"); let attempts = 0;
  embedding.verify = async () => { if (++attempts === 1) throw new Error("runtime unavailable"); return true; };
  await assert.rejects(embedding.prepare(), /runtime unavailable/);
  assert.equal(await embedding.prepare(), true); assert.equal(attempts, 2);
  await embedding.close();
});
