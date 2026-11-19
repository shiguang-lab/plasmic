const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CoverQueue } = require("./covers.cjs");

test("autosaves coalesce, a continuously edited project eventually renders", async () => {
  const queue = new CoverQueue();
  for (let i = 0; i < 80; i++) queue.offer("p", i + 1, i * 4000);
  assert.equal(queue.pending.size, 1);
  assert.equal(queue.pending.get("p").due, 300000);
  let calls = 0;
  const capture = async () => {
    calls++;
    return { projectId: "p", revision: 80 };
  };
  assert.equal(await queue.run(capture, () => 299999), undefined);
  assert.deepEqual(await queue.run(capture, () => 316000), {
    projectId: "p", publishedRevision: 80,
  });
  queue.offer("p", 80, 316001, true);
  await queue.run(capture, () => 316002);
  assert.equal(calls, 1);
  assert.equal(queue.published.get("p"), 80);
});

test("one renderer, newer save during capture remains pending", async () => {
  const queue = new CoverQueue();
  queue.offer("p", 1, 100, true);
  let finish;
  const running = queue.run(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => 100,
  );
  queue.offer("p", 2, 101);
  await queue.run(
    () => assert.fail("concurrent renderer"),
    () => 50000,
  );
  finish({ projectId: "p", revision: 1 });
  await running;
  assert.equal(queue.published.get("p"), 1);
  assert.equal(queue.pending.get("p").rev, 2);
});

test("a failed screenshot retains the previous revision, backs off and then parks until the revision changes", async () => {
  const queue = new CoverQueue();
  queue.published.set("p", 1);
  queue.offer("p", 2, 0, true);
  let calls = 0;
  const fail = async () => {
    calls++;
    throw Error("simulated screenshot timeout");
  };
  for (const now of [0, 1, 15000, 75000, 375000, 999999])
    assert.equal(await queue.run(fail, () => now), undefined);
  assert.equal(calls, 4);
  assert.equal(queue.published.get("p"), 1);
  assert.equal(queue.pending.get("p").due, Infinity);
  queue.offer("p", 3, 1000000);
  await queue.run(
    async () => ({ projectId: "p", revision: 3 }),
    () => 1100000,
  );
  assert.equal(queue.published.get("p"), 3);
});
