import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function hashFiles(root, names, exclude = []) {
  const hash = createHash("sha256");
  async function visit(relative) {
    if (exclude.includes(relative)) return;
    const file = path.join(root, relative);
    const entries = await readdir(file, { withFileTypes: true }).catch(
      (error) => {
        if (error.code === "ENOTDIR") return null;
        throw error;
      },
    );
    if (entries) {
      for (const entry of entries.sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        await visit(path.join(relative, entry.name));
      }
    } else {
      hash.update(relative.replaceAll(path.sep, "/") + "\0");
      hash.update(await readFile(file));
      hash.update("\0");
    }
  }
  for (const name of [...names].sort()) await visit(name);
  return hash.digest("hex");
}

export const desktopSources = ["src", "package.json", "desktop.config.json", "mcp-guide.md"];
