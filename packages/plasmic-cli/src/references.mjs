import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { artifactUrl, CLI_VERSION, CODEGEN_REFERENCES, feedUrl, MAX_BYTES, requiresNewCli, sha256, unpackResources, validateManifest } from "./protocol.mjs";

const cacheRoot = (options) => path.resolve(options.home || process.env.PLASMIC_RESOURCE_HOME || path.join(homedir(), ".cache", "plasmic"));
async function download(url) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Cannot download ${url}: HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error("Resource download exceeds limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function latest(options) {
  const feed = feedUrl(options.feed);
  const manifest = validateManifest(JSON.parse((await download(new URL("latest.json", feed))).toString("utf8")));
  const cliUrl = artifactUrl(feed, manifest, "cli");
  return { feed, manifest, cliUrl };
}
function versionInfo(release) {
  return {
    cliVersion: CLI_VERSION,
    latestCliVersion: release.manifest.version,
    minCliVersion: release.manifest.minCliVersion,
    cliUpdateAvailable: requiresNewCli(release.manifest.version),
    cliCompatible: !requiresNewCli(release.manifest.minCliVersion),
    cliUrl: release.cliUrl,
  };
}
function requireCompatibleCli(release) {
  if (requiresNewCli(release.manifest.minCliVersion)) {
    const error = new Error(`Resources require CLI ${release.manifest.minCliVersion}; install ${release.cliUrl} and rerun`);
    Object.assign(error, versionInfo(release));
    throw error;
  }
}
export async function checkCliVersion(options = {}) { return versionInfo(await latest(options)); }
async function current(root) {
  try { return JSON.parse(await readFile(path.join(root, "current.json"), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function verifyLocal(directory, manifest) {
  try {
    if (!(await lstat(directory)).isDirectory()) return false;
    const cachedText = await readFile(path.join(directory, "manifest.json"), "utf8");
    try {
      const cached = validateManifest(JSON.parse(cachedText));
      if (cached.releaseId !== manifest.releaseId) return false;
    } catch { return false; }
    for (const file of manifest.files) {
      const target = path.join(directory, file.path);
      // Resource directories/files must be real cache entries, never symlinks.
      let parent = path.dirname(target);
      while (parent !== directory) {
        if (!(await lstat(parent)).isDirectory()) return false;
        parent = path.dirname(parent);
      }
      const stat = await lstat(target);
      if (!stat.isFile() || stat.size !== file.size || sha256(await readFile(target)) !== file.sha256) return false;
    }
    return true;
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code)) return false;
    throw error;
  }
}
function result(root, release, extra = {}) {
  const resourceRoot = path.join(root, "releases", release.manifest.releaseId);
  return {
    version: release.manifest.version,
    releaseId: release.manifest.releaseId,
    resourceRoot,
    referencePath: path.join(resourceRoot, release.manifest.entrypoints.guide),
    ...versionInfo(release),
    ...extra,
  };
}
export async function checkReferences(options = {}) {
  const root = cacheRoot(options), release = await latest(options), state = await current(root);
  const directory = path.join(root, "releases", release.manifest.releaseId);
  const valid = await verifyLocal(directory, release.manifest);
  return result(root, release, { updateAvailable: state?.releaseId !== release.manifest.releaseId || state?.feed !== release.feed || !valid, localVersion: state?.version || null });
}
export async function updateReferences(options = {}) {
  const root = cacheRoot(options), release = await latest(options);
  requireCompatibleCli(release);
  await mkdir(root, { recursive: true });
  const lock = path.join(root, ".update-lock");
  try { await mkdir(lock); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error(`Resource update already in progress: ${lock}`);
    throw error;
  }
  try { return await installResources(root, release); }
  finally { await rm(lock, { recursive: true, force: true }); }
}
async function installResources(root, release) {
  const directory = path.join(root, "releases", release.manifest.releaseId);
  const state = await current(root);
  let updated = state?.releaseId !== release.manifest.releaseId || state?.feed !== release.feed;
  if (!await verifyLocal(directory, release.manifest)) {
    const files = unpackResources(await download(artifactUrl(release.feed, release.manifest, "resources")), release.manifest);
    await mkdir(path.dirname(directory), { recursive: true });
    const staging = await mkdtemp(path.join(root, "releases", ".download-"));
    try {
      for (const file of files) {
        const target = path.join(staging, file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content, { flag: "wx" });
      }
      await writeFile(path.join(staging, "manifest.json"), JSON.stringify(release.manifest));
      // Replace corrupt entries only after the complete replacement has been verified.
      if (!await verifyLocal(directory, release.manifest)) await rm(directory, { recursive: true, force: true });
      try { await rename(staging, directory); }
      catch (error) {
        if (!["EEXIST", "ENOTEMPTY"].includes(error.code) || !await verifyLocal(directory, release.manifest)) throw error;
      }
      updated = true;
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
  const temporary = await mkdtemp(path.join(root, ".current-"));
  try {
    await writeFile(path.join(temporary, "current.json"), JSON.stringify({ feed: release.feed, releaseId: release.manifest.releaseId, version: release.manifest.version }));
    await rename(path.join(temporary, "current.json"), path.join(root, "current.json"));
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return result(root, release, { updated, manifest: release.manifest });
}
export async function referencePath(options = {}) {
  const root = cacheRoot(options), state = await current(root);
  if (!state || !/^[a-f0-9]{64}$/.test(state.releaseId)) throw new Error("No verified local resources; run plasmickit references update");
  const directory = path.join(root, "releases", state.releaseId);
  const manifest = validateManifest(JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")));
  if (manifest.releaseId !== state.releaseId || !await verifyLocal(directory, manifest)) throw new Error("Local resources are corrupt; run plasmickit references update");
  return result(root, { manifest, cliUrl: artifactUrl(feedUrl(state.feed), manifest, "cli") }, { freshness: "unchecked" });
}
export async function resolveContext(mode, options = {}) {
  if (!["prototype", "codegen"].includes(mode)) throw new Error("--mode must be prototype or codegen");
  const { manifest, ...resources } = await updateReferences(options);
  const references = [manifest.entrypoints.guide, "references/desktop-mcp.md", manifest.entrypoints[mode], ...(mode === "codegen" ? CODEGEN_REFERENCES : [])];
  return { ...resources, mode, mustRead: references.map((reference) => path.join(resources.resourceRoot, reference)) };
}
