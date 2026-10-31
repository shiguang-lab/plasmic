const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { ResourceCache, maxBytes: defaultMaxBytes } = require("@plasmic-shared/resource-cache");
const digest = value => createHash("sha256").update(value).digest("hex");

class FileResourceStore {
  constructor(directory, maxBytes = defaultMaxBytes) {
    Object.assign(this, { directory, maxBytes });
    this.active = new Map();
    this.queue = Promise.resolve();
  }
  run(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  file(scope, kind, key) {
    return path.join(this.directory, digest(JSON.stringify([scope.origin, scope.userId])), digest(scope.buildId), `${kind}-${digest(key)}.json`);
  }
  protect(scope, kind, key) {
    const file = this.file(scope, kind, key);
    this.active.set(file, (this.active.get(file) || 0) + 1);
    return () => {
      const count = this.active.get(file);
      if (count > 1) this.active.set(file, count - 1);
      else this.active.delete(file);
    };
  }
  async read(scope, kind, key, check) {
    const file = this.file(scope, kind, key);
    try {
      const stored = JSON.parse(await fs.readFile(file, "utf8"));
      const body = Buffer.from(stored.body, "base64");
      if (stored.key !== key || stored.digest !== digest(JSON.stringify([stored.key, stored.headers, stored.body]))) throw new Error("Invalid library cache contents");
      check();
      await fs.utimes(file, new Date(), new Date()).catch(() => {});
      return { body, headers: stored.headers };
    } catch {
      check();
      await fs.rm(file, { force: true }).catch(() => {});
      return undefined;
    }
  }
  write(scope, kind, key, body, headers, check) {
    return this.run(async () => {
      check();
      const file = this.file(scope, kind, key);
      const encoded = Buffer.from(body).toString("base64");
      const contents = JSON.stringify({ key, digest: digest(JSON.stringify([key, headers, encoded])), headers, body: encoded });
      if (Buffer.byteLength(contents) > this.maxBytes) return;
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = file + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, contents, { mode: 0o600 });
        check();
        await fs.rename(temporary, file);
        await this.prune();
      } finally { await fs.rm(temporary, { force: true }); }
    });
  }
  async remove(scope, kind, key) { await fs.rm(this.file(scope, kind, key), { force: true }); }
  clear() { return this.run(() => fs.rm(this.directory, { recursive: true, force: true })); }
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
}

class LibraryCache extends ResourceCache {
  constructor({ directory, maxBytes, ...options }) {
    super({ ...options, store: new FileResourceStore(directory, maxBytes), hash: digest });
  }
}
module.exports = { LibraryCache };
