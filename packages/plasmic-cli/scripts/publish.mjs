import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { buildCli } from "../../../scripts/build-plasmic-resources.mjs";
import { CLI_VERSION, artifactUrl, compareVersions, feedUrl, validateReleaseEnvelope, verifyArtifact } from "../src/protocol.mjs";
import { download } from "../src/references.mjs";
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
    const verificationAttempts = 120;
    for (let attempt = 0; attempt < verificationAttempts; attempt++) {
      const live = await fetchRelease(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (!live.ok && live.status !== 404 && live.status < 500) throw new Error(`Cannot verify published npm release: HTTP ${live.status}`);
      if (live.ok) {
        const release = await live.json();
        const actual = release.versions?.[version]?.dist?.integrity;
        if (actual && actual !== integrity) throw new Error("Published npm integrity mismatch");
        if (actual === integrity && release["dist-tags"]?.latest === version) { verified = true; break; }
        if (release["dist-tags"]?.latest && compareVersions(release["dist-tags"].latest, version) > 0) throw new Error("Published npm latest version mismatch");
      }
      if (attempt < verificationAttempts - 1) await waitForPropagation();
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

export async function prepareRelease({ tag, output, force = false, feed, fetchRelease = fetch } = {}) {
  releaseVersion(tag);
  const local = await buildCli(tag);
  const localPackage = await inspectCliArtifact(local);
  const previous = await publishedCli({ feed, fetchRelease });
  const latest = previous.cliVersion;
  const unchanged = (await inspectCliArtifact(previous.cliArtifact)).contentHash === localPackage.contentHash;
  const directory = path.resolve(output || "dist/plasmic-cli");
  // A retry after Plasmic promotion must mirror the exact public bytes.
  if (latest === tag && unchanged) {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "plasmic-cli.tgz"), previous.cliArtifact);
    return { directory, version: tag, skipped: false };
  }
  if (compareVersions(tag, latest) <= 0) throw new Error(`Changed CLI requires a version newer than the Plasmic release ${latest}`);
  if (!force && unchanged && tag !== CLI_VERSION && !isNewReleaseSeries(tag, previous.cliVersion)) {
    return { skipped: true, version: previous.cliVersion, reason: "Package contents are unchanged" };
  }
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "plasmic-cli.tgz"), local);
  return { directory, version: tag, skipped: false };
}

export async function publishedCli({ feed, fetchRelease = fetch } = {}) {
  const base = feedUrl(feed);
  const manifest = validateReleaseEnvelope(JSON.parse(
    (await download(new URL("latest.json", base), undefined, fetchRelease)).toString("utf8"),
  ));
  const cliArtifact = await download(artifactUrl(base, manifest, "cli"), undefined, fetchRelease);
  verifyArtifact(cliArtifact, manifest.artifacts.cli);
  if ((await inspectCliArtifact(cliArtifact)).version !== manifest.cliVersion) {
    throw new Error("Plasmic CLI archive version does not match its manifest");
  }
  return { cliVersion: manifest.cliVersion, cliArtifact };
}

export async function mirrorCli({ directory, tag, feed, fetchPlasmic, ...npmOptions }) {
  const live = await publishedCli({ feed, fetchRelease: fetchPlasmic });
  const built = await readFile(path.join(directory, "plasmic-cli.tgz"));
  if (live.cliVersion !== tag || !live.cliArtifact.equals(built)) {
    throw new Error("Plasmic has not activated the expected CLI artifact");
  }
  return publishCli({ directory, tag, ...npmOptions });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { tag: { type: "string" }, output: { type: "string" }, mirror: { type: "boolean" }, execute: { type: "boolean" }, force: { type: "boolean" } } });
  const tag = releaseVersion(values.tag || process.env.GITHUB_REF_NAME || "");
  if (process.env.GITHUB_REF_TYPE === "tag" && tag !== process.env.GITHUB_REF_NAME) throw new Error("Requested release does not match the GitHub tag");
  if (values.mirror) {
    console.log(JSON.stringify(await mirrorCli({
      directory: values.output || "dist/plasmic-cli", tag, execute: Boolean(values.execute),
    }), null, 2));
  } else {
    if (values.execute) throw new Error("--execute requires --mirror");
    const built = await prepareRelease({ output: values.output, tag, force: values.force || process.env.RELEASE_FORCE_ALL === "true" });
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `publish=${!built.skipped}\nversion=${built.version}\n`);
    console.log(JSON.stringify(built, null, 2));
  }
}
