/** NAS/browser acceptance of the AI editing API; creates new pages in the specified acceptance project. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLASMIC_PLAYWRIGHT_PATH || "playwright",
);
const env = Object.fromEntries(
  fs
    .readFileSync(process.env.PLASMIC_ENV_FILE || "/run/plasmic.env", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")),
      line.slice(line.indexOf("=") + 1),
    ]),
);
const projectId = process.env.PLASMIC_PROJECT_ID;
assert(
  projectId,
  "Set PLASMIC_PROJECT_ID to an acceptance project with Ant Design 6 installed",
);
const reportDir = process.env.PLASMIC_REPORT_DIR || "./ai-prototype-report";
fs.mkdirSync(reportDir, { recursive: true });
const calls = [],
  errors = [];
let browser;

(async () => {
  browser = await chromium.launch({
    executablePath: process.env.PLASMIC_CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
  });
  const base = env.STUDIO_ORIGIN;
  assert(env.SG_SESSION, "Set SG_SESSION to an IAM-issued acceptance session");
  await context.addCookies([
    {
      name: "__Secure-sg_session",
      value: env.SG_SESSION,
      domain: ".shiguanglab.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  const login = await context.request.get(base + "/api/v1/auth/self");
  assert(login.ok(), "Shiguang session was rejected");
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  async function open() {
    await page.goto(base + "/projects/" + projectId, {
      waitUntil: "commit",
      timeout: 60000,
    });
    await page.waitForFunction(() => !!window.PLASMIC_AI_TOOLS, undefined, {
      timeout: 180000,
    });
  }
  async function call(name, input = {}, expectError = false) {
    const start = Date.now();
    const result = await page.evaluate(
      async ({ name: toolName, input: toolInput }) =>
        await window.PLASMIC_AI_TOOLS[toolName](toolInput),
      { name, input },
    );
    calls.push({ name, input, result, durationMs: Date.now() - start });
    fs.writeFileSync(
      path.join(reportDir, "tool-calls.json"),
      JSON.stringify(calls, null, 2),
    );
    if (expectError) {
      assert.equal(result.success, false, "Expected rejected input");
      return result;
    }
    assert(result.success, result.error?.message || name + " failed");
    return JSON.parse(result.output);
  }
  await open();
  const identity = await call("identify", {
    model: "acceptance-fixture",
    client: "nas-playwright",
    skill: "plasmic",
    outputFormat: "json",
  });
  assert(identity.canEdit, "Acceptance user cannot edit this project");
  const overview = (await call("read")).results[0];
  const library = overview.importedProjects.find((dep) =>
    dep.components?.some((c) => c.name === "plasmic-antd6-button"),
  );
  assert(library, "Install Ant Design 6 in the acceptance project first");
  const registrations = library.components;
  const names = [
    "plasmic-antd6-button",
    "plasmic-antd6-card",
    "plasmic-antd6-input",
    "plasmic-antd6-tag",
    "plasmic-antd6-statistic",
  ];
  const contracts = names.map((name) => {
    const c = registrations.find((registration) => registration.name === name);
    assert(c, name + " not registered");
    return c;
  });
  const definitions = (
    await call("read", { componentUuids: contracts.map((c) => c.uuid) })
  ).results;
  const run = Date.now().toString(36);
  const dashboard = (
    await call("createComponent", {
      name: "AI 项目概览 " + run,
      type: "page",
      path: "/ai-projects-" + run,
    })
  ).results[0];
  const form = (
    await call("createComponent", {
      name: "AI 新建项目 " + run,
      type: "page",
      path: "/ai-create-" + run,
    })
  ).results[0];
  const root = (resource) =>
    resource.baseVariantTplTree.match(/id="([^"]+)"/)?.[1];
  const prop = (value) => JSON.stringify(value).replace(/'/g, "&#39;");
  const cc = (name, props, content = "", instance = "") => {
    const definition = definitions.find(
      (c) => c.uuid === registrations.find((r) => r.name === name).uuid,
    );
    const values = { ...props },
      slots = [];
    const escape = (value) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    for (const [key, value] of Object.entries(values)) {
      if (definition.props.some((p) => p.name === key && p.type === "slot")) {
        slots.push(`<slot name="${key}"><span>${escape(value)}</span></slot>`);
        delete values[key];
      }
    }
    if (content) {
      slots.push(`<slot name="children">${content}</slot>`);
    }
    return `<plasmic-component data-plasmic-component="${name}" data-plasmic-project="${library.id}" ${instance ? `data-plasmic-name="${instance}"` : ""} ${[names[1], names[2], names[4]].includes(name) ? 'style="width:100%"' : ""} data-props='${prop(values)}'>${slots.join("")}</plasmic-component>`;
  };
  const metric = (title, label, value) =>
    `<div style="display:flex;flex-direction:column;flex:1;min-width:240px">${cc(names[1], { title }, cc(names[4], { title: label, value }))}</div>`;
  const dashboardHtml = `<main data-plasmic-name="dashboard" style="display:flex;flex-direction:column;gap:24px;padding:32px;background:#f5f7fb;width:100%;max-width:1180px;align-self:center;min-height:720px">
    <header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px"><div style="display:flex;flex-direction:column;gap:8px"><h1 style="font-size:28px;font-weight:700;color:#172033">项目概览</h1><p style="color:#667085">跟踪团队交付进度 · 原型模拟数据</p></div>${cc(names[0], { type: "primary", href: form.pageMeta.path }, "<span>新建项目</span>", "createProject")}</header>
    <section data-plasmic-name="metrics" style="display:flex;flex-wrap:wrap;gap:16px">${metric("进行中", "活跃项目", 12)}${metric("本周交付", "完成任务", 38)}${metric("团队效率", "按时交付率", 96)}</section>
    ${cc(names[1], { title: "重点项目" }, `<div style="display:flex;flex-direction:column;gap:20px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px"><div><h2 style="font-size:18px;font-weight:600">客户工作台改版</h2><p style="color:#667085">负责人：林晓 · 截止日期：10 月 18 日</p></div>${cc(names[3], { color: "blue" }, "<span>进行中</span>")}</div><p>本周完成信息架构和交互原型评审，下一步进入视觉设计。</p>${cc(names[0], { type: "default", href: form.pageMeta.path }, "<span>创建类似项目</span>")}</div>`)}
  </main>`;
  await call("insertHtml", {
    componentUuid: dashboard.uuid,
    html: dashboardHtml,
  });
  await call("createState", {
    componentUuid: form.uuid,
    name: "submitted",
    variableType: "boolean",
    initialValue: false,
  });
  const formHtml = `<main data-plasmic-name="createForm" style="display:flex;flex-direction:column;gap:24px;padding:32px;width:100%;max-width:720px;align-self:center;min-height:720px;background:#f5f7fb"><a href="${dashboard.pageMeta.path}">← 返回项目概览</a><h1 style="font-size:28px;font-weight:700">新建项目</h1><p style="color:#667085">填写项目信息，创建团队协作空间。</p>${cc(names[1], { title: "项目信息" }, `<div style="display:flex;flex-direction:column;gap:16px"><label style="display:flex;flex-direction:column;row-gap:8px"><span>项目名称</span>${cc(names[2], { placeholder: "例如：客户工作台改版" }, "", "projectName")}</label><label style="display:flex;flex-direction:column;row-gap:8px"><span>负责人</span>${cc(names[2], { placeholder: "输入负责人姓名" }, "", "ownerName")}</label><p>此原型使用模拟数据，不会创建真实业务记录。</p>${cc(names[0], { type: "primary", disabled: "{{ $state.submitted }}" }, "<span>{{ $state.submitted ? '已创建（模拟）' : '创建项目' }}</span>", "submitProject")}</div>`)}</main>`;
  await call("insertHtml", { componentUuid: form.uuid, html: formHtml });
  const formResource = (await call("read", { componentUuids: [form.uuid] }))
    .results[0];
  const submit = formResource.baseVariantTplTree.match(
    /<plasmic-component[^>]*data-plasmic-name="submitProject"[^>]*>/,
  )?.[0];
  const submitUuid = submit?.match(/id="([^"]+)"/)?.[1];
  assert(submitUuid, "Submit component UUID missing");
  await call("createInteraction", {
    componentUuid: form.uuid,
    elementUuid: submitUuid,
    eventName: "onClick",
    name: "模拟创建项目",
    action: {
      actionName: "updateVariable",
      variable: ["submitted"],
      operation: "NewValue",
      value: "{{ true }}",
    },
  });
  const before = (await call("read", { componentUuids: [form.uuid] }))
    .results[0].baseVariantTplTree;
  await call(
    "changeElement",
    {
      componentUuid: form.uuid,
      elementUuid: submitUuid,
      props: { type: "dashed", disabled: "wrong-type" },
    },
    true,
  );
  assert.equal(
    (await call("read", { componentUuids: [form.uuid] })).results[0]
      .baseVariantTplTree,
    before,
    "Invalid props did not roll back",
  );
  await call(
    "insertHtml",
    {
      componentUuid: dashboard.uuid,
      html: '<p>Must not be inserted</p><plasmic-component data-plasmic-component="UnknownComponent"></plasmic-component>',
    },
    true,
  );
  await call(
    "deleteElement",
    { componentUuid: form.uuid, elementUuid: root(formResource) },
    true,
  );
  const validation = await call("validate", {
    componentUuids: [dashboard.uuid, form.uuid],
  });
  assert(
    validation.valid && validation.antDesign6Instances >= 10,
    "Prototype structural validation failed",
  );
  await call("navigate", { componentUuid: dashboard.uuid });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(reportDir, "desktop.png") });
  await call("navigate", { componentUuid: form.uuid });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(reportDir, "form.png") });
  const saved = await call("save");
  const preview = await context.newPage();
  preview.on("pageerror", (error) => errors.push(error.message));
  async function previewFrame(route, width) {
    await preview.setViewportSize({ width, height: 1000 });
    await preview.goto(
      base + "/projects/" + projectId + "/preview-full" + route,
      { waitUntil: "commit", timeout: 60000 },
    );
    for (let n = 0; n < 120; n++) {
      for (const frame of preview.frames()) {
        try {
          if (
            frame.url().includes("live=true") &&
            (await frame.locator(".ant-btn").count())
          ) {
            return frame;
          }
        } catch {}
      }
      await preview.waitForTimeout(1000);
    }
    throw new Error("Full preview did not render");
  }
  let interactive;
  for (const width of [1440, 390]) {
    const frame = await previewFrame(dashboard.pageMeta.path, width);
    interactive = frame;
    await frame.getByText("项目概览", { exact: true }).waitFor();
    assert.equal(
      await frame.locator(".ant-tag-blue").count(),
      1,
      "Registered Tag color was not rendered",
    );
    await preview.waitForTimeout(1000);
    const overflow = await frame.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert(
      overflow.content <= overflow.viewport + 2,
      "Horizontal overflow at " + width + "px: " + JSON.stringify(overflow),
    );
    await preview.screenshot({
      path: path.join(reportDir, `preview-${width}.png`),
    });
    if (width === 390) {
      await frame
        .getByRole("link", { name: "创建类似项目", exact: true })
        .scrollIntoViewIfNeeded();
      await preview.screenshot({
        path: path.join(reportDir, "preview-390-bottom.png"),
      });
    }
  }
  await interactive
    .getByRole("link", { name: "新建项目", exact: true })
    .click();
  await preview.waitForURL(
    (url) =>
      url.pathname ===
      "/projects/" + projectId + "/preview-full" + form.pageMeta.path,
    { timeout: 30000 },
  );
  await interactive
    .getByRole("heading", { name: "新建项目", exact: true })
    .waitFor();
  await interactive.getByLabel("项目名称").fill("AI 原型项目");
  await interactive.getByLabel("负责人").fill("林晓");
  await interactive
    .getByRole("button", { name: "创建项目", exact: true })
    .click();
  await interactive
    .getByRole("button", { name: "已创建（模拟）", exact: true })
    .waitFor();
  assert(
    await interactive
      .getByRole("button", { name: "已创建（模拟）", exact: true })
      .isDisabled(),
    "Submit state did not update",
  );
  await preview.screenshot({ path: path.join(reportDir, "interaction.png") });
  await preview.close();
  await open();
  await call("identify", {
    model: "acceptance-fixture",
    client: "nas-playwright",
    skill: "plasmic",
    outputFormat: "json",
  });
  const reopened = (
    await call("read", { componentUuids: [dashboard.uuid, form.uuid] })
  ).results;
  assert(
    reopened[0].baseVariantTplTree.includes("项目概览"),
    "Dashboard did not persist",
  );
  assert(
    reopened[1].interactions?.length && reopened[1].states?.length,
    "Interactions/state did not persist",
  );
  assert(!errors.length, "Browser errors: " + errors.join("; "));
  const report = {
    status: "PASS",
    projectId,
    revision: saved.revision,
    pages: reopened.map((c) => ({
      name: c.name,
      uuid: c.uuid,
      path: c.pageMeta.path,
    })),
    validation,
    toolCalls: calls.length,
    browserErrors: errors,
    checkedViewportWidths: [1440, 390],
    interactionVerified: true,
    navigationVerified: true,
    tagColorVerified: true,
  };
  fs.writeFileSync(
    path.join(reportDir, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
