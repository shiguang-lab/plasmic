import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withProgress } from "./progress.mjs";
import { CLI_VERSION, compareVersions, requiresNewCli, validateManifest, validateReleaseEnvelope, verifyArtifact } from "./protocol.mjs";
import {
  cacheRoot, describeContext, download, installResources, readRecentRelease,
  readRelease, withUpdateLock,
} from "./references.mjs";
import { verifyRuntime } from "./runtime.mjs";
import { installSkill, needsSkillMigration } from "./skill.mjs";

const run = promisify(execFile);

async function syncSkill(existingOnly) {
  let result;
  try { result = await installSkill({ existingOnly }); }
  catch (error) { result = { ok: false, error: error.message, installations: [] }; }
  for (const entry of result.installations) {
    if (entry.status === "updated") process.stderr.write(`✓ Skill 入口已更新：${entry.skillPath}；客户端重新加载技能后采用新入口\n`);
    if (entry.status === "failed") process.stderr.write(`! Skill 入口更新失败：${entry.skillPath}：${entry.error}\n`);
  }
  if (result.error) process.stderr.write(`! Skill 入口更新失败：${result.error}\n`);
  return result;
}

// The starter hands the already-fetched release to the selected CLI version.
export async function prepareRelease(mode, release, runtime, options) {
  await withProgress(options, "compatibility", () => validateManifest(release.manifest));
  const resources = await installResources(release, options);
  const context = await describeContext(mode, runtime, resources, options);
  return { ...context, skillUpdate: await syncSkill(!options.installAll) };
}

async function selectCli(release, options) {
  if (!requiresNewCli(release.manifest.cliVersion)) return prepareRelease;

  const { manifest, cliUrl } = release;
  const artifact = manifest.artifacts.cli;
  const root = path.join(cacheRoot(options), "cli");
  const destination = path.join(root, artifact.sha256);
  const entry = path.join("package", "src", "context.mjs");
  const metadata = path.join("package", "package.json");
  const load = async (directory) => {
    const { name, version } = JSON.parse(await readFile(path.join(directory, metadata), "utf8"));
    if (name !== "@plasmickit/cli" || version !== manifest.cliVersion) {
      throw new Error("CLI package name or version does not match the release manifest");
    }
    const candidate = await import(pathToFileURL(path.join(directory, entry)));
    if (typeof candidate.prepareRelease !== "function") throw new Error("CLI package is missing the published context entry");
    return candidate.prepareRelease;
  };
  try {
    return await load(destination);
  } catch (error) {
    if (!["ENOENT", "ERR_MODULE_NOT_FOUND"].includes(error.code)) throw error;
  }

  return withProgress(options, "cli-update", async (progress) => {
    const bytes = await download(cliUrl, progress);
    verifyArtifact(bytes, artifact);
    await mkdir(root, { recursive: true });
    const staging = await mkdtemp(path.join(root, ".download-"));
    try {
      const archive = "plasmic-cli.tgz";
      await writeFile(path.join(staging, archive), bytes);
      await run("tar", ["-xzf", archive], { cwd: staging, timeout: 10000 });
      await load(staging);
      await rm(path.join(staging, archive));
      await rm(destination, { recursive: true, force: true });
      await rename(staging, destination);
      return await load(destination);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }, { bytes: 0, totalBytes: artifact.size, cliVersion: manifest.cliVersion });
}

export async function resolveManagedContext(mode, options) {
  const runtime = await withProgress(options, "runtime", verifyRuntime);
  return withUpdateLock(options, async () => {
    const migrating = await needsSkillMigration();
    const refresh = options.refresh || migrating;
    const recent = refresh ? undefined : await readRecentRelease(options);
    const release = recent ?? await readRelease(options, validateReleaseEnvelope);
    if (migrating && compareVersions(release.manifest.cliVersion, CLI_VERSION) < 0) {
      throw new Error("The Plasmic release feed has not activated this CLI version. Retry migration after publication.");
    }
    const selected = await selectCli(release, options);
    const context = await selected(mode, release, runtime, options);
    if (migrating && !context.skillUpdate.ok) {
      const error = new Error("Skill migration incomplete. Retry the failed installations.");
      error.skillUpdate = context.skillUpdate;
      throw error;
    }
    return { ...context, checkedAt: release.checkedAt };
  }, 30000);
}
