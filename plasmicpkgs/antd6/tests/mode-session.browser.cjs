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
      response.end(`<button id="mode">Toggle mode</button><button id="standalone">Standalone</button><button id="selection">Toggle selection</button><iframe id="canvas" style="width:1440px;height:900px;border:0" src="/frame?widget=${widget}"></iframe><script>let interactive=false,selected=true;document.querySelector('#mode').onclick=()=>{interactive=!interactive;document.querySelector('#canvas').contentWindow.postMessage({sessionMode:{interactive,standalone:false}},'*')};document.querySelector('#selection').onclick=()=>{selected=!selected;document.querySelector('#canvas').contentWindow.postMessage({sessionSelection:selected},'*')};document.querySelector('#standalone').onclick=()=>document.querySelector('#canvas').contentWindow.postMessage({sessionMode:{interactive:true,standalone:true}},'*')</script>`);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const widget of ["pagination", "tabs", "modal", "drawer", "collapse", "menu", "table", "picker", "tooltip", "table-tooltip", "table-popover", "table-popconfirm", "table-dropdown", "table-popover-click", "table-dropdown-click"]) {
      const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?widget=${widget}`);
      const frame = page.frames().find((candidate) => candidate.url().includes("/frame?"));
      assert(frame, "The canvas iframe must exist");
      if (widget === "pagination") {
        await page.locator("#mode").click();
        await frame.locator('[data-mode="interactive"]').waitFor();
        assert.deepEqual(await frame.evaluate(() => window.sessionCheck.calls), []);
        const origin = frame.url();
        const second = frame.getByRole("link", { name: "Page 2", exact: true });
        assert.equal(await second.getAttribute("href"), "/records?page=2&size=10");
        assert.equal(await second.getAttribute("rel"), "next");
        await second.click();
        await frame.locator('[aria-label="Page 2"][aria-current="page"]').waitFor();
        assert.equal(await frame.getByLabel("Current page").textContent(), "2");
        assert.equal(frame.url(), origin, "SEO pagination must not navigate the iframe");
        await frame.getByRole("link", { name: "Page 3", exact: true }).press("Enter");
        await frame.locator('[aria-label="Page 3"][aria-current="page"]').waitFor();
        assert.equal(await frame.getByLabel("Current page").textContent(), "3");
        assert.equal(frame.url(), origin);
        const expected = ["page:2:10", "page:3:10"];
        assert.deepEqual(await frame.evaluate(() => window.sessionCheck.calls), expected);
        await page.locator("#mode").click();
        await frame.locator('[data-mode="editing"]').waitFor();
        await page.locator("#mode").click();
        await frame.locator('[data-mode="interactive"]').waitFor();
        assert.deepEqual(await frame.evaluate(() => window.sessionCheck.calls), expected);
        assert.equal(await frame.getByLabel("Current page").textContent(), "3");
        assert.deepEqual(errors, []);
        results.push({ widget, passed: true, pointerAndKeyboard: true, iframeNavigation: false, businessEventsAtModeChanges: 0 });
        await page.close();
        continue;
      }
      if (widget.startsWith("table-")) {
        const kind = widget.split("-")[1];
        const click = kind === "popconfirm" || widget.endsWith("-click");
        const popupSelector = kind === "tooltip" ? ".ant-tooltip:not(.ant-tooltip-hidden)" : kind === "dropdown" ? ".ant-dropdown:not(.ant-dropdown-hidden)" : ".ant-popover:not(.ant-popover-hidden)";
        await frame.addStyleTag({ content: `td.ant-table-cell-ellipsis > .__wab_text, td.ant-table-cell-ellipsis > .__wab_text > .__wab_rich_text { display:block; max-width:100%; overflow:hidden; text-overflow:inherit; white-space:inherit }` });
        const popups = frame.locator(popupSelector);
        const outside = frame.locator("[data-outside]");
        const visibleRows = () => popups.locator("[data-popup-row]").evaluateAll((elements) => elements.map((element) => Number(element.dataset.popupRow)).sort((a, b) => a - b));
        const expectRows = async (rows) => {
          await frame.waitForFunction(({ selector, rows }) => {
            const visible = [...document.querySelectorAll(selector + " [data-popup-row]")].map((element) => Number(element.dataset.popupRow)).sort((a, b) => a - b);
            return JSON.stringify(visible) === JSON.stringify(rows);
          }, { selector: popupSelector, rows }, { timeout: 5000 }).catch(async () => {
            assert.deepEqual(await visibleRows(), rows, `${widget}: unexpected popup rows`);
          });
          assert.equal(await popups.count(), rows.length, `${widget}: another row's popup opened`);
          assert.deepEqual(await visibleRows(), rows);
        };
        const resetCalls = () => frame.evaluate(() => { window.sessionCheck.calls.length = 0; });
        const readCalls = () => frame.evaluate(() => [...window.sessionCheck.calls]);
        const toggle = async (interactive) => {
          const before = await readCalls();
          // Changing canvas mode must not itself generate pointer or business events.
          await page.locator("#mode").evaluate((button) => button.click());
          await frame.locator(`[data-mode="${interactive ? "interactive" : "editing"}"]`).waitFor();
          await frame.evaluate(async () => { for (let index = 0; index < 4; index++) await new Promise(requestAnimationFrame); });
          assert.deepEqual(await readCalls(), before, `${widget}: mode change emitted business callbacks`);
        };
        const open = async (row) => {
          const target = frame.locator(`[data-row="${row}"]`);
          if (click) { await target.click(); } else { await target.hover(); }
          await expectRows([row]);
          const css = await target.evaluate((element) => ({ overflow: getComputedStyle(element).overflow, ellipsis: getComputedStyle(element).textOverflow, truncated: element.firstElementChild.scrollWidth > element.firstElementChild.clientWidth }));
          assert.deepEqual(css, { overflow: "hidden", ellipsis: "ellipsis", truncated: true }, `${widget}: cell lost ellipsis`);
          assert.equal(await popups.locator("[data-popup-row]").innerText(), await target.innerText());
        };
        const close = async () => {
          if (click) { await outside.click(); } else { await outside.hover(); }
          await expectRows([]);
        };
        const exercise = async () => {
          await resetCalls();
          for (const row of [4, 1, 0]) { await open(row); await close(); }
          const expected = [4, 1, 0].flatMap((row) => [`open:${row}:true${kind === "dropdown" ? ":trigger" : ""}`, `open:${row}:false${kind === "dropdown" ? ":trigger" : ""}`]);
          assert.deepEqual(await readCalls(), expected, `${widget}: open/close callbacks affected another row or ran twice`);
          if (kind === "tooltip") {
            await resetCalls();
            for (const row of [0, 1, 2, 3, 4]) { await open(row); }
            await close();
            const transitions = [0, 1, 2, 3, 4].flatMap((row) => [`open:${row}:true`, `open:${row}:false`]);
            assert.deepEqual((await readCalls()).slice().sort(), transitions.sort(), `${widget}: direct row transitions lost a hover event`);
          }
          if (kind === "popconfirm") {
            await open(1);
            await popups.getByRole("button", { name: "Confirm", exact: true }).click();
            await expectRows([]);
            await open(4);
            await popups.getByRole("button", { name: "Cancel", exact: true }).click();
            await expectRows([]);
            assert.deepEqual((await readCalls()).filter((call) => /^(confirm|cancel):/.test(call)), ["confirm:1", "cancel:4"]);
          }
          if (kind === "dropdown") {
            await open(1);
            await popups.getByRole("menuitem").click();
            await expectRows([]);
            assert.deepEqual((await readCalls()).filter((call) => call.startsWith("action:")), ["action:1:details"]);
          }
          return readCalls();
        };
        await frame.locator('[data-row="4"]').waitFor();
        await expectRows([4]);
        assert.deepEqual(await readCalls(), []);
        await toggle(true);
        await expectRows([4]);
        await page.locator("#selection").click();
        await expectRows([]);
        assert.deepEqual(await readCalls(), [], "Selection changes must not emit business callbacks");
        const baseline = await exercise();
        await frame.evaluate(() => { window.trackedCell = document.querySelector('[data-row="0"]'); });
        for (let round = 0; round < 2; round++) {
          await open(0);
          await toggle(false);
          await expectRows([0]);
          await toggle(true);
          await expectRows([0]);
          assert.equal(await frame.evaluate(() => window.trackedCell === document.querySelector('[data-row="0"]')), true, `${widget}: mode change remounted the cell`);
          await close();
          assert.deepEqual(await exercise(), baseline, `${widget}: behavior changed after a mode round trip`);
        }
        await page.locator("#standalone").click();
        await expectRows([]);
        assert.deepEqual(await exercise(), baseline, `${widget}: interactive mode differs from native preview`);
        assert.deepEqual(errors, []);
        results.push({ widget, passed: true, rows: [4, 1, 0], roundTripsWhileOpen: 2,
          modes: ["interactive", "interactive-after-editing", "preview"], callbacksMatchPreview: true,
          rowIsolation: true, ellipsisPreserved: true, actions: kind === "popconfirm" ? ["confirm", "cancel"] : kind === "dropdown" ? ["menu action"] : [] });
        await page.close();
        continue;
      }
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
            2);
          assert.equal(await frame.locator(".ant-tooltip:visible").count(), 2,
            "Selection reveals remain visible in both canvas modes");
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
        await page.locator("#selection").click();
        await frame.waitForFunction(() => !document.querySelector(".ant-tooltip:not(.ant-tooltip-hidden)"));
        assert.deepEqual(await frame.evaluate(() => window.sessionCheck.calls), [], "Releasing selection is silent");
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
