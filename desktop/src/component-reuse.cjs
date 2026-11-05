const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { MODEL, normalize } = require("./component-embedding.cjs");
const hash = value => createHash("sha256").update(value).digest("hex");
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
const stopWords = new Set(["the", "and", "or", "an", "in", "on", "of", "for", "to", "by", "as", "is", "are", "be", "with", "from", "this", "that", "it", "its", "at"]);
function terms(text) {
  const expanded = text.replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase();
  const result = [];
  for (const item of segmenter.segment(expanded)) if (item.isWordLike && item.segment.length > 1 && !stopWords.has(item.segment)) result.push(item.segment);
  return result;
}
function fragments(doc) {
  const output = [];
  for (const section of doc.sections) {
    let text = "";
    for (const line of section.split("\n")) {
      for (let offset = 0; offset < line.length; offset += 900) {
        const part = line.slice(offset, offset + 900);
        if (text.length + part.length > 1200) { output.push(text); text = ""; }
        text += (text ? "\n" : "") + part;
      }
    }
    if (text) output.push(text);
  }
  return output.map(body => "title: " + doc.name + " | text: " + body);
}
const cosine = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

// Small content-addressed Float32 files; no vector database or model in this process.
class ComponentVectorCache {
  constructor(directory, signature, seedDirectory) { this.directory = directory; this.signature = signature; this.seedDirectory = seedDirectory; this.memory = new Map(); this.writes = 0; }
  key(text) { return hash(this.signature + "\0" + text); }
  async get(account, key) {
    const id = account + ":" + key;
    if (this.memory.has(id)) return this.memory.get(id);
    const files = [path.join(this.directory, account, key + ".bin"), ...(this.seedDirectory ? [path.join(this.seedDirectory, "vector-" + key + ".bin")] : [])];
    for (const file of files) {
      let bytes;
      try { bytes = await fs.readFile(file); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
      if (bytes.length !== 32 + 4 * MODEL.dimensions || !bytes.subarray(0, 32).equals(createHash("sha256").update(bytes.subarray(32)).digest())) continue;
      const vector = Array.from({ length: MODEL.dimensions }, (_, i) => bytes.readFloatLE(32 + i * 4));
      if (!vector.every(Number.isFinite) || Math.abs(Math.hypot(...vector) - 1) > 0.001) continue;
      this.remember(id, vector); return vector;
    }
    return null;
  }
  remember(id, vector) { this.memory.delete(id); this.memory.set(id, vector); if (this.memory.size > 4096) this.memory.delete(this.memory.keys().next().value); }
  async put(account, key, raw) {
    const vector = normalize(raw); const body = Buffer.alloc(MODEL.dimensions * 4);
    vector.forEach((value, index) => body.writeFloatLE(value, index * 4));
    const directory = path.join(this.directory, account); await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, key + ".bin"); const temporary = file + "." + randomUUID() + ".tmp";
    try { await fs.writeFile(temporary, Buffer.concat([createHash("sha256").update(body).digest(), body]), { mode: 0o600 }); await fs.rename(temporary, file); }
    finally { await fs.rm(temporary, { force: true }); }
    const stored = Array.from({ length: MODEL.dimensions }, (_, i) => body.readFloatLE(i * 4));
    this.remember(account + ":" + key, stored);
    if (++this.writes % 64 === 0) await this.prune(directory);
    return stored;
  }
  async prune(directory) {
    const names = (await fs.readdir(directory)).filter(name => /^[a-f0-9]{64}\.bin$/.test(name));
    if (names.length <= 8192) return;
    const entries = [];
    for (const name of names) { const stat = await fs.stat(path.join(directory, name)); entries.push({ name, mtime: stat.mtimeMs }); }
    entries.sort((a, b) => b.mtime - a.mtime);
    for (const entry of entries.slice(8192)) await fs.rm(path.join(directory, entry.name), { force: true });
  }
}

class ComponentReuse {
  constructor({ directory, embedding, backgroundDelayMs = 150, idlePauseMs = 700 }) {
    this.embedding = embedding; this.cache = new ComponentVectorCache(directory, embedding.signature, embedding.directory);
    this.backgroundDelayMs = backgroundDelayMs; this.idlePauseMs = idlePauseMs;
    this.foreground = []; this.pending = new Map(); this.generation = 0; this.closed = false;
    this.queryCache = new Map();
    this.stats = { cacheHits: 0, documentEmbeddings: 0, queryEmbeddings: 0, queryCacheHits: 0 };
  }
  activity() { this.pausedUntil = Date.now() + this.idlePauseMs; }
  async sync(scope, documents, unavailable = 0) {
    if (this.closed) throw new Error("Component reuse closed");
    if (this.state && (this.state.scope.account !== scope.account || this.state.scope.project !== scope.project)) this.reset();
    const fingerprint = hash(JSON.stringify([scope, documents, unavailable]));
    if (this.state?.fingerprint === fingerprint) return this.coverage();
    const previous = new Map(this.state?.documents.map(doc => [doc.lexicalKey, doc]) ?? []);
    const generation = ++this.generation; this.pending.clear(); this.failure = null;
    const state = this.state = { scope, fingerprint, generation, unavailable, documents: documents.map(doc => {
      const content = [doc.name, doc.name, doc.name, doc.description, doc.description, ...doc.sections].join(" ");
      const lexicalKey = hash(content); const cached = previous.get(lexicalKey);
      const counts = cached?.termCounts ?? new Map(); let length = cached?.termLength ?? 0;
      if (!cached) for (const term of terms(content)) { counts.set(term, (counts.get(term) ?? 0) + 1); length++; }
      return { ...doc, lexicalKey, termCounts: counts, termLength: length, pieces: fragments(doc).map(text => ({ text, key: this.cache.key(text), vector: null })) };
    }) };
    state.frequency = new Map(); state.averageLength = state.documents.reduce((sum, doc) => sum + doc.termLength, 0) / Math.max(1, documents.length);
    for (const doc of state.documents) for (const term of doc.termCounts.keys()) state.frequency.set(term, (state.frequency.get(term) ?? 0) + 1);
    for (const doc of state.documents) {
      for (const piece of doc.pieces) {
        const vector = await this.cache.get(scope.account, piece.key);
        if (this.state !== state) return this.coverage();
        if (vector) { piece.vector = vector; this.stats.cacheHits++; }
        else this.pending.set(piece.key, { text: piece.text, key: piece.key, state });
      }
    }
    this.pump(); return this.coverage();
  }
  coverage(state = this.state) {
    const total = (state?.documents.length ?? 0) + (state?.unavailable ?? 0);
    return { indexed: state?.documents.filter(doc => doc.pieces.length && doc.pieces.every(piece => piece.vector)).length ?? 0, total };
  }
  enqueue(text, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const job = { text, signal, resolve, reject };
      job.cancel = () => { this.foreground = this.foreground.filter(item => item !== job); reject(signal.reason); };
      signal.addEventListener("abort", job.cancel, { once: true }); this.foreground.push(job); this.pump();
    });
  }
  pump() {
    clearTimeout(this.timer);
    if (this.closed || this.running) return;
    let job = this.foreground.shift();
    if (!job) {
      if (!this.pending.size || this.failure) return;
      const pause = Math.max(0, (this.pausedUntil ?? 0) - Date.now());
      this.timer = setTimeout(() => this.runBackground(), Math.max(this.backgroundDelayMs, pause)); this.timer.unref?.(); return;
    }
    this.running = true;
    this.embedding.encode(job.text, { signal: job.signal }).then(vector => { this.stats.queryEmbeddings++; job.resolve(vector); }, job.reject)
      .finally(() => { job.signal.removeEventListener("abort", job.cancel); this.running = false; this.pump(); });
  }
  async runBackground() {
    if (this.closed || this.running || this.foreground.length) { this.pump(); return; }
    if (Date.now() < (this.pausedUntil ?? 0)) { this.pump(); return; }
    const job = this.pending.values().next().value;
    if (!job) return;
    this.pending.delete(job.key); this.running = true;
    const controller = this.background = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Component indexing timed out")), 15000);
    try {
      // Query arrivals wait at most for this one piece, never for a whole library batch.
      const vector = await this.embedding.encode(job.text, { signal: controller.signal }); this.stats.documentEmbeddings++;
      const stored = await this.cache.put(job.state.scope.account, job.key, vector);
      if (this.state === job.state) for (const doc of job.state.documents) for (const piece of doc.pieces) if (piece.key === job.key) piece.vector = stored;
    } catch (error) {
      if (this.state === job.state && !this.closed) { this.failure = error; this.pending.set(job.key, job); }
    } finally { clearTimeout(timeout); this.background = null; this.running = false; this.pump(); }
  }
  rank(state, region, vector) {
    const query = [...new Set(terms(region.intent))]; const documents = state.documents;
    const rows = documents.map(doc => {
      let keyword = 0; let overlaps = 0; let matchedWeight = 0; let queryWeight = 0; const matchedTerms = [];
      for (const term of query) {
        const count = doc.termCounts.get(term) ?? 0; const frequency = state.frequency.get(term) ?? 0;
        const idf = Math.log(1 + (documents.length - frequency + 0.5) / (frequency + 0.5));
        queryWeight += idf;
        if (count) { keyword += idf * count * 2.2 / (count + 1.2 * (0.25 + 0.75 * doc.termLength / (state.averageLength || 1))); matchedWeight += idf; matchedTerms.push(term); if (idf > 0.8) overlaps++; }
      }
      const scores = vector ? doc.pieces.filter(piece => piece.vector).map(piece => cosine(vector, piece.vector)) : [];
      return { doc, keyword, overlaps, keywordCoverage: queryWeight ? matchedWeight / queryWeight : 0, matchedTerms, similarity: scores.length ? Math.max(...scores) : null };
    });
    const semantic = rows.filter(row => row.similarity !== null).sort((a, b) => b.similarity - a.similarity);
    // A single coincidental word must not receive a full lexical ranking vote.
    const lexicalMatch = row => row.overlaps >= 2 && row.keywordCoverage >= 0.25;
    const lexical = rows.filter(lexicalMatch).sort((a, b) => b.keyword - a.keyword);
    for (const row of rows) row.fusion = (lexicalMatch(row) ? 1 / (60 + lexical.indexOf(row) + 1) : 0) + (row.similarity !== null ? 1 / (60 + semantic.indexOf(row) + 1) : 0);
    // Model-specific conservative pilot cutoff; not a cross-model probability.
    const eligible = row => row.similarity !== null
      ? row.similarity >= 0.68 || lexicalMatch(row) && row.similarity >= 0.65
      : lexicalMatch(row);
    const used = rows.filter(row => region.usedComponentUuids.includes(row.doc.componentUuid) && eligible(row));
    const candidates = rows.filter(row => !region.usedComponentUuids.includes(row.doc.componentUuid) && row.doc.componentUuid !== region.componentUuid && eligible(row)).sort((a, b) => b.fusion - a.fusion);
    if (used.some(row => candidates[0] && (row.similarity ?? 0) >= (candidates[0].similarity ?? 0) - 0.01 && row.keyword >= candidates[0].keyword)) return [];
    return candidates.slice(0, 3).map(({ doc, keyword, similarity, keywordCoverage, matchedTerms }) => ({
      componentUuid: doc.componentUuid, name: doc.name, fromProject: doc.fromProject, version: doc.version,
      description: doc.description.slice(0, 220), score: similarity ?? keyword,
      keywordCoverage, matchedTerms: matchedTerms.slice(0, 10),
      matchedBy: [...(keyword ? ["keyword"] : []), ...(similarity !== null ? ["embedding"] : [])],
      contract: { props: doc.props.slice(0, 8), slots: doc.slots.slice(0, 5), events: doc.events.slice(0, 5), ...(doc.parent ? { parent: doc.parent } : {}) },
      unknowns: ["Relevance is not behavioral equivalence. Read the current full contract and verify data, events, accessibility and any parent requirements before replacing."],
    }));
  }
  async review(scope, regions, { signal } = {}) {
    const started = performance.now(); const state = this.state;
    const result = { status: "unavailable", ...this.coverage(), elapsedMs: 0, suggestions: [] };
    if (!state || state.scope.account !== scope.account || state.scope.project !== scope.project) return result;
    const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(new Error("Component review deadline")), 5000);
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    this.activity();
    try {
      for (const region of regions) {
        combined.throwIfAborted(); if (this.state !== state) { result.status = "partial"; break; }
        let vector;
        if (this.queryCache.has(region.intent)) { vector = this.queryCache.get(region.intent); this.stats.queryCacheHits++; }
        else if (!this.failure && this.coverage(state).indexed) {
          try {
            vector = await this.enqueue("task: search result | query: " + region.intent, combined);
            combined.throwIfAborted();
            if (this.state === state) {
              this.queryCache.set(region.intent, vector);
              if (this.queryCache.size > 128) this.queryCache.delete(this.queryCache.keys().next().value);
            }
          } catch (error) { if (combined.aborted) throw error; this.failure = error; }
        }
        if (this.state !== state) { result.status = "partial"; result.suggestions = []; break; }
        const candidates = this.rank(state, region, vector);
        if (candidates.length) result.suggestions.push({ componentUuid: region.componentUuid, elementUuid: region.elementUuid, intent: region.intent, candidates,
          guidance: "Reassess this region once using the applicable Plasmic rules (external MCP clients: top-level read_skill). Read each candidate's current contract with read view:contract, fromProject and componentUuids. Replace only if it satisfies the requirement; keep justified custom UI. Do not repeat a successful edit or loop merely because this advisory exists." });
      }
      result.status = this.state === state && !this.failure && this.coverage(state).indexed === this.coverage(state).total ? "completed" : "partial";
    } catch { result.status = signal?.aborted ? "cancelled" : controller.signal.aborted ? "timeout" : "unavailable"; result.suggestions = []; }
    finally { clearTimeout(deadline); }
    Object.assign(result, this.coverage(state), { elapsedMs: performance.now() - started });
    while (Buffer.byteLength(JSON.stringify(result)) > 5120 && result.suggestions.length) { result.suggestions.pop(); if (result.status === "completed") result.status = "partial"; }
    return result;
  }
  reset() {
    this.generation++; this.state = null; this.pending.clear(); this.queryCache.clear(); this.failure = null; clearTimeout(this.timer);
    this.background?.abort(new Error("Component project changed"));
    void this.embedding.stop();
    for (const job of this.foreground.splice(0)) { job.signal.removeEventListener("abort", job.cancel); job.reject(new Error("Component project changed")); }
  }
  async close() { this.closed = true; this.reset(); await this.embedding.close(); }
}
module.exports = { ComponentReuse, ComponentVectorCache, fragments, terms, hash };
