import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { buildResources } from "../../../scripts/build-plasmic-resources.mjs";
import { checkCliVersion, checkReferences, referencePath, resolveContext, updateReferences } from "../src/references.mjs";
import { CLI_VERSION, CODEGEN_REFERENCES, releaseId, sha256, validateManifest } from "../src/protocol.mjs";

const run = promisify(execFile);
function fixture(text = "first release") {
  const files = ["guide", "prototype", "codegen", "desktop-mcp"].map((name) => ({ path: `references/${name}.md`, content: text + name }));
  files.push(...CODEGEN_REFERENCES.map((path) => ({ path, content: text + path })));
  const bytes = gzipSync(JSON.stringify({ schemaVersion: 1, files }));
  const manifest = {
    schemaVersion: 1, version: CLI_VERSION, minCliVersion: CLI_VERSION,
    entrypoints: { guide: files[0].path, prototype: files[1].path, codegen: files[2].path },
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.content), size: Buffer.byteLength(file.content) })),
    artifacts: { resources: { file: "resources.json.gz", size: bytes.length, sha256: sha256(bytes) }, cli: { file: "plasmic-cli.tgz", size: 1, sha256: sha256("x") } },
  };
  manifest.releaseId = releaseId(manifest);
  return { bytes, manifest };
}
async function setup(t) {
  const home = await mkdtemp(path.join(tmpdir(), "plasmic-cli-test-"));
  const state = { ...fixture(), requests: [], failure: false, corrupt: false };
  const server = createServer((req, res) => {
    state.requests.push({ path: req.url, cache: req.headers["cache-control"] });
    if (state.failure) { res.writeHead(503).end(); return; }
    if (req.url === "/latest.json") res.end(JSON.stringify(state.manifest));
    else if (req.url === `/releases/${state.manifest.releaseId}/resources.json.gz`) res.end(state.corrupt ? Buffer.from("invalid") : state.bytes);
    else res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); });
  return { home, feed: `http://127.0.0.1:${server.address().port}`, state };
}
test("context checks the feed every task, reuses valid bytes and switches both modes to changed resources", async (t) => {
  const options = await setup(t);
  assert.equal((await checkReferences(options)).updateAvailable, true);
  await assert.rejects(access(path.join(options.home, "current.json")));
  const first = await resolveContext("prototype", options);
  assert.equal(first.updated, true);
  assert.equal(first.mustRead.length, 3);
  assert.ok(first.mustRead.every(path.isAbsolute));
  assert.match(await readFile(first.mustRead[2], "utf8"), /first releaseprototype/);
  const codegen = await resolveContext("codegen", options);
  assert.equal(codegen.updated, false);
  assert.deepEqual(codegen.mustRead.slice(3), CODEGEN_REFERENCES.map((reference) => path.join(codegen.resourceRoot, reference)));
  for (const reference of codegen.mustRead) await access(reference);
  assert.equal((await checkReferences(options)).updateAvailable, false);
  assert.equal(options.state.requests.filter((r) => r.path.endsWith(".gz")).length, 1);
  assert.equal(options.state.requests.filter((r) => r.path.endsWith(".json")).length, 4);
  assert.ok(options.state.requests.filter((r) => r.path.endsWith(".json")).every((r) => r.cache === "no-cache"));
  Object.assign(options.state, fixture("new release"));
  assert.equal((await checkReferences(options)).updateAvailable, true);
  const second = await resolveContext("codegen", options);
  assert.notEqual(second.releaseId, first.releaseId);
  assert.match(await readFile(second.mustRead[2], "utf8"), /new releasecodegen/);
  assert.equal((await referencePath(options)).releaseId, second.releaseId);
  assert.match(await readFile(first.referencePath, "utf8"), /first release/);
});
test("checksum and freshness failures keep the previous verified release without executing stale context", async (t) => {
  const options = await setup(t);
  const first = await updateReferences(options);
  Object.assign(options.state, fixture("next release"), { corrupt: true });
  await assert.rejects(resolveContext("prototype", options), /checksum/);
  assert.equal((await referencePath(options)).releaseId, first.releaseId);
  await assert.rejects(access(path.join(options.home, ".update-lock")));
  options.state.failure = true;
  await assert.rejects(resolveContext("codegen", options), /HTTP 503/);
  assert.equal((await referencePath(options)).freshness, "unchecked");
});
test("changed and missing cached files and corrupt local manifests are repaired from verified downloads", async (t) => {
  const options = await setup(t);
  const first = await updateReferences(options);
  await writeFile(first.referencePath, "corrupt");
  assert.equal((await checkReferences(options)).updateAvailable, true);
  assert.equal((await updateReferences(options)).updated, true);
  await rm(path.join(first.resourceRoot, "references/codegen.md"));
  assert.equal((await updateReferences(options)).updated, true);
  await writeFile(path.join(first.resourceRoot, "manifest.json"), "invalid json");
  assert.equal((await updateReferences(options)).updated, true);
  assert.equal((await referencePath(options)).releaseId, first.releaseId);
});
test("newer required CLI returns the immutable install URL and does not select resources", async (t) => {
  const options = await setup(t);
  options.state.manifest.minCliVersion = "99.0.0";
  options.state.manifest.version = "99.0.0";
  options.state.manifest.releaseId = releaseId(options.state.manifest);
  const status = await checkCliVersion(options);
  assert.equal(status.cliVersion, CLI_VERSION);
  assert.equal(status.latestCliVersion, "99.0.0");
  assert.equal(status.cliUpdateAvailable, true);
  assert.equal(status.cliCompatible, false);
  assert.equal((await checkReferences(options)).cliCompatible, false);
  await assert.rejects(updateReferences(options), (error) => error.message.includes("CLI 99.0.0") && error.cliUrl.endsWith("/plasmic-cli.tgz"));
  await assert.rejects(access(path.join(options.home, "current.json")));
});
test("compatible newer CLI is reported while resources can still update", async (t) => {
  const options = await setup(t);
  options.state.manifest.version = "0.0.35";
  options.state.manifest.releaseId = releaseId(options.state.manifest);
  const status = await checkCliVersion(options);
  assert.equal(status.cliUpdateAvailable, true);
  assert.equal(status.cliCompatible, true);
  const context = await resolveContext("prototype", options);
  assert.equal(context.latestCliVersion, "0.0.35");
  assert.equal(context.cliVersion, CLI_VERSION);
});
test("path traversal, duplicates, manifest tampering and missing entrypoints are rejected", () => {
  for (const mutate of [
    (m) => { m.files[0].path = "references/../../outside.md"; },
    (m) => { m.files.push(m.files[0]); },
    (m) => { m.entrypoints.codegen = "references/missing.md"; },
    (m) => { m.files = m.files.filter((file) => file.path !== CODEGEN_REFERENCES[0]); },
    (m) => { m.artifacts.cli.file = "../outside"; },
  ]) {
    const manifest = fixture().manifest;
    mutate(manifest); manifest.releaseId = releaseId(manifest);
    assert.throws(() => validateManifest(manifest));
  }
  const manifest = fixture().manifest;
  manifest.version = "2.0.0";
  assert.throws(() => validateManifest(manifest), /checksum/);
});
test("built NAS artifacts install a working CLI binary and only the thin skill", async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-pack-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const built = await buildResources(path.join(temporary, "feed"), "0.0.35");
  const repeated = await buildResources(path.join(temporary, "repeat"), "0.0.35");
  assert.equal(built.manifest.releaseId, repeated.manifest.releaseId);
  const archivedFiles = (await run("tar", ["-tzf", path.join(built.directory, "plasmic-cli.tgz")])).stdout.trim().split("\n");
  assert.deepEqual(archivedFiles.filter((name) => name.endsWith("/SKILL.md")), ["package/skill/plasmic/SKILL.md"]);
  const packed = JSON.parse((await run("tar", ["-xOzf", path.join(built.directory, "plasmic-cli.tgz"), "package/package.json"])).stdout);
  assert.equal(packed.name, "@plasmickit/cli");
  assert.deepEqual(packed.bin, { plasmickit: "src/index.mjs" });
  const prefix = path.join(temporary, "prefix");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await run(npm, ["install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", path.join(built.directory, "plasmic-cli.tgz")]);
  const binary = path.join(prefix, process.platform === "win32" ? "plasmickit.cmd" : "bin/plasmickit");
  assert.equal((await run(binary, ["--version"])).stdout.trim(), "0.0.35");
  const skills = path.join(temporary, "skills");
  const installed = JSON.parse((await run(binary, ["skill", "install", "--target", skills])).stdout);
  assert.equal(installed.mode, "bootstrap");
  assert.deepEqual(await readdir(path.join(skills, "plasmic")), ["SKILL.md"]);
  assert.equal(await readFile(installed.skillPath, "utf8"), await readFile(new URL("../skill/plasmic/SKILL.md", import.meta.url), "utf8"));
  assert.ok(built.manifest.files.some((f) => f.path === "scripts/verify_structure.py"));
  assert.ok(built.manifest.files.every((f) => !f.path.includes("test_") && !f.path.includes("SKILL.md")));
  // Read every linked local Markdown reference in the real release, not fixture wording.
  const server = createServer(async (req, res) => {
    try { res.end(await readFile(path.join(built.output, req.url))); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const args = ["--feed", `http://127.0.0.1:${server.address().port}`, "--home", path.join(temporary, "cache")];
  const versions = JSON.parse((await run(binary, ["version", "check", ...args])).stdout);
  assert.equal(versions.cliVersion, "0.0.35");
  assert.equal(versions.latestCliVersion, "0.0.35");
  assert.equal(versions.cliUpdateAvailable, false);
  for (const mode of ["prototype", "codegen"]) {
    const context = JSON.parse((await run(binary, ["context", "resolve", "--mode", mode, ...args])).stdout);
    assert.deepEqual(context.mustRead.map((reference) => path.relative(context.resourceRoot, reference)), [built.manifest.entrypoints.guide, "references/desktop-mcp.md", built.manifest.entrypoints[mode], ...(mode === "codegen" ? CODEGEN_REFERENCES : [])]);
    for (const reference of context.mustRead) await access(reference);
    for (const file of built.manifest.files.filter((f) => f.path.endsWith(".md"))) {
      const absolute = path.join(context.resourceRoot, file.path);
      const text = await readFile(absolute, "utf8");
      for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|#)/.test(match[1])) continue;
        const target = path.resolve(path.dirname(absolute), match[1].split("#")[0]);
        assert.ok(target.startsWith(context.resourceRoot + path.sep), `Reference outside bundle: ${match[1]}`);
        await access(target);
      }
    }
  }
});
