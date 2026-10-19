const { chromium, firefox, webkit } = require("../../node_modules/playwright");
const { PNG } = require("../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/lib/utilsBundle.js");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const cases = [
  { name: "positive", shadow: "0 8px 0 red" },
  { name: "negative", shadow: "0 -8px 0 red" },
  { name: "fractional", shadow: "1px 2.5px 0 red" },
  { name: "inset-positive", shadow: "inset 0 6px 0 red" },
  { name: "inset-negative", shadow: "inset 0 -6px 0 red" },
  { name: "multiple", shadow: "0 8px 0 red, 0 -8px 0 green" },
  { name: "filtered", shadow: "0 8px 8px rgba(0,0,0,0.5)", filter: "saturate(1.1)" },
];
(async () => {
  const results = [], stylesheetReadiness = [];
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
      await page.route("**/__probe-delayed-style.css", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill({ contentType: "text/css", body: ".readiness-probe{font-family:monospace!important}" });
      });
      const errors = [], references = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.exposeFunction("captureReference", async (label) => {
        if (label !== "fidelity") return;
        const frame = page.frames().find((frame) => frame.url().includes("/canvas-preview/index.html"));
        const readiness = await frame.evaluate(async () => {
          const style = document.createElement("style");
          const probe = document.createElement("span");
          probe.className = "readiness-probe"; probe.textContent = "Font readiness";
          let loaded = false; style.addEventListener("load", () => { loaded = true; });
          style.textContent = '@import url("/__probe-delayed-style.css");';
          document.head.append(style); document.body.append(probe);
          try { await window.coverEngine.ready(); return { loaded, font: getComputedStyle(probe).fontFamily }; }
          finally { style.remove(); probe.remove(); }
        });
        stylesheetReadiness.push({ browser: name, ...readiness });
        assert.equal(readiness.loaded, true, `${name}: imported stylesheet must load before capture readiness`);
        assert.equal(readiness.font, "monospace");
        await frame.evaluate((cases) => {
          const root = document.getElementById("fidelity");
          root.replaceChildren();
          root.style.cssText = "position:absolute;left:0;top:0;width:1000px;height:800px;background:white";
          cases.forEach((item, index) => {
            const container = document.createElement("div");
            container.dataset.shadowCase = String(index);
            container.style.cssText = `position:absolute;left:${index * 120}px;top:0;width:100px;height:100px;background:white`;
            const box = document.createElement("div");
            box.style.cssText = `position:absolute;left:30px;top:30px;width:40px;height:30px;background:blue;box-shadow:${item.shadow};filter:${item.filter || "none"}`;
            container.append(box); root.append(container);
          });
        }, cases);
        await frame.evaluate(() => window.coverEngine.ready());
        for (let i = 0; i < cases.length; i++) references.push(PNG.sync.read(await frame.locator(`[data-shadow-case="${i}"]`).screenshot()));
      });
      await page.exposeFunction("captureResult", async (label, url, stats) => {
        if (label !== "fidelity") return;
        assert.deepEqual(stats.assetErrors, []);
        const image = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
        for (let i = 0; i < cases.length; i++) {
          let changed = 0;
          const reference = references[i];
          assert.equal(reference.width, 100); assert.equal(reference.height, 100);
          for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
            const actual = (y * image.width + i * 120 + x) * 4, expected = (y * 100 + x) * 4;
            if (Math.max(...[0, 1, 2].map((channel) => Math.abs(image.data[actual + channel] - reference.data[expected + channel]))) > 20) changed++;
          }
          results.push({ browser: name, case: cases[i].name, pixelsOver20Percent: changed / 100 });
        }
      });
      await page.goto("http://127.0.0.1:3217/?count=0");
      await page.waitForFunction(() => window.coverProbe);
      await page.evaluate(() => window.coverProbe.fidelity());
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  await fs.writeFile("/tmp/plasmic-cover-probe/shadow-fidelity.json", JSON.stringify(results, null, 2));
  await fs.writeFile("/tmp/plasmic-cover-probe/stylesheet-readiness.json", JSON.stringify(stylesheetReadiness, null, 2));
  assert.equal(results.length, 21);
  for (const result of results) assert.ok(result.pixelsOver20Percent < 1, `${result.browser}: ${result.case}: ${result.pixelsOver20Percent}%`);
  console.log(JSON.stringify(results));
})().catch((error) => { console.error(error); process.exitCode = 1; });
