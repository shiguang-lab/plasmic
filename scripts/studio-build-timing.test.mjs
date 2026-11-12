import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = new URL("./studio-build-timing.mjs", import.meta.url);
const vertex = (target, cached) => ({
  name: `[${target} canvas 1/1] RUN NODE_ENV=production node esbuild.js`,
  digest: "sha256:canvas",
  started: "2026-11-12T00:00:00Z",
  completed: "2026-11-12T00:00:10Z",
  cached,
});
const run = (events, args = [], env = {}) => spawnSync(process.execPath, [script.pathname, ...args], {
  input: events.map((event) => JSON.stringify(event)).join("\n"),
  encoding: "utf8", env: { ...process.env, ...env },
});

test("shared BuildKit vertices count once and split package timing logs survive", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "studio-timing-"));
  try {
    const summary = path.join(directory, "summary.md");
    const log = '[canvas-dependency-timing] {"package":"packages/host","seconds":12.34}\n';
    const result = run([
      { vertexes: [vertex("web", false), vertex("server", false)] },
      { logs: [{ vertex: "dependencies", data: Buffer.from(log.slice(0, 30)).toString("base64") }] },
      { logs: [{ vertex: "dependencies", data: Buffer.from(log.slice(30)).toString("base64") }] },
    ], [], { GITHUB_STEP_SUMMARY: summary });
    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(summary, "utf8");
    assert.match(markdown, /\| canvas \| 10.0 \| 0\/1 \|/);
    assert.match(markdown, /\| packages\/host \| 12.3 \|/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("cache verification requires observed Canvas bundling and every step cached", () => {
  assert.equal(run([{ vertexes: [vertex("web", true)] }], ["--require-canvas-cache"]).status, 0);
  assert.notEqual(run([{ vertexes: [vertex("web", false)] }], ["--require-canvas-cache"]).status, 0);
  assert.notEqual(run([], ["--require-canvas-cache"]).status, 0);
  assert.notEqual(run([{ vertexes: [vertex("web", true), {
    ...vertex("web", false), name: "[web canvas-dependencies 1/1] RUN node scripts/build-canvas-dependencies.mjs",
  }] }], ["--require-canvas-cache"]).status, 0);
});
