import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadComponentReviewContract } from "../../desktop/scripts/component-review-contract.mjs";

const require = createRequire(import.meta.url);
require("tsx/cjs");
const { describeReviewRegistration } = await loadComponentReviewContract();
const root = fileURLToPath(new URL("../../", import.meta.url));
const packages = path.resolve(
  process.argv.slice(2).find((arg) => arg !== "--check") ??
    path.join(root, "platform/wab/public/static/packages"),
);
const archives = (await readdir(packages))
  .filter((name) => name.endsWith(".tgz"))
  .sort();
if (!archives.length)
  throw new Error("No released component library packages in " + packages);

const workspaces = JSON.parse(
  execFileSync("pnpm", ["-r", "ls", "--depth=-1", "--json"], {
    cwd: root,
    encoding: "utf8",
  }),
);
const packagesByName = new Map(workspaces.map((pkg) => [pkg.name, pkg]));
const documents = [];
const names = new Set();
for (const archive of archives) {
  const file = path.join(packages, archive);
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOzf", file, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  const { name, version } = manifest;
  const workspace = packagesByName.get(name);
  if (
    !workspace ||
    workspace.version !== version ||
    workspace.private ||
    manifest.private
  ) {
    throw new Error(
      "Expected a released public workspace component library: " + archive,
    );
  }
  // Load the packed code with the same dependencies used to build it.
  const temp = await mkdtemp(path.join(workspace.path, ".component-search-"));
  try {
    execFileSync("tar", ["-xzf", file, "-C", temp]);
    const count = documents.length;
    await require(path.join(temp, "package")).registerAll({
      registerComponent(_component, meta) {
        if (names.has(meta.name))
          throw new Error(
            "Duplicate public component registration: " + meta.name,
          );
        names.add(meta.name);
        documents.push({
          componentUuid: meta.name,
          name: meta.name,
          fromProject: name,
          version,
          ...describeReviewRegistration(meta),
        });
      },
      registerGlobalContext() {},
      registerToken() {},
    });
    console.log(name, version, documents.length - count);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

const output = new URL(
  "../../platform/wab/src/wab/server/component-reuse/component-reuse-public-documents.json",
  import.meta.url,
);
const json = JSON.stringify(documents, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")) !== json)
    throw new Error("Public component documents are stale");
} else {
  await writeFile(output, json);
}
