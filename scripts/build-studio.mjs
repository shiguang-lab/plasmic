import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashFiles, sourceIdentity } from "./build-identity.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wab = path.join(repo, "platform/wab");
const identity = await sourceIdentity(repo);
execFileSync(process.execPath, [path.join(repo, "scripts/build-html-hydrate.mjs")], { cwd: repo, stdio: "inherit" });
for (const cwd of [path.join(repo, "platform/sub"), path.join(repo, "platform/live-frame"), wab]) {
  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    { cwd, stdio: "inherit" },
  );
}
if (identity.sourceHash !== (await sourceIdentity(repo)).sourceHash) {
  throw new Error("Sources changed while Studio was building; rebuild Studio.");
}
const output = path.join(wab, "build");
await writeFile(
  path.join(output, "studio-build.json"),
  JSON.stringify(
    {
      ...identity,
      builtAt: new Date().toISOString(),
      artifactHash: await hashFiles(output, ["."], ["studio-build.json"]),
    },
    null,
    2,
  ) + "\n",
);
