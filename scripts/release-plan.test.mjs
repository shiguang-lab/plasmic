import assert from "node:assert/strict";
import test from "node:test";
import { affectedProducts, releasePlan } from "./release-plan.mjs";
import { isNewReleaseSeries } from "./release-version.mjs";

test("milestone releases advance the minor or major series", () => {
  assert.equal(isNewReleaseSeries("0.1.0", "0.0.88"), true);
  assert.equal(isNewReleaseSeries("1.0.0", "0.1.9"), true);
  assert.equal(isNewReleaseSeries("0.1.1", "0.1.0"), false);
  assert.equal(isNewReleaseSeries("0.1.0", "0.1.0"), false);
  assert.equal(isNewReleaseSeries("0.0.89", "0.1.0"), false);
});

test("only one numeric release tag starts publication", () => {
  for (const tag of ["v1.2.3", "desktop-v1.2.3", "cli-v1.2.3", "resources-v1.2.3", "1.2.3-beta", "01.2.3"]) {
    assert.throws(() => releasePlan(tag), /Unsupported release tag/);
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

test("unified patches select changed products; minor, major and manual full releases select everything", () => {
  const original = process.cwd();
  const repo = mkdtempSync(path.join(tmpdir(), "release-plan-"));
  const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
  const put = (file, value) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), value);
  };
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Release test", "-c", "user.email=test@example.invalid", "-c", "core.hooksPath=/dev/null", "commit", "-m", "test");
  };
  const desktop = (version, image = version) => {
    put("desktop/package.json", JSON.stringify({ version }));
    put("desktop/package-lock.json", JSON.stringify({ version, packages: { "": { version } } }));
    put("desktop/desktop.config.json", JSON.stringify({ webImage: `ghcr.io/shiguang-lab/plasmic-web:${image}` }));
    put(`desktop/release-notes/${version}.md`, "Update");
    put(`desktop/release-notes/${version}.json`, JSON.stringify(Object.fromEntries(["en", "zh-CN", "zh-TW", "ja", "ko"].map((language) => [language, "Update"]))));
  };
  const selected = (tag, options) => {
    const plan = releasePlan(tag, "HEAD", options);
    return ["studio", "desktop", "cli", "resources"].filter((product) => plan[product]);
  };
  try {
    git("init");
    desktop("1.2.0");
    put("platform/wab/src/wab/client/theme.ts", "old");
    put("ai/plasmic/references/guide.md", "old");
    put("packages/plasmic-cli/src/index.mjs", "old");
    commit();
    git("tag", "1.2.0");
    for (const prefix of ["desktop-v", "cli-v", "resources-v"]) git("tag", prefix + "1.2.0");
    process.chdir(repo);
    assert.equal(releasePlan("1.2.1").publish, false);
    put("platform/wab/src/wab/server/main.ts", "server");
    commit();
    assert.deepEqual(selected("1.2.1"), ["studio"]);
    put("packages/plasmic-cli/src/index.mjs", "unpublished CLI before old numeric tag");
    commit();
    git("tag", "-f", "1.2.0");
    assert.deepEqual(selected("1.2.1"), ["cli", "resources"]);
    assert.equal(releasePlan("1.2.1").baselines.cli, "cli-v1.2.0");
    put("scripts/github-release.mjs", "unified publisher");
    put("platform/wab/src/wab/server/main.ts", "updated server");
    commit();
    assert.deepEqual(selected("1.2.1"), ["studio", "cli", "resources"]);
    git("tag", "1.2.1");
    put("packages/plasmic-cli/src/index.mjs", "new CLI");
    commit();
    assert.deepEqual(selected("1.2.2"), ["cli", "resources"]);
    git("tag", "1.2.2");
    put("ai/plasmic/references/guide.md", "new resource");
    commit();
    assert.deepEqual(selected("1.2.3"), ["resources"]);
    git("tag", "1.2.3");
    put("desktop/src/main.cjs", "new Desktop");
    desktop("1.2.4", "1.2.1");
    commit();
    assert.deepEqual(selected("1.2.4"), ["desktop"]);
    git("tag", "1.2.4");
    put("platform/wab/src/wab/client/theme.ts", "new frontend");
    commit();
    assert.throws(() => releasePlan("1.2.5"), /Desktop release requires/);
    desktop("1.2.5");
    commit();
    assert.deepEqual(selected("1.2.5"), ["studio", "desktop"]);
    git("tag", "1.2.5");
    assert.throws(() => releasePlan("1.3.0"), /Desktop release requires/);
    for (const tag of ["1.3.0", "2.0.0"]) {
      desktop(tag);
      commit();
      assert.deepEqual(selected(tag), ["studio", "desktop", "cli", "resources"]);
      assert.equal(releasePlan(tag).full, true);
      git("tag", tag);
    }
    assert.equal(releasePlan("2.0.1").publish, false);
    desktop("2.0.1");
    commit();
    assert.deepEqual(selected("2.0.1", { forceAll: true }), ["studio", "desktop", "cli", "resources"]);
    assert.equal(releasePlan("2.0.1", "HEAD", { forceAll: true }).full, true);
    git("tag", "2.0.1");
    put("ai/plasmic/references/guide.md", "independently released resource");
    commit();
    git("tag", "resources-v2.0.2");
    assert.deepEqual(selected("2.0.2"), []);
    assert.equal(releasePlan("2.0.2").baselines.resources, "resources-v2.0.2");
    put("ai/plasmic/references/guide.md", "unreleased resource");
    commit();
    assert.deepEqual(selected("2.0.2"), ["resources"]);
    git("tag", "2.0.2");
    assert.equal(releasePlan("2.0.3").baselines.resources, "2.0.2");
    assert.equal(releasePlan("2.0.3").publish, false);
  } finally {
    process.chdir(original);
    rmSync(repo, { recursive: true, force: true });
  }
});
