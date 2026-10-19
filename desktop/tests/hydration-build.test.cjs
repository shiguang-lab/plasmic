const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function fixture() {
  const { hashFiles } = await import("../../scripts/build-identity.mjs");
  const { hydrationInputNames } = await import("../../scripts/build-html-hydrate.mjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hydration-provenance-"));
  for (const name of ["build.mjs", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.types.json", "scripts/build-html-hydrate.mjs", "scripts/build-identity.mjs", "platform/package.json", "platform/pnpm-lock.yaml", "platform/pnpm-workspace.yaml", "platform/loader-html-hydrate/src/index.ts", "platform/loader-html-hydrate/package.json", "platform/loader-html-hydrate/rollup.config.js", "packages/loader-react/src/index.ts", "packages/loader-react/package.json"]) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), name.endsWith("package.json") ? "{}" : "original input");
  }
  const build = path.join(root, "platform/loader-html-hydrate/build");
  await fs.mkdir(build);
  await fs.writeFile(path.join(build, "loader-hydrate.1234abcd.js"), "compiled hydration");
  await fs.writeFile(path.join(build, "loader-hydrate.js"), "compiled hydration");
  const manifest = { script: "loader-hydrate.1234abcd.js", inputHash: await hashFiles(root, await hydrationInputNames(root)), artifactHash: await hashFiles(build, ["."], ["hydration-build.json"]) };
  await fs.writeFile(path.join(build, "hydration-build.json"), JSON.stringify(manifest));
  return { root, build, manifest };
}

test("hydration provenance rejects a changed local SDK input independently of artifact bytes", async () => {
  const { readHydrationBuild } = await import("../../scripts/build-html-hydrate.mjs");
  const { root, manifest } = await fixture();
  try {
    assert.deepEqual(await readHydrationBuild(root), manifest);
    await fs.writeFile(path.join(root, "packages/loader-react/src/index.ts"), "changed SDK");
    await assert.rejects(readHydrationBuild(root), /Hydration sources changed/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("hydration provenance rejects changed output independently of source identity", async () => {
  const { readHydrationBuild } = await import("../../scripts/build-html-hydrate.mjs");
  const { root, build } = await fixture();
  try {
    await fs.writeFile(path.join(build, "loader-hydrate.1234abcd.js"), "stale hydration");
    await assert.rejects(readHydrationBuild(root), /Hydration assets changed/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("hydration provenance rejects an additional obsolete versioned output", async () => {
  const { readHydrationBuild } = await import("../../scripts/build-html-hydrate.mjs");
  const { root, build } = await fixture();
  try {
    await fs.writeFile(path.join(build, "loader-hydrate.deadbeef.js"), "old build");
    await assert.rejects(readHydrationBuild(root), /Hydration assets changed/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

for (const target of ["Studio", "Desktop"]) {
  test(`hydration rejects altered ${target} bytes with all other provenance valid`, async () => {
    const { verifyHydrationAssets } = await import("../../scripts/build-html-hydrate.mjs");
    const { root, build } = await fixture();
    const studio = path.join(root, "platform/wab/build/static/js");
    const renderer = path.join(root, "desktop/renderer");
    try {
      await fs.mkdir(studio, { recursive: true });
      await fs.cp(build, studio, { recursive: true });
      await fs.mkdir(path.join(renderer, "static/js"), { recursive: true });
      await fs.cp(build, path.join(renderer, "static/js"), { recursive: true });
      await verifyHydrationAssets(root, renderer);
      await fs.writeFile(path.join(target === "Studio" ? studio : path.join(renderer, "static/js"), "loader-hydrate.1234abcd.js"), "other build");
      await assert.rejects(verifyHydrationAssets(root, renderer), /Published hydration bytes differ/);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
}

test("hydration provenance rejects a changed compiler dependency lock with identical SDK source and output", async () => {
  const { readHydrationBuild } = await import("../../scripts/build-html-hydrate.mjs");
  const { root } = await fixture();
  try {
    await fs.writeFile(path.join(root, "platform/pnpm-lock.yaml"), "changed compiler dependency");
    await assert.rejects(readHydrationBuild(root), /Hydration sources changed/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});


test("hydration rejects an obsolete Studio script with current canonical manifest and all required bytes valid", async () => {
  const { verifyHydrationAssets } = await import("../../scripts/build-html-hydrate.mjs");
  const { root, build } = await fixture();
  const studio = path.join(root, "platform/wab/build/static/js");
  const renderer = path.join(root, "desktop/renderer");
  try {
    await fs.mkdir(studio, { recursive: true });
    await fs.cp(build, studio, { recursive: true });
    await fs.mkdir(path.join(renderer, "static/js"), { recursive: true });
    await fs.cp(build, path.join(renderer, "static/js"), { recursive: true });
    await verifyHydrationAssets(root, renderer);
    await fs.writeFile(path.join(studio, "loader-hydrate.deadbeef.js"), "obsolete release");
    await assert.rejects(verifyHydrationAssets(root, renderer), /Unexpected hydration versions/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
