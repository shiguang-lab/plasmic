import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

// The runtime is a flat directory, independent of the CMake build tree.
export async function relocateComponentReuseRuntime(directory, platform) {
  if (platform !== "darwin") return;
  const names = await readdir(directory);
  const bundled = new Set(names);
  for (const name of names.filter(name => name === "llama-server" || name.endsWith(".dylib"))) {
    const file = path.join(directory, name);
    const commands = execFileSync("otool", ["-l", file], { encoding: "utf8" });
    const rpaths = [...commands.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path (.*?) \(offset/g)].map(match => match[1]);
    const changes = rpaths.filter(value => value !== "@loader_path").flatMap(value => ["-delete_rpath", value]);
    if (!rpaths.includes("@loader_path")) changes.push("-add_rpath", "@loader_path");
    const dependencies = execFileSync("otool", ["-L", file], { encoding: "utf8" });
    for (const line of dependencies.split("\n").slice(1)) {
      const dependency = line.trim().split(" (compatibility")[0];
      if (path.isAbsolute(dependency) && bundled.has(path.basename(dependency))) changes.push("-change", dependency, "@rpath/" + path.basename(dependency));
    }
    if (changes.length) {
      execFileSync("install_name_tool", [...changes, file]);
      // Editing load commands invalidates the build signature. Electron signs
      // the final bundle later; an ad-hoc signature enables preparation probes.
      execFileSync("codesign", ["--force", "--sign", "-", file], { stdio: "pipe" });
    }
  }
}

export async function verifyComponentReuseRuntime(directory) {
  const { ComponentEmbedding } = require("../src/component-embedding.cjs");
  const embedding = new ComponentEmbedding(directory);
  try {
    await embedding.encode("task: search result | query: Display structured records with pagination", { signal: AbortSignal.timeout(15000) });
  } finally { await embedding.close(); }
}
