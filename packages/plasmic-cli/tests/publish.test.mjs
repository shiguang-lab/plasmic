import { execFileSync } from "node:child_process";
import { inspectCliArtifact } from "../../../scripts/plasmic-cli-artifact.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildCli, buildResources } from "../../../scripts/build-plasmic-resources.mjs";
import { prepareRelease, publishCli, releaseVersion } from "../scripts/publish.mjs";
import { compareVersions } from "../src/protocol.mjs";

test("only stable repository version tags release the CLI", () => {
  assert.equal(releaseVersion("0.0.35"), "0.0.35");
  for (const tag of [undefined, "cli-v0.0.35", "v0.0.35", "0.0.35-beta.1", "01.0.1", "0.0.1;exit"]) assert.throws(() => releaseVersion(tag));
  assert.equal(compareVersions("0.0.10", "0.0.9"), 1);
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareVersions("0.0.34", "0.0.35"), -1);
  assert.equal(compareVersions("0.0.35", "0.0.35"), 0);
});
test("npm release checks tag, registry versions and integrity before publishing or skipping", async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-publish-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const built = await buildResources(temporary, "0.0.59", { cliVersion: "0.0.59" });
  const bytes = await readFile(path.join(built.directory, "plasmic-cli.tgz"));
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
  const calls = [];
  let registry = null, status = 404;
  const options = {
    directory: built.directory, tag: "0.0.59",
    fetchRelease: async () => ({ ok: status === 200, status, json: async () => registry }),
    runNpm: (args) => { calls.push(args); return "dry run"; },
    waitForPropagation: async () => {},
  };
  const dryRun = await publishCli(options);
  assert.equal(dryRun.mode, "dry-run");
  assert.ok(calls[0].includes("--dry-run"));
  await assert.rejects(publishCli({ ...options, tag: "0.0.60" }), /does not match/);
  status = 200;
  registry = { "dist-tags": { latest: "0.0.59" }, versions: { "0.0.59": { dist: { integrity } } } };
  assert.equal((await publishCli({ ...options, execute: true })).skipped, true);
  assert.equal(calls.length, 1);
  registry.versions["0.0.59"].dist.integrity = "sha512-wrong";
  await assert.rejects(publishCli(options), /different artifact bytes/);
  registry = { "dist-tags": { latest: "0.0.60" }, versions: {} };
  await assert.rejects(publishCli(options), /npm latest is 0.0.60/);
  status = 401;
  await assert.rejects(publishCli(options), /HTTP 401/);
  status = 404;
  options.runNpm = (args) => {
    calls.push(args);
    registry = { "dist-tags": { latest: "0.0.59" }, versions: { "0.0.59": { dist: { integrity } } } };
    status = 200;
    return "published";
  };
  assert.equal((await publishCli({ ...options, execute: true })).mode, "execute");
  assert.ok(!calls[1].includes("--dry-run"));
  let fetches = 0, waits = 0;
  assert.equal((await publishCli({ ...options, execute: true,
    fetchRelease: async () => (++fetches < 4 ? { ok: false, status: 404 } : { ok: true, status: 200, json: async () => registry }),
    waitForPropagation: async () => { waits++; },
  })).mode, "execute");
  assert.equal(waits, 2);
  status = 404;
  options.runNpm = () => { status = 200; registry = { "dist-tags": { latest: "0.0.59" }, versions: {} }; return "published"; };
  await assert.rejects(publishCli({ ...options, execute: true }), /integrity or latest version mismatch/);
});

async function registryFixture(t, bytes, version = "0.0.60") {
  const output = await mkdtemp(path.join(tmpdir(), "plasmic-release-test-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const tarball = "https://registry.npmjs.org/@plasmickit/cli/-/cli.tgz";
  const metadata = {
    "dist-tags": { latest: version },
    versions: { [version]: { dist: {
      tarball,
      integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64"),
    } } },
  };
  const fetchRelease = async (url) => String(url) === tarball
    ? { ok: true, arrayBuffer: async () => bytes }
    : { ok: true, json: async () => metadata };
  return { output, metadata, fetchRelease };
}

test("resource-only releases reuse the published CLI version and exact bytes, with no npm publish", async (t) => {
  const bytes = await buildCli("0.0.60");
  const options = await registryFixture(t, bytes);
  const first = await prepareRelease({ ...options, tag: "0.0.82" });
  const second = await prepareRelease({ ...options, tag: "0.0.83" });
  assert.equal(second.manifest.version, "0.0.83");
  assert.equal(second.manifest.cliVersion, "0.0.60");
  assert.notEqual(first.manifest.releaseId, second.manifest.releaseId);
  assert.deepEqual(first.manifest.artifacts.cli, second.manifest.artifacts.cli);
  assert.deepEqual(await readFile(path.join(second.directory, "plasmic-cli.tgz")), bytes);
  const result = await publishCli({
    directory: second.directory, tag: "0.0.83", execute: true,
    fetchRelease: options.fetchRelease,
    runNpm: () => assert.fail("Unchanged CLI must not be published"),
  });
  assert.equal(result.skipped, true);
  assert.equal(result.version, "0.0.60");
});

for (const filename of ["src/index.mjs", "skill/plasmic/SKILL.md"]) {
  test(`changed ${filename} publishes npm independently of the resource version`, async (t) => {
    const bytes = await buildCli("0.0.60");
    const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-old-cli-test-"));
    t.after(() => rm(temporary, { recursive: true, force: true }));
    const archive = path.join(temporary, "cli.tgz");
    await writeFile(archive, bytes);
    execFileSync("tar", ["-xzf", archive, "-C", temporary]);
    const target = path.join(temporary, "package", filename);
    await writeFile(target, (await readFile(target, "utf8")) + "\nPrevious published content\n");
    const npm = process.platform === "win32" ? process.execPath : "npm";
    const npmArgs = process.platform === "win32"
      ? [process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")]
      : [];
    const packed = execFileSync(npm, [...npmArgs, "pack", "--ignore-scripts", "--silent", "--pack-destination", temporary], {
      cwd: path.join(temporary, "package"), encoding: "utf8",
    }).trim();
    const old = await readFile(path.join(temporary, packed));
    assert.notEqual((await inspectCliArtifact(old)).contentHash, (await inspectCliArtifact(bytes)).contentHash);
    const options = await registryFixture(t, old);
    const built = await prepareRelease({ ...options, tag: "0.0.82" });
    assert.equal(built.manifest.cliVersion, "0.0.82");
    let calls = 0;
    const result = await publishCli({ directory: built.directory, tag: "0.0.82", fetchRelease: options.fetchRelease,
      runNpm: (args) => { calls++; assert.ok(args.includes("publish")); return "dry run"; },
    });
    assert.equal(calls, 1);
    assert.equal(result.skipped, false);
    assert.equal(result.version, "0.0.82");
    await assert.rejects(prepareRelease({ ...options, tag: "0.0.60" }), /requires a version newer/);
  });
}

test("release comparison ignores package version but verifies downloaded npm integrity", async (t) => {
  const first = await buildCli("0.0.60");
  const second = await buildCli("0.0.82");
  assert.equal((await inspectCliArtifact(first)).contentHash, (await inspectCliArtifact(second)).contentHash);
  const options = await registryFixture(t, first);
  options.metadata.versions["0.0.60"].dist.integrity = "sha512-wrong";
  await assert.rejects(prepareRelease({ ...options, tag: "0.0.82" }), /integrity mismatch/);
});
