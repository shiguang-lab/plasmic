const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validId = (value) => typeof value === "string" && value.length > 0 && value.length < 256;

// Each editor owns a file. Never replace another editor's unsynced work.
class DesktopDraftStore {
  constructor(directory, { maxBytes = 256 * 1024 * 1024 } = {}) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    this.queue = Promise.resolve();
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
  async readFile(file) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {return null;}
      if (!(error instanceof SyntaxError)) {throw error;}
      // Preserve the damaged file for inspection and recover the previous checkpoint.
      return JSON.parse(await fs.readFile(file + ".previous", "utf8"));
    }
  }
  async list(scope, allProjects = false) {
    await this.queue;
    const directory = this.scope(scope);
    let names;
    try { names = await fs.readdir(directory); }
    catch (error) { if (error.code === "ENOENT") {return [];} throw error; }
    const entries = await Promise.all(names.filter(name => name.endsWith(".json")).map(async name => {
      const draft = await this.readFile(path.join(directory, name));
      if (!draft || (!allProjects && (draft.projectId !== scope.projectId || draft.branchId !== scope.branchId))) {return null;}
      const { id, projectId, branchId, baseRevision, sequence, savedAt, projectName, needsAttention } = draft;
      return { id, projectId, branchId, baseRevision, sequence, savedAt, projectName, needsAttention };
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
      const previous = await this.readFile(file);
      if (previous && (previous.sequence > draft.sequence || previous.sequence === draft.sequence &&
        previous.baseRevision >= draft.baseRevision && !!previous.needsAttention === !!draft.needsAttention)) {return;}
      const data = JSON.stringify(draft);
      const directory = path.dirname(file);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const names = await fs.readdir(directory);
      let bytes = Buffer.byteLength(data) + (previous ? Buffer.byteLength(JSON.stringify(previous)) : 0);
      for (const name of names) {
        const entry = path.join(directory, name);
        if (entry !== file && entry !== file + ".previous") {bytes += (await fs.stat(entry)).size;}
      }
      if (bytes > this.maxBytes) {throw new Error("Local draft storage is full. Export or discard old drafts to free space.");}
      if (previous) {await this.atomicWrite(file + ".previous", JSON.stringify(previous));}
      await this.atomicWrite(file, data);
    });
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
      const draft = await this.readFile(file);
      // A delayed acknowledgement must never delete a newer checkpoint.
      if (!draft || draft.sequence > sequence) {return false;}
      await fs.rm(file, { force: true });
      await fs.rm(file + ".previous", { force: true });
      return true;
    });
  }
}

function createDraftHandler({ store, origin, trustedSender, projectId, currentUser }) {
  const sessions = new Map();
  return {
    reset() { sessions.clear(); },
    async command(event, command, input) {
      if (!trustedSender(event)) {throw new Error("Invalid Studio page");}
      if (command === "list" || command === "open") {
        const userId = await currentUser();
        if (!userId || userId !== input.userId) {throw new Error("Invalid draft account");}
        const scope = { origin, userId, projectId: input.projectId || "list", branchId: input.branchId ?? null };
        if (command === "list") {return store.list(scope, true);}
        if (projectId(event.senderFrame.url) !== input.projectId) {throw new Error("Invalid Studio project");}
        for (const [key, session] of sessions) {
          if (session.frame === event.senderFrame) {sessions.delete(key);}
        }
        const handle = randomUUID();
        sessions.set(handle, { scope, frame: event.senderFrame });
        return { handle, drafts: await store.list(scope) };
      }
      const session = sessions.get(input.handle);
      if (!session || session.frame !== event.senderFrame || projectId(event.senderFrame.url) !== session.scope.projectId) {
        throw new Error("Invalid draft session");
      }
      if (command === "read") {return store.read(session.scope, input.id);}
      if (command === "write") {return store.write(session.scope, input.draft);}
      if (command === "remove") {return store.remove(session.scope, input.id, input.sequence);}
      throw new Error("Invalid draft command");
    },
  };
}
module.exports = { DesktopDraftStore, createDraftHandler };
