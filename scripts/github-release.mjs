import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions, validateManifest, verifyArtifact } from "../packages/plasmic-cli/src/protocol.mjs";

async function checksum(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return "sha256:" + hash.digest("hex");
}

export async function collectRelease(plan, root = ".") {
  compareVersions(plan.tag, plan.tag);
  const artifacts = path.resolve(root, "release-artifacts");
  const assets = [];
  const notes = [`Release ${plan.tag}`, ""];
  const add = (name, file) => assets.push({ name, file });
  if (plan.studio) {
    notes.push("Studio images:", ...["server", "web", "preview"].map((image) => `- ghcr.io/shiguang-lab/plasmic-${image}:${plan.tag}`), "");
  }
  if (plan.desktop) {
    notes.push(await readFile(path.join(root, `desktop/release-notes/${plan.tag}.md`), "utf8"), "");
    const distribution = path.join(artifacts, "desktop-distribution");
    const manifest = JSON.parse(await readFile(path.join(distribution, "latest.json"), "utf8"));
    if (manifest.version !== plan.tag) throw new Error("Desktop distribution version mismatch");
    add("desktop-latest.json", path.join(distribution, "latest.json"));
    for (const [platform, arch, manifestName, assetName] of [
      ["darwin", "arm64", "latest-mac.yml", "latest-mac-arm64.yml"],
      ["darwin", "x64", "latest-mac.yml", "latest-mac-x64.yml"],
      ["win32", "x64", "latest.yml", "latest.yml"],
      ["linux", "x64", "latest-linux.yml", "latest-linux.yml"],
    ]) {
      add(assetName, path.join(distribution, platform, arch, manifestName));
      const directory = path.join(artifacts, `${platform}-${arch}`);
      const files = (await readdir(directory)).filter((name) => name.startsWith(`Plasmic-${plan.tag}-`));
      if (!files.length) throw new Error(`Missing ${platform}-${arch} installers`);
      for (const name of files) add(name, path.join(directory, name));
    }
  }
  if (plan.resources) {
    const directory = path.join(artifacts, `plasmic-resources-${plan.tag}`);
    const manifest = validateManifest(JSON.parse(await readFile(path.join(directory, "latest.json"), "utf8")));
    if (manifest.version !== plan.tag) throw new Error("Resource distribution version mismatch");
    const release = path.join(directory, "releases", manifest.releaseId);
    const immutable = validateManifest(JSON.parse(await readFile(path.join(release, "manifest.json"), "utf8")));
    if (immutable.releaseId !== manifest.releaseId) throw new Error("Resource manifest mismatch");
    add("plasmic-latest.json", path.join(directory, "latest.json"));
    add("plasmic-manifest.json", path.join(release, "manifest.json"));
    for (const kind of ["cli", "resources"]) {
      const artifact = manifest.artifacts[kind];
      const file = path.join(release, artifact.file);
      verifyArtifact(await readFile(file), artifact);
      add(artifact.file, file);
    }
    notes.push(`Workflow resources ${manifest.version}; npm CLI ${manifest.cliVersion}.`, `Resource release ID: ${manifest.releaseId}`, "");
  } else if (plan.cli) {
    add("plasmic-cli.tgz", path.join(artifacts, "plasmic-cli/plasmic-cli.tgz"));
  }
  const names = new Set();
  for (const asset of assets) {
    if (names.has(asset.name)) throw new Error(`Duplicate release asset: ${asset.name}`);
    names.add(asset.name);
    asset.size = (await stat(asset.file)).size;
    asset.digest = await checksum(asset.file);
  }
  return { assets, notes: notes.join("\n") };
}

const gh = (args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

export async function publishGitHubRelease({ plan, repository, root = ".", rebuild = false }, runGh = gh) {
  if (!plan.publish) return { skipped: true };
  const { assets, notes } = await collectRelease(plan, root);
  const endpoint = `repos/${repository}/releases/tags/${plan.tag}`;
  const inspect = async () => JSON.parse(await runGh(["api", endpoint]));
  let release;
  try {
    release = await inspect();
  } catch (error) {
    if (!String(error.stderr).includes("HTTP 404")) throw error;
  }
  const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-github-release-"));
  try {
    const body = path.join(temporary, "notes.md");
    await writeFile(body, notes);
    if (!release) {
      await runGh(["release", "create", plan.tag, "--repo", repository, "--verify-tag", "--draft", "--latest=false", "--title", plan.tag, "--notes-file", body]);
      release = await inspect();
    }
    const pending = [];
    for (const asset of assets) {
      const existing = release.assets.find((entry) => entry.name === asset.name);
      if (existing?.state === "uploaded" && existing.size === asset.size && existing.digest === asset.digest) continue;
      if (existing && !release.draft && !rebuild) throw new Error(`Published asset differs: ${asset.name}; publish a new version`);
      pending.push(asset);
    }
    const files = [];
    for (const asset of pending) {
      // Release assets have a flat namespace; only small manifest files need renaming.
      if (path.basename(asset.file) === asset.name) files.push(asset.file);
      else {
        const renamed = path.join(temporary, asset.name);
        await copyFile(asset.file, renamed);
        files.push(renamed);
      }
    }
    if (files.length) await runGh(["release", "upload", plan.tag, "--repo", repository, "--clobber", ...files]);
    const uploaded = await inspect();
    for (const asset of assets) {
      const actual = uploaded.assets.find((entry) => entry.name === asset.name);
      if (actual?.state !== "uploaded" || actual.size !== asset.size || actual.digest !== asset.digest) throw new Error(`Release upload verification failed: ${asset.name}`);
    }
    if (release.draft || rebuild) await runGh(["release", "edit", plan.tag, "--repo", repository, "--draft=false", "--latest", "--notes-file", body]);
    return { url: uploaded.html_url, assets: assets.map((asset) => asset.name) };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await publishGitHubRelease({
    plan: JSON.parse(process.env.RELEASE_PLAN),
    repository: process.env.GITHUB_REPOSITORY,
    rebuild: process.env.RELEASE_REBUILD === "true",
  }), null, 2));
}
