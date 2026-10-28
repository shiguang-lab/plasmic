import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { parseArgs } from "node:util";
import { CLI_VERSION, MIN_CLI_VERSION, compareVersions, releaseId, resourcePath, sha256, unpackResources, validateManifest } from "../packages/plasmic-cli/src/protocol.mjs";
import { inspectCliArtifact } from "./plasmic-cli-artifact.mjs";
import { validateReferences } from "./validate-plasmic-references.mjs";
import { validateComponentReferences } from "./validate-plasmic-component-coverage.mjs";

let verifierPassed = false;
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function buildCli(version = CLI_VERSION) {
  compareVersions(version, version);
  const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-resources-"));
  try {
    const source = path.join(repo, "packages/plasmic-cli");
    const packageRoot = path.join(temporary, "package");
    await mkdir(packageRoot);
    for (const name of ["src", "skill"]) await cp(path.join(source, name), path.join(packageRoot, name), { recursive: true });
    const metadata = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
    metadata.version = version;
    delete metadata.scripts;
    await writeFile(path.join(packageRoot, "package.json"), JSON.stringify(metadata, null, 2) + "\n");
    // Windows .cmd wrappers cannot be launched by execFileSync. Run npm's
    // JavaScript entry point directly, preserving argument boundaries.
    const npm = process.platform === "win32" ? process.execPath : "npm";
    const npmArgs = process.platform === "win32"
      ? [process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")]
      : [];
    const packedFile = execFileSync(npm, [...npmArgs, "pack", "--ignore-scripts", "--json=false", "--silent", "--pack-destination", temporary], {
      cwd: packageRoot, encoding: "utf8",
    }).trim();
    return await readFile(path.join(temporary, packedFile));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function buildResources(output = path.join(repo, "dist/plasmic-resources"), version = CLI_VERSION, { cliVersion = CLI_VERSION, cliArtifact } = {}) {
  compareVersions(version, version);
  if (compareVersions(cliVersion, MIN_CLI_VERSION) < 0) throw new Error(`CLI version must be at least ${MIN_CLI_VERSION}`);
  // Repeated artifacts in one process share the same immutable verifier suite.
  // Each artifact still validates its current references, manifest and bytes.
  if (!verifierPassed) {
    execFileSync("python3", ["-m", "unittest", "discover", "-s", "ai/plasmic/scripts", "-p", "test_*.py"], {
      cwd: repo, stdio: "inherit",
    });
    verifierPassed = true;
  }
  const files = [];
  async function visit(relative) {
    const entries = await readdir(path.join(repo, "ai/plasmic", relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile() && !entry.name.startsWith("test_") && /\.(md|py|json)$/.test(name)) {
        resourcePath(name);
        files.push({ path: name, content: await readFile(path.join(repo, "ai/plasmic", name), "utf8") });
      }
    }
  }
  await visit("references");
  await visit("scripts");
  files.sort((a, b) => a.path.localeCompare(b.path));
  const entrypoints = { guide: "references/guide.md", inspect: "references/workflows/inspect.md", prototype: "references/workflows/prototype.md", codegen: "references/workflows/codegen.md" };
  validateReferences(files, entrypoints);
  validateComponentReferences(files);
  const resources = gzipSync(JSON.stringify({ schemaVersion: 1, files }));
  const cli = cliArtifact || await buildCli(cliVersion);
  if ((await inspectCliArtifact(cli)).version !== cliVersion) throw new Error("CLI artifact version does not match cliVersion");
  const manifest = {
    schemaVersion: 1,
    version,
    cliVersion,
    minCliVersion: MIN_CLI_VERSION,
    entrypoints,
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.content), size: Buffer.byteLength(file.content) })),
    artifacts: {
      resources: { file: "resources.json.gz", sha256: sha256(resources), size: resources.length },
      cli: { file: "plasmic-cli.tgz", sha256: sha256(cli), size: cli.length },
    },
  };
  manifest.releaseId = releaseId(manifest);
  validateManifest(manifest);
  unpackResources(resources, manifest);
  const directory = path.join(path.resolve(output), "releases", manifest.releaseId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "resources.json.gz"), resources);
  await writeFile(path.join(directory, "plasmic-cli.tgz"), cli);
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(path.resolve(output), "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { directory, output: path.resolve(output), manifest };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { output: { type: "string" }, version: { type: "string" } } });
  console.log(JSON.stringify(await buildResources(values.output, values.version), null, 2));
}
