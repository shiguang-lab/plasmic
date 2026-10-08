import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import semver from "semver";
import { nasConfig } from "./nas-config.mjs";
import { parseManifest } from "../src/mac-updater.cjs";
const config = await nasConfig();
const metadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const tag = process.argv[2] || `desktop-v${metadata.version}`;
const version = tag.replace(/^desktop-v/, "");
if (
  tag !== `desktop-v${version}` ||
  !semver.valid(version) ||
  semver.prerelease(version)
)
  throw new Error("Use desktop-vX.Y.Z");
const feed = `${config.updateUrl}/latest.json`;
const current = await fetch(feed, {
  cache: "no-store",
  signal: AbortSignal.timeout(30000),
});
if (current.ok && !semver.gt(version, (await current.json()).version))
  throw new Error("Release must be newer than the deployed release");
if (!current.ok && current.status !== 404)
  throw new Error(`Cannot read live release JSON: ${current.status}`);
const image = `ghcr.io/shiguang-lab/plasmic-desktop-releases:${tag}`;
execFileSync("ssh", [...config.sshArgs, `docker pull ${image}`], {
  stdio: "inherit",
});
const candidate = JSON.parse(
  execFileSync(
    "ssh",
    [
      ...config.sshArgs,
      `docker run --rm --entrypoint cat ${image} /usr/share/nginx/html/desktop-updates/latest.json`,
    ],
    { encoding: "utf8" },
  ),
);
if (candidate.version !== version || candidate.installers?.length !== 4 ||
    !["mac-arm64", "mac-x64", "windows", "linux"].every((id) => candidate.installers.some((file) => file.id === id)))
  throw new Error("Release image metadata does not match requested version");
execFileSync(
  process.execPath,
  [new URL("./setup-nas-updates.mjs", import.meta.url).pathname, tag],
  { stdio: "inherit" },
);
const live = await fetch(feed, {
  cache: "no-store",
  signal: AbortSignal.timeout(30000),
});
if (
  !live.ok ||
  (await live.json()).version !== version ||
  !live.headers.get("cache-control")?.includes("no-store") ||
  live.headers.get("access-control-allow-origin") !== "*"
)
  throw new Error("Public release JSON is unavailable or cacheable");
for (const installer of candidate.installers) {
  const url = new URL(installer.url);
  if (
    url.origin !== new URL(config.updateUrl).origin ||
    !url.pathname.startsWith(new URL(config.updateUrl).pathname + "/")
  )
    throw new Error("Installer must use the configured public domain");
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(30000),
  });
  if (
    !response.ok ||
    Number(response.headers.get("content-length")) !== installer.size
  )
    throw new Error("Public installer is unavailable or has wrong size");
}
for (const arch of ["arm64", "x64"]) {
  const url = `${config.updateUrl}/darwin/${arch}/`;
  const response = await fetch(url + "latest-mac.yml", { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get("cache-control")?.includes("no-store")) throw new Error(`macOS ${arch} update feed unavailable or cacheable`);
  const update = parseManifest(await response.text(), "0.0.0", url, arch);
  if (update.version !== version) throw new Error(`macOS ${arch} update version mismatch`);
  const archive = await fetch(update.file.url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
  if (!archive.ok || Number(archive.headers.get("content-length")) !== update.file.size) throw new Error(`macOS ${arch} update archive unavailable or incomplete`);
}
console.log(`Deployed ${image}; JSON and all installers verified at ${feed}`);
