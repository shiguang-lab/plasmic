import { readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

// Desktop omits source maps. Only ignore the standalone trailing directive
// emitted by the Studio build, never a matching string inside the program.
function scriptBody(bytes) {
  const marker = bytes.lastIndexOf("\n//# sourceMappingURL=");
  if (marker >= 0 && /^\n\/\/# sourceMappingURL=\S+\.map(?:\r?\n)?$/.test(bytes.toString("utf8", marker))) {
    return bytes.subarray(0, marker);
  }
  return bytes;
}

export async function deduplicateCanvasPackages(directory) {
  const names = new Set(await readdir(directory));
  const aliases = {};
  for (const name of [...names].sort()) {
    const match = /^(.+)-v2(\.[^.]+\.js)$/.exec(name);
    if (!match || match[1].endsWith("-v2")) continue;
    const canonical = match[1] + match[2];
    if (!names.has(canonical)) continue;
    const [first, second] = await Promise.all(
      [canonical, name].map((entry) => readFile(path.join(directory, entry))),
    );
    if (scriptBody(first).equals(scriptBody(second))) {
      aliases[name] = canonical;
      await unlink(path.join(directory, name));
    }
  }
  return aliases;
}
