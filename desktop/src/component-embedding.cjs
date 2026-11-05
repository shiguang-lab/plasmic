const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const net = require("node:net");

const MODEL = Object.freeze({
  repo: "unsloth/embeddinggemma-2-GGUF", revision: "031f0d4b35536f69ab3509d4893c923264fcf253",
  file: "embeddinggemma-2-UD-Q4_K_XL.gguf", sha256: "ea905fd08e8061db77a0031cbb5096d459d7cfd2bdd0ad2ba66e483f16719493",
  bytes: 175673856, dimensions: 768,
  signature: "embeddinggemma2-UD-Q4_K_XL-ea905fd0-search-result-title-mean-l2-768-first512-v1",
});
async function fileHash(file) {
  const hash = createHash("sha256");
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.allocUnsafe(Math.min((await handle.stat()).size || 1, 1024 * 1024));
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally { await handle.close(); }
  return hash.digest("hex");
}
function normalize(vector) {
  if (!Array.isArray(vector) || vector.length !== MODEL.dimensions || !vector.every(Number.isFinite)) throw new Error("Invalid component embedding");
  const norm = Math.hypot(...vector);
  if (!norm) throw new Error("Empty component embedding");
  return vector.map(value => value / norm);
}

// Only this native child loads weights. No ONNX/Python/Go runtime in Electron.
class ComponentEmbedding {
  constructor(directory, { idleMs = 15000 } = {}) {
    this.directory = directory; this.idleMs = idleMs; this.signature = MODEL.signature;
    this.child = null; this.closed = false;
  }
  async verify() {
    const manifest = JSON.parse(await fs.readFile(path.join(this.directory, "runtime.json"), "utf8"));
    if (manifest.model?.sha256 !== MODEL.sha256 || manifest.commit !== "cd959bae99ff4bed22bef2604f45241c09bbb8c8" || manifest.platform !== process.platform || manifest.arch !== process.arch) throw new Error("Component embedding runtime does not match this build");
    for (const entry of manifest.files) {
      if (path.basename(entry.name) !== entry.name || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Invalid component runtime manifest");
      const file = path.join(this.directory, entry.name);
      // App packaging re-signs Mach-O/PE files. Their build hashes are provenance;
      // the signed application covers those binaries. Model/vector bytes stay fixed.
      const signable = /(?:\.dylib|\.dll|\.exe)$/.test(entry.name) || entry.name === "llama-server";
      if (signable && ["darwin", "win32"].includes(process.platform)) { if (!(await fs.stat(file)).isFile()) throw new Error("Component runtime binary is missing"); }
      else if (await fileHash(file) !== entry.sha256) throw new Error("Component runtime integrity check failed");
    }
    if (!manifest.files.some(entry => entry.name === MODEL.file && entry.sha256 === MODEL.sha256) || !manifest.files.some(entry => entry.name === (process.platform === "win32" ? "llama-server.exe" : "llama-server"))) throw new Error("Incomplete component embedding runtime");
    return true;
  }
  prepare() { return this.verified ??= this.verify(); }
  async start(signal) {
    if (this.closed) throw new Error("Component embeddings closed");
    signal.throwIfAborted(); clearTimeout(this.timer);
    await this.prepare(); signal.throwIfAborted();
    await this.stopping; signal.throwIfAborted();
    if (this.child) return;
    const port = await new Promise((resolve, reject) => {
      const listener = net.createServer(); listener.on("error", reject);
      listener.listen(0, "127.0.0.1", () => { const value = listener.address().port; listener.close(error => error ? reject(error) : resolve(value)); });
    });
    signal.throwIfAborted(); this.key = randomUUID(); this.url = "http://127.0.0.1:" + port;
    const child = this.child = spawn(path.join(this.directory, process.platform === "win32" ? "llama-server.exe" : "llama-server"), [
      "--model", path.join(this.directory, MODEL.file), "--embeddings", "--pooling", "mean", "--embd-normalize", "2",
      "--ctx-size", "512", "--batch-size", "512", "--ubatch-size", "512", "--parallel", "1",
      "--threads", "2", "--threads-batch", "2", "--threads-http", "1", "--gpu-layers", "0", "--no-warmup",
      "--host", "127.0.0.1", "--port", String(port), "--api-key", this.key,
    ], { cwd: this.directory, stdio: "ignore", windowsHide: true, env: { ...process.env, VECLIB_MAXIMUM_THREADS: "2" } });
    let failure;
    child.once("error", error => { failure = error; });
    child.once("exit", () => { if (this.child === child) this.child = null; });
    try {
      while (this.child === child && !failure) {
        signal.throwIfAborted();
        try {
          const response = await fetch(this.url + "/health", { signal: AbortSignal.any([signal, AbortSignal.timeout(300)]) });
          await response.body?.cancel();
          if (response.ok) return;
        } catch (error) { if (signal.aborted) throw error; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw failure ?? new Error("Component model exited during startup");
    } catch (error) { await this.stop(); throw error; }
  }
  async encode(text, { signal = AbortSignal.timeout(5000) } = {}) {
    clearTimeout(this.timer);
    const cancel = () => { void this.stop(); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await this.start(signal); signal.throwIfAborted();
      const post = async (endpoint, body) => {
        const response = await fetch(this.url + endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + this.key }, body: JSON.stringify(body), signal, redirect: "error" });
        if (!response.ok) { await response.body?.cancel(); throw new Error("Component embedding request failed: " + response.status); }
        return response.json();
      };
      const { tokens } = await post("/tokenize", { content: text, add_special: true });
      const output = await post("/v1/embeddings", { input: [tokens.slice(0, 512)], encoding_format: "float" });
      return normalize(output.data?.[0]?.embedding);
    } finally {
      signal.removeEventListener("abort", cancel);
      this.timer = setTimeout(() => { void this.stop(); }, this.idleMs); this.timer.unref?.();
    }
  }
  async stop() {
    clearTimeout(this.timer);
    if (this.stopping) return this.stopping;
    const child = this.child; this.child = null;
    if (!child || child.exitCode !== null) return;
    this.stopping = new Promise(resolve => {
      const timer = setTimeout(() => { child.kill("SIGKILL"); }, 1000); timer.unref();
      child.once("close", () => { clearTimeout(timer); resolve(); }); child.kill();
    });
    try { await this.stopping; } finally { this.stopping = null; }
  }
  async close() { this.closed = true; await this.stop(); }
}
module.exports = { ComponentEmbedding, MODEL, fileHash, normalize };
