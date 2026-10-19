const { firefox, webkit } = require("../../node_modules/playwright");
const {
  PNG,
} = require("../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/lib/utilsBundle.js");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
(async () => {
  const results = [];
  for (const [name, type] of Object.entries({ firefox, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1200 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let reference, title;
      await page.exposeFunction("captureReference", async (label) => {
        if (label === "fidelity") {
          title = await page.locator("#engine").evaluate(frame => {
            const heading = frame.contentDocument.querySelector("h1.gradient-text");
            if (!heading) throw new Error("Missing fidelity heading");
            const rect = heading.getBoundingClientRect();
            return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
          });
          reference = await page.locator("#engine").screenshot();
          await fs.writeFile(
            `/tmp/plasmic-cover-probe/fidelity-${name}-live.png`,
            reference,
          );
        }
      });
      await page.exposeFunction("captureResult", async (label, url, stats) => {
        if (label !== "fidelity") {
          return;
        }
        const png = Buffer.from(url.split(",")[1], "base64");
        await fs.writeFile(
          `/tmp/plasmic-cover-probe/fidelity-${name}-static.png`,
          png,
        );
        const p = PNG.sync.read(reference),
          q = PNG.sync.read(png);
        let changed = 0,
          delta = 0;
        for (let i = 0; i < p.data.length; i += 4) {
          let max = 0;
          for (let c = 0; c < 3; c++) {
            const d = Math.abs(p.data[i + c] - q.data[i + c]);
            max = Math.max(max, d);
            delta += d;
          }
          if (max > 20) {
            changed++;
          }
        }
        const ink = (image) => {
          let count = 0;
          for (let y = Math.floor(title.y); y < Math.ceil(title.y + title.height); y++)
            for (let x = Math.floor(title.x); x < Math.ceil(title.x + title.width); x++) {
              const i = (y * image.width + x) * 4;
              const channels = [...image.data.subarray(i, i + 3)];
              if (Math.max(...channels) - Math.min(...channels) > 40) count++;
            }
          return count;
        };
        results.push({
          name,
          fidelity: {
            ...stats,
            titleInk: {live: ink(p), snapshot: ink(q)},
            pixelsOver20Percent: (100 * changed) / (p.width * p.height),
            meanChannelDelta: delta / (p.width * p.height * 3),
          },
        });
      });
      await page.goto("http://127.0.0.1:3217/?count=0");
      await page.waitForFunction(() => !!window.coverProbe);
      await page.evaluate(() => window.coverProbe.purge());
      const start = Date.now();
      await page.evaluate(() => window.coverProbe.mount(2));
      const record = {
        name,
        coldMs: Date.now() - start,
        ...(await page.evaluate(() => ({
          stats: window.coverProbe.stats(),
          timings: window.coverProbe.timings,
        }))),
      };
      results.push(record);
      await page.screenshot({
        path: `/tmp/plasmic-cover-probe/overview-${name}.png`,
      });
      await page.evaluate(() => window.coverProbe.clear());
      await page.evaluate(() => window.coverProbe.fidelity());
      await page.reload();
      await page.waitForFunction(() => !!window.coverProbe);
      await page.evaluate(() => window.coverProbe.mount(2));
      record.afterReload = await page.evaluate(() => window.coverProbe.stats());
      record.errors = errors;
    } catch (e) {
      results.push({ name, error: e.message });
    } finally {
      await browser.close();
    }
  }
  await fs.writeFile(
    "/tmp/plasmic-cover-probe/browsers.json",
    JSON.stringify(results, null, 2),
  );
  assert.ok(
    results.every((r) => !r.error),
    "Browser pipeline must succeed",
  );
  for (const name of ["firefox", "webkit"]) {
    const record = results.find((r) => r.name === name && r.stats);
    assert.equal(record.stats.images, 2);
    assert.equal(record.afterReload.engines, 0);
    assert.equal(record.afterReload.cacheHits, 2);
    assert.equal(record.errors.length, 0);
    const sample = results.find((r) => r.name === name && r.fidelity).fidelity;
    assert.ok(sample.titleInk.live > 100, "Live gradient title must contain visible text");
    assert.ok(sample.titleInk.snapshot >= sample.titleInk.live * 0.9, "Snapshot must retain gradient title pixels");
    assert.equal(sample.canvases, 1);
    assert.equal(sample.svgs, 4);
    assert.equal(sample.assetErrors.length, 0);
    assert.ok(sample.pixelsOver20Percent < 1, "Chart / Canvas / CSS fidelity");
  }
  console.log(
    JSON.stringify(
      results.map(({ timings: _timings, ...r }) => r),
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
