import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { detectInstalledAgents } from "./agents.mjs";

async function physicalPath(filename) {
  try { return await realpath(filename); }
  catch (error) {
    if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
    const parent = path.dirname(filename);
    return parent === filename ? filename : path.join(await physicalPath(parent), path.basename(filename));
  }
}

export async function installSkill({ dryRun = false, ...options } = {}) {
  const detected = await detectInstalledAgents(options);
  if (!detected.length) return { ok: false, mode: "bootstrap", detected, installations: [], error: "No supported local Agent CLI or app detected. Install or initialize a supported client, then rerun skill install." };
  const content = await readFile(new URL("../skill/plasmic/SKILL.md", import.meta.url), "utf8");
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
      let previous;
      try { previous = await readFile(destination.skillPath, "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (previous === content) { installations.push({ ...destination, status: "unchanged" }); continue; }
      await mkdir(destination.target, { recursive: true });
      const temporary = path.join(destination.target, `.SKILL-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, content, { flag: "wx" });
        await rename(temporary, destination.skillPath);
      } finally { await rm(temporary, { force: true }); }
      installations.push({ ...destination, status: "installed" });
    } catch (error) { installations.push({ ...destination, status: "failed", error: error.message }); }
  }
  return { ok: installations.every((result) => result.status !== "failed"), mode: "bootstrap", dryRun, detected, installations };
}
