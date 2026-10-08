import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import semver from "semver";

export const manifestNames = { darwin: "latest-mac.yml", win32: "latest.yml", linux: "latest-linux.yml" };
export async function digest(file) {
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("base64");
}
export async function validateRelease(directory, platform, version, arch) {
  const name = platform === "linux" && arch === "arm64" ? "latest-linux-arm64.yml" : manifestNames[platform];
  if (!name || !semver.valid(version) || semver.prerelease(version)) throw new Error("Stable releases require a valid stable version and platform");
  const manifest = YAML.parse(await readFile(path.join(directory, name), "utf8"));
  if (manifest.version !== version || !manifest.files?.length) throw new Error("Release manifest version or files do not match");
  const files = [];
  for (const file of manifest.files) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file.url) || !file.url.includes(`-${version}-`)) throw new Error("Artifacts require immutable versioned filenames");
    if (platform === "darwin" && arch && !file.url.startsWith(`Plasmic-${version}-mac-${arch}.`)) throw new Error("Artifact architecture does not match release directory");
    const local = path.join(directory, file.url);
    if ((await stat(local)).size !== file.size || await digest(local) !== file.sha512) throw new Error(`Artifact checksum or size mismatch: ${file.url}`);
    files.push(file.url);
  }
  const entries = await readdir(directory);
  for (const file of [...files]) {
    if (entries.includes(file + ".blockmap")) files.push(file + ".blockmap");
  }
  return { manifest, files, name };
}
