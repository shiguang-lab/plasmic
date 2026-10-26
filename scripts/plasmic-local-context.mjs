import { readdir, access, mkdir, copyFile, mkdtemp, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { hashFiles } from "./build-identity.mjs";
import { verifyRuntime } from "../packages/plasmic-cli/src/runtime.mjs";
import { MODE_REFERENCES } from "../packages/plasmic-cli/src/protocol.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolveLocalContext(mode, sourceRoot = path.join(repo, "ai/plasmic"), cacheRoot = path.join(homedir(), "Library/Caches/Plasmic/skill-resources")) {
  if (!Object.hasOwn(MODE_REFERENCES, mode)) throw new Error("--mode must be inspect, prototype or codegen");
  const runtime = await verifyRuntime();
  sourceRoot = path.resolve(sourceRoot);
  const files = [];
  for (const directory of ["references", "scripts"]) {
    for (const entry of await readdir(path.join(sourceRoot, directory), { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && !entry.name.startsWith("test_") && /\.(md|py|json)$/.test(entry.name)) {
        files.push(path.relative(sourceRoot, path.join(entry.parentPath, entry.name)));
      }
    }
  }
  // Regular files support ordinary recursive search. Content-addressed snapshots
  // keep an active session stable while the next resolution picks up local edits.
  const resourceHash = await hashFiles(sourceRoot, files);
  const cache = path.join(cacheRoot, createHash("sha256").update(sourceRoot).digest("hex").slice(0, 16));
  const resourceRoot = path.join(cache, resourceHash);
  await mkdir(cache, { recursive: true });
  const exists = await access(resourceRoot).then(() => true, error => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  if (!exists) {
    const staging = await mkdtemp(path.join(cache, ".prepare-"));
    try {
      for (const name of files) {
        const target = path.join(staging, name);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(sourceRoot, name), target);
      }
      if (await hashFiles(staging, files) !== resourceHash) throw new Error("Local resources changed during resolution; resolve again before starting the task");
      await rename(staging, resourceRoot).catch(error => {
        if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error;
      });
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
  if (await hashFiles(resourceRoot, files) !== resourceHash) throw new Error("Local resource snapshot failed integrity verification");
  const mustRead = ["references/guide.md", "references/desktop-mcp.md", `references/workflows/${mode}.md`, ...MODE_REFERENCES[mode]]
    .map((name) => path.join(resourceRoot, name));
  await Promise.all(mustRead.map((filename) => access(filename)));
  return { ok: true, source: "local", version: "local", releaseId: `local-${resourceHash}`, resourceHash,
    resourceRoot, referencePath: mustRead[0], mode, mustRead, runtime };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { mode: { type: "string" } } });
  console.log(JSON.stringify(await resolveLocalContext(values.mode), null, 2));
}
