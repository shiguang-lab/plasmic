import { build } from "esbuild";
import { inject } from "postject";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = JSON.parse(await readFile(path.join(root, "scripts/mcp-node.json"), "utf8"));
const cache = path.join(root, "mcp-bin", "node-" + runtime.version);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

async function nodeBinary(platform, arch) {
  const target = `${platform}-${arch}`, expected = runtime.sha256[target];
  if (!expected) throw new Error("Unsupported MCP runtime target: " + target);
  const filename = platform === "win32" ? `win-${arch}/node.exe` : `node-v${runtime.version}-${target}.tar.gz`;
  const archive = path.join(cache, filename.replaceAll("/", "-"));
  await mkdir(cache, { recursive: true });
  let bytes = await readFile(archive).catch(error => { if (error.code !== "ENOENT") throw error; });
  if (!bytes) {
    const response = await fetch(`https://nodejs.org/dist/v${runtime.version}/${filename}`);
    if (!response.ok) throw new Error(`Node download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (sha256(bytes) !== expected) throw new Error("Node runtime checksum mismatch: " + filename);
    await writeFile(archive, bytes);
  }
  if (sha256(bytes) !== expected) throw new Error("Cached Node runtime checksum mismatch: " + filename);
  if (platform === "win32") return { binary: archive };
  execFileSync("tar", ["-xzf", archive, "-C", cache]);
  const directory = path.join(cache, `node-v${runtime.version}-${target}`);
  return { binary: path.join(directory, "bin/node"), license: path.join(directory, "LICENSE") };
}

export async function buildMcp(platform = process.platform, arch = process.arch) {
  const host = await nodeBinary(process.platform, process.arch);
  const target = platform === process.platform && arch === process.arch ? host : await nodeBinary(platform, arch);
  const directory = path.join(root, "mcp-bin", `${platform}-${arch}`);
  await mkdir(directory, { recursive: true });
  const bundle = path.join(directory, "bundle.cjs"), blob = path.join(directory, "sea.blob"), config = path.join(directory, "sea.json");
  await build({ entryPoints: [path.join(root, "src/mcp-entry.cjs")], outfile: bundle, bundle: true,
    platform: "node", target: "node24", format: "cjs", minify: true, legalComments: "eof" });
  await writeFile(config, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true,
    useSnapshot: false, useCodeCache: false, execArgvExtension: "none" }));
  // Blob and target executable must use exactly the same Node version.
  const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  execFileSync(host.binary, ["--experimental-sea-config", config], { env, stdio: "inherit" });
  const executable = path.join(directory, platform === "win32" ? "plasmic-mcp.exe" : "plasmic-mcp");
  await copyFile(target.binary, executable);await chmod(executable, 0o755);
  if (platform === "darwin") {
    if (process.platform !== "darwin") throw new Error("macOS MCP binaries must be signed on macOS");
    execFileSync("/usr/bin/codesign", ["--remove-signature", executable]);
  }
  await inject(executable, "NODE_SEA_BLOB", await readFile(blob), {
    sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2", machoSegmentName: "NODE_SEA",
  });
  if (platform === "darwin") execFileSync("/usr/bin/codesign", ["--sign", "-", executable]);
  const license = target.license || host.license;
  if (license) await copyFile(license, path.join(directory, "LICENSE.node"));
  else {
    const response = await fetch(`https://raw.githubusercontent.com/nodejs/node/v${runtime.version}/LICENSE`);
    if (!response.ok) throw new Error("Node license download failed");
    await writeFile(path.join(directory, "LICENSE.node"), await response.text());
  }
  if (platform === process.platform && arch === process.arch) {
    const actual = JSON.parse(execFileSync(executable, ["--version"], { env, encoding: "utf8" }));
    if (actual.node !== runtime.version || actual.platform !== platform || actual.arch !== arch) throw new Error("MCP runtime verification failed");
  }
  return directory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await buildMcp(...process.argv.slice(2)));
}
