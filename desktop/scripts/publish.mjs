import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import semver from "semver";
import { validateRelease } from "./release-artifacts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const config = JSON.parse(await readFile(path.join(root, "desktop.config.json"), "utf8"));
const [platform = process.platform, arch = process.arch] = process.argv.slice(2);
if (!["darwin", "win32", "linux"].includes(platform) || !["arm64", "x64"].includes(arch)) throw new Error("Unsupported platform or architecture");
if (!/^[a-zA-Z0-9@._-]+$/.test(config.nasHost) || !/^\/[a-zA-Z0-9/._-]+$/.test(config.nasDeployDir)) throw new Error("Invalid NAS SSH host or deployment directory");
const directory = path.join(root, `dist/${metadata.version}/${platform}-${arch}`);
const release = await validateRelease(directory, platform, metadata.version, arch);
const feed = `${config.updateUrl}/${platform}/${arch}/`;
const current = await fetch(feed + release.name, { cache: "no-store", signal: AbortSignal.timeout(30000) });
if (current.ok) {
  const version = YAML.parse(await current.text()).version;
  if (!semver.valid(version) || !semver.gt(metadata.version, version)) throw new Error(`Release must be newer than NAS version ${version}`);
} else if (current.status !== 404) throw new Error(`Cannot read NAS release: HTTP ${current.status}`);
const destination = `${config.nasDeployDir}/desktop-updates/${platform}/${arch}`;
const staging = `${destination}/.upload-${randomUUID()}`;
execFileSync("ssh", ["-o", "BatchMode=yes", config.nasHost, `mkdir -p '${staging}'`], { stdio: "inherit" });
try {
  const tar = spawn("tar", ["-cf", "-", "-C", directory, ...release.files, release.name], { env: { ...process.env, COPYFILE_DISABLE: "1" }, stdio: ["ignore", "pipe", "inherit"] });
  const ssh = spawn("ssh", ["-o", "BatchMode=yes", config.nasHost, `tar -xf - -C '${staging}'`], { stdio: ["pipe", "inherit", "inherit"] });
  tar.stdout.pipe(ssh.stdin);
  await Promise.all([tar, ssh].map((child) => new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Upload process exited ${code}`)));
  })));
  // A helper writes the Docker-managed NAS volume; the web container reads it.
  const promote = await readFile(path.join(root, "scripts/promote-release.cjs"), "utf8");
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  const command = `cd ${quote(config.nasDeployDir)} && docker volume inspect plasmic-desktop-updates >/dev/null && docker compose run --rm --no-deps -T --user 0 --entrypoint node -v plasmic-desktop-updates:/updates -v ${quote(staging + ":/incoming:ro")} server -e ${quote(promote)} ${quote(platform + "/" + arch)} ${quote(release.name)} ${quote(JSON.stringify(release.manifest))}`;
  execFileSync("ssh", ["-o", "BatchMode=yes", config.nasHost, command], { stdio: "inherit" });
} finally {
  execFileSync("ssh", ["-o", "BatchMode=yes", config.nasHost, `rm -rf '${staging}'`], { stdio: "inherit" });
}
const live = await fetch(feed + release.name, { cache: "no-store", signal: AbortSignal.timeout(30000) });
if (!live.ok || YAML.parse(await live.text()).version !== metadata.version) throw new Error("Published release is not reachable over public HTTPS");
for (const file of release.files) {
  const response = await fetch(feed + file, { method: "HEAD", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Published artifact is not reachable: ${file}`);
}
console.log(`Published ${metadata.version} to ${feed}`);
