const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const semver = require("semver");

const digest = value => createHash("sha256").update(value).digest("hex");
const MODEL_HEADER = "X-Plasmic-Model-Cache";
const validDigest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Only immutable library bodies live here; project/permission responses never do. */
class LibraryCache {
  constructor({ directory, studioOrigin, buildId, identity, remoteFetch, maxBytes = 256 * 1024 * 1024 }) {
    if (!buildId) throw new Error("Library cache requires an actual renderer build identity");
    Object.assign(this, { directory, studioOrigin, buildId, identity, remoteFetch, maxBytes });
    this.pending = new Map();
    this.active = new Map();
    this.queue = Promise.resolve();
  }
  async scope() {
    const value = await this.identity.read();
    if (value !== this.identity.value) throw new Error("Component library account changed; retry the operation");
    const userId = value?.user?.id;
    if (!userId) throw new Error("Sign in before loading component libraries");
    const epoch = this.identity.epoch;
    const userDirectory = path.join(this.directory, digest(JSON.stringify([this.studioOrigin, userId])));
    return { directory: path.join(userDirectory, digest(this.buildId)), epoch };
  }
  check(scope) {
    if (scope.epoch !== this.identity.epoch) throw new Error("Component library account changed; retry the operation");
  }
  async clear() {
    // Clear only redownloadable resources, including prior-process account
    // namespaces. Logout must also work after the verified identity expired.
    this.identity.invalidate();
    await this.run(() => fs.rm(this.directory, { recursive: true, force: true }));
  }
  run(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  pin(file) {
    this.active.set(file, (this.active.get(file) || 0) + 1);
  }
  unpin(file) {
    const count = this.active.get(file);
    if (count > 1) this.active.set(file, count - 1);
    else this.active.delete(file);
  }
  file(scope, kind, key) {
    if (kind === "model" && !validDigest(key)) throw new Error("Invalid model cache key");
    return path.join(scope.directory, `${kind}-${kind === "model" ? key : digest(key)}.json`);
  }
  async read(scope, kind, key) {
    this.check(scope);
    const file = this.file(scope, kind, key);
    try {
      const stored = JSON.parse(await fs.readFile(file, "utf8"));
      const body = Buffer.from(stored.body, "base64");
      if (stored.key !== key || stored.digest !== digest(JSON.stringify([stored.key, stored.headers, stored.body]))) throw new Error("Invalid library cache contents");
      this.check(scope);
      await fs.utimes(file, new Date(), new Date()).catch(() => {});
      return { body, headers: stored.headers };
    } catch (error) {
      if (scope.epoch !== this.identity.epoch) throw error;
      await fs.rm(file, { force: true }).catch(() => {});
      return undefined;
    }
  }
  async write(scope, kind, key, body, headers = {}) {
    await this.run(async () => {
      this.check(scope);
      const file = this.file(scope, kind, key);
      const encoded = body.toString("base64");
      const contents = JSON.stringify({ key, digest: digest(JSON.stringify([key, headers, encoded])), headers, body: encoded });
      if (Buffer.byteLength(contents) > this.maxBytes) return;
      await fs.mkdir(scope.directory, { recursive: true, mode: 0o700 });
      const temporary = file + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, contents, { mode: 0o600 });
        this.check(scope);
        await fs.rename(temporary, file);
        await this.prune();
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }).catch(error => {
      this.check(scope);
      if (typeof error.code !== "string") throw error;
      // A disk cache failure must not prevent using an authorized download.
      console.warn("Cannot persist component library cache:", error.message);
    });
  }
  async files(directory = this.directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => {
      if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(error.code)) return [];
      throw error;
    });
    return (await Promise.all(entries.map(async entry => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return this.files(file);
      if (!entry.isFile() || !entry.name.endsWith(".json")) return [];
      const stat = await fs.stat(file).catch(() => undefined);
      return stat ? [{ file, bytes: stat.size, used: stat.mtimeMs }] : [];
    }))).flat();
  }
  async prune() {
    const files = (await this.files()).sort((a, b) => a.used - b.used);
    let bytes = files.reduce((sum, file) => sum + file.bytes, 0);
    for (const entry of files) {
      if (bytes <= this.maxBytes) break;
      if (this.active.has(entry.file)) continue;
      await fs.rm(entry.file, { force: true });
      bytes -= entry.bytes;
    }
  }
  async knownModels(scope) {
    const files = (await this.files(scope.directory)).filter(entry => path.basename(entry.file).startsWith("model-"));
    return files.map(entry => path.basename(entry.file).slice(6, -5)).filter(validDigest);
  }
  response(entry, head = false) {
    return new Response(head ? null : entry.body, { headers: {
      ...entry.headers,
      "Cache-Control": "no-store",
      "X-Plasmic-Desktop-Asset": "library-cache",
    } });
  }
  async code(request, url) {
    const version = url.searchParams.get("version"), pkgId = url.searchParams.get("pkgId");
    if (!version || semver.valid(version) !== version || !pkgId || url.searchParams.size !== 2) return this.remoteFetch(request);
    const scope = await this.scope();
    const key = url.pathname + "?" + new URLSearchParams({ pkgId, version });
    const pendingKey = JSON.stringify([scope.directory, scope.epoch, key]);
    const file = this.file(scope, "code", key);
    let pending = this.pending.get(pendingKey);
    if (!pending) {
      this.pin(file);
      pending = (async () => {
        const cached = await this.read(scope, "code", key);
        if (cached) return cached;
        // A HEAD miss still downloads the body once, so a subsequent GET is local.
        const headers = new Headers(request.headers);
        headers.delete("if-none-match"); headers.delete("if-modified-since");
        headers.set("Cache-Control", "no-cache");
        const response = await this.remoteFetch(new Request(request, { method: "GET", headers, cache: "no-store" }));
        if (response.status !== 200) throw new Error(`Component library download failed: HTTP ${response.status}`);
        if (!response.headers.get("content-type")?.startsWith("application/javascript")) throw new Error("Invalid component library response");
        const release = JSON.parse(response.headers.get("X-Plasmic-Library-Release") || "null");
        const body = Buffer.from(await response.arrayBuffer());
        if (release?.pkgId !== pkgId || release?.version !== version || !validDigest(release.digest) || release.digest !== digest(body)) throw new Error("Component library release checksum or version mismatch");
        const entry = { body, headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Content-Length": String(body.length),
          "X-Content-Type-Options": "nosniff",
          "X-Plasmic-Library-Release": JSON.stringify(release),
        } };
        this.check(scope);
        await this.write(scope, "code", key, body, entry.headers);
        return entry;
      })().finally(() => {
        this.pending.delete(pendingKey);
        this.unpin(file);
      });
      this.pending.set(pendingKey, pending);
    }
    const entry = await pending;
    this.check(scope);
    return this.response(entry, request.method === "HEAD");
  }
  async models(request) {
    const scope = await this.scope();
    const known = await this.knownModels(scope);
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = new Headers(request.headers);
      headers.set(MODEL_HEADER, "1");
      headers.set("Content-Type", "application/json");
      headers.delete("Content-Length");
      if (!headers.has("Origin")) {
        const referrerOrigin = request.referrer && new URL(request.referrer).origin;
        headers.set("Origin", referrerOrigin && referrerOrigin !== "null" ? referrerOrigin : this.studioOrigin);
      }
      headers.delete("if-none-match"); headers.delete("if-modified-since");
      // Current permissions/revisions must not come from Chromium's HTTP cache.
      headers.set("Cache-Control", "no-cache");
      const response = await this.remoteFetch(new Request(request, {
        method: "POST", headers, cache: "no-store",
        body: JSON.stringify({ modelDigests: attempt ? [] : known }),
      }));
      if (!response.ok || response.headers.get(MODEL_HEADER) !== "1") return response;
      const payload = await response.json();
      const snapshots = payload.modelSnapshots;
      if (!snapshots || typeof snapshots !== "object") throw new Error("Missing dependency model manifest");
      const packages = [...(payload.pkg ? [payload.pkg] : []), ...(payload.depPkgs || [])];
      let missing = false;
      for (const pkg of packages) {
        const hash = snapshots[pkg.id];
        if (!hash) continue; // Metadata-only package responses contain no model.
        if (!validDigest(hash)) throw new Error("Invalid dependency model digest");
        const file = this.file(scope, "model", hash);
        this.pin(file);
        try {
          if (pkg.model !== undefined) {
            const body = Buffer.from(JSON.stringify(pkg.model));
            if (digest(body) !== hash) throw new Error("Dependency model checksum mismatch");
            await this.write(scope, "model", hash, body);
          } else {
            const cached = await this.read(scope, "model", hash);
            if (!cached || digest(cached.body) !== hash) { missing = true; break; }
            pkg.model = JSON.parse(cached.body.toString("utf8"));
          }
        } finally {
          this.unpin(file);
        }
      }
      this.check(scope);
      // Eviction/corruption raced the hint: request a fresh authorized envelope.
      if (missing && !attempt) continue;
      if (missing) throw new Error("Dependency model snapshot is missing; retry loading the project");
      delete payload.modelSnapshots;
      const outgoing = new Headers(response.headers);
      outgoing.delete("content-length"); outgoing.delete("content-encoding"); outgoing.delete("etag");
      outgoing.set("Cache-Control", "no-store");
      return new Response(JSON.stringify(payload), { status: response.status, headers: outgoing });
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.origin !== this.studioOrigin) return this.remoteFetch(request);
    if (["GET", "HEAD"].includes(request.method) && /^\/api\/v1\/hostless-libraries\/[a-z0-9-]+\/canvas$/.test(url.pathname)) return this.code(request, url);
    if (request.method === "GET" && (
      /^\/api\/v1\/projects\/[^/]+(?:\/updates|\/revs\/[^/]+)?$/.test(url.pathname) ||
      /^\/api\/v1\/pkgs\/(?:projectId\/)?[^/]+$/.test(url.pathname)
    )) return this.models(request);
    return this.remoteFetch(request);
  }
}

module.exports = { LibraryCache };
