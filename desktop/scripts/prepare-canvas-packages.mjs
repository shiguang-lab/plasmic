import { createHash } from "node:crypto";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Only the standalone trailing directive from the bundler refers to an omitted
// map. Inline data URLs and strings inside the program must remain intact.
export function stripSourceMap(text) {
  return text
    .replace(/\r?\n\/\/# sourceMappingURL=(?!data:)\S+\.map(?:\r?\n)?$/, "\n")
    .replace(/\r?\n\/\*# sourceMappingURL=(?!data:)\S+\.map[ \t]*\*\/(?:\r?\n)?$/, "\n");
}

export async function prepareCanvasPackages(directory) {
  const names = (await readdir(directory)).sort();
  const aliases = Object.create(null);
  const stored = new Set();
  async function store(name, data) {
    const file = createHash("sha256").update(data).digest("hex") + path.extname(name);
    if (!stored.has(file)) {
      await writeFile(path.join(directory, file), data);
      stored.add(file);
    }
    aliases[name] = file;
  }
  // License text has its own identity. A bundle with the same code but a
  // changed license must reference the new text before the script is hashed.
  for (const name of names.filter(name => name.endsWith(".txt"))) {
    await store(name, await readFile(path.join(directory, name)));
  }
  for (const name of names.filter(name => name.endsWith(".js"))) {
    const text = await readFile(path.join(directory, name), "utf8");
    const script = stripSourceMap(text).replace(
      /^\/\*! For license information please see ([\w.-]+) \*\//,
      (banner, license) => aliases[license] ? banner.replace(license, aliases[license]) : banner,
    );
    await store(name, script);
  }
  await writeFile(path.join(directory, "aliases.json"), JSON.stringify(aliases));
  for (const name of Object.keys(aliases)) {
    if (!stored.has(name)) await unlink(path.join(directory, name));
  }
}
