import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { headingIds } from "./validate-plasmic-references.mjs";

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
    const catalog = resources.get(`${directory}/catalog.md`);
    assert(library === "antd_icons" || catalog, `Missing component catalog: ${library}`);
    for (const row of (catalog || "").matchAll(/^\| \[[^\]]+\]\((components\/[^)]+\.md)\) \| (.+) \|$/gm)) {
      const document = `${directory}/${row[1]}`;
      assert(resources.has(document), `Missing component document: ${document}`);
      for (const key of row[2].matchAll(/`(plasmic-[^`]+)`/g)) {
        assert(!indexed.has(key[1]), `Duplicate indexed registration: ${key[1]}`);
        indexed.set(key[1], { document, caption: row[2] });
      }
    }
    validateRulesManifest(resources, directory, indexed);
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

// rules.json is the machine-readable owner map. It must mirror the catalog
// exactly, and every decision/check must resolve to a real heading.
function validateRulesManifest(resources, directory, indexed) {
  const source = resources.get(`${directory}/rules.json`);
  if (source === undefined) return; // Markdown-only bundles (source CLI checks) skip it.
  const manifest = JSON.parse(source);
  const resolve = (target) => {
    const [file, anchor] = target.split("#");
    const document = path.posix.join(directory, file);
    assert(resources.has(document), `Missing rules.json target: ${document}`);
    assert(!anchor || headingIds(resources.get(document)).has(anchor), `Missing rules.json anchor: ${target}`);
    return document;
  };
  for (const target of Object.values(manifest.prefixes || {})) resolve(target);
  for (const target of Object.values(manifest.checks || {})) resolve(target);
  const listed = new Map();
  for (const [file, entry] of Object.entries(manifest.documents || {})) {
    const document = resolve(file);
    const content = resources.get(document);
    for (const key of entry.registrations) listed.set(key, document);
    const decisions = Object.entries(entry.decisions || {});
    assert.equal(content.includes("\n## Plan decisions\n"), decisions.length > 0, `Plan decisions section must match rules.json: ${document}`);
    for (const [key, items] of decisions) {
      assert(entry.registrations.includes(key), `Decision for a foreign registration: ${key}`);
      for (const item of items) {
        assert(headingIds(content).has(item.rule), `Missing decision anchor: ${document}#${item.rule}`);
        assert(content.includes(`| \`${key}\` | \`${item.prop}\``), `Plan decisions table omits ${key} ${item.prop}: ${document}`);
      }
    }
  }
  for (const [key, entry] of indexed) assert.equal(listed.get(key), entry.document, `rules.json ownership mismatch: ${key}`);
  for (const key of listed.keys()) assert(indexed.has(key), `rules.json lists an unindexed registration: ${key}`);
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
    "resource-authorization-record": "resource-authorization",
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
      else if (entry.name.endsWith(".md") || entry.name === "rules.json") files.push({ path: name, content: await readFile(path.join(repo, "ai/plasmic", name), "utf8") });
    }
  }
  await visit("references/libraries");
  console.log(JSON.stringify({ ...validateComponentReferences(files, registrations), icons: iconCount }));
}
