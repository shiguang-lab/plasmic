/** Real Web acceptance: IAM auth, built-in AI, persisted readback and undo. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, selectors } = require(process.env.PLASMIC_PLAYWRIGHT_PATH || "playwright");
const env = process.env.PLASMIC_ENV_FILE
  ? Object.fromEntries(fs.readFileSync(process.env.PLASMIC_ENV_FILE, "utf8").split("\n")
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]))
  : process.env;
const base = env.STUDIO_ORIGIN;
const projectId = process.env.PLASMIC_PROJECT_ID;
assert(base && projectId, "Set STUDIO_ORIGIN and PLASMIC_PROJECT_ID to a Web acceptance project");
assert(env.SG_SESSION || process.env.PLASMIC_STORAGE_STATE,
  "Provide an IAM-issued SG_SESSION or private PLASMIC_STORAGE_STATE file");
const reportDir = process.env.PLASMIC_REPORT_DIR || "./local-ai-web-report";
fs.mkdirSync(reportDir, { recursive: true });
const report = { startedAt: new Date().toISOString(), base, projectId, passed: false, checks: [] };
let browser;
(async () => {
  selectors.setTestIdAttribute("data-test-id");
  browser = await chromium.launch({ executablePath: process.env.PLASMIC_CHROMIUM_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 },
    ...(process.env.PLASMIC_STORAGE_STATE ? { storageState: process.env.PLASMIC_STORAGE_STATE } : {}) });
  if (env.SG_SESSION) {
    const url = new URL(base);
    await context.addCookies([{ name: "__Secure-sg_session", value: env.SG_SESSION,
      domain: url.hostname.endsWith(".shiguanglab.com") ? ".shiguanglab.com" : url.hostname,
      path: "/", httpOnly: true, secure: url.protocol === "https:", sameSite: "Lax" }]);
  }
  // Uses the existing server test flag; it never bypasses IAM or project permission checks.
  if (process.env.PLASMIC_E2E_DEVFLAGS === "1") {
    await context.addCookies([{ name: "plasmic-e2e-devflags", value: "1", url: base }]);
  }
  const login = await context.request.get(base + "/api/v1/auth/self", { timeout: 15000 });
  assert(login.ok(), "IAM session rejected: " + login.status());
  report.checks.push({ name: "authenticated", passed: true });
  const status = await context.request.get(base + `/api/v1/projects/${projectId}/ai/edit/status`);
  assert(status.ok() && (await status.json()).configured, "Enable and configure built-in AI on this server");
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const steps = [];
  page.on("response", async (response) => {
    if (response.url().endsWith(`/projects/${projectId}/ai/edit/step`)) {
      try { steps.push({ status: response.status(), result: await response.json() }); } catch {}
    }
  });
  const projectUrl = base + "/projects/" + projectId;
  const composer = page.frameLocator("iframe.studio-frame").getByTestId("canvas-ai-composer");
  async function open() {
    await page.goto(projectUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!window.PLASMIC_AI_TOOLS, undefined, { timeout: 120000 });
    await call("identify", { model: "acceptance", client: "web-playwright", skill: "plasmic", outputFormat: "json" });
  }
  async function call(name, input = {}) {
    const result = await page.evaluate(async ({ name: toolName, input: toolInput }) => await window.PLASMIC_AI_TOOLS[toolName](toolInput), { name, input });
    assert(result.success, result.error?.message || name + " failed");
    return JSON.parse(result.output);
  }
  const marker = Date.now().toString(36);
  await open();
  const definition = (await call("createComponent", { name: "AiSaveUndoAcceptance" + marker,
    type: "page", path: "/ai-save-undo-" + marker })).results[0];
  report.componentUuid = definition.uuid;
  await call("insertHtml", { componentUuid: definition.uuid,
    html: '<h1 data-plasmic-name="AcceptanceTitle">Before ' + marker + '</h1>' });
  await call("navigate", { componentUuid: definition.uuid });
  async function readTitle(expected) {
    const resource = (await call("read", { componentUuids: [definition.uuid] })).results[0];
    const target = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const node = doc.querySelector('[data-plasmic-name="AcceptanceTitle"]');
      return node && { uuid: node.id, text: node.textContent };
    }, resource.baseVariantTplTree);
    assert(target?.uuid && target.text === expected, "Title readback mismatch: " + JSON.stringify(target));
    return target;
  }
  const title = await readTitle("Before " + marker);
  await call("save");
  async function edit(text) {
    await call("selectElement", { componentUuid: definition.uuid, elementUuid: title.uuid });
    await composer.getByRole("textbox").fill(
      `把选中的原生标题文本修改为“${text}”。只使用一次 changeElement.text，保留节点 UUID 和其他属性。`);
    await composer.getByRole("textbox").press("Enter");
    const task = page.getByTestId("local-ai-task").last();
    await page.waitForFunction(() => {
      const article = [...document.querySelectorAll('[data-test-id="local-ai-task"]')].at(-1);
      return article && article.dataset.aiStatus !== "running" &&
        document.querySelector('[data-test-id="local-ai-panel"]').dataset.aiBusy === "false";
    }, undefined, { timeout: 180000 });
    assert.equal(await task.getAttribute("data-ai-status"), "completed", await task.textContent());
    const revision = await task.getAttribute("data-ai-saved-revision");
    assert(revision !== null, "AI task did not confirm a saved revision");
    report.checks.push({ name: "AI edit saved", text, revision: Number(revision), passed: true });
    assert.equal(await task.getByTestId("local-ai-change").count(), 1, "Expected one undoable transaction");
    const result = await readTitle(text);
    assert.equal(result.uuid, title.uuid, "AI replaced the original title identity");
    return task;
  }
  await edit("Saved " + marker);
  await page.screenshot({ path: path.join(reportDir, "saved.png") });
  await open();
  await call("navigate", { componentUuid: definition.uuid });
  assert.equal((await readTitle("Saved " + marker)).uuid, title.uuid);
  report.checks.push({ name: "AI save and reopen", passed: true });
  const undoTask = await edit("Undo " + marker);
  const record = undoTask.getByTestId("local-ai-change");
  await record.locator("summary").first().click();
  await record.getByRole("button", { name: /^(Undo|撤销|撤銷)$/ }).click();
  await page.waitForFunction(() => {
    const task = [...document.querySelectorAll('[data-test-id="local-ai-task"]')].at(-1);
    return task && task.querySelector('[data-ai-undone="true"]') &&
      document.querySelector('[data-test-id="local-ai-panel"]').dataset.aiBusy === "false";
  }, undefined, { timeout: 60000 });
  const undoRevision = await undoTask.getAttribute("data-ai-saved-revision");
  assert(undoRevision !== null, "Undo was not confirmed saved");
  report.undoRevision = Number(undoRevision);
  await readTitle("Saved " + marker);
  await page.screenshot({ path: path.join(reportDir, "undone.png") });
  await open();
  await call("navigate", { componentUuid: definition.uuid });
  assert.equal((await readTitle("Saved " + marker)).uuid, title.uuid);
  report.checks.push({ name: "AI undo, save and reopen", passed: true });
  report.providerSteps = steps;
  report.browserErrors = errors;
  assert.deepEqual(errors, [], "Browser script errors occurred");
  report.passed = true;
})().catch((error) => {
  report.error = error.message;
  process.exitCode = 1;
}).finally(async () => {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(reportDir, "verification.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.error }));
});
