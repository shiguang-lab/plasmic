import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { MODE_REFERENCES, releaseId, sha256 } from "../packages/plasmic-cli/src/protocol.mjs";
import { collectRelease, publishGitHubRelease } from "./github-release.mjs";

async function fixture(t, products) {
  const root = await mkdtemp(path.join(tmpdir(), "github-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plan = { tag: "1.2.3", publish: true, ...products };
  const put = async (name, content) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  const base = "release-artifacts/";
  if (plan.cli) await put(base + "plasmic-cli/plasmic-cli.tgz", "CLI");
  if (plan.desktop) {
    await put("desktop/release-notes/1.2.3.md", "Desktop fixes");
    await put(base + "desktop-distribution/latest.json", JSON.stringify({ version: plan.tag }));
    for (const [platform, arch, manifest] of [["darwin", "arm64", "latest-mac.yml"], ["darwin", "x64", "latest-mac.yml"], ["win32", "x64", "latest.yml"], ["linux", "x64", "latest-linux.yml"]]) {
      await put(base + `${platform}-${arch}/Plasmic-1.2.3-${platform}-${arch}.zip`, "installer");
      await put(base + `${platform}-${arch}/Plasmic-1.2.3-${platform}-${arch}.zip.blockmap`, "blockmap");
      await put(base + `${platform}-${arch}/${manifest}`, "original manifest");
      await put(base + `desktop-distribution/${platform}/${arch}/${manifest}`, `localized ${arch}`);
    }
  }
  if (plan.resources) {
    const files = [...new Set(["references/guide.md", "references/desktop-mcp.md", "references/inspect.md", "references/prototype.md", "references/codegen.md", ...Object.values(MODE_REFERENCES).flat()])].map((name) => ({ path: name, content: "reference" }));
    const resources = gzipSync(JSON.stringify({ schemaVersion: 1, files }));
    const cli = Buffer.from("CLI");
    const manifest = {
      schemaVersion: 1, version: plan.tag, cliVersion: "1.2.2", minCliVersion: "0.0.59",
      entrypoints: Object.fromEntries(["guide", "inspect", "prototype", "codegen"].map((mode) => [mode, `references/${mode}.md`])),
      files: files.map((file) => ({ path: file.path, size: Buffer.byteLength(file.content), sha256: sha256(file.content) })),
      artifacts: {
        cli: { file: "plasmic-cli.tgz", size: cli.length, sha256: sha256(cli) },
        resources: { file: "resources.json.gz", size: resources.length, sha256: sha256(resources) },
      },
    };
    manifest.releaseId = releaseId(manifest);
    const directory = base + `plasmic-resources-${plan.tag}/`;
    await put(directory + "latest.json", JSON.stringify(manifest));
    await put(directory + `releases/${manifest.releaseId}/manifest.json`, JSON.stringify(manifest));
    await put(directory + `releases/${manifest.releaseId}/plasmic-cli.tgz`, cli);
    await put(directory + `releases/${manifest.releaseId}/resources.json.gz`, resources);
  }
  return { root, plan, repository: "example/plasmic" };
}

function github({ failOnce = false, wrongDigest = false, existing } = {}) {
  const calls = [];
  let release = existing;
  const run = async (args) => {
    calls.push(args);
    if (args[0] === "api") {
      if (!release) throw Object.assign(new Error("Not found"), { stderr: "HTTP 404" });
      return JSON.stringify(release);
    }
    if (args[1] === "create") release = { draft: true, assets: [], html_url: "https://github.com/example/plasmic/releases/tag/1.2.3" };
    if (args[1] === "upload") {
      for (const file of args.slice(args.indexOf("--clobber") + 1)) {
        const name = path.basename(file);
        const asset = { name, size: (await stat(file)).size, digest: "sha256:" + createHash("sha256").update(await readFile(file)).digest("hex"), state: "uploaded" };
        if (wrongDigest) asset.digest = "sha256:wrong";
        release.assets = release.assets.filter((entry) => entry.name !== name).concat(asset);
        if (failOnce) { failOnce = false; throw new Error("Upload interrupted"); }
      }
    }
    if (args[1] === "edit") release.draft = false;
    return "";
  };
  return { calls, run, release: () => release };
}

test("full release collects only selected public artifacts, preserves both Mac feeds and includes resources once", async (t) => {
  const options = await fixture(t, { studio: true, desktop: true, cli: true, resources: true });
  const { assets, notes } = await collectRelease(options.plan, options.root);
  const names = assets.map((asset) => asset.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.filter((name) => name === "plasmic-cli.tgz").length, 1);
  for (const name of ["desktop-latest.json", "plasmic-latest.json", "plasmic-manifest.json", "resources.json.gz", "latest-mac-arm64.yml", "latest-mac-x64.yml", "latest.yml", "latest-linux.yml"]) assert.ok(names.includes(name), name);
  assert.equal(names.filter((name) => name.endsWith(".blockmap")).length, 4);
  for (const arch of ["arm64", "x64"]) assert.equal(await readFile(assets.find((asset) => asset.name === `latest-mac-${arch}.yml`).file, "utf8"), `localized ${arch}`);
  assert.match(notes, /plasmic-server:1.2.3/);
  assert.match(notes, /Desktop fixes/);
});

test("resource-only release neither requires nor uploads Desktop/Studio artifacts", async (t) => {
  const options = await fixture(t, { resources: true });
  const { assets, notes } = await collectRelease(options.plan, options.root);
  assert.deepEqual(assets.map((asset) => asset.name), ["plasmic-latest.json", "plasmic-manifest.json", "plasmic-cli.tgz", "resources.json.gz"]);
  assert.doesNotMatch(notes, /Studio images|Desktop/);
});

test("interrupted uploads stay draft; retry reuses verified assets before publishing", async (t) => {
  const options = await fixture(t, { resources: true });
  const remote = github({ failOnce: true });
  await assert.rejects(publishGitHubRelease(options, remote.run), /Upload interrupted/);
  assert.equal(remote.release().draft, true);
  assert.equal(remote.calls.some((args) => args[1] === "edit"), false);
  const result = await publishGitHubRelease(options, remote.run);
  assert.equal(result.assets.length, 4);
  assert.equal(remote.release().draft, false);
  assert.equal(remote.calls.filter((args) => args[1] === "create").length, 1);
  const uploads = remote.calls.filter((args) => args[1] === "upload");
  assert.equal(uploads[1].some((value) => value.endsWith("/plasmic-latest.json")), false);
});

test("published assets are immutable unless explicitly rebuilding; corrupt uploads never become public", async (t) => {
  const options = await fixture(t, { cli: true });
  const remote = github();
  await publishGitHubRelease(options, remote.run);
  const before = remote.calls.length;
  await publishGitHubRelease(options, remote.run);
  assert.equal(remote.calls.slice(before).some((args) => args[0] === "release"), false);
  remote.release().assets[0].digest = "sha256:different";
  await assert.rejects(publishGitHubRelease(options, remote.run), /Published asset differs/);
  await publishGitHubRelease({ ...options, rebuild: true }, remote.run);
  const corrupt = github({ wrongDigest: true });
  await assert.rejects(publishGitHubRelease(options, corrupt.run), /verification failed/);
  assert.equal(corrupt.release().draft, true);
});

test("unchanged patches create no release; Studio-only releases need no download artifacts", async (t) => {
  const options = await fixture(t, { studio: true });
  assert.deepEqual(await publishGitHubRelease({ ...options, plan: { ...options.plan, publish: false } }, () => { throw new Error("Unexpected GitHub call"); }), { skipped: true });
  const remote = github();
  const result = await publishGitHubRelease(options, remote.run);
  assert.deepEqual(result.assets, []);
  assert.equal(remote.release().draft, false);
});
