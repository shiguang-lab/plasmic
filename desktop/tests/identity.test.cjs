const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { DesktopIdentity } = require("../src/identity.cjs");
const { createDraftHandler } = require("../src/drafts.cjs");

const origin = "https://studio.example";
const cookie = { domain: ".example", path: "/", name: "session", httpOnly: true, value: "a" };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(t) {
  const cookies = new EventEmitter();
  cookies.get = async () => [cookie];
  let now = 0, reads = 0;
  const identity = new DesktopIdentity({
    session: { cookies }, studioOrigin: origin,
    prepare: async () => {}, now: () => now,
    fetchIdentity: async () => { reads++; return { user: { id: "a" } }; },
  });
  t.after(() => identity.dispose());
  return { identity, cookies, get reads() { return reads; }, advance() { now += 30_000; } };
}

test("concurrent consumers and a later draft share a verified server identity until refresh", async t => {
  const f = fixture(t), pending = deferred();
  let reads = 0;
  f.identity.fetchIdentity = () => { reads++; return pending.promise; };
  const a = f.identity.read(), b = f.identity.read();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 1);
  f.identity.expire();
  const c = f.identity.read();
  pending.resolve({ user: { id: "a" } });
  assert.deepEqual(await Promise.all([a, b, c]), Array(3).fill({ user: { id: "a" } }));
  await f.identity.read(); assert.equal(reads, 1);
  f.identity.expire(); await f.identity.read(); assert.equal(reads, 2);
  f.advance(); await f.identity.read(); assert.equal(reads, 3);
});

test("changed or expired session cookies invalidate old tasks and late identities cannot authorize", async t => {
  const f = fixture(t), pending = deferred();
  f.identity.fetchIdentity = () => pending.promise;
  const old = f.identity.read();
  const rejected = assert.rejects(old, /identity changed/);
  await new Promise(resolve => setImmediate(resolve));
  let changes = 0; f.identity.on("changed", () => changes++);
  f.cookies.emit("changed", {}, { ...cookie, value: "b" }, "explicit", false);
  f.identity.fetchIdentity = async () => ({ user: { id: "b" } });
  assert.equal((await f.identity.read()).user.id, "b");
  pending.resolve({ user: { id: "a" } }); await rejected;
  assert.equal((await f.identity.read()).user.id, "b");
  f.cookies.emit("changed", {}, { ...cookie, value: "b" }, "expired", true);
  f.identity.fetchIdentity = async () => ({ user: null });
  assert.equal((await f.identity.read()).user, null);
  assert.equal(changes, 2);
});

test("unrelated and unchanged cookies retain verification; replacing its value invalidates once", async t => {
  const f = fixture(t); await f.identity.read();
  for (const change of [
    { ...cookie, domain: "unrelated.example.test", value: "other" },
    { ...cookie, httpOnly: false, value: "theme" },
    cookie,
  ]) f.cookies.emit("changed", {}, change, "explicit", false);
  f.cookies.emit("changed", {}, cookie, "overwrite", true);
  await f.identity.read(); assert.equal(f.reads, 1);
  f.cookies.emit("changed", {}, { ...cookie, value: "replacement" }, "explicit", false);
  await f.identity.read(); assert.equal(f.reads, 2);
});

test("failed, timed-out and anonymous checks are not retained and can retry", async t => {
  const f = fixture(t);
  for (const error of [new Error("HTTP 401"), new Error("HTTP 503"), new DOMException("Timeout", "TimeoutError")]) {
    f.identity.fetchIdentity = async () => { throw error; };
    await assert.rejects(f.identity.read(), error);
    f.identity.fetchIdentity = async () => ({ user: { id: "a" } });
    assert.equal((await f.identity.read()).user.id, "a");
    f.identity.expire();
  }
  f.identity.fetchIdentity = async () => ({ user: null });
  assert.equal((await f.identity.read()).user, null);
  f.identity.fetchIdentity = async () => ({ user: { id: "b" } });
  assert.equal((await f.identity.read()).user.id, "b");
});

test("session preparation runs before cache hits and a failure discards verification", async t => {
  const f = fixture(t); await f.identity.read();
  f.identity.prepare = async () => { throw new Error("Session restoration failed"); };
  await assert.rejects(f.identity.read(), /restoration failed/);
  f.identity.prepare = async () => {};
  await f.identity.read(); assert.equal(f.reads, 2);
});

test("different sessions never share verification and disposal removes the cookie listener", async t => {
  const a = fixture(t), b = fixture(t);
  await a.identity.read(); await b.identity.read();
  assert.equal(a.reads, 1); assert.equal(b.reads, 1);
  a.identity.dispose(); assert.equal(a.cookies.listenerCount("changed"), 0);
  assert.equal(b.cookies.listenerCount("changed"), 1);
});

test("draft opening reuses native verification, rejects a forged account, and resets old handles on auth change", async t => {
  const f = fixture(t), frame = { url: origin + "/projects/project" };
  const store = { list: async () => [], read: async () => ({ id: "draft" }) };
  const handler = createDraftHandler({ store, origin, trustedSender: () => true,
    projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => (await f.identity.read()).user?.id });
  f.identity.on("changed", () => handler.invalidate());
  await f.identity.read();
  const input = { userId: "a", projectId: "project" };
  const { handle } = await handler.command({ senderFrame: frame }, "open", input);
  assert.equal(f.reads, 1);
  await assert.rejects(handler.command({ senderFrame: frame }, "open", { ...input, userId: "forged" }), /Invalid draft account/);
  f.cookies.emit("changed", {}, { ...cookie, value: "b" }, "explicit", false);
  f.identity.fetchIdentity = async () => ({ user: { id: "b" } });
  await assert.rejects(handler.command({ senderFrame: frame }, "read", { handle, id: "draft" }), /Invalid draft session/);
  await assert.rejects(handler.command({ senderFrame: frame }, "open", input), /Invalid draft account/);
  assert.deepEqual((await handler.command({ senderFrame: frame }, "open", { ...input, userId: "b" })).drafts, []);
});
