import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withProgress } from "./progress.mjs";
import {
  CLI_VERSION,
  MAX_BYTES,
  MODE_REFERENCES,
  artifactUrl,
  feedUrl,
  requiresNewCli,
  sha256,
  unpackResources,
  validateManifest,
  validateReleaseEnvelope,
} from "./protocol.mjs";

const RELEASE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const cacheRoot = (options) =>
  path.resolve(
    options.home ||
      process.env.PLASMIC_RESOURCE_HOME ||
      path.join(homedir(), ".cache", "plasmic"),
  );
export async function download(url, progress, fetchRelease = fetch) {
  const response = await fetchRelease(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Cannot download ${url}: HTTP ${response.status}`);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) {
      throw new Error("Resource download exceeds limit");
    }
    chunks.push(chunk);
    progress?.({ bytes: size });
  }
  return Buffer.concat(chunks);
}
export async function readRelease(options, validate = validateManifest) {
  const feed = feedUrl(options.feed);
  const manifest = await withProgress(options, "manifest", async (progress) => {
    const state = await current(cacheRoot(options));
    const checkedManifest = validate(
      JSON.parse(
        (await download(new URL("latest.json", feed))).toString("utf8"),
      ),
    );
    progress({
      version: checkedManifest.version,
      currentVersion: state?.version ?? null,
      currentCliVersion: CLI_VERSION,
      cliVersion: checkedManifest.cliVersion,
    });
    return checkedManifest;
  });
  return {
    feed,
    manifest,
    cliUrl: artifactUrl(feed, manifest, "cli"),
    checkedAt: Date.now(),
  };
}
function versionInfo(release) {
  return {
    cliVersion: CLI_VERSION,
    latestCliVersion: release.manifest.cliVersion,
    minCliVersion: release.manifest.minCliVersion,
    cliUpdateAvailable: requiresNewCli(release.manifest.cliVersion),
    cliCompatible: !requiresNewCli(release.manifest.minCliVersion),
    cliUrl: release.cliUrl,
  };
}
function requireCompatibleCli(release) {
  if (requiresNewCli(release.manifest.minCliVersion)) {
    const error = new Error(
      `Resources require CLI ${release.manifest.minCliVersion}; install ${release.cliUrl} and rerun`,
    );
    Object.assign(error, versionInfo(release));
    throw error;
  }
}
export async function checkCliVersion(options = {}) {
  return versionInfo(await readRelease(options));
}
export async function readRecentRelease(options) {
  const root = cacheRoot(options);
  const feed = feedUrl(options.feed);
  const state = await current(root);
  const age = Date.now() - state?.checkedAt;
  if (
    state?.feed !== feed ||
    !/^[a-f0-9]{64}$/.test(state?.releaseId ?? "") ||
    !Number.isFinite(age) || age < 0 || age >= RELEASE_CHECK_INTERVAL_MS
  ) {
    return;
  }
  try {
    const filename = path.join(root, "releases", state.releaseId, "manifest.json");
    const manifest = validateReleaseEnvelope(JSON.parse(await readFile(filename, "utf8")));
    if (manifest.releaseId === state.releaseId) {
      return {
        feed,
        manifest,
        cliUrl: artifactUrl(feed, manifest, "cli"),
        checkedAt: state.checkedAt,
        recent: true,
      };
    }
  } catch {
    // Refresh the manifest if the cached release cannot be read or validated.
  }
}
async function current(root) {
  try {
    return JSON.parse(await readFile(path.join(root, "current.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
async function verifyLocal(directory, manifest, progress) {
  try {
    if (!(await lstat(directory)).isDirectory()) {
      return false;
    }
    const cachedText = await readFile(
      path.join(directory, "manifest.json"),
      "utf8",
    );
    try {
      const cached = validateManifest(JSON.parse(cachedText));
      if (cached.releaseId !== manifest.releaseId) {
        return false;
      }
    } catch {
      return false;
    }
    let completedFiles = 0;
    for (const file of manifest.files) {
      const target = path.join(directory, file.path);
      // Resource directories/files must be real cache entries, never symlinks.
      let parent = path.dirname(target);
      while (parent !== directory) {
        if (!(await lstat(parent)).isDirectory()) {
          return false;
        }
        parent = path.dirname(parent);
      }
      const stat = await lstat(target);
      if (
        !stat.isFile() ||
        stat.size !== file.size ||
        sha256(await readFile(target)) !== file.sha256
      ) {
        return false;
      }
      progress?.({
        completedFiles: ++completedFiles,
        totalFiles: manifest.files.length,
      });
    }
    return true;
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code)) {
      return false;
    }
    throw error;
  }
}
async function checkCache(directory, manifest, options, state, recent = false) {
  return withProgress(
    options,
    "cache",
    async (progress) => {
      const valid = await verifyLocal(directory, manifest, progress);
      progress({
        valid,
        recent,
        ...(state !== undefined
          ? {
              upToDate:
                valid &&
                state?.releaseId === manifest.releaseId &&
                state?.feed === feedUrl(options.feed),
            }
          : {}),
      });
      return valid;
    },
    { completedFiles: 0, totalFiles: manifest.files.length },
  );
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
  const root = cacheRoot(options),
    release = await readRelease(options),
    state = await current(root);
  const directory = path.join(root, "releases", release.manifest.releaseId);
  const valid = await checkCache(directory, release.manifest, options, state);
  return result(root, release, {
    updateAvailable:
      state?.releaseId !== release.manifest.releaseId ||
      state?.feed !== release.feed ||
      !valid,
    localVersion: state?.version || null,
  });
}
export async function updateReferences(options = {}) {
  const release = await readRelease(options);
  return withUpdateLock(options, () => installResources(release, options));
}
export async function withUpdateLock(options, action, waitMs = 0) {
  const root = cacheRoot(options);
  const lock = path.join(root, ".update-lock");
  await withProgress(options, "lock", async () => {
    await mkdir(root, { recursive: true });
    const deadline = Date.now() + waitMs;
    for (;;) {
      try {
        await mkdir(lock);
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (Date.now() >= deadline) {
          throw new Error(`Resource update already in progress: ${lock}`);
        }
        await delay(50);
      }
    }
  });
  try {
    return await action();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
// Callers hold the update lock for this cache root.
export async function installResources(release, options) {
  const root = cacheRoot(options);
  await withProgress(options, "compatibility", () =>
    requireCompatibleCli(release),
  );
  const directory = path.join(root, "releases", release.manifest.releaseId);
  const state = await current(root);
  let updated =
    state?.releaseId !== release.manifest.releaseId ||
    state?.feed !== release.feed;
  if (!(await checkCache(directory, release.manifest, options, state, release.recent))) {
    const bytes = await withProgress(
      options,
      "download",
      (progress) =>
        download(
          artifactUrl(release.feed, release.manifest, "resources"),
          progress,
        ),
      { bytes: 0, totalBytes: release.manifest.artifacts.resources.size },
    );
    const files = await withProgress(options, "verify", () =>
      unpackResources(bytes, release.manifest),
    );
    await withProgress(
      options,
      "install",
      async (progress) => {
        await mkdir(path.dirname(directory), { recursive: true });
        const staging = await mkdtemp(
          path.join(root, "releases", ".download-"),
        );
        try {
          let completedFiles = 0;
          for (const file of files) {
            const target = path.join(staging, file.path);
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, file.content, { flag: "wx" });
            progress({
              completedFiles: ++completedFiles,
              totalFiles: files.length,
            });
          }
          await writeFile(
            path.join(staging, "manifest.json"),
            JSON.stringify(release.manifest),
          );
          // Replace corrupt entries only after the complete replacement has been verified.
          if (!(await verifyLocal(directory, release.manifest))) {
            await rm(directory, { recursive: true, force: true });
          }
          try {
            await rename(staging, directory);
          } catch (error) {
            if (
              !["EEXIST", "ENOTEMPTY"].includes(error.code) ||
              !(await verifyLocal(directory, release.manifest))
            ) {
              throw error;
            }
          }
          updated = true;
        } finally {
          await rm(staging, { recursive: true, force: true });
        }
      },
      { completedFiles: 0, totalFiles: files.length },
    );
  }
  await withProgress(
    options,
    "activate",
    async () => {
      if (!updated && state?.checkedAt === release.checkedAt) return;
      const temporary = await mkdtemp(path.join(root, ".current-"));
      try {
        await writeFile(
          path.join(temporary, "current.json"),
          JSON.stringify({
            feed: release.feed,
            releaseId: release.manifest.releaseId,
            version: release.manifest.version,
            checkedAt: release.checkedAt,
          }),
        );
        await rename(
          path.join(temporary, "current.json"),
          path.join(root, "current.json"),
        );
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    },
    { updated },
  );
  return result(root, release, { updated, manifest: release.manifest });
}
export async function referencePath(options = {}) {
  const root = cacheRoot(options),
    state = await current(root);
  if (!state || !/^[a-f0-9]{64}$/.test(state.releaseId)) {
    throw new Error(
      "No verified local resources; run plasmickit references update",
    );
  }
  const directory = path.join(root, "releases", state.releaseId);
  const manifest = validateManifest(
    JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")),
  );
  if (
    manifest.releaseId !== state.releaseId ||
    !(await checkCache(directory, manifest, options))
  ) {
    throw new Error(
      "Local resources are corrupt; run plasmickit references update",
    );
  }
  return result(
    root,
    { manifest, cliUrl: artifactUrl(feedUrl(state.feed), manifest, "cli") },
    { freshness: "unchecked" },
  );
}
export async function describeContext(mode, runtime, { manifest, ...resources }, options) {
  return withProgress(options, "workflow", (progress) => {
    const mustReadByMode = {};
    for (const [name, references] of Object.entries(MODE_REFERENCES)) {
      const files = [
        manifest.entrypoints.guide,
        "references/desktop-mcp.md",
        manifest.entrypoints[name],
        ...references,
      ];
      mustReadByMode[name] = files.map((file) => path.join(resources.resourceRoot, file));
    }
    const mustRead = mustReadByMode[mode];
    progress({ mode, mustRead });
    return { ...resources, mode, mustRead, mustReadByMode, runtime };
  });
}
