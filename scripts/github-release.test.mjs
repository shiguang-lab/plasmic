import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { sha256 } from "../packages/plasmic-cli/src/protocol.mjs";
import { collectRelease, publishGitHubRelease } from "./github-release.mjs";
import {
  DESKTOP_FEEDS,
  RESOURCE_RELEASE,
  resourceAssetName,
} from "./release-download-contract.mjs";
import { fixture, githubFixture } from "./test-fixtures/github-release.mjs";

test("full release collects only selected public artifacts, preserves both Mac feeds and includes resources once", async (t) => {
  const options = await fixture(t, {
    studio: true,
    desktop: true,
    cli: true,
    resources: true,
  });
  const { assets, notes } = await collectRelease(options.plan, options.root);
  const names = assets.map((asset) => asset.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.filter((name) => name === "plasmic-cli.tgz").length, 1);
  for (const name of [
    "desktop-latest.json",
    "plasmic-latest.json",
    "plasmic-manifest.json",
    "resources.json.gz",
    "latest-mac-arm64.yml",
    "latest-mac-x64.yml",
    "latest.yml",
    "latest-linux.yml",
  ])
    assert.ok(names.includes(name), name);
  assert.equal(names.filter((name) => name.endsWith(".blockmap")).length, 4);
  for (const arch of ["arm64", "x64"])
    assert.equal(
      await readFile(
        assets.find((asset) => asset.name === `latest-mac-${arch}.yml`).file,
        "utf8",
      ),
      `version: ${options.plan.tag}\n# localized ${arch}`,
    );
  assert.match(notes, /plasmic-server:1.2.3/);
  assert.match(notes, /Desktop fixes/);
});

test("resource-only release neither requires nor uploads Desktop/Studio artifacts", async (t) => {
  const options = await fixture(t, { resources: true });
  const { assets, notes } = await collectRelease(options.plan, options.root);
  assert.deepEqual(
    assets.map((asset) => asset.name),
    [
      "plasmic-latest.json",
      "plasmic-manifest.json",
      "plasmic-cli.tgz",
      "resources.json.gz",
    ],
  );
  assert.doesNotMatch(notes, /Studio images|Desktop/);
});

for (const products of [
  { resources: true },
  { desktop: true },
  { studio: true },
]) {
  test(`${Object.keys(products)[0]}-only release publishes six consistent feeds and reuses unchanged bytes`, async (t) => {
    const options = await fixture(t, products),
      remote = await githubFixture(t);
    const result = await publishGitHubRelease(options, remote.run);
    for (const name of [...Object.values(DESKTOP_FEEDS), "plasmic-latest.json"])
      assert.ok(result.assets.includes(name), name);
    assert.equal(remote.latest(), "1.2.3");
    assert.equal(remote.release().draft, false);
    for (const name of Object.values(DESKTOP_FEEDS)) {
      if (!products.desktop)
        assert.deepEqual(
          remote.bodies.get(`1.2.3/${name}`),
          remote.bodies.get(`1.2.2/${name}`),
        );
    }
    if (!products.resources)
      assert.deepEqual(
        remote.bodies.get("1.2.3/plasmic-latest.json"),
        remote.bodies.get("1.2.2/plasmic-latest.json"),
      );
    if (!products.desktop)
      assert.equal(
        result.assets.some((name) => name.startsWith("Plasmic-")),
        false,
      );
    for (const call of remote.calls.filter((call) => call[1] === "download"))
      assert.ok(!call[call.indexOf("--pattern") + 1].startsWith("Plasmic-"));
    assert.equal(remote.release(RESOURCE_RELEASE).draft, false);
    for (const tag of ["1.2.2", ...(products.resources ? ["1.2.3"] : [])]) {
      const manifest = JSON.parse(
        remote.bodies.get(`${tag}/plasmic-manifest.json`),
      );
      for (const name of [
        "manifest.json",
        "plasmic-cli.tgz",
        "resources.json.gz",
      ])
        assert.ok(
          remote
            .release(RESOURCE_RELEASE)
            .assets.some(
              (asset) =>
                asset.name === resourceAssetName(manifest.releaseId, name),
            ),
        );
    }
  });
}

test("first full release publishes all feeds and immutable resource files before latest", async (t) => {
  const options = await fixture(t, {
      studio: true,
      desktop: true,
      resources: true,
    }),
    remote = await githubFixture(t, { seed: false });
  await publishGitHubRelease(options, remote.run);
  assert.equal(remote.latest(), "1.2.3");
  const edits = remote.calls.filter((call) => call[1] === "edit");
  assert.equal(edits[0][2], RESOURCE_RELEASE);
  assert.ok(edits[0].includes("--latest=false"));
  assert.equal(edits.at(-1)[2], "1.2.3");
  assert.ok(edits.at(-1).includes("--latest"));
  const poolCreate = remote.calls.find(
    (call) => call[1] === "create" && call[2] === RESOURCE_RELEASE,
  );
  assert.equal(poolCreate[poolCreate.indexOf("--target") + 1], "1".repeat(40));
});

test("interrupted uploads stay draft and retries reuse verified files", async (t) => {
  const options = await fixture(t, { resources: true }),
    remote = await githubFixture(t, { failOnce: true });
  await assert.rejects(
    publishGitHubRelease(options, remote.run),
    /Upload interrupted/,
  );
  assert.equal(remote.release().draft, true);
  assert.equal(remote.latest(), "1.2.2");
  const first = remote.calls.find((call) => call[1] === "upload");
  const firstFile = first[first.indexOf("--clobber") + 1];
  await publishGitHubRelease(options, remote.run);
  assert.equal(remote.latest(), "1.2.3");
  assert.equal(
    remote.calls
      .filter((call) => call[1] === "upload")
      .flatMap((call) => call.slice(call.indexOf("--clobber") + 1))
      .filter((file) => path.basename(file) === path.basename(firstFile))
      .length,
    1,
  );
});

test("published numeric assets are immutable unless rebuilding; resource hashes are always immutable", async (t) => {
  const options = await fixture(t, { desktop: true }),
    remote = await githubFixture(t);
  await publishGitHubRelease(options, remote.run);
  let before = remote.calls.length;
  await publishGitHubRelease(options, remote.run);
  assert.equal(
    remote.calls
      .slice(before)
      .some((call) => ["upload", "create", "edit"].includes(call[1])),
    false,
  );
  const installer = remote
    .release()
    .assets.find((asset) => asset.name.startsWith("Plasmic-"));
  installer.digest = "sha256:wrong";
  await assert.rejects(
    publishGitHubRelease(options, remote.run),
    /Published asset differs/,
  );
  await publishGitHubRelease({ ...options, rebuild: true }, remote.run);
  const immutable = remote
    .release(RESOURCE_RELEASE)
    .assets.find((asset) => asset.name.endsWith("resources.json.gz"));
  immutable.digest = "sha256:wrong";
  await assert.rejects(
    publishGitHubRelease({ ...options, rebuild: true }, remote.run),
    /Published asset differs/,
  );
});

test("corrupt uploads or carried downloads cannot advance latest", async (t) => {
  const options = await fixture(t, { resources: true }),
    remote = await githubFixture(t, { wrongDigest: true });
  await assert.rejects(
    publishGitHubRelease(options, remote.run),
    /verification failed/,
  );
  assert.equal(remote.release().draft, true);
  assert.equal(remote.latest(), "1.2.2");
  const broken = await githubFixture(t);
  broken.bodies.set("1.2.2/latest.yml", Buffer.from("corrupt"));
  await assert.rejects(
    publishGitHubRelease(options, broken.run),
    /download verification failed/,
  );
  assert.equal(broken.latest(), "1.2.2");
});

test("missing prior products and mismatched platform versions fail without inventing feeds", async (t) => {
  const options = await fixture(t, { resources: true }),
    empty = await githubFixture(t, { seed: false });
  await assert.rejects(
    publishGitHubRelease(options, empty.run),
    /No published feed group/,
  );
  const broken = await githubFixture(t);
  const bytes = Buffer.from("version: 1.2.0\n");
  broken.bodies.set("1.2.2/latest.yml", bytes);
  Object.assign(
    broken.release("1.2.2").assets.find((asset) => asset.name === "latest.yml"),
    { size: bytes.length, digest: "sha256:" + sha256(bytes) },
  );
  await assert.rejects(
    publishGitHubRelease(options, broken.run),
    /feed versions differ/,
  );
  assert.equal(broken.latest(), "1.2.2");
});

test("unchanged patches do nothing; an older release cannot replace latest", async (t) => {
  const options = await fixture(t, { studio: true });
  assert.deepEqual(
    await publishGitHubRelease(
      { ...options, plan: { ...options.plan, publish: false } },
      () => {
        throw new Error("Unexpected call");
      },
    ),
    { skipped: true },
  );
  const old = await fixture(t, { studio: true }, "1.2.1"),
    remote = await githubFixture(t);
  await assert.rejects(
    publishGitHubRelease(old, remote.run),
    /refusing to downgrade/,
  );
  assert.equal(
    remote.calls.some((call) => ["create", "upload", "edit"].includes(call[1])),
    false,
  );
});

test("existing drafts are inspected by release ID rather than the published-tag endpoint", async (t) => {
  const options = await fixture(t, { resources: true }),
    remote = await githubFixture(t, { existing: { draft: true } });
  await publishGitHubRelease(options, remote.run);
  assert.equal(remote.release().draft, false);
  assert.equal(
    remote.calls.some((call) => call[1] === "create" && call[2] === "1.2.3"),
    false,
  );
  for (const call of remote.calls.filter(
    (call) =>
      call[0] === "api" &&
      !call.includes("--paginate") &&
      !call.includes("--jq"),
  ))
    assert.match(call[1], /\/releases\/\d+$/);
});

test("bootstrapping a published Desktop release adds the missing resource feed without replacing installers", async (t) => {
  const options = await fixture(t, { desktop: true });
  const { assets } = await collectRelease(options.plan, options.root);
  const remote = await githubFixture(t, { existing: { assets } });
  for (const asset of remote.release().assets) {
    asset.state = "uploaded";
    remote.bodies.set(`1.2.3/${asset.name}`, await readFile(asset.file));
  }
  await remote.run(["release", "edit", "1.2.3", "--latest"]);
  const before = remote.calls.length;
  await publishGitHubRelease(options, remote.run);
  const uploaded = remote.calls
    .slice(before)
    .filter((call) => call[1] === "upload" && call[2] === "1.2.3");
  assert.equal(uploaded.length, 1);
  assert.deepEqual(
    uploaded[0]
      .slice(uploaded[0].indexOf("--clobber") + 1)
      .map((file) => path.basename(file)),
    ["plasmic-latest.json"],
  );
  assert.deepEqual(
    remote.bodies.get("1.2.3/plasmic-latest.json"),
    remote.bodies.get("1.2.2/plasmic-latest.json"),
  );
  assert.equal(remote.latest(), "1.2.3");
  assert.equal(remote.release(RESOURCE_RELEASE).draft, false);
});

test("a numeric upload failure after resources become public still preserves latest", async (t) => {
  for (const corrupt of [false, true]) {
    const options = await fixture(t, { desktop: true });
    const remote = await githubFixture(t);
    const fail = async (args) => {
      const result = await remote.run(args);
      if (args[1] === "upload" && args[2] === options.plan.tag) {
        if (corrupt) remote.release().assets[0].digest = "sha256:corrupt";
        else throw new Error("Numeric upload interrupted");
      }
      return result;
    };
    await assert.rejects(
      publishGitHubRelease(options, fail),
      /Numeric upload interrupted|upload verification failed/,
    );
    assert.equal(remote.release(RESOURCE_RELEASE).draft, false);
    assert.equal(remote.release().draft, true);
    assert.equal(remote.latest(), "1.2.2");
    await publishGitHubRelease(options, remote.run);
    assert.equal(remote.latest(), "1.2.3");
  }
});
