const fs = require("fs"),
  assert = require("assert/strict"),
  { createRequire } = require("module");
const r = createRequire(process.cwd() + "/platform/wab/package.json");
const { chromium, selectors } = r("playwright");
const sharp = r("sharp");
let browser;
(async () => {
  selectors.setTestIdAttribute("data-test-id");
  const projectId = process.env.AI_CHAT_TEST_PROJECT_ID;
  assert(
    projectId,
    "AI_CHAT_TEST_PROJECT_ID must identify a disposable local test project",
  );
  const output =
    process.env.AI_CHAT_TEST_OUTPUT || "/tmp/plasmic-ai-chat-acceptance";
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3003/projects/" + projectId, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!window.PLASMIC_AI_TOOLS, undefined, {
    timeout: 90000,
  });
  const baseline = (
    await (
      await page.request.get(
        `http://localhost:3003/api/v1/projects/${projectId}/ai/chat`,
      )
    ).json()
  ).tasks.at(-1)?.id;
  const composer = page.getByTestId("canvas-ai-composer");
  await composer.waitFor();
  const png = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#1677ff" },
  })
    .png()
    .toBuffer();
  await composer.locator("input[type=file]").setInputFiles([
    {
      name: "local-acceptance.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Local AI acceptance\nAdd a counter interaction only in the test page. Preserve the heading.",
      ),
    },
    { name: "local-acceptance.png", mimeType: "image/png", buffer: png },
  ]);
  await composer
    .getByRole("textbox")
    .fill(
      "In this existing local acceptance page, keep the current heading and add a compact counter demo beneath it. Create a native numeric state named counter with initialValue exactly the JSON number 0 (not an object), and variableType number. Add a clearly visible button labeled Increase Counter and a text labeled Counter: 0 that is dynamically bound to counter. Use a native onClick interaction to increment counter by one. Read the actual state, interaction and registered component contracts before editing; use existing components or native HTML elements, and do not invent props. Give editable nodes English PascalCase names. Then read back the structure and save. Use getEditorContext with exactly {} if needed.",
    );
  let dropped = 0;
  await page.evaluate(() => {
    window.__aiNativeCounts = {};
    const tools = window.PLASMIC_AI_TOOLS,
      original = tools._executeLocal;
    tools._executeLocal = async (input) => {
      const id = input.execution?.operationId;
      if (id)
        window.__aiNativeCounts[id] = (window.__aiNativeCounts[id] || 0) + 1;
      return original(input);
    };
  });
  await page.route("**/ai/chat/tools/**/receipt", async (route) => {
    const body = route.request().postDataJSON();
    if (!dropped && body.result?.changed) {
      dropped++;
      console.log("DROPPED_SAVED_ACK", route.request().url());
      await route.abort("failed");
    } else await route.continue();
  });
  await composer.getByRole("button", { name: "Send AI request" }).click();
  await page.getByTestId("local-ai-panel").waitFor();
  assert.equal(await page.getByTestId("canvas-ai-composer").count(), 0);
  let run;
  let previous = "";
  for (let i = 0; i < 360; i++) {
    const response = await page.request.get(
      `http://localhost:3003/api/v1/projects/${projectId}/ai/chat`,
    );
    const h = await response.json();
    run = h.tasks.at(-1);
    if (!run || run.id === baseline) {
      await page.waitForTimeout(1000);
      continue;
    }
    const phase = `${run?.status}:${run?.phase}:${run?.operations.length}`;
    if (phase !== previous) {
      console.log("PHASE", phase);
      previous = phase;
    }
    if (run && run.status !== "running") break;
    await page.waitForTimeout(2000);
  }
  fs.writeFileSync(
    output + "/interactive-run.json",
    JSON.stringify(run, null, 2),
  );
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.files.length, 2);
  assert.equal(dropped, 1);
  const counts = await page.evaluate(() => window.__aiNativeCounts);
  assert(Object.values(counts).every((count) => count === 1));
  console.log("NO_DUPLICATE_NATIVE_OPERATIONS", Object.keys(counts).length);
  assert(run.records.length >= 2);
  await page.screenshot({
    path: output + "/interactive-editor.png",
    fullPage: true,
  });
  const read = await page.evaluate(async () => {
    const c = JSON.parse(
      (await window.PLASMIC_AI_TOOLS._getLocalContext()).output,
    );
    return window.PLASMIC_AI_TOOLS.read({ componentUuids: [c.componentUuid] });
  });
  fs.writeFileSync(output + "/interactive-readback.json", JSON.stringify(read));
  assert(read.success);
  console.log("READ_STRUCTURE", read.output.includes("counter"));
  const preview = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  const presentation = await page.request.post(
    `http://localhost:3003/api/v1/projects/${projectId}/presentation`,
  );
  assert(presentation.ok(), "Could not resolve presentation code");
  const { code } = await presentation.json();
  await preview.goto(`http://localhost:3003/d/${code}#/local-edit-acceptance`, {
    waitUntil: "domcontentloaded",
  });
  let runtime;
  for (let i = 0; i < 180; i++) {
    for (const frame of preview.frames()) {
      if (
        frame.url().includes("localhost:3005") &&
        (await frame
          .getByRole("button", { name: "Increase Counter", exact: true })
          .count())
      ) {
        runtime = frame;
        break;
      }
    }
    if (runtime) break;
    if (i === 60) {
      await preview.reload({ waitUntil: "domcontentloaded" });
    }
    await preview.waitForTimeout(500);
  }
  assert(runtime, "Preview runtime frame was not loaded");
  const button = runtime.getByRole("button", {
    name: "Increase Counter",
    exact: true,
  });
  await button.waitFor({ timeout: 10000 });
  console.log("PREVIEW_INITIAL", await runtime.locator("body").innerText());
  await button.click();
  await runtime
    .getByText("Counter: 1", { exact: true })
    .waitFor({ timeout: 10000 });
  await preview.screenshot({
    path: output + "/interactive-preview.png",
    fullPage: true,
  });
  console.log("PREVIEW_INCREMENT_PASSED");
  await preview.close();
  await page
    .getByTestId("local-ai-change")
    .last()
    .locator("summary")
    .first()
    .click();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await page.waitForTimeout(2000);
  const h = await (
    await page.request.get(
      `http://localhost:3003/api/v1/projects/${projectId}/ai/chat`,
    )
  ).json();
  const after = h.tasks.at(-1);
  assert(after.records.some((record) => record.undone));
  console.log("CURRENT_NATIVE_UNDO_PERSISTED", after.savedRevision);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.PLASMIC_AI_TOOLS, undefined, {
    timeout: 90000,
  });
  const loaded = (
    await (
      await page.request.get(
        `http://localhost:3003/api/v1/projects/${projectId}/ai/chat`,
      )
    ).json()
  ).tasks.at(-1);
  assert(loaded.records.some((record) => record.undone));
  console.log("UNDO_READBACK_AFTER_REFRESH", true);
  await page.goto(
    page.url() + (page.url().includes("?") ? "&" : "?") + "copilot_chat=true",
    { waitUntil: "domcontentloaded" },
  );
  await page.getByTestId("local-ai-task").last().waitFor({ timeout: 90000 });
  assert.equal(
    await page.getByRole("button", { name: "Undo", exact: true }).count(),
    0,
  );
  await page.screenshot({
    path: output + "/interactive-history.png",
    fullPage: true,
  });
  fs.writeFileSync(
    output + "/interactive-report.json",
    JSON.stringify(
      {
        projectId,
        runId: run.id,
        model: run.model,
        droppedSavedAck: dropped,
        nativeOperationCounts: counts,
        files: run.files,
        previewIncrement: true,
        undoPersisted: true,
        noHistoricalNativeUndo: true,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close();
  process.exitCode = 1;
});
