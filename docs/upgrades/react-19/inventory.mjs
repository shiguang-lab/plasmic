// Documentation coverage inventory; does not install packages or run product code.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, "../../..");
const output = path.join(directory, "scope-inventory.json");
const mode = process.argv[2];
if (!["--check", "--write"].includes(mode)) {
  throw new Error(
    "Use --check to verify coverage or --write to refresh the inventory.",
  );
}
const keys = new Set([
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "react-is",
  "react-test-renderer",
  "@types/react-test-renderer",
  "use-sync-external-store",
  "valtio",
  "next",
  "gatsby",
  "mobx-react",
  "mobx-react-lite",
  "@plasmicapp/react-ssr-prepass",
]);
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "resolutions",
  "optionalDependencies",
];
const files = execFileSync(
  "rg",
  [
    "--files",
    "-g",
    "package.json",
    "-g",
    "pnpm-workspace.yaml",
    "-g",
    "pnpm-lock.yaml",
    "-g",
    "package-lock.json",
    "-g",
    "yarn.lock",
  ],
  {
    cwd: repository,
    encoding: "utf8",
  },
)
  .trim()
  .split("\n")
  .sort();
const hash = (contents) => createHash("sha256").update(contents).digest("hex");
function scope(file) {
  if (file.includes("/cpa-out/")) return "scaffold-output";
  if (file.startsWith("platform/loader-tests/src/")) return "consumer-fixture";
  if (file.startsWith("examples/")) return "example";
  if (file.startsWith("packages/")) return "sdk-and-tools";
  if (file.startsWith("plasmicpkgs/")) return "component-package";
  if (file.startsWith("platform/")) return "platform";
  return "other";
}
const manifests = [];
const configurationFiles = [];
for (const file of files) {
  const contents = readFileSync(path.join(repository, file));
  if (!file.endsWith("package.json")) {
    configurationFiles.push({ path: file, sha256: hash(contents) });
    continue;
  }
  const manifest = JSON.parse(contents);
  const reactRequirements = {};
  for (const section of sections) {
    for (const [name, version] of Object.entries(
      manifest[section] ?? {},
    ).sort()) {
      if (keys.has(name)) reactRequirements[`${section}.${name}`] = version;
    }
  }
  manifests.push({
    path: file,
    name: manifest.name ?? null,
    scope: scope(file),
    sha256: hash(contents),
    reactRequirements,
  });
}
const countsByScope = {};
for (const manifest of manifests) {
  const counts = (countsByScope[manifest.scope] ??= {
    manifests: 0,
    directlyRelated: 0,
  });
  counts.manifests++;
  if (Object.keys(manifest.reactRequirements).length) counts.directlyRelated++;
}
const snapshot = {
  schemaVersion: 1,
  note: "Source coverage only. Peer acceptance, package installation and runtime compatibility are not validated by this inventory.",
  manifestCount: manifests.length,
  directlyRelatedCount: manifests.filter(
    (item) => Object.keys(item.reactRequirements).length,
  ).length,
  countsByScope,
  manifests,
  configurationFiles,
};
const serialized = JSON.stringify(snapshot, null, 2) + "\n";
if (mode === "--write") {
  writeFileSync(output, serialized);
  process.stdout.write(
    `Wrote ${snapshot.manifestCount} manifests, ${snapshot.directlyRelatedCount} directly related, ${configurationFiles.length} configuration files.\n`,
  );
} else {
  const expected = JSON.parse(readFileSync(output, "utf8"));
  if (JSON.stringify(expected) !== JSON.stringify(snapshot)) {
    throw new Error(
      "Source inventory changed. Review the scope matrix and dependency decisions before running inventory.mjs --write.",
    );
  }
  process.stdout.write(
    `Coverage matches: ${snapshot.manifestCount} manifests, ${snapshot.directlyRelatedCount} directly related, ${configurationFiles.length} configuration files.\n`,
  );
}
