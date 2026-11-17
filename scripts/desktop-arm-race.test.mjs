import assert from "node:assert/strict";
import test from "node:test";
import { cancelRace, dispatchRace, firstInstaller, githubApi, waitForInstaller } from "./desktop-arm-race.mjs";

const sha = "a".repeat(40);
const artifact = (id, runner = "macos-26", extra = {}) => ({
  id, name: `darwin-arm64-${runner}`, expired: false, size_in_bytes: 100,
  created_at: "2026-11-17T00:00:00Z", ...extra,
});

test("dispatch pins application source and reuses the parent's renderer", async () => {
  const calls = [];
  const id = await dispatchRace(async (...args) => {
    calls.push(args);
    return { workflow_run_id: 123 };
  }, {
    workflowRef: "owner/repo/.github/workflows/publish-images.yml@refs/heads/master",
    sourceRef: sha, rendererRunId: "42",
  });
  assert.equal(id, 123);
  assert.deepEqual(calls, [["POST", "/actions/workflows/build-desktop-arm.yml/dispatches", {
    ref: "master", inputs: { "source-ref": sha, "renderer-run-id": "42" },
  }]]);
});

test("rejects mutable application refs before dispatch", async () => {
  await assert.rejects(dispatchRace(() => assert.fail("must not dispatch"), {
    sourceRef: "master", rendererRunId: "42",
  }), /immutable source/);
});

test("only complete candidate uploads can win; selection is deterministic", () => {
  const winner = artifact(2, "macos-15");
  assert.equal(firstInstaller([
    artifact(1, "macos-26", { expired: true }),
    artifact(1, "macos-26", { size_in_bytes: 0 }),
    artifact(1, "macos-26", { name: "session-lifecycle-arm64-macos-26" }),
    artifact(3, "macos-26", { created_at: "2026-11-17T00:01:00Z" }),
    winner,
  ]), winner);
});

for (const runner of ["macos-15", "macos-26"]) {
  test(`${runner} wins without waiting for the other environment to finish`, async () => {
    const winner = artifact(2, runner);
    const result = await waitForInstaller(async (_, endpoint) =>
      endpoint.includes("artifacts?") ? { artifacts: [winner] } : { head_sha: sha, status: "in_progress" },
    123, sha, { pause: () => assert.fail("must not wait for the losing job") });
    assert.equal(result, winner);
  });
}

test("one failed attempt does not prevent the other candidate from winning", async () => {
  let polls = 0;
  const winner = artifact(4, "macos-15");
  const result = await waitForInstaller(async (_, endpoint) => {
    if (endpoint.includes("artifacts?")) return { artifacts: polls++ ? [winner] : [] };
    return { head_sha: sha, status: "in_progress" };
  }, 123, sha, { pause: async () => {} });
  assert.equal(result, winner);
  assert.equal(polls, 2);
});

test("a completed race still accepts its validated artifact even if the other job failed", async () => {
  const winner = artifact(2);
  assert.equal(await waitForInstaller(async (_, endpoint) =>
    endpoint.includes("artifacts?") ? { artifacts: [winner] } : { head_sha: sha, status: "completed", conclusion: "failure" },
  123, sha), winner);
});

test("a newly dispatched run can return artifact 404 before its installer appears", async () => {
  let polls = 0;
  let pauses = 0;
  const winner = artifact(8);
  const api = githubApi({ token: "test-token", repository: "owner/repo" }, async (url) => {
    if (!url.includes("artifacts?")) return Response.json({ head_sha: sha, status: "queued" });
    return polls++ ? Response.json({ artifacts: [winner] }) : new Response("Not Found", { status: 404 });
  });
  assert.deepEqual(await waitForInstaller(api, 123, sha, {
    pause: async () => { pauses++; },
  }), winner);
  assert.equal(pauses, 1);
});

test("a completed run with artifact 404 fails instead of waiting indefinitely", async () => {
  const api = githubApi({ token: "test-token", repository: "owner/repo" }, async (url) =>
    url.includes("artifacts?") ? new Response("Not Found", { status: 404 }) :
      Response.json({ head_sha: sha, status: "completed", conclusion: "failure" }));
  await assert.rejects(waitForInstaller(api, 123, sha, {
    pause: () => assert.fail("completed run must fail"),
  }), /HTTP 404/);
});

test("artifact authorization failures are never treated as pending", async () => {
  const api = githubApi({ token: "test-token", repository: "owner/repo" }, async (url) =>
    url.includes("artifacts?") ? new Response("Forbidden", { status: 403 }) :
      Response.json({ head_sha: sha, status: "queued" }));
  await assert.rejects(waitForInstaller(api, 123, sha), /HTTP 403/);
});

test("both failures stop publication", async () => {
  await assert.rejects(waitForInstaller(async (_, endpoint) =>
    endpoint.includes("artifacts?") ? { artifacts: [] } : { head_sha: sha, status: "completed", conclusion: "failure" },
  123, sha), /Neither ARM environment/);
});

test("a different workflow revision cannot supply release artifacts", async () => {
  await assert.rejects(waitForInstaller(async () => ({ head_sha: "b".repeat(40) }), 123, sha), /revision differs/);
});

test("unavailable runners time out instead of accepting missing artifacts", async () => {
  let time = 0;
  await assert.rejects(waitForInstaller(async (_, endpoint) =>
    endpoint.includes("artifacts?") ? { artifacts: [] } : { head_sha: sha, status: "queued" },
  123, sha, { now: () => time, pause: async (ms) => { time += ms; }, timeoutMs: 30_000 }), /Timed out/);
});

test("cleanup cancels only the child race and tolerates it finishing concurrently", async () => {
  const calls = [];
  await cancelRace(async (...args) => {
    calls.push(args);
    return { status: "in_progress" };
  }, 123);
  assert.deepEqual(calls, [
    ["GET", "/actions/runs/123"],
    ["POST", "/actions/runs/123/cancel", undefined, [409]],
  ]);
});

test("cleanup leaves completed runs alone", async () => {
  await cancelRace(async (method) => {
    assert.equal(method, "GET");
    return { status: "completed" };
  }, 123);
});

test("uses the API version returning dispatch run IDs and propagates API errors", async () => {
  const api = githubApi({ token: "test-token", repository: "owner/repo" }, async (url, init) => {
    assert.equal(url, "https://api.github.com/repos/owner/repo/actions/workflows/build-desktop-arm.yml/dispatches");
    assert.equal(init.headers["X-GitHub-Api-Version"], "2026-03-10");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    return new Response("denied", { status: 403 });
  });
  await assert.rejects(api("POST", "/actions/workflows/build-desktop-arm.yml/dispatches", {}), /HTTP 403/);
});
