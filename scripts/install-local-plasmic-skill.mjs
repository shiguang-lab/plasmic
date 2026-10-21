import { lstat, mkdir, readFile, readlink, rename, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveLocalContext } from "./plasmic-local-context.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function installLocalSkill(target = path.join(process.env.DSH_AGENTS_HOME || path.join(homedir(), ".agents"), "skills/plasmic")) {
  target = path.resolve(target);
  const context = await resolveLocalContext("prototype");
  const links = { "SKILL.md": path.join(repo, "packages/plasmic-cli/skill/plasmic/SKILL.md"),
    references: path.join(context.resourceRoot, "references"), scripts: path.join(context.resourceRoot, "scripts") };
  const config = JSON.stringify({ source: "local", resolver: path.join(repo, "scripts/plasmic-local-context.mjs") }, null, 2) + "\n";
  let exists = false;
  try { await lstat(target); exists = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) {
    const same = await Promise.all(Object.entries(links).map(async ([name, source]) => {
      try { return await readlink(path.join(target, name)) === source; } catch { return false; }
    }));
    if (same.every(Boolean) && await readFile(path.join(target, "local-source.json"), "utf8").catch(() => "") === config) {
      return { target, status: "unchanged", resourceRoot: context.resourceRoot, resourceHash: context.resourceHash };
    }
    const backup = path.join(path.dirname(path.dirname(target)), "plasmic-skill-backups", new Date().toISOString().replaceAll(":", "-"));
    await mkdir(path.dirname(backup), { recursive: true });
    await rename(target, backup);
  }
  await mkdir(target, { recursive: true });
  for (const [name, source] of Object.entries(links)) await symlink(source, path.join(target, name));
  await writeFile(path.join(target, "local-source.json"), config);
  return { target, status: "installed", resourceRoot: context.resourceRoot, resourceHash: context.resourceHash };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { target: { type: "string" } } });
  console.log(JSON.stringify(await installLocalSkill(values.target), null, 2));
}
