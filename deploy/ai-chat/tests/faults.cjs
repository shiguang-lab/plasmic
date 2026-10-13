const fs = require("fs"),
  assert = require("assert/strict"),
  cp = require("child_process"),
  { createRequire } = require("module");
const r = createRequire(process.cwd() + "/platform/wab/package.json");
const { chromium, selectors } = r("playwright");
const config = JSON.parse(
  fs.readFileSync(process.env.HOME + "/.plasmic/local-web-env.json"),
);
const projectId = process.env.AI_CHAT_TEST_PROJECT_ID;
assert(
  projectId,
  "AI_CHAT_TEST_PROJECT_ID must identify a disposable local test project",
);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(config.DATABASE_URI).hostname,
  ),
  "Test database must be local",
);
const output =
  process.env.AI_CHAT_TEST_OUTPUT || "/tmp/plasmic-ai-chat-acceptance";
fs.mkdirSync(output, { recursive: true });
const report = { projectId, checks: [] };
let browser, worker, provider;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = {
  "Content-Type": "application/json",
  "x-plasmic-api-user": config.PLASMIC_DEV_API_USER,
  "x-plasmic-api-token": config.PLASMIC_DEV_API_TOKEN,
};
const api = async (path, body) => {
  const r = await fetch(
    "http://localhost:3004/api/v1/projects/" + projectId + "/ai/chat" + path,
    {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const data = await r.json();
  assert(r.ok, JSON.stringify(data));
  return data;
};
const spawnWorker = () => {
  const fd = fs.openSync(output + "/fault-worker-restarted.log", "a");
  const child = cp.spawn(
    process.execPath,
    [
      "-r",
      "esbuild-register",
      "-r",
      "dotenv/config",
      "src/wab/server/copilot/ai-worker.ts",
    ],
    {
      cwd: process.cwd() + "/platform/wab",
      env: {
        ...process.env,
        ...config,
        NODE_ENV: "development",
        AI_CHAT_BUCKET: "plasmic-ai-chat",
        S3_ENDPOINT: "http://127.0.0.1:8333",
        AWS_ACCESS_KEY_ID: "local-ai-storage",
        AWS_SECRET_ACCESS_KEY: "local-ai-storage-secret",
        PLASMIC_AI_BASE_URL: "http://127.0.0.1:8032/v1",
        PLASMIC_AI_API_KEY: "local-fault-placeholder",
        PLASMIC_AI_MODEL: "fault-fixture",
        PLASMIC_AI_MODELS: "fault-fixture",
      },
      stdio: ["ignore", fd, fd],
    },
  );
  fs.closeSync(fd);
  return child;
};
(async () => {
  assert.throws(
    () =>
      cp.execFileSync("pgrep", [
        "-f",
        "^.+node -r esbuild-register -r dotenv/config src/wab/server/copilot/ai-worker.ts$",
      ]),
    "Stop the existing AI worker before fault injection",
  );
  provider = cp.spawn(
    process.execPath,
    ["deploy/ai-chat/tests/fault-provider.cjs"],
    { stdio: "inherit" },
  );
  await sleep(500);
  worker = spawnWorker();
  selectors.setTestIdAttribute("data-test-id");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto(
    `http://localhost:3003/projects/${projectId}/-/Custom-arena-1?arena_type=custom&arena=Custom+arena+1&copilot_chat=true`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(() => !!window.PLASMIC_AI_TOOLS, undefined, {
    timeout: 90000,
  });
  const getContext = async () =>
    JSON.parse(
      (await page.evaluate(() => window.PLASMIC_AI_TOOLS._getLocalContext()))
        .output,
    );
  const submit = async (prompt) => {
    const editor = await getContext();
    const body = {
      clientRequestId: crypto.randomUUID(),
      prompt,
      model: "fault-fixture",
      binding: {
        projectId,
        branchId: editor.branchId,
        sessionId: editor.sessionId,
        changeCounter: editor.changeCounter,
        componentUuid: editor.componentUuid,
        elementUuids: [],
        frameUuid: editor.frameUuid,
      },
      context: JSON.stringify(editor),
      attachments: [],
    };
    const [one, two] = await Promise.all([api("", body), api("", body)]);
    assert.equal(one.id, two.id);
    return one;
  };
  const run = await submit(
    "WORKER_CRASH local fault fixture; render Markdown only and do not modify the design.",
  );
  let partial;
  for (let i = 0; i < 60; i++) {
    partial = await api("/runs/" + run.id);
    if (partial.messages.join("").includes("Partial output")) break;
    await sleep(500);
  }
  assert(partial.messages.join("").includes("Partial output"));
  console.log("PARTIAL_PERSISTED_BEFORE_CRASH", partial.seq);
  await page
    .getByTestId("local-ai-task")
    .last()
    .getByText("Local fault fixture", { exact: true })
    .waitFor({ timeout: 10000 });
  worker.kill("SIGKILL");
  worker = spawnWorker();
  let resumed;
  for (let i = 0; i < 100; i++) {
    resumed = await api("/runs/" + run.id);
    if (resumed.status !== "running") break;
    await sleep(500);
  }
  assert.equal(resumed.status, "failed");
  assert(resumed.error.includes("interrupted"));
  assert(resumed.messages.join("").includes(partial.messages.join("")));
  const stats = await (await fetch("http://127.0.0.1:8032/stats")).json();
  assert.equal(stats.calls, 1);
  console.log("WORKER_RESTART_PRESERVED_OUTPUT_NO_NEW_HTTP", stats.calls);
  report.checks.push({
    name: "worker crash",
    status: resumed.status,
    error: resumed.error,
    upstreamRequests: stats.calls,
    retained: true,
  });
  const failed = await submit(
    "UPSTREAM_FAILURE local fault fixture; render Markdown only, with no design modifications.",
  );
  let failure;
  for (let i = 0; i < 100; i++) {
    failure = await api("/runs/" + failed.id);
    if (failure.status !== "running") break;
    await sleep(500);
  }
  assert.equal(failure.status, "failed");
  assert(failure.messages.join("").includes("Partial output"));
  console.log("UPSTREAM_STREAM_FAILURE_PERSISTED", failure.status);
  report.checks.push({
    name: "upstream stream failure",
    status: failure.status,
    retained: true,
  });
  const offline = await submit(
    "OFFLINE_REPLAY local fault fixture " +
      crypto.randomUUID() +
      "; render Markdown only, no modifications.",
  );
  await sleep(3000);
  const seen = (await api("/runs/" + offline.id)).messages.join("");
  await context.setOffline(true);
  await sleep(2000);
  await context.setOffline(false);
  await sleep(3000);
  const read = await api("/runs/" + offline.id);
  assert(read.messages.join("").includes(seen));
  assert.equal(
    await page
      .getByTestId("local-ai-task")
      .filter({ hasText: offline.prompt })
      .count(),
    1,
  );
  await api("/runs/" + offline.id + "/stop", {});
  await sleep(1500);
  assert.equal((await api("/runs/" + offline.id)).status, "stopped");
  console.log("OFFLINE_REPLAY_AND_STOP_PERSISTED");
  report.checks.push({
    name: "offline reconnect and stop",
    retained: true,
    status: "stopped",
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("local-ai-task").last().waitFor({ timeout: 90000 });
  await page.screenshot({
    path: output + "/fault-history.png",
    fullPage: true,
  });
  const user = await getContext();
  const heading = await page.evaluate(async () => {
    const c = JSON.parse(
      (await window.PLASMIC_AI_TOOLS._getLocalContext()).output,
    );
    return window.PLASMIC_AI_TOOLS.queryElements({
      componentUuid: c.componentUuid,
      tag: "h1",
    });
  });
  const headingId = JSON.parse(heading.output)
    .results[0].baseVariantTplTree.replaceAll('\\"', '"')
    .match(/id="([^"]+)"/)[1];
  let selection;
  for (let i = 0; i < 60; i++) {
    selection = await page.evaluate(
      async ({ componentUuid, headingId }) =>
        window.PLASMIC_AI_TOOLS.selectElement({
          componentUuid,
          elementUuid: headingId,
          instanceIndex: 0,
        }),
      { componentUuid: user.componentUuid, headingId },
    );
    if (selection.success) break;
    await sleep(500);
  }
  assert(selection.success, JSON.stringify(selection));
  const selected = await getContext();
  assert(
    selected.selectedElementUuids.includes(headingId),
    JSON.stringify(selected),
  );
  const nodeRun = await api("", {
    clientRequestId: crypto.randomUUID(),
    prompt: "NODE_REFERENCE local fault fixture; render Markdown only.",
    model: "fault-fixture",
    binding: {
      projectId,
      branchId: selected.branchId,
      sessionId: selected.sessionId,
      changeCounter: selected.changeCounter,
      componentUuid: selected.componentUuid,
      elementUuids: selected.selectedElementUuids,
      frameUuid: selected.frameUuid,
    },
    context: JSON.stringify(selected),
    attachments: [],
  });
  await sleep(3000);
  assert.equal(
    (await api("/runs/" + nodeRun.id)).nodes[0].name,
    "AcceptanceTitle",
  );
  await api("/runs/" + nodeRun.id + "/stop", {});
  await sleep(1000);
  await page
    .getByTestId("local-ai-task")
    .last()
    .getByText("AcceptanceTitle", { exact: true })
    .click();
  let located;
  for (let i = 0; i < 80; i++) {
    located = await getContext();
    if (located.selectedElementUuids.includes(headingId)) break;
    await sleep(500);
  }

  assert(located.selectedElementUuids.includes(headingId));
  assert.equal(located.changeCounter, selected.changeCounter);
  console.log("NODE_TAG_LOCATED_WITHOUT_DESIGN_CHANGE");
  report.checks.push({
    name: "historical node tag",
    nameSnapshot: "AcceptanceTitle",
    located: true,
    designCounterUnchanged: true,
  });
  await page.screenshot({
    path: output + "/node-reference.png",
    fullPage: true,
  });
  fs.writeFileSync(
    output + "/fault-report.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  worker.kill("SIGTERM");
  provider.kill("SIGTERM");
})().catch(async (e) => {
  console.error(e);
  report.error = e.message;
  fs.writeFileSync(
    output + "/fault-report.json",
    JSON.stringify(report, null, 2),
  );
  if (browser) await browser.close();
  if (worker) worker.kill("SIGTERM");
  if (provider) provider.kill("SIGTERM");
  process.exitCode = 1;
});
