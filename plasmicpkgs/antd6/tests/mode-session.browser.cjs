const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const repo = path.resolve(__dirname, "../../..");
const wab = path.join(repo, "platform/wab");
const { build } = require(path.join(wab, "node_modules/esbuild"));
const { chromium } = require(path.join(wab, "node_modules/playwright"));

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-mode-session-"));
  let browser, server;
  try {
    const bundle = path.join(directory, "app.js");
    await build({
      entryPoints: [path.join(__dirname, "mode-session.browser.tsx")], bundle: true, outfile: bundle,
      define: { "process.env.NODE_ENV": '"development"' },
      plugins: [{ name: "studio-source", setup(builder) {
        builder.onResolve({ filter: /^@\// }, ({ path: source }) => ({ path: path.join(wab, "src", source.slice(2)) + ".ts" }));
        builder.onResolve({ filter: /^@plasmicapp\/host(?:\/.*)?$/ }, ({ path: source }) => ({ path: path.join(repo, "packages/host/src", source === "@plasmicapp/host" ? "exports.ts" : source.slice("@plasmicapp/host/".length) + ".ts") }));
      } }],
    });
    const script = await fs.readFile(bundle);
    server = http.createServer((request, response) => {
      response.setHeader("Content-Type", request.url === "/app.js" ? "text/javascript" : "text/html");
      if (request.url === "/app.js") {return response.end(script);}
      if (request.url.startsWith("/frame")) {return response.end('<div id="root"></div><script src="/app.js"></script>');}
      const widget = new URL(request.url, "http://local").searchParams.get("widget") || "tabs";
      response.end(`<button id="mode">Toggle mode</button><button id="standalone">Standalone</button><iframe id="canvas" style="width:1440px;height:900px;border:0" src="/frame?widget=${widget}"></iframe><script>let interactive=false;document.querySelector('#mode').onclick=()=>{interactive=!interactive;document.querySelector('#canvas').contentWindow.postMessage({sessionMode:{interactive,standalone:false}},'*')};document.querySelector('#standalone').onclick=()=>document.querySelector('#canvas').contentWindow.postMessage({sessionMode:{interactive:true,standalone:true}},'*')</script>`);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const widget of ["tabs", "modal", "drawer", "collapse", "menu", "table", "picker", "tooltip"]) {
      const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?widget=${widget}`);
      const frame = page.frames().find((candidate) => candidate.url().includes("/frame?"));
      assert(frame, "The canvas iframe must exist");
      const input = frame.getByRole("textbox").first();
      await input.waitFor({ state: "visible" });
      if (widget !== "picker") {await input.fill("retained draft");}
      await frame.evaluate(() => { window.trackedInput = document.querySelector("input"); });
      const frames = [];
      for (let index = 0; index < 4; index++) {
        await page.locator("#mode").click();
        const sample = await frame.evaluate(async () => {
          const values = [];
          for (let sampleIndex = 0; sampleIndex < 6; sampleIndex++) {
            await new Promise(requestAnimationFrame);
            const field = document.querySelector("input");
            values.push({ sameNode: field === window.trackedInput, connected: !!field?.isConnected,
              value: field?.value, selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
              indicator: document.querySelector('.ant-tabs-ink-bar')?.getAttribute('style') });
          }
          return values;
        });
        for (const value of sample) {
          assert(value.sameNode && value.connected, `${widget}: mode switch remounted input`);
          if (widget !== "picker") {assert.equal(value.value, "retained draft");}
          if (widget === "tabs") {assert.equal(value.selectedTab, "Second");}
        }
        frames.push(...sample);
        if (widget === "tooltip") {
          await frame.waitForFunction((expected) =>
            document.querySelectorAll(".ant-tooltip:not(.ant-tooltip-hidden)").length === expected,
            index % 2 ? 2 : 0);
          assert.equal(await frame.locator(".ant-tooltip:visible").count(), index % 2 ? 2 : 0,
            "Editing reveals must not leak into interactive mode");
        }
      }
      const calls = await frame.evaluate(() => window.sessionCheck.calls);
      assert.deepEqual(calls, [], `${widget}: mode switch emitted a business event`);
      if (widget === "tabs") {assert.equal(new Set(frames.map((value) => value.indicator)).size, 1, "Tabs indicator moved at a mode boundary");}
      const checkTooltips = async () => {
        for (const [row, target] of [[0, input], [1, frame.getByRole("button", { name: "Second tooltip" })], [0, input]]) {
          await target.hover();
          await frame.getByRole("tooltip", { name: `Full text ${row}`, exact: true }).waitFor({ state: "visible" });
          assert.equal(await frame.locator(".ant-tooltip:visible").count(), 1, "Repeated tooltips must remain independent");
          await page.locator("#standalone").hover();
          await frame.locator(".ant-tooltip:visible").waitFor({ state: "hidden" });
        }
      };
      if (widget === "tooltip") {
        await page.locator("#mode").click();
        await frame.locator('[data-mode="interactive"]').waitFor();
        await frame.waitForFunction(() => !document.querySelector(".ant-tooltip:not(.ant-tooltip-hidden)"));
        await checkTooltips();
        await frame.waitForFunction(() => window.sessionCheck.calls.length === 12);
        assert.deepEqual(await frame.evaluate(() => window.sessionCheck.calls),
          Array.from({ length: 3 }, () => ["tooltip:true", "after:true", "tooltip:false", "after:false"]).flat());
        await input.hover();
        await frame.getByRole("tooltip", { name: "Full text 0", exact: true }).waitFor({ state: "visible" });
        await page.locator("#mode").click();
        await frame.locator('[data-mode="editing"]').waitFor();
        // Let the native mouse-leave delay finish while editing absorbs business events.
        await frame.evaluate(async () => {
          for (let index = 0; index < 20; index++) {await new Promise(requestAnimationFrame);}
        });
        await page.locator("#mode").click();
        await frame.locator('[data-mode="interactive"]').waitFor();
        await frame.waitForFunction(() => !document.querySelector(".ant-tooltip:not(.ant-tooltip-hidden)"));
      }
      await page.locator("#standalone").click();
      if (widget === "tabs") {await frame.getByRole("tab", { name: "First", selected: true }).waitFor();}
      else if (widget === "picker") {assert.equal(await input.inputValue(), "");}
      else if (widget === "tooltip") {
        await frame.locator(".ant-tooltip:visible").waitFor({ state: "hidden" });
        await checkTooltips();
      }
      else {await input.waitFor({ state: "hidden" });}
      assert.deepEqual(errors, [], `${widget}: browser runtime errors`);
      results.push({ widget, passed: true, checkedFrames: frames.length, businessEventsAtModeChanges: calls.length });
      await page.close();
    }
    await fs.writeFile(path.join(directory, "results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: true, results, evidence: path.join(directory, "results.json") }, null, 2));
  } finally {
    await browser?.close();
    if (server) {await new Promise((resolve) => server.close(resolve));}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
