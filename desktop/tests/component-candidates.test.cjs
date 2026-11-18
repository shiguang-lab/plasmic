const test = require("node:test");
const assert = require("node:assert/strict");
const { ComponentCandidates } = require("../src/component-candidates.cjs");
const {
  ComponentSearchService,
} = require("../../platform/wab/src/wab/server/component-reuse/search-service.cjs");

const scope = { account: "alice", project: "one" };
const region = {
  componentUuid: "page",
  elementUuid: "edit",
  intent: "Edit records",
  usedComponentUuids: [],
};
const complete = { status: "completed", indexed: 1, total: 1, rows: [] };
const catalogue = { indexed: 1, total: 1, version: "first" };

test("candidate misses coalesce, cancellation of one reader does not cancel another", async () => {
  let completeRequest,
    signal,
    count = 0;
  const cache = new ComponentCandidates(async (_project, body, abort) => {
    if (body.command === "sync") return catalogue;
    signal = abort;
    count++;
    return new Promise((resolve) => {
      completeRequest = resolve;
    });
  });
  await cache.sync(scope, [], 0);
  const cancel = new AbortController();
  const first = cache.review(scope, [region], { signal: cancel.signal });
  const second = cache.review(scope, [region]);
  cancel.abort();
  assert.equal((await first).status, "cancelled");
  assert.equal(signal.aborted, false);
  completeRequest(complete);
  assert.equal((await second).status, "completed");
  await cache.review(scope, [region]);
  assert.equal(count, 1);
});

test("partial results retry, completed empty lists are cached, scope and catalogue changes invalidate", async () => {
  let searches = 0;
  const cache = new ComponentCandidates(async (_project, body) => {
    if (body.command === "sync") return catalogue;
    searches++;
    return searches === 1 ? { ...complete, status: "indexing" } : complete;
  });
  await cache.sync(scope, [], 0);
  assert.equal(
    (await cache.review(scope, [region, region])).status,
    "indexing",
  );
  await cache.review(scope, [region]);
  await cache.review(scope, [region]);
  assert.equal(searches, 2);
  await cache.sync(scope, [], 1);
  await cache.review(scope, [region]);
  const other = { ...scope, account: "bob" };
  await cache.sync(other, [], 1);
  assert.equal((await cache.review(scope, [region])).status, "unavailable");
  await cache.review(other, [region]);
  assert.equal(searches, 4);
});

test("an evicted catalogue is synchronized once before retrying a read", async () => {
  const calls = [];
  const cache = new ComponentCandidates(async (_project, body) => {
    calls.push(body.command);
    if (body.command === "sync") return catalogue;
    if (calls.length === 2)
      throw Object.assign(new Error("expired"), { status: 409 });
    return complete;
  });
  await cache.sync(scope, [], 0);
  const expired = await cache.review(scope, [region]);
  assert.deepEqual(expired.issues, ["catalogue-changed"]);
  await cache.sync(scope, [], 0, true);
  assert.equal((await cache.review(scope, [region])).status, "completed");
  assert.deepEqual(calls, ["sync", "search", "sync", "search"]);
});

test("server looks up catalogue versions within the authenticated account and project", async () => {
  const service = new ComponentSearchService("", { signature: "fixture" });
  const { version } = await service.sync(scope, {
    documents: [],
    unavailable: 0,
  });
  const query = { version, intent: "Edit records" };
  const signal = AbortSignal.timeout(1000);
  assert.equal(
    await service.search({ ...scope, account: "bob" }, query, signal),
    null,
  );
  assert.equal(
    await service.search({ ...scope, project: "two" }, query, signal),
    null,
  );
  assert.equal(
    (await service.search(scope, query, signal)).status,
    "completed",
  );
  await assert.rejects(
    service.sync(scope, { documents: [{}], unavailable: 0 }),
    TypeError,
  );
});

test("a timed-out NAS search can be retried without replaying the edit", async () => {
  let searches = 0;
  const cache = new ComponentCandidates(async (_project, body) => {
    if (body.command === "sync") return catalogue;
    if (++searches === 1) throw new DOMException("Deadline", "TimeoutError");
    return complete;
  });
  await cache.sync(scope, [], 0);
  assert.equal((await cache.review(scope, [region])).status, "timeout");
  assert.equal(cache.state.cache.size, 0);
  assert.equal((await cache.review(scope, [region])).status, "completed");
  assert.equal(searches, 2);
});

test("a foreground edit reports indexing immediately and a read joins the same background sync", async () => {
  const { promise, resolve } = Promise.withResolvers();
  const calls = [];
  const cache = new ComponentCandidates(async (_project, body) => {
    calls.push(body.command);
    return body.command === "sync" ? promise : complete;
  });
  const open = cache.sync(scope, [], 0);
  const coverage = await cache.sync(scope, [], 0, false, true);
  assert.deepEqual(coverage, { preparing: true, indexed: 0, total: 0 });
  const read = cache.sync(scope, [], 0, true);
  resolve(catalogue);
  await open;
  assert.equal(await read, catalogue);
  assert.equal((await cache.review(scope, [region])).status, "completed");
  assert.deepEqual(calls, ["sync", "search"]);
});
