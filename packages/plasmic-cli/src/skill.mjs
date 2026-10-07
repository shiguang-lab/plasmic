import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function installSkill(targetRoot) {
  if (!targetRoot) throw new Error("skill install requires --target SKILLS_ROOT");
  const target = path.resolve(targetRoot, "plasmic");
  const content = await readFile(new URL("../skill/plasmic/SKILL.md", import.meta.url), "utf8");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "SKILL.md"), content);
  return { target, skillPath: path.join(target, "SKILL.md"), mode: "bootstrap" };
}
