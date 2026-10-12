/** Real Web acceptance: IAM auth, built-in AI, persisted readback and undo. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, selectors } = require(
  process.env.PLASMIC_PLAYWRIGHT_PATH || "playwright",
);
const env = process.env.PLASMIC_ENV_FILE
  ? Object.fromEntries(
      fs
        .readFileSync(process.env.PLASMIC_ENV_FILE, "utf8")
        .split("\n")
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => [
          line.slice(0, line.indexOf("=")),
          line.slice(line.indexOf("=") + 1),
        ]),
    )
  : process.env;
const base = env.STUDIO_ORIGIN;
const projectId = process.env.PLASMIC_PROJECT_ID;
assert(
  base && projectId,
  "Set STUDIO_ORIGIN and PLASMIC_PROJECT_ID to a Web acceptance project",
);
assert(
  env.SG_SESSION || process.env.PLASMIC_STORAGE_STATE,
  "Provide an IAM-issued SG_SESSION or private PLASMIC_STORAGE_STATE file",
);
const reportDir = process.env.PLASMIC_REPORT_DIR || "./local-ai-web-report";
fs.mkdirSync(reportDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  base,
  projectId,
  passed: false,
  checks: [],
};
let browser;
(async () => {
  selectors.setTestIdAttribute("data-test-id");
  browser = await chromium.launch({
    executablePath: process.env.PLASMIC_CHROMIUM_PATH,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    ...(process.env.PLASMIC_STORAGE_STATE
      ? { storageState: process.env.PLASMIC_STORAGE_STATE }
      : {}),
  });
  if (env.SG_SESSION) {
    const url = new URL(base);
    await context.addCookies([
      {
        name: "__Secure-sg_session",
        value: env.SG_SESSION,
        domain: url.hostname.endsWith(".shiguanglab.com")
          ? ".shiguanglab.com"
          : url.hostname,
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);
  }
  // Uses the existing server test flag; it never bypasses IAM or project permission checks.
  if (process.env.PLASMIC_E2E_DEVFLAGS === "1") {
    await context.addCookies([
      { name: "plasmic-e2e-devflags", value: "1", url: base },
    ]);
  }
  const login = await context.request.get(base + "/api/v1/auth/self", {
    timeout: 15000,
  });
  assert(login.ok(), "IAM session rejected: " + login.status());
  report.checks.push({ name: "authenticated", passed: true });
  const status = await context.request.get(
    base + `/api/v1/projects/${projectId}/ai/edit/status`,
  );
  assert(
    status.ok() && (await status.json()).configured,
    "Enable and configure built-in AI on this server",
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const steps = [];
  page.on("response", async (response) => {
    if (response.url().endsWith(`/projects/${projectId}/ai/edit/step`)) {
      try {
        steps.push({
          status: response.status(),
          result: await response.json(),
        });
      } catch {}
    }
  });
  const projectUrl = base + "/projects/" + projectId;
  const composer = page
    .frameLocator("iframe.studio-frame")
    .frameLocator("iframe.__wab_studio-frame")
    .getByTestId("canvas-ai-composer");
  async function open() {
    await page.goto(projectUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForFunction(() => !!window.PLASMIC_AI_TOOLS, undefined, {
      timeout: 120000,
    });
    await call("identify", {
      model: "acceptance",
      client: "web-playwright",
      skill: "plasmic",
      outputFormat: "json",
    });
  }
  async function call(name, input = {}) {
    const result = await page.evaluate(
      async ({ name: toolName, input: toolInput }) =>
        await window.PLASMIC_AI_TOOLS[toolName](toolInput),
      { name, input },
    );
    assert(result.success, result.error?.message || name + " failed");
    return JSON.parse(result.output);
  }
  const marker = Date.now().toString(36);
  await open();
  const definition = (
    await call("createComponent", {
      name: "AiSaveUndoAcceptance" + marker,
      type: "page",
      path: "/ai-save-undo-" + marker,
    })
  ).results[0];
  report.componentUuid = definition.uuid;
  await call("insertHtml", {
    componentUuid: definition.uuid,
    html: '<h1 data-plasmic-name="AcceptanceTitle">Before ' + marker + "</h1>",
  });
  await call("navigate", { componentUuid: definition.uuid });
  async function readTitle(expected) {
    const resource = (await call("read", { componentUuids: [definition.uuid] }))
      .results[0];
    const target = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const node = doc.querySelector('[label="AcceptanceTitle"]');
      return node && { uuid: node.id, text: node.textContent };
    }, resource.baseVariantTplTree);
    assert(
      target?.uuid && target.text === expected,
      "Title readback mismatch: " + JSON.stringify(target),
    );
    return target;
  }
  const title = await readTitle("Before " + marker);
  await call("save");
  async function edit(text) {
    await call("selectElement", {
      componentUuid: definition.uuid,
      elementUuid: title.uuid,
    });
    await composer
      .getByRole("textbox")
      .fill(
        `把选中的原生标题文本修改为“${text}”。只使用一次 changeElement.text，保留节点 UUID 和其他属性。`,
      );
    await composer.getByRole("textbox").press("Enter");
    const task = page.getByTestId("local-ai-task").last();
    await page.waitForFunction(
      () => {
        const article = [
          ...document.querySelectorAll('[data-test-id="local-ai-task"]'),
        ].at(-1);
        return (
          article &&
          article.dataset.aiStatus !== "running" &&
          document.querySelector('[data-test-id="local-ai-panel"]').dataset
            .aiBusy === "false"
        );
      },
      undefined,
      { timeout: 180000 },
    );
    assert.equal(
      await task.getAttribute("data-ai-status"),
      "completed",
      await task.textContent(),
    );
    const revision = await task.getAttribute("data-ai-saved-revision");
    assert(revision !== null, "AI task did not confirm a saved revision");
    report.checks.push({
      name: "AI edit saved",
      text,
      revision: Number(revision),
      passed: true,
    });
    assert.equal(
      await task.getByTestId("local-ai-change").count(),
      1,
      "Expected one undoable transaction",
    );
    const result = await readTitle(text);
    assert.equal(
      result.uuid,
      title.uuid,
      "AI replaced the original title identity",
    );
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
  await record.getByRole("button").click();
  await page.waitForFunction(
    () => {
      const task = [
        ...document.querySelectorAll('[data-test-id="local-ai-task"]'),
      ].at(-1);
      return (
        task &&
        task.querySelector('[data-ai-undone="true"]') &&
        document.querySelector('[data-test-id="local-ai-panel"]').dataset
          .aiBusy === "false"
      );
    },
    undefined,
    { timeout: 60000 },
  );
  const undoRevision = await undoTask.getAttribute("data-ai-saved-revision");
  assert(undoRevision !== null, "Undo was not confirmed saved");
  report.undoRevision = Number(undoRevision);
  await readTitle("Saved " + marker);
  await page.screenshot({ path: path.join(reportDir, "undone.png") });
  await open();
  await call("navigate", { componentUuid: definition.uuid });
  assert.equal((await readTitle("Saved " + marker)).uuid, title.uuid);
  report.checks.push({ name: "AI undo, save and reopen", passed: true });
  if (process.env.PLASMIC_VERIFY_PAGE_GENERATION === "1") {
    const adminProject = "145nN6S5QQBwgjtNUwuiQZ";
    const overview = (await call("read")).results[0];
    if (
      !overview.importedProjects.some(
        (dependency) => dependency.id === adminProject,
      )
    ) {
      await call("installLibrary", { projectId: adminProject });
      await call("save");
    }
    const sceneName = "RecordsPage" + marker;
    const route = "/ai-records-" + marker;
    // The generator, including page creation, is invoked only through its Web UI.
    await composer
      .getByRole("button", { name: /Open AI assistant|打开 AI 助手/ })
      .click();
    await page.getByTestId("local-ai-page-mode").click();
    await page.getByTestId("local-ai-page-name").fill(sceneName);
    await page.getByTestId("local-ai-page-path").fill(route);
    await page
      .getByTestId("local-ai-prompt")
      .fill(
        "生成中文记录管理页，验收查询表格、新建抽屉、详情抽屉。读取已安装 Admin Templates 的 StandardListPage、SearchTableSection、DrawerFormSection、DrawerDetailSection 及实际组件契约后，用一个 AppShell 和现有 Antd6/Overseas 可编辑节点组成页面。" +
          "列表初始60条记录，名称为记录 01至记录 60，负责人为负责人1、负责人2轮流，状态为启用或停用。原型内存数据即可。三个 SearchForm 查询字段为名称关键词、负责人、状态，默认四列网格，查询和重置动作在第四列。查询提交后才筛选，查询和重置回到第一页。Table 默认每页20条，可切到50、100。" +
          "业务按钮文案新建，打开标题为新建记录的Drawer，字段名称、负责人、状态，名称和负责人必填且拒绝空格。字段占位符为请输入名称、请输入负责人，状态默认启用。抽屉页脚取消在左、创建在右，通过原生Form ref submit校验，onFinish一次添加记录到列表首行、重置查询并关闭。取消、X、Esc不提交，重新打开为空白。" +
          "每行详情按钮打开标题为记录详情的Drawer，用Descriptions显示当前行名称、负责人和状态，关闭后可打开另一行。两个Drawer初始关闭，编辑器选中揭示不改变业务状态。使用Desktop预览尺寸、英文PascalCase节点名，完成后读回状态和交互。",
      );
    await page
      .getByTestId("local-ai-panel")
      .getByRole("button")
      .filter({ hasText: /Send AI request|发送 AI 请求/ })
      .click();
    await page.waitForFunction(
      () => {
        const task = [
          ...document.querySelectorAll('[data-test-id="local-ai-task"]'),
        ].at(-1);
        return (
          task &&
          task.dataset.aiStatus !== "running" &&
          document.querySelector('[data-test-id="local-ai-panel"]').dataset
            .aiBusy === "false"
        );
      },
      undefined,
      { timeout: 780000 },
    );
    const generatedTask = page.getByTestId("local-ai-task").last();
    assert.equal(
      await generatedTask.getAttribute("data-ai-status"),
      "completed",
      await generatedTask.textContent(),
    );
    assert(
      await generatedTask.getAttribute("data-ai-saved-revision"),
      "Generated page was not saved",
    );
    const entry = (await call("read")).results[0].components.find(
      (component) => component.name === sceneName,
    );
    assert(entry?.uuid, "Generated routed page missing");
    const generated = (await call("read", { componentUuids: [entry.uuid] }))
      .results[0];
    assert.equal(generated.pageMeta.path, route);
    assert(
      generated.states?.length && generated.interactions?.length,
      "Prototype states or interactions missing",
    );
    report.generatedPage = generated;
    await open();
    assert.deepEqual(
      (await call("read", { componentUuids: [entry.uuid] })).results[0],
      generated,
      "Generated model changed after reopen",
    );
    const preview = await context.newPage();
    preview.on("pageerror", (error) => errors.push(error.message));
    await preview.goto(projectUrl + "/preview-full" + route, {
      waitUntil: "domcontentloaded",
    });
    const runtime = preview
      .frameLocator("iframe.studio-frame")
      .frameLocator("iframe.__wab_studio-frame")
      .frameLocator('[data-test-id="live-frame"]');
    const rows = runtime.locator(".ant-table-tbody .ant-table-row");
    await rows.first().waitFor({ state: "visible", timeout: 120000 });
    assert.equal(await rows.count(), 20);
    assert.equal(
      await runtime.locator(".ant-drawer-open").count(),
      0,
      "Drawers must initially be closed",
    );
    await preview.screenshot({
      path: path.join(reportDir, "generated-list.png"),
    });
    const keyword = runtime
      .locator(".ant-form-item")
      .filter({ hasText: "名称关键词" })
      .getByRole("textbox");
    await keyword.fill("记录 03");
    assert.equal(await rows.count(), 20, "Draft query applied before search");
    await runtime.getByRole("button", { name: /查\s*询/, exact: true }).click();
    await rows.first().getByText("记录 03", { exact: true }).waitFor();
    assert.equal(await rows.count(), 1, "Search did not filter records");
    await runtime.getByRole("button", { name: /重\s*置/, exact: true }).click();
    await rows.first().getByText("记录 01", { exact: true }).waitFor();
    assert.equal(await rows.count(), 20, "Reset did not restore records");
    await runtime.locator(".ant-pagination-item-2").click();
    await rows.first().getByText("记录 21", { exact: true }).waitFor();
    await runtime.getByRole("button", { name: /查\s*询/, exact: true }).click();
    await rows.first().getByText("记录 01", { exact: true }).waitFor();
    const sizePicker = runtime.locator(".ant-pagination-options-size-changer");
    for (const [size, expected] of [
      [50, 50],
      [100, 60],
      [20, 20],
    ]) {
      await sizePicker.click();
      await runtime
        .locator(".ant-select-item-option")
        .filter({ hasText: new RegExp("^" + size + "\\D") })
        .click();
      await rows.nth(expected - 1).waitFor({ state: "visible" });
      await rows.nth(expected).waitFor({ state: "hidden" });
      assert.equal(
        await rows.count(),
        expected,
        "Page size did not update the list",
      );
    }

    await rows
      .first()
      .getByRole("button", { name: /详\s*情/ })
      .click();
    const drawer = runtime.locator(".ant-drawer-open");
    await drawer.getByText("记录 01", { exact: true }).waitFor();
    await preview.screenshot({
      path: path.join(reportDir, "generated-detail.png"),
    });
    await drawer.getByRole("button", { name: /close|关闭/i }).click();
    await runtime.getByRole("button", { name: /新\s*建/, exact: true }).click();
    await drawer.getByRole("button", { name: /创\s*建/, exact: true }).click();
    await drawer.locator(".ant-form-item-explain-error").first().waitFor();
    assert.equal(await rows.count(), 20, "Invalid submission changed the list");
    await preview.screenshot({
      path: path.join(reportDir, "generated-invalid-create.png"),
    });
    await drawer.getByPlaceholder("请输入名称").fill("Web验收新记录");
    await drawer.getByPlaceholder("请输入负责人").fill("验收负责人");
    await drawer.getByRole("button", { name: /创\s*建/, exact: true }).click();
    await runtime.getByText("Web验收新记录", { exact: true }).waitFor();
    await drawer.waitFor({ state: "hidden" });
    assert(
      (await rows.first().textContent()).includes("Web验收新记录"),
      "Created record did not appear first",
    );
    await preview.screenshot({
      path: path.join(reportDir, "generated-created.png"),
    });
    report.checks.push({
      name: "Whole-page generation, persistence, draft/search/reset, pagination and sizes, initial closed overlays, row details, native invalid and valid create",
      passed: true,
    });
    await preview.close();
  }
  report.providerSteps = steps;
  report.browserErrors = errors;
  assert.deepEqual(errors, [], "Browser script errors occurred");
  report.passed = true;
})()
  .catch((error) => {
    report.error = error.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(reportDir, "verification.json"),
      JSON.stringify(report, null, 2),
    );
    await browser?.close();
    console.log(
      JSON.stringify({
        passed: report.passed,
        checks: report.checks,
        error: report.error,
      }),
    );
  });
