import path from "node:path";
import { MODE_REFERENCES } from "../packages/plasmic-cli/src/protocol.mjs";

function headingIds(content) {
  const counts = new Map();
  return new Set(
    [...content.matchAll(/^#{1,6} (.+)$/gm)].map((match) => {
      const slug = match[1]
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_ -]/gu, "")
        .replace(/ /g, "-");
      const count = counts.get(slug) || 0;
      counts.set(slug, count + 1);
      return count ? `${slug}-${count}` : slug;
    }),
  );
}

// Validate actual release resources, including generated references/search-form.md.
export function validateReferences(files, entrypoints) {
  const resources = new Map(files.map((file) => [file.path, file.content]));
  const edges = new Map();
  for (const [filename, content] of resources) {
    if (!filename.endsWith(".md")) {
      continue;
    }
    const budget =
      filename === entrypoints.guide
        ? 4096
        : filename === "references/desktop-mcp.md"
          ? 4096
          : filename.startsWith("references/workflows/")
            ? 6144
            : 20480;
    if (Buffer.byteLength(content) > budget) {
      throw new Error(
        `Reference exceeds ${budget}-byte reading budget: ${filename}`,
      );
    }
    const links = [];
    for (const [, destination] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(destination)) {
        continue;
      }
      const [relative, anchor] = destination.split("#");
      const target = relative
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(filename), relative),
          )
        : filename;
      const targetContent = resources.get(target);
      if (targetContent === undefined) {
        throw new Error(`Missing reference ${destination} from ${filename}`);
      }
      if (
        anchor &&
        (!target.endsWith(".md") || !headingIds(targetContent).has(anchor))
      ) {
        throw new Error(`Missing heading ${destination} from ${filename}`);
      }
      links.push(target);
    }
    edges.set(filename, links);
  }
  const reachable = new Set();
  const pending = [entrypoints.guide];
  while (pending.length) {
    const filename = pending.pop();
    if (reachable.has(filename)) {
      continue;
    }
    reachable.add(filename);
    pending.push(...(edges.get(filename) || []));
  }
  for (const filename of resources.keys()) {
    if (filename.startsWith("references/") && !reachable.has(filename)) {
      throw new Error(`Unreachable task reference: ${filename}`);
    }
  }
  const readingBytes = {};
  for (const [mode, references] of Object.entries(MODE_REFERENCES)) {
    const required = [
      entrypoints.guide,
      "references/desktop-mcp.md",
      entrypoints[mode],
      ...references,
    ];
    readingBytes[mode] = required.reduce((total, filename) => {
      if (!resources.has(filename)) {
        throw new Error(`Missing ${mode} reference: ${filename}`);
      }
      return total + Buffer.byteLength(resources.get(filename));
    }, 0);
    if (readingBytes[mode] > 24576) {
      throw new Error(
        `${mode} mustRead exceeds 24 KiB: ${readingBytes[mode]} bytes`,
      );
    }
  }
  return readingBytes;
}
