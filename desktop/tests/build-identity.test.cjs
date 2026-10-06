const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

test("Studio provenance detects stale sources and tampered assets and preserves the actual build revision", async () => {
  const { hashFiles, sourceIdentity, readStudioBuild } =
    await import("../../scripts/build-identity.mjs");
  const repo = await fs.mkdtemp(
    path.join(os.tmpdir(), "studio-provenance-test-"),
  );
  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  try {
    await fs.writeFile(path.join(repo, ".gitignore"), "build/\n");
    const source = path.join(repo, "source.js");
    await fs.writeFile(source, "first source");
    git("init", "-q");
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.test",
      "commit",
      "-qm",
      "initial",
    );
    const identity = await sourceIdentity(repo);
    const build = path.join(repo, "build");
    await fs.mkdir(build);
    const asset = path.join(build, "studio.js");
    await fs.writeFile(asset, "compiled source");
    const provenance = {
      ...identity,
      builtAt: "2026-10-06T00:00:00.000Z",
      artifactHash: await hashFiles(build, ["."], ["studio-build.json"]),
    };
    await fs.writeFile(
      path.join(build, "studio-build.json"),
      JSON.stringify(provenance),
    );
    assert.deepEqual(await readStudioBuild(build, repo), provenance);
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.test",
      "commit",
      "--allow-empty",
      "-qm",
      "new revision",
    );
    assert.notEqual(git("rev-parse", "HEAD"), identity.revision);
    assert.equal(
      (await readStudioBuild(build, repo)).revision,
      identity.revision,
    );
    await fs.writeFile(source, "second source");
    await assert.rejects(readStudioBuild(build, repo), /sources changed/);
    await fs.writeFile(source, "first source");
    await fs.writeFile(
      path.join(repo, "new-source.js"),
      "new untracked source",
    );
    await assert.rejects(readStudioBuild(build, repo), /sources changed/);
    await fs.rm(path.join(repo, "new-source.js"));
    await fs.rm(source);
    await assert.rejects(readStudioBuild(build, repo), /sources changed/);
    await fs.writeFile(source, "first source");
    await fs.writeFile(asset, "other compiled source");
    await assert.rejects(readStudioBuild(build, repo), /assets changed/);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
