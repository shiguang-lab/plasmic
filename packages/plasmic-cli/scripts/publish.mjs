import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { buildCli } from "../../../scripts/build-plasmic-resources.mjs";
import { CLI_VERSION, MAX_BYTES, compareVersions } from "../src/protocol.mjs";
import { inspectCliArtifact } from "../../../scripts/plasmic-cli-artifact.mjs";
import { isNewReleaseSeries } from "../../../scripts/release-version.mjs";

export function releaseVersion(tag) {
  compareVersions(tag, tag);
  return tag;
}
export async function publishCli({ directory, tag, execute = false, registry = "https://registry.npmjs.org/", fetchRelease = fetch, runNpm, waitForPropagation = () => delay(5000) } = {}) {
  const version = releaseVersion(tag);
  const artifact = path.join(directory, "plasmic-cli.tgz");
  const bytes = await readFile(artifact);
  if ((await inspectCliArtifact(bytes)).version !== version) throw new Error("CLI artifact version does not match tag");
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
  const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  if (metadata.publishConfig?.access !== "public" || metadata.private) throw new Error("CLI must declare public npm publishing");
  const { url, published } = await inspectRegistry(registry, fetchRelease, metadata.name);
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
async function inspectRegistry(registry, fetchRelease, name = "@plasmickit/cli") {
  const url = new URL(registry);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) throw new Error("npm registry must use HTTPS");
  url.pathname = url.pathname.replace(/\/?$/, "/") + encodeURIComponent(name);
  const response = await fetchRelease(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok && response.status !== 404) throw new Error(`Cannot inspect npm release: HTTP ${response.status}`);
  return { url, published: response.ok ? await response.json() : null };
}

export async function prepareRelease({ tag, output, registry = "https://registry.npmjs.org/", fetchRelease = fetch } = {}) {
  releaseVersion(tag);
  const local = await buildCli(CLI_VERSION);
  const localPackage = await inspectCliArtifact(local);
  const { published } = await inspectRegistry(registry, fetchRelease);
  const latest = published?.["dist-tags"]?.latest;
  const previous = await publishedCli({ published, fetchRelease });
  if (previous && !isNewReleaseSeries(tag, previous.cliVersion) && (await inspectCliArtifact(previous.cliArtifact)).contentHash === localPackage.contentHash) {
    return { skipped: true, version: previous.cliVersion, reason: "Package contents are unchanged" };
  }
  if (latest && compareVersions(tag, latest) <= 0) throw new Error(`Changed CLI requires a version newer than npm latest ${latest}`);
  const directory = path.resolve(output || "dist/plasmic-cli");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "plasmic-cli.tgz"), await buildCli(tag));
  return { directory, version: tag, skipped: false };
}

export async function publishedCli({ published, registry = "https://registry.npmjs.org/", fetchRelease = fetch } = {}) {
  if (published === undefined) ({ published } = await inspectRegistry(registry, fetchRelease));
  const latest = published?.["dist-tags"]?.latest;
  if (!latest) return null;
  compareVersions(latest, latest);
  const dist = published.versions?.[latest]?.dist;
  if (!dist?.tarball || !dist.integrity) throw new Error("npm latest is missing its verified CLI artifact");
  const url = new URL(dist.tarball);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) throw new Error("CLI artifact URL must use HTTPS");
  const response = await fetchRelease(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Cannot download published CLI: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error("CLI artifact exceeds limit");
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
  if (integrity !== dist.integrity) throw new Error("Published CLI integrity mismatch");
  if ((await inspectCliArtifact(bytes)).version !== latest) throw new Error("npm latest does not match CLI artifact version");
  return { cliVersion: latest, cliArtifact: bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { tag: { type: "string" }, output: { type: "string" }, execute: { type: "boolean" } } });
  const tag = releaseVersion((values.tag || process.env.GITHUB_REF_NAME || "").replace(/^cli-v/, ""));
  if (process.env.GITHUB_REF_NAME && `cli-v${tag}` !== process.env.GITHUB_REF_NAME) throw new Error("Requested release does not match the GitHub tag");
  const built = await prepareRelease({ output: values.output, tag });
  console.log(JSON.stringify(built.skipped ? built : await publishCli({ directory: built.directory, tag, execute: Boolean(values.execute) }), null, 2));
}
