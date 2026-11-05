import { createRequire } from "node:module";
import { readFile, writeFile, mkdtemp, cp, rm, readdir, rename, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { ComponentReuse, hash } = require("../src/component-reuse.cjs");
const { ComponentEmbedding, MODEL, fileHash } = require("../src/component-embedding.cjs");

// Public build inputs only. Private/project components are never written to seeds.
export async function prepareComponentReuseIndex(directory) {
  const documents = JSON.parse(await readFile(new URL("../src/component-reuse-public-documents.json", import.meta.url), "utf8"));
  const inputSha256 = hash(JSON.stringify([MODEL.signature, documents]));
  const manifestPath = path.join(directory, "runtime.json"); const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.seedInputSha256 === inputSha256 && manifest.seedSignature === MODEL.signature) return;
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) throw new Error("Prepare the updated public vector seeds on the native runtime's target host before packaging");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "component-public-seeds-"));
  const embedding = new ComponentEmbedding(directory); const account = hash("public-library-build-inputs");
  const service = new ComponentReuse({ directory: temporary, embedding, backgroundDelayMs: 0, idlePauseMs: 0 });
  try {
    await service.sync({ account, project: "public-library-build" }, documents);
    const deadline = Date.now() + 600000;
    while (service.coverage().indexed < service.coverage().total) {
      if (service.failure) throw service.failure;
      if (Date.now() > deadline) throw new Error("Public vector seed preparation timed out");
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const keys = [...new Set(service.state.documents.flatMap(doc => doc.pieces.map(piece => piece.key)))];
    for (const key of keys) {
      const target = path.join(directory, "vector-" + key + ".bin");
      try { await cp(path.join(temporary, account, key + ".bin"), target); }
      catch (error) { if (error.code !== "ENOENT") throw error; await readFile(target); }
      await chmod(target, 0o644);
    }
    const names = new Set(keys.map(key => "vector-" + key + ".bin"));
    for (const name of await readdir(directory)) if (/^vector-[a-f0-9]{64}\.bin$/.test(name) && !names.has(name)) await rm(path.join(directory, name));
    manifest.files = manifest.files.filter(entry => !entry.name.startsWith("vector-"));
    for (const name of [...names].sort()) manifest.files.push({ name, sha256: await fileHash(path.join(directory, name)) });
    Object.assign(manifest, { seedInputSha256: inputSha256, seedSignature: MODEL.signature, seedComponents: documents.length, seedVectors: keys.length });
    const output = manifestPath + ".tmp";
    await writeFile(output, JSON.stringify(manifest, null, 2) + "\n"); await rename(output, manifestPath);
    console.log(JSON.stringify({ publicSeedComponents: documents.length, publicSeedVectors: keys.length, computedVectors: service.stats.documentEmbeddings }));
  } finally { await service.close(); await rm(temporary, { recursive: true, force: true }); }
}
