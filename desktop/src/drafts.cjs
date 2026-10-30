const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validId = (value) => typeof value === "string" && value.length > 0 && value.length < 256;
const summarize = ({ id, projectId, branchId, baseRevision, sequence, savedAt, projectName, needsAttention }) =>
  ({ id, projectId, branchId, baseRevision, sequence, savedAt, projectName, needsAttention });

// Each editor owns a file. Never replace another editor's unsynced work.
class DesktopDraftStore {
  constructor(directory, { maxBytes = 256 * 1024 * 1024 } = {}) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    this.queue = Promise.resolve();
    // Summaries keyed by draft file and validated against its inode, size and
    // mtime. Drafts are MB-scale and parsing runs on Electron's UI thread.
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
    try {
      return { draft: JSON.parse(await fs.readFile(file, "utf8")), recovered: false };
    } catch (error) {
      if (error.code === "ENOENT") {return { draft: null, recovered: false };}
      if (!(error instanceof SyntaxError)) {throw error;}
      // Preserve the damaged file for inspection and recover the previous checkpoint.
      return { draft: JSON.parse(await fs.readFile(file + ".previous", "utf8")), recovered: true };
    }
  }
  async readFile(file) {
    return (await this.readDraft(file)).draft;
  }
  // Same result as summarizing readFile(file), but parses only after the file changed.
  async readSummary(file) {
    let stat;
    try { stat = await fs.stat(file); }
    catch (error) { if (error.code === "ENOENT") {this.summaries.delete(file); return null;} throw error; }
    const key = `${stat.ino}:${stat.size}:${stat.mtimeMs}`;
    const cached = this.summaries.get(file);
    if (cached?.key === key) {return cached;}
    const { draft, recovered } = await this.readDraft(file);
    if (!draft) {this.summaries.delete(file); return null;}
    const entry = { key, size: stat.size, recovered, summary: summarize(draft) };
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
    const entries = await Promise.all(names.filter(name => name.endsWith(".json")).map(async name => {
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
  write(scope, draft) {
    return this.run(async () => {
      const file = this.file(scope, draft.id);
      if (draft.projectId !== scope.projectId || draft.branchId !== scope.branchId ||
        !Number.isSafeInteger(draft.sequence) || draft.sequence < 1 ||
        !Number.isSafeInteger(draft.baseRevision) || draft.baseRevision < 0 ||
        draft.format !== 1 || !draft.bundle?.map || !Array.isArray(draft.dependencies)) {
        throw new Error("Invalid draft");
      }
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
      const summary = summarize(JSON.parse(JSON.stringify(summarize(draft))));
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

function createDraftHandler({ store, origin, trustedSender, projectId, currentUser }) {
  const sessions = new Map();
  let epoch = 0;
  return {
    reset() { epoch++; sessions.clear(); },
    invalidate() { epoch++; },
    async command(event, command, input) {
      if (!trustedSender(event)) {throw new Error("Invalid Studio page");}
      if (command === "list" || command === "open") {
        const version = epoch;
        const userId = await currentUser();
        if (version !== epoch || !userId || userId !== input.userId) {throw new Error("Invalid draft account");}
        const scope = { origin, userId, projectId: input.projectId || "list", branchId: input.branchId ?? null };
        if (command === "list") {
          const drafts = await store.list(scope, true);
          if (version !== epoch) {throw new Error("Invalid draft account");}
          return drafts;
        }
        if (projectId(event.senderFrame.url) !== input.projectId) {throw new Error("Invalid Studio project");}
        const drafts = await store.list(scope);
        if (version !== epoch) {throw new Error("Invalid draft account");}
        for (const [key, session] of sessions) {
          if (session.frame === event.senderFrame) {sessions.delete(key);}
        }
        const handle = randomUUID();
        sessions.set(handle, { scope, frame: event.senderFrame, epoch });
        return { handle, drafts };
      }
      const session = sessions.get(input.handle);
      if (!session || session.frame !== event.senderFrame || projectId(event.senderFrame.url) !== session.scope.projectId) {
        throw new Error("Invalid draft session");
      }
      if (session.epoch !== epoch) {
        const version = epoch;
        const userId = await currentUser();
        if (version !== epoch || sessions.get(input.handle) !== session) {
          throw new Error("Invalid draft session");
        }
        if (userId !== session.scope.userId) {
          sessions.delete(input.handle);
          throw new Error("Invalid draft session");
        }
        session.epoch = version;
      }
      if (command === "read") {
        const version = epoch;
        const draft = await store.read(session.scope, input.id);
        if (version !== epoch || sessions.get(input.handle) !== session) {throw new Error("Invalid draft session");}
        return draft;
      }
      if (command === "write") {return store.write(session.scope, input.draft);}
      if (command === "remove") {return store.remove(session.scope, input.id, input.sequence);}
      throw new Error("Invalid draft command");
    },
  };
}
module.exports = { DesktopDraftStore, createDraftHandler };
