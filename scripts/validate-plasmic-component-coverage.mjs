import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Bundle validation needs only the index and document metadata. The source CLI
// additionally checks those records against the actual registerAll calls.
export function validateComponentReferences(files, registrations = []) {
  const resources = new Map(files.map((file) => [file.path, file.content]));
  const covered = new Map();
  let libraries = 0;
  for (const [filename, index] of resources) {
    const match = /^references\/libraries\/([^/]+)\/index\.md$/.exec(filename);
    if (!match) continue;
    const library = match[1];
    const directory = path.posix.dirname(filename);
    const indexed = new Map();
    for (const row of index.matchAll(/^\| \[[^\]]+\]\((components\/[^)]+\.md)\) \| (.+) \|$/gm)) {
      const document = `${directory}/${row[1]}`;
      assert(resources.has(document), `Missing component document: ${document}`);
      for (const key of row[2].matchAll(/`(plasmic-[^`]+)`/g)) {
        assert(!indexed.has(key[1]), `Duplicate indexed registration: ${key[1]}`);
        indexed.set(key[1], { document, caption: row[2] });
      }
    }
    if (library === "antd_icons") {
      assert(index.includes("`plasmic-antd-icon-*`"), "Missing icon catalog coverage");
      libraries++;
      continue;
    }
    const documents = [...resources].filter(([name]) => name.startsWith(`${directory}/components/`) && name.endsWith(".md"));
    assert(documents.length && indexed.size, `Missing component coverage: ${library}`);
    for (const [document, content] of documents) {
      const metadata = content.split(/\n\n## /)[0];
      const rows = [...metadata.matchAll(/^\| ([^|]+) \| `(plasmic-[^`]+)` \|$/gm)];
      assert(rows.length, `Missing registration metadata: ${document}`);
      for (const [, displayName, name] of rows) {
        assert(!covered.has(name), `Duplicate document ownership: ${name}`);
        const entry = indexed.get(name);
        assert(entry?.document === document, `Index ownership mismatch: ${name}`);
        assert(entry.caption.includes(`${displayName} (\`${name}\`)`), `Index display name mismatch: ${name}`);
        covered.set(name, { library, document, displayName });
      }
    }
    for (const name of indexed.keys()) assert(covered.has(name), `Undocumented indexed registration: ${name}`);
    libraries++;
  }
  if (registrations.length) {
    const actual = new Set();
    for (const { library, owner, name, displayName } of registrations) {
      assert(!actual.has(name), `Duplicate source registration: ${name}`);
      actual.add(name);
      const entry = covered.get(name);
      assert(entry, `Missing registered component reference: ${name}`);
      assert.equal(entry.library, library, `Wrong library: ${name}`);
      assert.equal(entry.document, `references/libraries/${library}/components/${owner}.md`, `Wrong main-component owner: ${name}`);
      assert.equal(entry.displayName, displayName, `Stale registered display name: ${name}`);
    }
    for (const name of covered.keys()) assert(actual.has(name), `Unknown documented registration: ${name}`);
  }
  return { libraries, registrations: covered.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const require = createRequire(import.meta.url);
  require("tsx/cjs");
  const { componentChildren } = require(path.join(repo, "plasmicpkgs/antd6/src/componentSections.ts"));
  const owners = Object.fromEntries(Object.entries(componentChildren).map(([name, child]) => [name, child.parent]));
  Object.assign(owners, {
    "form-group": "form", "range-slider": "slider", "slider-mark": "slider",
    "segmented-option": "segmented", "single-collapse": "collapse",
    "row": "grid", "col": "grid", "search-form-item": "search-form",
  });
  const registrations = [];
  for (const [library, source] of [
    ["antd_v6", "antd6"], ["antd_v5", "antd5"],
    ["overseas", "overseas"], ["react_ui", "react-ui"],
  ]) {
    const capture = (_component, meta) => {
      let owner = meta.name.replace(/^plasmic-(?:antd[56]|overseas|react-ui)-/, "");
      while (owners[owner]) owner = owners[owner];
      registrations.push({ library, owner, name: meta.name, displayName: meta.displayName });
    };
    require(path.join(repo, `plasmicpkgs/${source}/src/index.ts`)).registerAll({
      registerComponent: capture, registerGlobalContext: capture, registerToken() {},
    });
  }
  let iconCount = 0;
  require(path.join(repo, "plasmicpkgs/antd-icons/src/index.ts")).registerAll({
    registerComponent(component, meta) {
      assert(component && meta.name === `plasmic-antd-icon-${meta.importName}`, "Invalid icon catalog registration");
      iconCount++;
    },
  });
  assert(iconCount > 0, "Empty icon catalog");
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(path.join(repo, "ai/plasmic", directory), { withFileTypes: true })) {
      const name = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.name.endsWith(".md")) files.push({ path: name, content: await readFile(path.join(repo, "ai/plasmic", name), "utf8") });
    }
  }
  await visit("references/libraries");
  console.log(JSON.stringify({ ...validateComponentReferences(files, registrations), icons: iconCount }));
}
