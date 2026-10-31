const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { ResourceCache, CacheStorageStore } = require("@plasmic-shared/resource-cache");
const origin = "https://studio.example";
const hash = value => createHash("sha256").update(value).digest("hex");
const model = JSON.stringify({ version: "schema", map: {} });
const request = (id = "model-1", init) => new Request(origin + "/api/v1/dependency-models/" + id, init);
const response = (id = "model-1") => new Response(model, { headers: {
  "Content-Type": "application/json", "X-Plasmic-Model-Resource": JSON.stringify({ id, digest: hash(model) }),
} });
class MemoryStorage {
  caches = new Map();
  async open(name) {
    if (!this.caches.has(name)) {
      const entries = new Map();
      this.caches.set(name, {
        match: async key => entries.get(new Request(key).url)?.clone(),
        put: async (key, value) => { entries.set(new Request(key).url, value.clone()); },
        delete: async key => entries.delete(new Request(key).url),
        keys: async () => [...entries.keys()].map(url => new Request(url)),
      });
    }
    return this.caches.get(name);
  }
  async keys() { return [...this.caches.keys()]; }
  async delete(name) { return this.caches.delete(name); }
}
function fixture(budget) {
  const storage = new MemoryStorage(), requests = [];
  const identity = { value: { user: { id: "a" } }, epoch: 0, async read() { return this.value; }, invalidate() { this.epoch++; this.value = undefined; } };
  let responder = () => response();
  const make = (buildId = "build") => new ResourceCache({ studioOrigin: origin, buildId, identity, hash,
    store: new CacheStorageStore({ storage, maxBytes: budget }),
    remoteFetch: async req => { requests.push(req); return responder(req); },
  });
  return { storage, requests, identity, make, respond: fn => { responder = fn; } };
}
test("CacheStorage model hits survive new cache instances without server checks", async () => {
  const f = fixture();
  assert.equal(await (await f.make().fetch(request())).text(), model);
  assert.equal(await (await f.make().fetch(request())).text(), model);
  assert.equal(await (await f.make().fetch(request("model-1", {method:"HEAD"}))).text(), "");
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].cache, "no-store");
});
test("CacheStorage verifies cached bytes and repairs corruption", async () => {
  const f = fixture(), cache = f.make();
  await cache.fetch(request());
  const stored = await f.storage.open((await f.storage.keys())[0]);
  await stored.put(request(), new Response("damaged", {headers:response().headers}));
  assert.equal(await (await cache.fetch(request())).text(), model);
  assert.equal(f.requests.length, 2);
});
test("CacheStorage namespaces isolate accounts and builds; logout clears only library caches", async () => {
  const f = fixture();
  await f.storage.open("other-feature");
  await f.make().fetch(request());
  f.identity.invalidate(); f.identity.value = {user:{id:"b"}};
  await f.make().fetch(request());
  await f.make("new-build").fetch(request());
  assert.equal(f.requests.length, 3);
  await f.make().clear();
  assert.deepEqual(await f.storage.keys(), ["other-feature"]);
});
test("CacheStorage evicts old resources within its byte budget", async () => {
  const f = fixture(Buffer.byteLength(model) * 2), cache = f.make();
  f.respond(req => response(req.url.split('/').at(-1)));
  for (const id of ["one", "two", "three"]) await cache.fetch(request(id));
  await cache.fetch(request("two"));
  assert.equal(f.requests.length, 3);
  await cache.fetch(request("one"));
  assert.equal(f.requests.length, 4);
});
test("an unavailable CacheStorage never blocks an authorized download", async t => {
  t.mock.method(console, "warn", () => {});
  const f = fixture();
  f.storage.open = async () => { throw new DOMException("Blocked", "SecurityError"); };
  assert.equal(await (await f.make().fetch(request())).text(), model);
  assert.equal(f.requests.length, 1);
});
test("quota failures degrade to the downloaded resource instead of failing the editor", async t => {
  t.mock.method(console, "warn", () => {});
  const f = fixture(), open = f.storage.open.bind(f.storage);
  f.storage.open = async name => {
    const cache = await open(name);
    cache.put = async () => { throw new DOMException("Full", "QuotaExceededError"); };
    return cache;
  };
  assert.equal(await (await f.make().fetch(request())).text(), model);
  assert.equal(await (await f.make().fetch(request())).text(), model);
  assert.equal(f.requests.length, 2);
});
test("account changes fence pending CacheStorage downloads", async () => {
  const f = fixture(), cache = f.make();
  const pending = Promise.withResolvers();
  f.respond(() => pending.promise);
  const read = cache.fetch(request());
  const rejected = assert.rejects(read, /account changed/);
  while (!f.requests.length) await new Promise(resolve => setImmediate(resolve));
  await cache.clear();
  pending.resolve(response());
  await rejected;
  assert.equal((await f.storage.keys()).length, 0);
});
test("anonymous reads and unrelated APIs bypass persistent resource storage", async () => {
  const f = fixture(), cache = f.make();
  f.identity.invalidate();
  await cache.fetch(request());
  await cache.fetch(new Request(origin + "/api/v1/projects/current"));
  assert.equal(f.requests.length, 2);
  assert.deepEqual(await f.storage.keys(), []);
});
test("a verified user replacement also fences requests before the epoch notification arrives", async () => {
  const f = fixture(), cache = f.make(), pending = Promise.withResolvers();
  f.respond(() => pending.promise);
  const rejected = assert.rejects(cache.fetch(request()), /account changed/);
  while (!f.requests.length) await new Promise(resolve => setImmediate(resolve));
  f.identity.value = {user:{id:"another-user"}};
  pending.resolve(response());
  await rejected;
  for (const name of await f.storage.keys()) assert.deepEqual(await (await f.storage.open(name)).keys(),[]);
});
