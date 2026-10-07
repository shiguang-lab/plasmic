import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { buildResources } from "../../../scripts/build-plasmic-resources.mjs";
import { compareVersions, validateManifest, verifyArtifact } from "../src/protocol.mjs";

export function releaseVersion(tag) {
  compareVersions(tag, tag);
  return tag;
}
export async function publishCli({ directory, tag, execute = false, registry = "https://registry.npmjs.org/", fetchRelease = fetch, runNpm, waitForPropagation = () => delay(5000) } = {}) {
  const version = releaseVersion(tag);
  const manifest = validateManifest(JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")));
  if (manifest.version !== version) throw new Error(`Tag ${tag} does not match artifact version ${manifest.version}`);
  const artifact = path.join(directory, manifest.artifacts.cli.file);
  const bytes = await readFile(artifact);
  verifyArtifact(bytes, manifest.artifacts.cli);
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
  const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  if (metadata.publishConfig?.access !== "public" || metadata.private) throw new Error("CLI must declare public npm publishing");
  const url = new URL(registry);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) throw new Error("npm registry must use HTTPS");
  url.pathname = url.pathname.replace(/\/?$/, "/") + encodeURIComponent(metadata.name);
  const response = await fetchRelease(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  let published = null;
  if (response.ok) published = await response.json();
  else if (response.status !== 404) throw new Error(`Cannot inspect npm release: HTTP ${response.status}`);
  const existing = published?.versions?.[version];
  const latest = published?.["dist-tags"]?.latest;
  if (latest && compareVersions(latest, version) > 0) throw new Error(`Refusing release ${version}; npm latest is ${latest}`);
  if (existing) {
    if (existing.dist?.integrity !== integrity) throw new Error(`npm version ${version} already exists with different artifact bytes`);
    if (latest !== version) throw new Error(`npm version ${version} exists but latest is ${latest}; inspect the registry before retrying`);
    return { name: metadata.name, version, skipped: true, reason: "Already published with identical integrity" };
  }
  const args = ["publish", artifact, "--registry", registry, "--tag", "latest", "--access", "public"];
  if (!execute) args.push("--dry-run");
  const npm = runNpm || ((args) => execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { encoding: "utf8" }));
  const output = npm(args);
  if (execute) {
    let verified = false;
    for (let attempt = 0; attempt < 36; attempt++) {
      const live = await fetchRelease(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (!live.ok && live.status !== 404 && live.status < 500) throw new Error(`Cannot verify published npm release: HTTP ${live.status}`);
      if (live.ok) {
        const release = await live.json();
        const actual = release.versions?.[version]?.dist?.integrity;
        if (actual && actual !== integrity) throw new Error("Published npm integrity mismatch");
        if (actual === integrity && release["dist-tags"]?.latest === version) { verified = true; break; }
        if (release["dist-tags"]?.latest && compareVersions(release["dist-tags"].latest, version) > 0) throw new Error("Published npm latest version mismatch");
      }
      if (attempt < 35) await waitForPropagation();
    }
    if (!verified) throw new Error("Published npm integrity or latest version mismatch after waiting for registry propagation; inspect npm before retrying");
  }
  return { name: metadata.name, version, skipped: false, mode: execute ? "execute" : "dry-run", output };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { tag: { type: "string" }, output: { type: "string" }, execute: { type: "boolean" } } });
  const tag = releaseVersion(values.tag || process.env.GITHUB_REF_NAME);
  if (process.env.GITHUB_REF_NAME && tag !== process.env.GITHUB_REF_NAME) throw new Error("Requested release does not match the GitHub tag");
  const built = await buildResources(values.output, tag);
  console.log(JSON.stringify(await publishCli({ directory: built.directory, tag, execute: Boolean(values.execute) }), null, 2));
}
