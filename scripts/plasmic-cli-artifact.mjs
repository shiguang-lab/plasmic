import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_BYTES, compareVersions, sha256 } from "../packages/plasmic-cli/src/protocol.mjs";

/** Compare shipped files, excluding only the npm package version. Never extract to disk. */
export async function inspectCliArtifact(bytes) {
  if (bytes.length > MAX_BYTES) throw new Error("CLI artifact exceeds limit");
  const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-cli-inspect-"));
  try {
    // GNU tar interprets a Windows drive colon in an absolute archive as a host.
    const archive = "cli.tgz";
    await writeFile(path.join(temporary, archive), bytes);
    const readTar = (args) => execFileSync("tar", args, { cwd: temporary, maxBuffer: MAX_BYTES });
    const names = readTar(["-tzf", archive]).toString("utf8").trim().split("\n").filter((name) => !name.endsWith("/")).sort();
    if (new Set(names).size !== names.length || !names.includes("package/package.json")) throw new Error("Invalid CLI package entries");
    let metadata;
    const files = names.map((name) => {
      let content = readTar(["-xOzf", archive, "--", name]);
      if (name === "package/package.json") {
        metadata = JSON.parse(content.toString("utf8"));
        compareVersions(metadata.version, metadata.version);
        if (metadata.name !== "@plasmickit/cli") throw new Error("Unexpected CLI package name");
        const { version: _version, ...contract } = metadata;
        content = Buffer.from(JSON.stringify(contract, (_key, item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item));
      }
      return [name, sha256(content)];
    });
    return { version: metadata.version, contentHash: sha256(JSON.stringify(files)) };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
