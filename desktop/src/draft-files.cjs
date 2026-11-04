const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const summarize = ({ id, projectId, branchId, baseRevision, sequence, savedAt, projectName, needsAttention }) =>
  ({ id, projectId, branchId, baseRevision, sequence, savedAt, projectName, needsAttention });
const validId = (value) => typeof value === "string" && value.length > 0 && value.length < 256;

// Each editor owns a file. Never replace another editor's unsynced work.
class DraftFiles {
  constructor(directory, { maxBytes = 256 * 1024 * 1024 } = {}) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    this.queue = Promise.resolve();
    // Summaries keyed by draft file and validated against its inode, size and
    // mtime. The background parser returns only metadata, never a model tree.
    this.summaries = new Map();
  }
  scope(scope) {
    if (!validId(scope.origin) || !validId(scope.userId) || !validId(scope.projectId) ||
      !(scope.branchId === null || validId(scope.branchId))) {throw new Error("Invalid draft scope");}
    return path.join(this.directory, hash([scope.origin, scope.userId]));
  }
  file(scope, id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) {throw new Error("Invalid draft ID");}
    return path.join(this.scope(scope), hash([scope.projectId, scope.branchId]) + "-" + id + ".json");
  }
  run(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  async readDraft(file) {
    const read = async file => {
      const data = await fs.readFile(file);
      const draft = JSON.parse(data);
      const summary = draft ? summarize(draft) : null;
      return { data, summary };
    };
    try {
      return { ...await read(file), recovered: false };
    } catch (error) {
      if (error.code === "ENOENT") {return { data: null, summary: null, recovered: false };}
      if (!(error instanceof SyntaxError)) {throw error;}
      // Preserve the damaged file for inspection and recover the previous checkpoint.
      return { ...await read(file + ".previous"), recovered: true };
    }
  }
  async readFile(file) {
    return (await this.readDraft(file)).data;
  }
  // Same result as summarizing readFile(file), but parses only after the file changed.
  async readSummary(file) {
    let stat;
    try { stat = await fs.stat(file); }
    catch (error) { if (error.code === "ENOENT") {this.summaries.delete(file); return null;} throw error; }
    const key = `${stat.ino}:${stat.size}:${stat.mtimeMs}`;
    const cached = this.summaries.get(file);
    if (cached?.key === key) {return cached;}
    const { summary, recovered } = await this.readDraft(file);
    if (!summary) {this.summaries.delete(file); return null;}
    const entry = { key, size: stat.size, recovered, summary };
    // A recovered checkpoint lives in another file; never reuse it by this file's identity.
    if (recovered) {this.summaries.delete(file);} else {this.summaries.set(file, entry);}
    return entry;
  }
  async list(scope, allProjects = false) {
    await this.queue;
    const directory = this.scope(scope);
    let names;
    try { names = await fs.readdir(directory); }
    catch (error) { if (error.code === "ENOENT") {return [];} throw error; }
    const prefix = hash([scope.projectId, scope.branchId]) + "-";
    const entries = await Promise.all(names.filter(name => name.endsWith(".json") && (allProjects || name.startsWith(prefix))).map(async name => {
      const draft = (await this.readSummary(path.join(directory, name)))?.summary;
      if (!draft || (!allProjects && (draft.projectId !== scope.projectId || draft.branchId !== scope.branchId))) {return null;}
      return { ...draft };
    }));
    return entries.filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
  }
  async read(scope, id) {
    await this.queue;
    return this.readFile(this.file(scope, id));
  }
  write(scope, draftJson) {
    return this.run(async () => {
      const draft = JSON.parse(Buffer.from(draftJson.buffer, draftJson.byteOffset, draftJson.byteLength).toString("utf8"));
      const file = this.file(scope, draft.id);
      if (draft.projectId !== scope.projectId || draft.branchId !== scope.branchId ||
        !Number.isSafeInteger(draft.sequence) || draft.sequence < 1 ||
        !Number.isSafeInteger(draft.baseRevision) || draft.baseRevision < 0 ||
        draft.format !== 1 || !draft.bundle?.map || !Array.isArray(draft.dependencies)) throw new Error("Invalid draft");
      const stored = await this.readSummary(file);
      const previous = stored?.summary;
      if (previous && (previous.sequence > draft.sequence || previous.sequence === draft.sequence &&
        previous.baseRevision >= draft.baseRevision && !!previous.needsAttention === !!draft.needsAttention)) {return;}
      const data = JSON.stringify(draft);
      const directory = path.dirname(file);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const names = await fs.readdir(directory);
      // The previous checkpoint is kept byte-for-byte, so its size is the size of
      // the file it comes from: this file, or the checkpoint it was recovered from.
      const previousSize = !stored ? 0 : stored.recovered ? (await fs.stat(file + ".previous")).size : stored.size;
      let bytes = Buffer.byteLength(data) + previousSize;
      for (const name of names) {
        const entry = path.join(directory, name);
        if (entry !== file && entry !== file + ".previous") {bytes += (await fs.stat(entry)).size;}
      }
      if (bytes > this.maxBytes) {throw new Error("Local draft storage is full. Export or discard old drafts to free space.");}
      // A recovered checkpoint already is the .previous file; otherwise copy this
      // file's bytes instead of parsing and serializing the whole model again.
      if (stored && !stored.recovered) {await this.atomicCopy(file, file + ".previous");}
      this.summaries.delete(file);
      await this.atomicWrite(file, data);
      const stat = await fs.stat(file);
      // Round-trip only the small summary so it matches what parsing the file yields.
      const summary = JSON.parse(JSON.stringify(summarize(draft)));
      this.summaries.set(file, { key: `${stat.ino}:${stat.size}:${stat.mtimeMs}`, size: stat.size, recovered: false, summary });
    });
  }
  async atomicCopy(source, target) {
    const temporary = target + ".tmp";
    let handle;
    try {
      await fs.copyFile(source, temporary);
      handle = await fs.open(temporary, "r+");
      await handle.chmod(0o600);
      await handle.sync();
      await handle.close();
      await fs.rename(temporary, target);
    } finally {
      await handle?.close();
      await fs.rm(temporary, { force: true });
    }
  }
  async atomicWrite(file, data) {
    const temporary = file + ".tmp";
    const handle = await fs.open(temporary, "w", 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(data, "utf8"); await handle.sync();
      await handle.close();
      await fs.rename(temporary, file);
    } finally {
      await handle.close();
      await fs.rm(temporary, { force: true });
    }
  }
  remove(scope, id, sequence) {
    return this.run(async () => {
      const file = this.file(scope, id);
      const draft = (await this.readSummary(file))?.summary;
      // A delayed acknowledgement must never delete a newer checkpoint.
      if (!draft || draft.sequence > sequence) {return false;}
      this.summaries.delete(file);
      await fs.rm(file, { force: true });
      await fs.rm(file + ".previous", { force: true });
      return true;
    });
  }
}

module.exports = { DraftFiles };
