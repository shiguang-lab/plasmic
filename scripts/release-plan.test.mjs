import assert from "node:assert/strict";
import test from "node:test";
import { affectedProducts, productForTag } from "./release-plan.mjs";
import { isNewReleaseSeries } from "./release-version.mjs";

test("milestone releases advance the minor or major series", () => {
  assert.equal(isNewReleaseSeries("0.1.0", "0.0.88"), true);
  assert.equal(isNewReleaseSeries("1.0.0", "0.1.9"), true);
  assert.equal(isNewReleaseSeries("0.1.1", "0.1.0"), false);
  assert.equal(isNewReleaseSeries("0.1.0", "0.1.0"), false);
  assert.equal(isNewReleaseSeries("0.0.89", "0.1.0"), false);
});

test("release tags have independent namespaces", () => {
  for (const [tag, product] of [
    ["0.0.84", "studio"],
    ["desktop-v0.0.59", "desktop"],
    ["cli-v0.0.83", "cli"],
    ["resources-v0.0.84", "resources"],
  ]) {
    assert.equal(productForTag(tag), product);
  }
  for (const tag of ["v0.0.84", "foo", "0.0.84-beta", "cli-v01.0.1"]) {
    assert.throws(() => productForTag(tag));
  }
});
const products = (files) =>
  Object.entries(affectedProducts(files))
    .filter(([key, value]) => key !== "frontend" && value)
    .map(([key]) => key);
test("Studio frontend and shared renderer dependencies require Desktop", () => {
  for (const file of [
    "platform/wab/src/wab/client/theme.ts",
    "platform/wab/src/wab/shared/model.ts",
    "platform/canvas-packages/src/index.ts",
    "packages/host/src/index.ts",
    "plasmicpkgs/antd6/src/index.ts",
    "pnpm-lock.yaml",
    "deploy/Dockerfile",
  ]) {
    assert.deepEqual(products([file]), ["studio", "desktop"], file);
  }
});
test("backend and preview changes do not rebuild Desktop", () => {
  for (const file of [
    "platform/wab/src/wab/server/main.ts",
    "platform/wab/src/wab/migrations/1.ts",
    "platform/preview/pages/index.ts",
    "deploy/server-entrypoint.sh",
  ]) {
    assert.deepEqual(products([file]), ["studio"], file);
  }
});
test("Desktop is independent and CLI changes refresh the resource feed's CLI artifact", () => {
  assert.deepEqual(products(["desktop/src/main.cjs"]), ["desktop"]);
  assert.deepEqual(products(["desktop/desktop.config.json"]), ["desktop"]);
  assert.deepEqual(products(["packages/plasmic-cli/src/index.mjs"]), [
    "cli",
    "resources",
  ]);
  assert.deepEqual(products(["packages/plasmic-cli/skill/plasmic/SKILL.md"]), [
    "cli",
    "resources",
  ]);
  assert.deepEqual(products(["ai/plasmic/references/guide.md"]), ["resources"]);
  assert.deepEqual(products(["ai/plasmic/scripts/verify_slots.py"]), [
    "resources",
  ]);
  assert.deepEqual(
    products([
      "ai/plasmic/references/libraries/overseas/components/search-form.md",
    ]),
    ["resources"],
  );
  assert.deepEqual(
    products(["scripts/validate-plasmic-component-coverage.mjs"]),
    ["resources"],
  );
});
test("documentation, tests, and workflow changes alone do not release products", () => {
  assert.deepEqual(
    products([
      "desktop/README.md",
      "platform/wab/README.md",
      "platform/wab/src/wab/client/theme.test.ts",
      "ai/plasmic/scripts/test_verify_slots.py",
      ".github/workflows/publish-desktop.yml",
      "scripts/release-plan.mjs",
    ]),
    [],
  );
});

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { releasePlan } from "./release-plan.mjs";

test("plans compare product baselines and enforce the Studio/Desktop link", () => {
  const original = process.cwd();
  const repo = mkdtempSync(path.join(tmpdir(), "release-plan-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, stdio: "pipe" });
  const put = (file, value) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), value);
  };
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Release test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "test",
    );
  };
  try {
    git("init");
    put("desktop/package.json", JSON.stringify({ version: "0.0.58" }));
    put(
      "desktop/desktop.config.json",
      JSON.stringify({ webImage: "ghcr.io/shiguang-lab/plasmic-web:0.0.82" }),
    );
    put("platform/wab/src/wab/client/theme.ts", "old");
    put("ai/plasmic/references/guide.md", "old");
    commit();
    git("tag", "0.0.82");
    git("tag", "desktop-v0.0.58");
    process.chdir(repo);
    put("platform/wab/src/wab/server/main.ts", "server");
    commit();
    assert.equal(releasePlan("0.0.83").desktop, false);
    assert.equal(releasePlan("resources-v0.0.83").publish, false);
    put("platform/wab/src/wab/client/theme.ts", "new");
    commit();
    assert.throws(() => releasePlan("0.0.83"), /requires a new Desktop/);
    put("desktop/package.json", JSON.stringify({ version: "0.0.59" }));
    put(
      "desktop/desktop.config.json",
      JSON.stringify({ webImage: "ghcr.io/shiguang-lab/plasmic-web:0.0.83" }),
    );
    put(
      "desktop/package-lock.json",
      JSON.stringify({
        version: "0.0.59",
        packages: { "": { version: "0.0.59" } },
      }),
    );
    put("desktop/release-notes/0.0.59.md", "Update");
    put(
      "desktop/release-notes/0.0.59.json",
      JSON.stringify(
        Object.fromEntries(
          ["en", "zh-CN", "zh-TW", "ja", "ko"].map((key) => [key, "Update"]),
        ),
      ),
    );
    commit();
    assert.equal(releasePlan("0.0.83").desktopTag, "desktop-v0.0.59");
    assert.equal(releasePlan("desktop-v0.0.59").publish, true);
    git("tag", "desktop-v0.0.59", "HEAD~1");
    assert.throws(() => releasePlan("0.0.83"), /already belongs to another commit/);
    assert.equal(releasePlan("0.0.83", "HEAD", true).desktopTag, "desktop-v0.0.59");
    git("tag", "-d", "desktop-v0.0.59");
    git("tag", "0.0.83");
    assert.equal(releasePlan("0.0.84").publish, false);
    put("ai/plasmic/references/guide.md", "new");
    commit();
    git("tag", "0.0.84");
    assert.equal(releasePlan("resources-v0.0.84").baseline, "0.0.83");
    assert.equal(releasePlan("resources-v0.0.84").publish, true);
    git("tag", "resources-v0.0.84");
    assert.equal(
      releasePlan("resources-v0.0.85").baseline,
      "resources-v0.0.84",
    );
    assert.equal(releasePlan("resources-v0.0.85").publish, false);
    assert.equal(releasePlan("resources-v0.1.0").publish, true);
    put("packages/plasmic-cli/src/index.mjs", "new CLI");
    commit();
    assert.equal(releasePlan("resources-v0.0.85").publish, true);
    assert.equal(releasePlan("0.0.85").publish, false);
    assert.throws(() => releasePlan("0.1.0"), /requires a new Desktop/);
    put("desktop/package.json", JSON.stringify({ version: "0.1.0" }));
    put(
      "desktop/package-lock.json",
      JSON.stringify({
        version: "0.1.0",
        packages: { "": { version: "0.1.0" } },
      }),
    );
    put(
      "desktop/desktop.config.json",
      JSON.stringify({ webImage: "ghcr.io/shiguang-lab/plasmic-web:0.1.0" }),
    );
    put("desktop/release-notes/0.1.0.md", "Milestone");
    put(
      "desktop/release-notes/0.1.0.json",
      JSON.stringify(
        Object.fromEntries(
          ["en", "zh-CN", "zh-TW", "ja", "ko"].map((key) => [key, "Milestone"]),
        ),
      ),
    );
    commit();
    git("tag", "desktop-v0.0.59");
    assert.equal(releasePlan("0.1.0").desktopTag, "desktop-v0.1.0");
    assert.equal(releasePlan("desktop-v0.1.0").publish, true);
    git("tag", "0.1.0");
    assert.equal(releasePlan("0.1.1").publish, false);
  } finally {
    process.chdir(original);
    rmSync(repo, { recursive: true, force: true });
  }
});
