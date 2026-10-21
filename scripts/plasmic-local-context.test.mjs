import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile, readlink, readdir, access, lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveLocalContext } from "./plasmic-local-context.mjs";
import { installLocalSkill } from "./install-local-plasmic-skill.mjs";

test("local resolution creates searchable stable snapshots and picks up the latest source on the next resolve", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "plasmic-local-context-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "references/workflows"), { recursive: true });
  await mkdir(path.join(root, "scripts"));
  for (const name of ["guide.md", "desktop-mcp.md", "workflows/prototype.md"]) await writeFile(path.join(root, "references", name), name);
  await mkdir(path.join(root, "evals"));
  await writeFile(path.join(root, "evals/answer.json"), "Historical answer");
  await writeFile(path.join(root, "scripts/test_private.py"), "Test fixture");
  const cache = path.join(root, "cache");
  const before = await resolveLocalContext("prototype", root, cache);
  await writeFile(path.join(root, "references/guide.md"), "Updated local source");
  assert.equal(await readFile(before.referencePath, "utf8"), "guide.md");
  const after = await resolveLocalContext("prototype", root, cache);
  assert.notEqual(before.resourceHash, after.resourceHash);
  assert.notEqual(before.resourceRoot, after.resourceRoot);
  assert.equal(await readFile(after.referencePath, "utf8"), "Updated local source");
  assert.equal((await lstat(after.referencePath)).isSymbolicLink(), false);
  assert.match(execFileSync("grep", ["-r", "Updated local source", path.join(after.resourceRoot, "references")], { encoding: "utf8" }), /Updated local source/);
  assert.equal(after.source, "local");
  assert.notEqual(after.resourceRoot, root);
  assert.deepEqual((await readdir(after.resourceRoot)).sort(), ["references"]);
  await assert.rejects(access(path.join(after.resourceRoot, "evals/answer.json")), /ENOENT/);
  await assert.rejects(access(path.join(after.resourceRoot, "scripts/test_private.py")), /ENOENT/);
  await writeFile(path.join(root, "references/new.md"), "New reference");
  const added = await resolveLocalContext("prototype", root, cache);
  assert.equal(await readFile(path.join(added.resourceRoot, "references/new.md"), "utf8"), "New reference");
  await assert.rejects(access(path.join(after.resourceRoot, "references/new.md")), /ENOENT/);
  await rm(path.join(root, "references/new.md"));
  const removed = await resolveLocalContext("prototype", root, cache);
  await assert.rejects(access(path.join(removed.resourceRoot, "references/new.md")), /ENOENT/);
  assert.equal(await readFile(path.join(added.resourceRoot, "references/new.md"), "utf8"), "New reference");
  await assert.rejects(resolveLocalContext("unknown", root, cache), /--mode/);
  await assert.rejects(resolveLocalContext("codegen", root, cache), /ENOENT/);
  assert.equal((await resolveLocalContext("codegen")).mustRead.length, 6);
});

test("local skill installation links the canonical entry and resources and is idempotent", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "plasmic-local-skill-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "skills/plasmic");
  assert.equal((await installLocalSkill(target)).status, "installed");
  const context = await resolveLocalContext("prototype");
  assert.equal(await readlink(path.join(target, "references")), path.join(context.resourceRoot, "references"));
  assert.match(await readFile(path.join(target, "SKILL.md"), "utf8"), /local-source.json/);
  assert.equal((await installLocalSkill(target)).status, "unchanged");
});

