import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, cp, readdir, rm, rename, chmod } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareComponentReuseIndex } from "./prepare-component-reuse-index.mjs";
import { relocateComponentReuseRuntime, verifyComponentReuseRuntime } from "./component-reuse-runtime.mjs";

const require = createRequire(import.meta.url);
const { MODEL, fileHash } = require("../src/component-embedding.cjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commit = "cd959bae99ff4bed22bef2604f45241c09bbb8c8";

export async function prepareComponentReuse(platform = process.platform, arch = process.arch) {
  const directory = path.join(root, "component-reuse-runtime", platform + "-" + arch);
  let prepared = false;
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, "runtime.json"), "utf8"));
    if (manifest.commit !== commit || manifest.model?.sha256 !== MODEL.sha256 || manifest.platform !== platform || manifest.arch !== arch) throw new Error("Runtime identity mismatch");
    if (platform === "darwin" && (platform !== process.platform || arch !== process.arch) && !manifest.macLoaderRelative) throw new Error("Verify the loader-relative macOS runtime on its target host before cross-packaging");
    for (const entry of manifest.files) if (path.basename(entry.name) !== entry.name || await fileHash(path.join(directory, entry.name)) !== entry.sha256) throw new Error("Runtime integrity mismatch");
    prepared = manifest.files.some(entry => entry.name === MODEL.file) && manifest.files.some(entry => entry.name === (platform === "win32" ? "llama-server.exe" : "llama-server"));
  } catch (error) { if (platform !== process.platform || arch !== process.arch) throw new Error(`Prepare and verify component-reuse-runtime/${platform}-${arch} on its target host before cross-packaging: ${error.message}`); }
  if (prepared) {
    if (platform === process.platform && arch === process.arch) {
      await relocateComponentReuseRuntime(directory, platform);
      const manifest = JSON.parse(await readFile(path.join(directory, "runtime.json"), "utf8"));
      for (const entry of manifest.files) entry.sha256 = await fileHash(path.join(directory, entry.name));
      await writeFile(path.join(directory, "runtime.json"), JSON.stringify(manifest, null, 2) + "\n");
      await verifyComponentReuseRuntime(directory);
      if (platform === "darwin") { manifest.macLoaderRelative = true; await writeFile(path.join(directory, "runtime.json"), JSON.stringify(manifest, null, 2) + "\n"); }
    }
    await prepareComponentReuseIndex(directory); return directory;
  }
  if (platform !== process.platform || arch !== process.arch) throw new Error("Prepare the complete component embedding runtime on its target host before cross-packaging");
  if (!["darwin", "linux", "win32"].includes(platform) || !["arm64", "x64"].includes(arch)) throw new Error("Unsupported component embedding target");
  const work = path.join(root, ".cache/component-reuse", platform + "-" + arch);
  await mkdir(work, { recursive: true });
  const source = path.join(work, "llama.cpp");
  try { await readFile(path.join(source, "LICENSE")); }
  catch { execFileSync("git", ["clone", "--depth", "1", "--branch", "v0.9.0", "https://github.com/ggml-org/llama.cpp.git", source], { stdio: "inherit" }); }
  if (execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== commit) throw new Error("Pinned llama.cpp source mismatch");
  const build = path.join(work, "build");
  const flags = ["-DCMAKE_BUILD_TYPE=Release", "-DGGML_NATIVE=OFF", "-DGGML_METAL=OFF", "-DGGML_ACCELERATE=" + (platform === "darwin" ? "ON" : "OFF"), "-DLLAMA_BUILD_TESTS=OFF", "-DLLAMA_BUILD_EXAMPLES=OFF", "-DLLAMA_BUILD_SERVER=ON", "-DLLAMA_OPENSSL=OFF", "-DLLAMA_CURL=OFF"];
  if (platform === "darwin") flags.push("-DCMAKE_BUILD_WITH_INSTALL_RPATH=ON", "-DCMAKE_INSTALL_RPATH=@loader_path");
  execFileSync("cmake", ["-S", source, "-B", build, ...flags], { stdio: "inherit" });
  execFileSync("cmake", ["--build", build, "--config", "Release", "--target", "llama-server", "-j", "4"], { stdio: "inherit" });
  const model = path.join(work, MODEL.file);
  let valid = false;
  try { valid = await fileHash(model) === MODEL.sha256; } catch {}
  if (!valid) {
    const temporary = model + ".download";
    const response = await fetch(`https://huggingface.co/${MODEL.repo}/resolve/${MODEL.revision}/${MODEL.file}?download=true`, { signal: AbortSignal.timeout(600000) });
    if (!response.ok) throw new Error("Model download failed: " + response.status);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if (await fileHash(temporary) !== MODEL.sha256) { await rm(temporary, { force: true }); throw new Error("Model SHA-256 mismatch"); }
    await rename(temporary, model);
  }
  await mkdir(directory, { recursive: true });
  const filenames = [];
  async function collect(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) { await collect(path.join(folder, entry.name)); continue; }
      if (entry.isSymbolicLink() || !(entry.name === "llama-server" || entry.name === "llama-server.exe" || /\.(?:dylib|dll|so(?:\.\d+)*)$/.test(entry.name))) continue;
      await cp(path.join(folder, entry.name), path.join(directory, entry.name)); filenames.push(entry.name);
    }
  }
  await collect(path.join(build, "bin"));
  // Preserve dylib/so aliases used by the native loader without archiving a source checkout.
  async function aliases(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) { await aliases(path.join(folder, entry.name)); continue; }
      if (entry.isSymbolicLink() && /\.(?:dylib|so(?:\.\d+)*)$/.test(entry.name)) { await cp(path.join(folder, entry.name), path.join(directory, entry.name), { dereference: true }); filenames.push(entry.name); }
    }
  }
  await aliases(path.join(build, "bin"));
  await cp(model, path.join(directory, MODEL.file)); filenames.push(MODEL.file);
  await cp(path.join(source, "LICENSE"), path.join(directory, "LICENSE.llama.cpp")); filenames.push("LICENSE.llama.cpp");
  await writeFile(path.join(directory, "NOTICE.txt"), "EmbeddingGemma 2 text-only, quantized by Unsloth. Model terms: https://ai.google.dev/gemma/terms\nModel artifact: https://huggingface.co/" + MODEL.repo + "/tree/" + MODEL.revision + "\nllama.cpp is distributed under its included MIT license. CPU-only runtime; no remote inference.\n"); filenames.push("NOTICE.txt");
  if (platform !== "win32") await chmod(path.join(directory, "llama-server"), 0o755);
  await relocateComponentReuseRuntime(directory, platform);
  const files = [];
  for (const name of [...new Set(filenames)].sort()) files.push({ name, sha256: await fileHash(path.join(directory, name)) });
  await writeFile(path.join(directory, "runtime.json"), JSON.stringify({ platform, arch, commit, model: MODEL, buildFlags: flags, files }, null, 2) + "\n");
  await verifyComponentReuseRuntime(directory);
  if (platform === "darwin") {
    const manifest = JSON.parse(await readFile(path.join(directory, "runtime.json"), "utf8"));
    manifest.macLoaderRelative = true;
    await writeFile(path.join(directory, "runtime.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
  await prepareComponentReuseIndex(directory);
  return directory;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await prepareComponentReuse(...process.argv.slice(2)));
