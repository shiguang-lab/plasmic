const { randomUUID } = require("node:crypto");
const { BackgroundWorker } = require("./background-worker.cjs");
const { DraftFiles } = require("./draft-files.cjs");

// The main process owns authorization and small summary metadata. All model
// parsing, serialization and durable file operations belong to one worker.
class DesktopDraftStore {
  constructor(directory, { maxBytes = 256 * 1024 * 1024 } = {}) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    this.worker = new BackgroundWorker({ name: "Plasmic Drafts" });
    this.summaries = new Map();
    this.queue = Promise.resolve();
    this.closed = false;
  }
  scope(scope) { return DraftFiles.prototype.scope.call(this, scope); }
  file(scope, id) { return DraftFiles.prototype.file.call(this, scope, id); }
  request(method, args) {
    if (this.closed) return Promise.reject(new Error("Desktop closed"));
    const result = this.worker.run("draft-store", { directory: this.directory, maxBytes: this.maxBytes,
      method, args, summaries: [...this.summaries] }).then(({ value, summaries }) => {
      this.summaries = new Map(summaries);
      return value;
    });
    this.queue = result.then(() => {}, () => {});
    return result;
  }
  write(scope, draftData) {
    if (!(draftData instanceof Uint8Array)) return Promise.reject(new Error("Invalid draft payload"));
    return this.request("write", [scope, draftData]);
  }
  read(scope, id) { return this.request("read", [scope, id]); }
  list(scope, allProjects = false) { return this.request("list", [scope, allProjects]); }
  remove(scope, id, sequence) { return this.request("remove", [scope, id, sequence]); }
  async close() {
    this.closed = true;
    await this.queue;
    await this.worker.close();
  }
}

function createDraftHandler({ store, origin, trustedSender, projectId, currentUser }) {
  const sessions = new Map();
  let epoch = 0;
  return {
    close: () => store.close(),
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
      if (command === "write") {
        if (!(input.draftData instanceof Uint8Array)) {throw new Error("Invalid draft payload");}
        return store.write(session.scope, input.draftData);
      }
      if (command === "remove") {return store.remove(session.scope, input.id, input.sequence);}
      throw new Error("Invalid draft command");
    },
  };
}
module.exports = { DesktopDraftStore, createDraftHandler };
