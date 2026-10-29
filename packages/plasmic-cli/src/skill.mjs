import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { detectInstalledAgents } from "./agents.mjs";
import { CLI_VERSION, compareVersions } from "./protocol.mjs";

const versionMarker = /^<!-- plasmickit-cli-version: (.+) -->$/m;

async function optionalStat(filename) {
  try { return await lstat(filename); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}

async function skipReason(target, existingOnly) {
  if (await optionalStat(path.join(target, "local-source.json"))) return "local-source";
  const file = await optionalStat(path.join(target, "SKILL.md"));
  if ((await optionalStat(target))?.isSymbolicLink() || file?.isSymbolicLink()) return "symlink";
  if (existingOnly && !file) return "not-installed";
}

async function writeSkill(destination, content, existingOnly) {
  const { target, skillPath } = destination;
  const skipped = await skipReason(target, existingOnly);
  if (skipped) return { status: "skipped", reason: skipped };
  if (!existingOnly) await mkdir(target, { recursive: true });
  const lock = path.join(target, ".plasmickit-skill-lock");
  const deadline = Date.now() + 5000;
  for (;;) {
    try { await mkdir(lock); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new Error(`Skill update still locked: ${lock}. Retry after the other updater finishes; remove this lock only if no updater is running.`);
      await delay(50);
    }
  }
  try {
    // Recheck under the shared directory lock: another CLI may have just updated it.
    const skipped = await skipReason(target, existingOnly);
    if (skipped) return { status: "skipped", reason: skipped };
    let previous;
    try { previous = await readFile(skillPath, "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const installedVersion = previous?.match(versionMarker)?.[1];
    if (installedVersion && compareVersions(installedVersion, CLI_VERSION) > 0) {
      return { status: "skipped", reason: "newer-installed", installedVersion };
    }
    if (previous === content) return { status: "unchanged" };
    const temporary = path.join(target, `.SKILL-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { flag: "wx" });
      await rename(temporary, skillPath);
    } finally { await rm(temporary, { force: true }); }
    return { status: previous === undefined ? "installed" : "updated" };
  } finally { await rm(lock, { recursive: true, force: true }); }
}

async function physicalPath(filename) {
  try { return await realpath(filename); }
  catch (error) {
    if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
    const parent = path.dirname(filename);
    return parent === filename ? filename : path.join(await physicalPath(parent), path.basename(filename));
  }
}

export async function installSkill({ dryRun = false, existingOnly = false, ...options } = {}) {
  const detected = await detectInstalledAgents(options);
  if (!detected.length && !existingOnly) return { ok: false, mode: "bootstrap", detected, installations: [], error: "No supported local Agent CLI or app detected. Install or initialize a supported client, then rerun skill install." };
  const bundled = await readFile(new URL("../skill/plasmic/SKILL.md", import.meta.url), "utf8");
  // Keep version and instructions in one atomic replacement, without a sidecar file.
  const content = `${bundled.trimEnd()}\n\n<!-- plasmickit-cli-version: ${CLI_VERSION} -->\n`;
  const destinations = new Map();
  const installations = [];
  for (const agent of detected) {
    const target = path.join(agent.skillsRoot, "plasmic");
    let physicalTarget;
    try { physicalTarget = await physicalPath(target); }
    catch (error) {
      installations.push({ agents: [agent.id], target, skillPath: path.join(target, "SKILL.md"), status: "failed", error: error.message }); continue;
    }
    const key = (options.platform || process.platform) === "win32" ? physicalTarget.toLowerCase() : physicalTarget;
    if (destinations.has(key)) destinations.get(key).agents.push(agent.id);
    else destinations.set(key, { agents: [agent.id], target, skillPath: path.join(target, "SKILL.md") });
  }
  for (const destination of destinations.values()) {
    if (dryRun) { installations.push({ ...destination, status: "planned" }); continue; }
    try {
      installations.push({ ...destination, ...await writeSkill(destination, content, existingOnly) });
    } catch (error) { installations.push({ ...destination, status: "failed", error: error.message }); }
  }
  return { ok: installations.every((result) => result.status !== "failed"), mode: existingOnly ? "sync" : "bootstrap", cliVersion: CLI_VERSION, dryRun, detected, installations };
}
