const { createHash } = require("node:crypto");
const { selectCandidates } = require("./component-selection.cjs");
const hash = (value) => createHash("sha256").update(value).digest("hex");

class ComponentCandidates {
  constructor(post) {
    this.post = post;
    this.state = null;
  }
  async sync(scope, documents, unavailable, retry = false, defer = false) {
    const key = hash(JSON.stringify([scope, documents, unavailable]));
    if (this.state?.key !== key) {
      this.reset();
      this.state = {
        key,
        scope,
        cache: new Map(),
        cacheBytes: 0,
        pendingSearches: new Map(),
        controller: new AbortController(),
      };
    }
    const state = this.state;
    if (state.catalogue && !retry) return state.catalogue;
    if (!state.pending) {
      const body = {
        command: "sync",
        documents,
        unavailable,
        retry,
      };
      state.pending = this.post(
        state.scope.project,
        body,
        state.controller.signal,
      )
        .then((catalogue) => {
          if (catalogue.version !== state.catalogue?.version) {
            state.cache.clear();
            state.cacheBytes = 0;
          }
          state.catalogue = catalogue;
        })
        .finally(() => {
          state.pending = null;
        });
    }
    if (defer) {
      // The next read retries a failed upload. Edits can finish while it is in flight.
      void state.pending.catch(() => {});
      return { preparing: true, indexed: 0, total: documents.length + unavailable };
    }
    await state.pending;
    return state.catalogue;
  }
  async candidates(state, intent, signal) {
    if (state.cache.has(intent)) return state.cache.get(intent).response;
    let entry = state.pendingSearches.get(intent);
    if (!entry) {
      const controller = new AbortController();
      const sharedSignal = AbortSignal.any([
        controller.signal,
        state.controller.signal,
      ]);
      const load = async () => {
        const response = await this.post(
          state.scope.project,
          { command: "search", version: state.catalogue.version, intent },
          sharedSignal,
        );
        sharedSignal.throwIfAborted();
        if (!Array.isArray(response.rows))
          throw new Error("Invalid component candidates");
        if (response.status === "completed") {
          const size = Buffer.byteLength(JSON.stringify(response));
          state.cache.set(intent, { response, size });
          state.cacheBytes += size;
          while (state.cache.size > 128 || state.cacheBytes > 4 * 1024 * 1024) {
            const oldest = state.cache.keys().next().value;
            state.cacheBytes -= state.cache.get(oldest).size;
            state.cache.delete(oldest);
          }
        }
        return response;
      };
      entry = {
        controller,
        readers: 0,
        promise: load().finally(() => {
          if (state.pendingSearches.get(intent) === entry)
            state.pendingSearches.delete(intent);
        }),
      };
      state.pendingSearches.set(intent, entry);
    }
    entry.readers++;
    let abort;
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    try {
      return await Promise.race([entry.promise, cancelled]);
    } finally {
      signal.removeEventListener("abort", abort);
      if (
        --entry.readers === 0 &&
        state.pendingSearches.get(intent) === entry
      ) {
        state.pendingSearches.delete(intent);
        entry.controller.abort();
      }
    }
  }
  async review(scope, regions, { signal } = {}) {
    const started = performance.now();
    const state = this.state;
    if (
      !state?.catalogue ||
      scope.account !== state.scope.account ||
      scope.project !== state.scope.project
    ) {
      return {
        status: "unavailable",
        indexed: 0,
        total: 0,
        elapsedMs: 0,
        suggestions: [],
      };
    }
    const { indexed, total } = state.catalogue;
    const result = {
      status: "completed",
      indexed,
      total,
      elapsedMs: 0,
      suggestions: [],
    };
    const deadline = AbortSignal.timeout(5000);
    const combined = AbortSignal.any([
      deadline,
      state.controller.signal,
      ...(signal ? [signal] : []),
    ]);
    const batch = new Map();
    try {
      for (const region of regions) {
        combined.throwIfAborted();
        let response = batch.get(region.intent);
        if (!response) {
          response = await this.candidates(state, region.intent, combined);
          batch.set(region.intent, response);
        }
        const { rows, ...metadata } = response;
        if (result.status === "completed" || metadata.status !== "completed")
          Object.assign(result, metadata);
        const candidates = selectCandidates(rows, region);
        if (candidates.length)
          result.suggestions.push({
            componentUuid: region.componentUuid,
            elementUuid: region.elementUuid,
            intent: region.intent,
            candidates,
            guidance:
              "Reassess this region once using the applicable Plasmic rules (external MCP clients: top-level read_skill). Read each candidate's current contract with read view:contract, fromProject and componentUuids. Candidates with requiredBy are required parents, not alternatives; keep the composition together unless the target already has that ancestor. Replace only if it satisfies the requirement; keep justified custom UI. Do not repeat a successful edit or loop merely because this advisory exists.",
          });
      }
    } catch (error) {
      if (error.status === 409 && this.state === state) {
        // Studio supplies its current (possibly unsaved) catalogue on a read-only retry.
        this.reset();
        result.status = "partial";
        result.issues = ["catalogue-changed"];
      } else
        result.status =
          deadline.aborted || error.name === "TimeoutError"
            ? "timeout"
            : combined.aborted
              ? "cancelled"
              : "unavailable";
      result.suggestions = [];
    }
    result.elapsedMs = performance.now() - started;
    while (
      Buffer.byteLength(JSON.stringify(result)) > 5120 &&
      result.suggestions.length
    ) {
      result.suggestions.pop();
      if (result.status === "completed") result.status = "partial";
      result.issues = [
        ...new Set([...(result.issues ?? []), "output-truncated"]),
      ];
    }
    return result;
  }
  reset() {
    this.state?.controller.abort();
    this.state = null;
  }
  close() {
    this.reset();
  }
}

function nasComponentSearch(session, origin) {
  return async (project, body, signal) => {
    const response = await session.fetch(
      origin +
        "/api/v1/projects/" +
        encodeURIComponent(project) +
        "/component-search",
      {
        method: "POST",
        credentials: "include",
        redirect: "error",
        bypassCustomProtocolHandlers: true,
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(
        new Error("Component search returned " + response.status),
        { status: response.status },
      );
    }
    return response.json();
  };
}
module.exports = { ComponentCandidates, nasComponentSearch, hash };
