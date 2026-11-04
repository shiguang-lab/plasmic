require("./fixtures/background.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
const { BackgroundWorker } = require("../src/background-worker.cjs");
const vector = { width: 100, height: 100, paths: ["M0 0h40v40h-40z", "M20 0h40v40h-40z"] };

test("graphics retain exact Paper output, reuse one lane, then release it and start on demand", async t => {
  const worker = new BackgroundWorker({ idleMs: 40 });
  t.after(() => worker.close());
  assert.equal(worker.worker, null);
  const { makeVector } = require("../src/vector.cjs");
  for (const operation of ["unite", "intersect", "subtract", "exclude"]) {
    const input = { ...vector, operation };
    assert.deepEqual(await worker.run("vector", input), makeVector(input));
  }
  const instance = worker.worker;
  const first = instance.pid;
  await worker.run("vector", vector);
  assert.equal(worker.worker.pid, first);
  for (let i = 0; worker.worker && i < 100; i++) await delay(10);
  assert.equal(worker.worker, null, "idle worker must be destroyed");
  assert.ok(instance.exitCode !== null || instance.signalCode !== null, "the idle process must actually exit");
  assert.deepEqual(await worker.run("vector", vector), makeVector(vector));
  assert.notEqual(worker.worker.pid, first);
});

test("worker returns geometry errors without losing queued jobs", async t => {
  const worker = new BackgroundWorker(); t.after(() => worker.close());
  const invalid = worker.run("vector", { ...vector, fill: 'red" onload="bad' });
  const next = worker.run("vector", vector);
  await assert.rejects(invalid, /solid fill/);
  assert.match((await next).svg, /<svg/);
  await assert.rejects(worker.run("vector", { ...vector, operation: "unite", paths: ["M0 0L10 10"] }), /closed paths/);
});

test("cancelling a running job replaces its worker; queued cancellations never run", async t => {
  const worker = new BackgroundWorker(); t.after(() => worker.close());
  const running = new AbortController(), queued = new AbortController();
  const first = worker.run("vector", vector, { signal: running.signal });
  const old = worker.worker;
  const second = worker.run("vector", vector, { signal: queued.signal });
  const firstRejected = assert.rejects(first, /running cancelled/);
  const secondRejected = assert.rejects(second, /queued cancelled/);
  queued.abort(Error("queued cancelled")); running.abort(Error("running cancelled"));
  await Promise.all([firstRejected, secondRejected]);
  assert.match((await worker.run("vector", vector)).svg, /<svg/);
  assert.notEqual(worker.worker, old);
});

test("unexpected worker exit rejects accepted work and permits the next invocation", async t => {
  const worker = new BackgroundWorker(); t.after(() => worker.close());
  const task = worker.run("vector", vector);
  const rejected = assert.rejects(task, /Background worker exited/);
  worker.worker.kill(); await rejected;
  assert.match((await worker.run("vector", vector)).svg, /<svg/);
});

test("owner close rejects running and queued work and prevents restart", async () => {
  const worker = new BackgroundWorker();
  const first = assert.rejects(worker.run("vector", vector), /Desktop closed/);
  const second = assert.rejects(worker.run("vector", vector), /Desktop closed/);
  await worker.close(); await Promise.all([first, second]);
  await assert.rejects(worker.run("vector", vector), /Desktop closed/);
  assert.equal(worker.worker, null);
});
