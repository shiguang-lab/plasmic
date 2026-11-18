const { ComponentReuse, hash } = require("./component-reuse.cjs");
const { MODEL } = require("./component-embedding.cjs");
const { documents } = require("./catalogue.cjs");

// A catalogue identifies an exact editor snapshot, including unsaved component contracts.
class ComponentSearchService {
  constructor(directory, model) {
    this.catalogues = new Map();
    this.directory = directory;
    this.queue = Promise.resolve();
    this.preparedDocuments = new Map();
    this.embedding = {
      signature: model.signature,
      directory: model.directory,
      encode: (text, options) => {
        const job = this.queue.then(() => {
          options.signal.throwIfAborted();
          return model.encode(text, options);
        });
        this.queue = job.catch(() => {});
        return job;
      },
    };
  }

  // Called before the NAS HTTP listener opens. Never add project contracts to this map.
  async prepare() {
    const publicDocs = require("./component-reuse-public-documents.json");
    const index = new ComponentReuse({ directory: this.directory, embedding: this.embedding });
    try {
      await this.embedding.encode("task: search result | query: component", { signal: AbortSignal.timeout(60000) });
      const { indexed } = await index.sync({ account: hash("public-library-build-inputs"), project: "public-library-build" }, publicDocs);
      if (indexed !== publicDocs.length) throw new Error("Incomplete public component vector seeds");
      for (const doc of index.state.documents) this.preparedDocuments.set(doc.lexicalKey, doc);
    } finally {
      index.reset();
    }
  }

  async sync(scope, input) {
    if (
      !Number.isInteger(input.unavailable) ||
      input.unavailable < 0 ||
      input.unavailable > 5000
    ) {
      throw new TypeError("Invalid component coverage");
    }
    const docs = documents(input.documents);
    const version = hash(
      JSON.stringify([
        "hybrid-v2",
        MODEL.signature,
        scope,
        docs,
        input.unavailable,
      ]),
    );
    let entry = this.catalogues.get(version);
    if (!entry) {
      if (this.catalogues.size >= 8) {
        const oldest = this.catalogues.keys().next().value;
        this.catalogues.get(oldest).index.reset();
        this.catalogues.delete(oldest);
      }
      const index = new ComponentReuse({
        directory: this.directory,
        preparedDocuments: this.preparedDocuments,
        embedding: this.embedding,
      });
      entry = {
        scope,
        index,
        ready: index.sync(scope, docs, input.unavailable),
      };
      this.catalogues.set(version, entry);
    }
    try {
      await entry.ready;
    } catch (error) {
      if (this.catalogues.get(version) === entry)
        this.catalogues.delete(version);
      entry.index.reset();
      throw error;
    }
    if (input.retry === true && entry.index.failure) {
      await entry.index.sync(scope, docs, input.unavailable, true);
    }
    return { version, ...entry.index.coverage() };
  }

  async search(scope, { version, intent }, signal) {
    if (
      typeof intent !== "string" ||
      !intent.trim() ||
      intent.length > 600 ||
      !/^[a-f0-9]{64}$/.test(version)
    ) {
      throw new TypeError("Invalid component search");
    }
    const entry = this.catalogues.get(version);
    if (
      !entry ||
      entry.scope.account !== scope.account ||
      entry.scope.project !== scope.project
    )
      return null;
    this.catalogues.delete(version);
    this.catalogues.set(version, entry);
    await entry.ready;
    if (this.catalogues.get(version) !== entry) return null;
    return entry.index.search(intent, signal);
  }
}

module.exports = { ComponentSearchService };
