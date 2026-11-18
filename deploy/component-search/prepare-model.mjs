import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import embedding from "../../platform/wab/src/wab/server/component-reuse/component-embedding.cjs";
import { prepareComponentReuseIndex } from "./prepare-index.mjs";

const directory = process.argv[2];
const { MODEL, fileHash } = embedding;
const modelUrl = `https://huggingface.co/${MODEL.repo}/resolve/${MODEL.revision}/${MODEL.file}`;
const files = [];
for (const name of ["llama-server", MODEL.file, "LICENSE.llama.cpp"]) {
  files.push({ name, sha256: await fileHash(path.join(directory, name)) });
}
if (files.find(file => file.name === MODEL.file).sha256 !== MODEL.sha256) throw new Error("Model checksum mismatch");
await writeFile(path.join(directory, "runtime.json"), JSON.stringify({
  platform: process.platform, arch: process.arch, model: MODEL,
  commit: (await readFile(path.join(directory, "llama-commit"), "utf8")).trim(), files,
}));
await writeFile(path.join(directory, "NOTICE.txt"), "EmbeddingGemma 2, quantized by Unsloth. Model terms: https://ai.google.dev/gemma/terms\n" + modelUrl + "\nllama.cpp uses the included MIT license.\n");
await prepareComponentReuseIndex(directory);
