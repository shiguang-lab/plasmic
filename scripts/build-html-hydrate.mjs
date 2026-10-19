import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashFiles } from "./build-identity.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hydration = path.join(repo, "platform/loader-html-hydrate");

// Host generates src/version.ts from its hashed package.json during the build.
export async function hydrationInputNames(root) {
  const names = ["build.mjs", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.types.json", "scripts/build-html-hydrate.mjs", "scripts/build-identity.mjs", "platform/package.json", "platform/pnpm-lock.yaml", "platform/pnpm-workspace.yaml", "platform/loader-html-hydrate/src", "platform/loader-html-hydrate/package.json", "platform/loader-html-hydrate/rollup.config.js"];
  const pending = ["loader-react"], visited = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (visited.has(name)) continue;
    visited.add(name);
    const directory = `packages/${name}`;
    const manifest = JSON.parse(await readFile(path.join(root, directory, "package.json"), "utf8"));
    names.push(`${directory}/src`, `${directory}/package.json`);
    for (const file of await readdir(path.join(root, directory))) {
      if (/^(?:rollup\.config\.[cm]?js|tsconfig.*\.json|update_version\.sh)$/.test(file)) names.push(`${directory}/${file}`);
    }
    for (const [dependency, specifier] of Object.entries(manifest.dependencies || {})) {
      if (specifier.startsWith("workspace:")) pending.push(dependency.replace("@plasmicapp/", ""));
    }
  }
  return names.sort();
}

export async function readHydrationBuild(root) {
  const output = path.join(root, "platform/loader-html-hydrate/build");
  const manifest = JSON.parse(await readFile(path.join(output, "hydration-build.json"), "utf8"));
  if (manifest.inputHash !== await hashFiles(root, await hydrationInputNames(root), [path.join("packages", "host", "src", "version.ts")])) {
    throw new Error("Hydration sources changed; rebuild hydration.");
  }
  if (manifest.artifactHash !== await hashFiles(output, ["."], ["hydration-build.json"])) {
    throw new Error("Hydration assets changed; rebuild hydration.");
  }
  return manifest;
}

export async function verifyHydrationAssets(root, renderer) {
  const manifest = await readHydrationBuild(root);
  const original = path.join(root, "platform/loader-html-hydrate/build");
  for (const output of [path.join(root, "platform/wab/build/static/js"), path.join(renderer, "static/js")]) {
    const scripts = (await readdir(output)).filter((name) => /^loader-hydrate.*\.js$/.test(name)).sort();
    if (JSON.stringify(scripts) !== JSON.stringify([manifest.script, "loader-hydrate.js"].sort())) {
      throw new Error(`Unexpected hydration versions in ${output}`);
    }
    for (const name of [...scripts, "hydration-build.json"]) {
      if (!(await readFile(path.join(original, name))).equals(await readFile(path.join(output, name)))) {
        throw new Error(`Published hydration bytes differ: ${path.join(output, name)}`);
      }
    }
  }
  return manifest;
}

async function build() {
  const inputHash = await hashFiles(repo, await hydrationInputNames(repo), [path.join("packages", "host", "src", "version.ts")]);
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--config.verify-deps-before-run=error", "--filter", "@plasmicapp/loader-react...", "run", "build"], { cwd: repo, stdio: "inherit" });
  const sdk = path.join(repo, "packages/loader-react");
  const manifest = JSON.parse(await readFile(path.join(sdk, "package.json"), "utf8"));
  for (const consumer of [hydration, path.join(repo, "platform/wab")]) {
    const require = createRequire(path.join(consumer, "package.json"));
    if (await realpath(require.resolve("@plasmicapp/loader-react")) !== await realpath(path.join(sdk, manifest.main))) {
      throw new Error(`${consumer} must link the local loader-react SDK; install platform dependencies.`);
    }
  }
  // These ignored development copies predate the canonical sibling build.
  // They must not be copied from public/ into a new Studio release.
  const publicJs = path.join(repo, "platform/wab/public/static/js");
  for (const name of await readdir(publicJs)) {
    if (/^loader-hydrate(?:\.[\da-f]+)?\.js(?:\.map)?$/.test(name)) {
      await rm(path.join(publicJs, name));
    }
  }
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { cwd: hydration, stdio: "inherit" });
  const output = path.join(hydration, "build");
  const names = await readdir(output);
  const versioned = names.filter((name) => /^loader-hydrate\.[\da-f]+\.js$/.test(name));
  if (versioned.length !== 1 || !names.includes("loader-hydrate.js")) {
    throw new Error("Hydration build must contain one versioned script and its stable entry.");
  }
  for (const name of ["loader-hydrate.js", versioned[0]]) {
    const code = await readFile(path.join(output, name), "utf8");
    if (/refreshXModules|__GetlibsReadyResolver|js\/getlibs\.js/.test(code)) {
      throw new Error("Legacy Host remains in hydration output.");
    }
    const map = JSON.parse(await readFile(path.join(output, `${name}.map`), "utf8"));
    for (const source of ["packages/host/src/canvas-host.tsx", "packages/loader-react/src/render.tsx", "packages/loader-react/src/loader-client.ts"]) {
      const indices = map.sources.flatMap((entry, index) => path.resolve(output, entry) === path.join(repo, source) ? [index] : []);
      if (indices.length !== 1 || map.sourcesContent[indices[0]] !== await readFile(path.join(repo, source), "utf8")) {
        throw new Error(`Hydration must contain the current local source: ${source}`);
      }
    }
  }
  if (inputHash !== await hashFiles(repo, await hydrationInputNames(repo), [path.join("packages", "host", "src", "version.ts")])) {
    throw new Error("Sources changed while hydration was building; rebuild hydration.");
  }
  await writeFile(path.join(output, "hydration-build.json"), JSON.stringify({ inputHash, script: versioned[0], artifactHash: await hashFiles(output, ["."], ["hydration-build.json"]) }, null, 2) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
