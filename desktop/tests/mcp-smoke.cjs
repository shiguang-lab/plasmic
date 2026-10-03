const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startDesktop } = require("../src/main.cjs");
const reportDir =
  process.env.PLASMIC_REPORT_DIR || "/tmp/plasmic-desktop-mcp-report";
fs.mkdirSync(reportDir, { recursive: true });
const profile =
  process.env.PLASMIC_DESKTOP_PROFILE || "/tmp/plasmic-desktop-report/profile";
app.setPath("userData", profile);
const projectId = process.env.PLASMIC_TEST_PROJECT_ID;
const componentProjectId = process.env.PLASMIC_TEST_COMPONENT_PROJECT_ID;
if (!projectId || !componentProjectId)
  throw new Error(
    "Set PLASMIC_TEST_PROJECT_ID and PLASMIC_TEST_COMPONENT_PROJECT_ID to an editable acceptance project and its Ant Design 6 catalog",
  );
const report = { status: "RUNNING", calls: [] };
let client, window;
const watchdog = setTimeout(() => {
  console.error("MCP acceptance timed out");
  app.exit(1);
}, 300000);
app
  .whenReady()
  .then(async () => {
    window = await startDesktop();
    window.webContents.session.webRequest.onErrorOccurred((details) => {
      console.log(
        "NETWORK FAILURE",
        details.error,
        new URL(details.url).origin + new URL(details.url).pathname,
      );
    });
    client = new Client({ name: "desktop-acceptance", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.env.PLASMIC_MCP_EXECUTABLE || process.execPath,
        args: process.env.PLASMIC_MCP_EXECUTABLE
          ? ["--mcp"]
          : [path.resolve(__dirname, "../src/entry.cjs"), "--mcp"],
        env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile },
        stderr: "pipe",
      }),
    );
    console.log("MCP CONNECTED");
    const listing = await client.listTools();
    assert.deepEqual(listing.tools.map((tool) => tool.name).sort(), [
      "browser",
      "capture_browser",
      "execute",
      "execute_batch",
      "export_code",
      "export_design",
      "export_pages",
      "generate_image",
      "get_app_state",
      "get_screenshot",
      "get_style",
      "import_image",
      "list_projects",
      "make_vector",
      "open_design",
      "read_image",
      "read_skill",
      "search_stock_images",
      "snapshot_layout",
      "vectorize_image",
    ]);
    async function call(name, args = {}) {
      console.log("MCP CALL", name);
      const result = await client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: 150000 },
      );
      report.calls.push({ name, args, isError: !!result.isError });
      assert(!result.isError, result.content?.[0]?.text || name + " failed");
      return result;
    }
    const state = JSON.parse((await call("get_app_state")).content[0].text);
    assert(state.running);
    const projects = JSON.parse((await call("list_projects")).content[0].text);
    assert(JSON.stringify(projects).includes(projectId));
    await call("open_design", { projectId: projectId });
    const ready = JSON.parse((await call("get_app_state")).content[0].text);
    assert(ready.ready && ready.editorTools.createComponent.inputSchema);
    async function execute(name, input = {}) {
      return JSON.parse(
        (await call("execute", { name, input })).content[0].text,
      );
    }
    const overview = await execute("read");
    assert(
      JSON.stringify(overview).includes("plasmicAntd6Button") ||
        JSON.stringify(overview).includes("plasmic-antd6-button"),
    );
    const stamp = Date.now();
    const created = await execute("createComponent", {
      name: "Desktop MCP acceptance " + stamp,
      type: "page",
      path: "/desktop-mcp-" + stamp,
    });
    const componentUuid = created.results[0].uuid;
    await execute("insertHtml", {
      componentUuid,
      html:
        '<main style="padding:32px;background:#f5f5f5;display:flex;flex-direction:column;gap:16px"><h1>Desktop MCP prototype</h1><p>Created through local MCP</p><plasmic-component data-plasmic-component="plasmic-antd6-button" data-plasmic-project="' +
        componentProjectId +
        '" data-props=\'{"type":"primary"}\'><slot name="children">Save design</slot></plasmic-component></main>',
    });
    const page = await execute("read", { componentUuids: [componentUuid] });
    const markup = page.results[0].baseVariantTplTree;
    const elementUuid = markup.match(/\bid="([^"]+)"/)?.[1];
    assert(elementUuid, "No editable element ID returned");
    await execute("changeElement", {
      componentUuid,
      elementUuid,
      styles: { background: "#eef4ff", padding: "40px" },
    });
    await execute("navigate", { componentUuid });
    const validation = await execute("validate", {
      componentUuids: [componentUuid],
    });
    assert(validation.valid);
    assert.equal(validation.antDesign6Instances, 1);
    const persisted = await execute("save");
    assert(persisted.saved);
    const screenshot = await call("get_screenshot", { componentUuid });
    const image = screenshot.content.find((item) => item.type === "image");
    assert.equal(image.mimeType, "image/png");
    const bytes = Buffer.from(image.data, "base64");
    assert(
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    );
    fs.writeFileSync(path.join(reportDir, "prototype.png"), bytes);
    // Reload the app, then use MCP to read the persisted page from NAS.
    await new Promise((resolve) => {
      window.webContents.once("did-finish-load", resolve);
      window.reload();
    });
    await call("open_design", {
      projectId: projectId,
      componentUuid,
    });
    const reloaded = await execute("read", { componentUuids: [componentUuid] });
    assert(reloaded.results[0].baseVariantTplTree.includes("#eef4ff"));
    // Input rejection belongs to the tool result, not a broken MCP connection.
    const unknown = await client.callTool({
      name: "execute",
      arguments: { name: "eval", input: { code: "process.exit()" } },
    });
    assert(unknown.isError);
    await call("get_app_state");
    Object.assign(report, {
      status: "PASS",
      componentUuid,
      validation,
      persisted: true,
      screenshotBytes: bytes.length,
      invalidOperationRejected: true,
    });
    fs.writeFileSync(
      path.join(reportDir, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log("DESKTOP MCP ACCEPTANCE PASS", componentUuid);
    await client.close();
    clearTimeout(watchdog);
    app.exit(0);
  })
  .catch(async (error) => {
    report.status = "FAIL";
    report.error = error.message;
    fs.writeFileSync(
      path.join(reportDir, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.error(error.message);
    if (window && !window.isDestroyed()) {
      console.error(
        "DESKTOP URL",
        window.webContents.getURL(),
        "LOADING",
        window.webContents.isLoading(),
      );
      fs.writeFileSync(
        path.join(reportDir, "failure.png"),
        (await window.webContents.capturePage()).toPNG(),
      );
    }
    await client?.close();
    clearTimeout(watchdog);
    app.exit(1);
  });
