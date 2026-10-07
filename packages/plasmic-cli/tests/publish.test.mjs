import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildResources } from "../../../scripts/build-plasmic-resources.mjs";
import { publishCli, releaseVersion } from "../scripts/publish.mjs";
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
  const built = await buildResources(temporary, "0.0.35");
  const bytes = await readFile(path.join(built.directory, "plasmic-cli.tgz"));
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
  const calls = [];
  let registry = null, status = 404;
  const options = {
    directory: built.directory, tag: "0.0.35",
    fetchRelease: async () => ({ ok: status === 200, status, json: async () => registry }),
    runNpm: (args) => { calls.push(args); return "dry run"; },
    waitForPropagation: async () => {},
  };
  const dryRun = await publishCli(options);
  assert.equal(dryRun.mode, "dry-run");
  assert.ok(calls[0].includes("--dry-run"));
  await assert.rejects(publishCli({ ...options, tag: "0.0.36" }), /does not match/);
  status = 200;
  registry = { "dist-tags": { latest: "0.0.35" }, versions: { "0.0.35": { dist: { integrity } } } };
  assert.equal((await publishCli({ ...options, execute: true })).skipped, true);
  assert.equal(calls.length, 1);
  registry.versions["0.0.35"].dist.integrity = "sha512-wrong";
  await assert.rejects(publishCli(options), /different artifact bytes/);
  registry = { "dist-tags": { latest: "0.0.36" }, versions: {} };
  await assert.rejects(publishCli(options), /npm latest is 0.0.36/);
  status = 401;
  await assert.rejects(publishCli(options), /HTTP 401/);
  status = 404;
  options.runNpm = (args) => {
    calls.push(args);
    registry = { "dist-tags": { latest: "0.0.35" }, versions: { "0.0.35": { dist: { integrity } } } };
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
  options.runNpm = () => { status = 200; registry = { "dist-tags": { latest: "0.0.35" }, versions: {} }; return "published"; };
  await assert.rejects(publishCli({ ...options, execute: true }), /integrity or latest version mismatch/);
});
