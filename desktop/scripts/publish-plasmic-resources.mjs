import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildResources } from "../../scripts/build-plasmic-resources.mjs";
import { artifactUrl, compareVersions, feedUrl, validateManifest, verifyArtifact } from "../../packages/plasmic-cli/src/protocol.mjs";
import { nasConfig } from "./nas-config.mjs";

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await nasConfig();
const { values } = parseArgs({ options: { from: { type: "string" }, version: { type: "string" } } });
const version = values.version || process.env.GITHUB_REF_NAME;
compareVersions(version, version);
let release;
if (values.from) {
  const output = path.resolve(values.from);
  const manifest = validateManifest(JSON.parse(await readFile(path.join(output, "latest.json"), "utf8")));
  if (manifest.version !== version) throw new Error("NAS artifact version does not match release tag");
  release = { output, manifest, directory: path.join(output, "releases", manifest.releaseId) };
} else release = await buildResources(undefined, version);
for (const artifact of Object.values(release.manifest.artifacts)) verifyArtifact(await readFile(path.join(release.directory, artifact.file)), artifact);
const staging = `${config.nasDeployDir}/desktop-updates/.plasmic-upload-${randomUUID()}`;
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
execFileSync("ssh", [...config.sshArgs, `mkdir -p ${quote(staging)}`], { stdio: "inherit" });
try {
  const tar = spawn("tar", ["-cf", "-", "-C", release.output, `releases/${release.manifest.releaseId}`], {
    env: { ...process.env, COPYFILE_DISABLE: "1" }, stdio: ["ignore", "pipe", "inherit"],
  });
  const ssh = spawn("ssh", [...config.sshArgs, `tar -xf - -C ${quote(staging)}`], { stdio: ["pipe", "inherit", "inherit"] });
  tar.stdout.pipe(ssh.stdin);
  await Promise.all([tar, ssh].map((child) => new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Resource upload exited ${code}`)));
  })));
  const promote = await readFile(path.join(desktop, "scripts/promote-plasmic-resources.cjs"), "utf8");
  execFileSync("ssh", [...config.sshArgs,
    `cd ${quote(config.nasDeployDir)} && docker volume inspect plasmic-desktop-updates >/dev/null && docker compose run --rm --no-deps -T --user 0 --entrypoint node -v plasmic-desktop-updates:/updates -v ${quote(staging + ":/incoming:ro")} server -e ${quote(promote)} ${quote(JSON.stringify(release.manifest))}`,
  ], { stdio: "inherit" });
} finally {
  execFileSync("ssh", [...config.sshArgs, `rm -rf ${quote(staging)}`], { stdio: "inherit" });
}
const feed = feedUrl(`${config.updateUrl}/plasmic`);
const live = await fetch(new URL("latest.json", feed), { cache: "no-store", signal: AbortSignal.timeout(30000) });
if (!live.ok || (await live.json()).releaseId !== release.manifest.releaseId || !live.headers.get("cache-control")?.includes("no-store")) {
  throw new Error("NAS resource manifest is unreachable or cacheable; run setup:nas-updates");
}
for (const kind of ["resources", "cli"]) {
  const response = await fetch(artifactUrl(feed, release.manifest, kind), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Published ${kind} artifact is unreachable`);
  verifyArtifact(Buffer.from(await response.arrayBuffer()), release.manifest.artifacts[kind]);
}
console.log(`Published Plasmic resources ${release.manifest.releaseId} to ${feed}`);
