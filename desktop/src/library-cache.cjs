const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { ResourceCache, maxBytes: defaultMaxBytes } = require("@plasmic-shared/resource-cache");
const digest = value => createHash("sha256").update(value).digest("hex");
const contentDigest = (key, headers, body) => createHash("sha256").update(JSON.stringify([key, headers])).update(body).digest("hex");

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
    return path.join(this.directory, digest(JSON.stringify([scope.origin, scope.userId])), digest(scope.buildId), `${kind}-${digest(key)}.bin`);
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
      let bytes;
      try { bytes = await fs.readFile(file); }
      catch (error) {
        if (error.code !== "ENOENT") throw error;
        // Existing installations retain offline hits while their old entries
        // are converted once. Remove the old entry only after atomic commit.
        const stored = JSON.parse(await fs.readFile(file.replace(/\.bin$/, ".json"), "utf8"));
        if (stored.key !== key || stored.digest !== digest(JSON.stringify([stored.key, stored.headers, stored.body]))) throw new Error("Invalid library cache contents");
        const body = Buffer.from(stored.body, "base64");
        check();
        await this.write(scope, kind, key, body, stored.headers, check).catch(() => check());
        return { body, headers: stored.headers };
      }
      const length = bytes.length >= 4 ? bytes.readUInt32BE(0) : 0;
      if (!length || length > 64 * 1024 || length > bytes.length - 4) throw new Error("Invalid library cache contents");
      const stored = JSON.parse(bytes.subarray(4, 4 + length).toString("utf8"));
      const body = bytes.subarray(4 + length);
      if (stored.key !== key || stored.digest !== contentDigest(stored.key, stored.headers, body)) throw new Error("Invalid library cache contents");
      check();
      await fs.utimes(file, new Date(), new Date()).catch(() => {});
      return { body, headers: stored.headers };
    } catch {
      check();
      await fs.rm(file, { force: true }).catch(() => {});
      await fs.rm(file.replace(/\.bin$/, ".json"), { force: true }).catch(() => {});
      return undefined;
    }
  }
  write(scope, kind, key, body, headers, check) {
    return this.run(async () => {
      check();
      const file = this.file(scope, kind, key);
      const contents = Buffer.from(JSON.stringify({ key, headers, digest: contentDigest(key, headers, body) }));
      if (contents.length > 64 * 1024 || 4 + contents.length + body.byteLength > this.maxBytes) return;
      const length = Buffer.alloc(4);
      length.writeUInt32BE(contents.length);
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = file + "." + randomUUID() + ".tmp";
      try {
        const handle = await fs.open(temporary, "w", 0o600);
        try {
          await handle.writeFile(length);
          await handle.writeFile(contents);
          await handle.writeFile(body);
        } finally { await handle.close(); }
        check();
        await fs.rename(temporary, file);
        await fs.rm(file.replace(/\.bin$/, ".json"), { force: true });
        await this.prune();
      } finally { await fs.rm(temporary, { force: true }); }
    });
  }
  async remove(scope, kind, key) {
    const file = this.file(scope, kind, key);
    await fs.rm(file, { force: true });
    await fs.rm(file.replace(/\.bin$/, ".json"), { force: true });
  }
  clear() { return this.run(() => fs.rm(this.directory, { recursive: true, force: true })); }
  async files(directory = this.directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => {
      if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(error.code)) return [];
      throw error;
    });
    return (await Promise.all(entries.map(async entry => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return this.files(file);
      if (!entry.isFile() || !/\.(bin|json)$/.test(entry.name)) return [];
      const stat = await fs.stat(file).catch(() => undefined);
      return stat ? [{ file, bytes: stat.size, used: stat.mtimeMs }] : [];
    }))).flat();
  }
  async prune() {
    const files = (await this.files()).sort((a, b) => a.used - b.used);
    let bytes = files.reduce((sum, file) => sum + file.bytes, 0);
    for (const entry of files) {
      if (bytes <= this.maxBytes) break;
      if (this.active.has(entry.file.replace(/\.json$/, ".bin"))) continue;
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
