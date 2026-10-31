const semver = require("semver");
const maxBytes = 256 * 1024 * 1024;

function resourceSpec(request, origin) {
  const url = new URL(request.url);
  if (url.origin !== origin || !["GET", "HEAD"].includes(request.method)) {return;}
  if (/^\/api\/v1\/dependency-models\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.search) {
    return { kind: "model-resource", key: url.pathname, id: url.pathname.split("/").at(-1) };
  }
  if (!/^\/api\/v1\/hostless-libraries\/[a-z0-9-]+\/canvas$/.test(url.pathname)) {return;}
  const version = url.searchParams.get("version"), pkgId = url.searchParams.get("pkgId");
  if (!version || semver.valid(version) !== version || !pkgId || url.searchParams.size !== 2) {return;}
  return { kind: "code", key: url.pathname + "?" + new URLSearchParams({ pkgId, version }), pkgId, version };
}

/** One immutable-resource policy for browser CacheStorage and desktop files. */
class ResourceCache {
  constructor({ studioOrigin, buildId, identity, store, remoteFetch, hash }) {
    if (!buildId) {throw new Error("Resource cache requires an actual build identity");}
    Object.assign(this, { studioOrigin, buildId, identity, store, remoteFetch, hash });
    this.pending = new Map();
  }
  async scope() {
    const value = await this.identity.read();
    if (value !== this.identity.value) {throw new Error("Component library account changed; retry the operation");}
    const userId = value?.user?.id;
    if (!userId) {return;}
    return { origin: this.studioOrigin, userId, buildId: this.buildId, epoch: this.identity.epoch };
  }
  check(scope) {
    const currentUser = this.identity.value?.user?.id;
    if (scope.epoch !== this.identity.epoch || (currentUser && currentUser !== scope.userId)) {throw new Error("Component library account changed; retry the operation");}
  }
  async clear() {
    this.identity.invalidate();
    await this.store.clear();
  }
  async verified(spec, entry) {
    const type = spec.kind === "code" ? "application/javascript" : "application/json";
    const header = spec.kind === "code" ? "X-Plasmic-Library-Release" : "X-Plasmic-Model-Resource";
    const headers = new Headers(entry.headers);
    if (!headers.get("content-type")?.startsWith(type)) {throw new Error("Invalid component library response");}
    const release = JSON.parse(headers.get(header) || "null");
    const matches = spec.kind === "code"
      ? release?.pkgId === spec.pkgId && release?.version === spec.version
      : release?.id === spec.id;
    if (!matches || typeof release?.digest !== "string" || !/^[a-f0-9]{64}$/.test(release.digest) || release.digest !== await this.hash(entry.body)) {
      throw new Error("Component library resource identity, version or checksum mismatch");
    }
    return { body: entry.body, headers: {
      "Content-Type": `${type}; charset=utf-8`, "Content-Length": String(entry.body.byteLength),
      "X-Content-Type-Options": "nosniff", [header]: JSON.stringify(release),
    } };
  }
  async fetch(request) {
    const spec = resourceSpec(request, this.studioOrigin);
    if (!spec) {return this.remoteFetch(request);}
    const scope = await this.scope();
    if (!scope) {return this.remoteFetch(new Request(request, { cache: "no-store" }));} // Public/anonymous reads are never persisted.
    const pendingKey = JSON.stringify([scope.origin, scope.userId, scope.buildId, scope.epoch, spec.key]);
    let pending = this.pending.get(pendingKey);
    if (!pending) {
      const release = this.store.protect(scope, spec.kind, spec.key);
      pending = (async () => {
        let cached;
        try { cached = await this.store.read(scope, spec.kind, spec.key, () => this.check(scope)); }
        catch (error) { this.check(scope); console.warn("Cannot read component library cache:", error.message); }
        this.check(scope);
        if (cached) {
          try { return { ...await this.verified(spec, cached), cached: true }; }
          catch { await this.store.remove(scope, spec.kind, spec.key).catch(() => {}); }
          this.check(scope);
        }
        const headers = new Headers(request.headers);
        headers.delete("if-none-match"); headers.delete("if-modified-since");
        headers.set("Cache-Control", "no-cache");
        const response = await this.remoteFetch(new Request(request, { method: "GET", headers, cache: "no-store" }));
        if (response.status !== 200) {return response;}
        const entry = await this.verified(spec, { body: new Uint8Array(await response.arrayBuffer()), headers: response.headers });
        this.check(scope);
        try { await this.store.write(scope, spec.kind, spec.key, entry.body, entry.headers, () => this.check(scope)); }
        catch (error) { this.check(scope); console.warn("Cannot persist component library cache:", error.message); }
        this.check(scope);
        return entry;
      })().finally(() => { this.pending.delete(pendingKey); release(); });
      this.pending.set(pendingKey, pending);
    }
    const entry = await pending;
    this.check(scope);
    if (entry instanceof Response) {
      return new Response(request.method === "HEAD" ? null : entry.clone().body, {
        status: entry.status, statusText: entry.statusText, headers: entry.headers,
      });
    }
    return new Response(request.method === "HEAD" ? null : entry.body, { headers: {
      ...entry.headers, "Cache-Control": "no-store", "X-Plasmic-Resource-Cache": entry.cached ? "hit" : "miss",
    } });
  }
}

const cachePrefix = "plasmic-library-resources-v1:";
const scopeKey = scope => JSON.stringify([scope.origin, scope.userId, scope.buildId]);

class CacheStorageStore {
  constructor({ storage, maxBytes: budget = maxBytes }) {
    Object.assign(this, { storage, maxBytes: budget });
    this.queue = Promise.resolve();
    this.active = new Map();
  }
  name(scope) { return cachePrefix + encodeURIComponent(scopeKey(scope)); }
  url(scope, key) { return new URL(key, scope.origin).href; }
  meta(scope, key) { return new URL("/__plasmic_library_cache_metadata__/" + encodeURIComponent(key), scope.origin).href; }
  token(scope, key) { return this.name(scope) + "|" + this.url(scope, key); }
  run(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  protect(scope, _kind, key) {
    const token = this.token(scope, key);
    this.active.set(token, (this.active.get(token) || 0) + 1);
    return () => {
      const count = this.active.get(token);
      if (count > 1) {this.active.set(token, count - 1);}
      else {this.active.delete(token);}
    };
  }
  async read(scope, _kind, key, check) {
    const cache = await this.storage.open(this.name(scope));
    const response = await cache.match(this.url(scope, key));
    if (!response) {return;}
    const body = new Uint8Array(await response.arrayBuffer());
    check();
    // Touch only a small metadata response, never rewrite the resource body.
    await this.run(async () => {
      check();
      await cache.put(this.meta(scope, key), new Response(String(Date.now())));
    }).catch(() => { check(); });
    return { body, headers: response.headers };
  }
  write(scope, _kind, key, body, headers, check) {
    return this.run(async () => {
      check();
      if (body.byteLength > this.maxBytes) {return;}
      await this.prune(body.byteLength);
      check();
      const cache = await this.storage.open(this.name(scope));
      const saved = new Headers(headers);
      saved.set("X-Plasmic-Cache-Bytes", String(body.byteLength));
      saved.set("X-Plasmic-Cache-Created", String(Date.now()));
      const put = () => cache.put(this.url(scope, key), new Response(body, { headers: saved }));
      try {
        try { await put(); }
        catch (error) {
          if (error.name !== "QuotaExceededError") {throw error;}
          await this.prune(this.maxBytes);
          check();
          await put();
        }
        check();
        await cache.put(this.meta(scope, key), new Response(String(Date.now())));
        check();
      } catch (error) {
        await cache.delete(this.url(scope, key)).catch(() => {});
        await cache.delete(this.meta(scope, key)).catch(() => {});
        throw error;
      }
    });
  }
  async remove(scope, _kind, key) {
    const cache = await this.storage.open(this.name(scope));
    await cache.delete(this.url(scope, key));
    await cache.delete(this.meta(scope, key));
  }
  clear() {
    return this.run(async () => {
      await Promise.all((await this.storage.keys()).filter(name => name.startsWith(cachePrefix)).map(name => this.storage.delete(name)));
    });
  }
  async prune(reserve = 0) {
    const entries = [];
    for (const name of (await this.storage.keys()).filter(candidate => candidate.startsWith(cachePrefix))) {
      const cache = await this.storage.open(name);
      for (const request of await cache.keys()) {
        const spec = resourceSpec(request, new URL(request.url).origin);
        if (!spec) {continue;} // Small access-time records aren't resource bodies.
        const response = await cache.match(request);
        if (!response) {continue;}
        const metaUrl = new URL("/__plasmic_library_cache_metadata__/" + encodeURIComponent(spec.key), request.url).href;
        const touched = await cache.match(metaUrl);
        entries.push({ cache, request, metaUrl, token: name + "|" + request.url,
          bytes: Number(response.headers.get("X-Plasmic-Cache-Bytes")) || Number(response.headers.get("Content-Length")) || 0,
          used: Number(touched ? await touched.text() : response.headers.get("X-Plasmic-Cache-Created")) || 0 });
      }
    }
    let bytes = entries.reduce((sum, item) => sum + item.bytes, 0) + reserve;
    for (const entry of entries.sort((a, b) => a.used - b.used)) {
      if (bytes <= this.maxBytes) {break;}
      if (this.active.has(entry.token)) {continue;}
      await entry.cache.delete(entry.request);
      await entry.cache.delete(entry.metaUrl);
      bytes -= entry.bytes;
    }
  }
}

module.exports = { ResourceCache, CacheStorageStore, resourceSpec, maxBytes };
