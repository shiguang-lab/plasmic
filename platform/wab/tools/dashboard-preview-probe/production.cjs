const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium, firefox, webkit } = require("../../node_modules/playwright");

(async () => {
  const results = [];
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    console.log(`Starting ${name}`);
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1500, height: 1000 },
      });
      let maxFrames = 0,
        loads = 0,
        writes = 0;
      const errors = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
        console.log(name, error.message);
      });
      page.on("request", (req) => {
        if (req.url().includes("/canvas-preview/index.html")) {
          loads++;
        }
        if (req.method() !== "GET") {
          writes++;
        }
      });
      await page.goto("http://127.0.0.1:3218/");
      await page.waitForFunction(() => window.previewTests);
      await page.evaluate(() => {
        window.maxEngines = 0;
        window.engineObserver = new MutationObserver(() => {
          window.maxEngines = Math.max(
            window.maxEngines,
            document.querySelectorAll("iframe").length,
          );
        });
        window.engineObserver.observe(document.body, {
          subtree: true,
          childList: true,
        });
      });
      await page.evaluate(() => window.previewTests.purge());
      await page.evaluate(() => window.previewTests.mount(100));
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".card")]
            .filter((card) => {
              const r = card.getBoundingClientRect();
              return r.top < innerHeight && r.bottom > 0;
            })
            .every((card) => card.querySelector("img")) &&
          document.querySelectorAll(".card img").length > 0,
        undefined,
        { timeout: 120000 },
      );
      console.log(name, "generated");
      maxFrames = await page.evaluate(() => window.maxEngines);
      assert.equal(maxFrames, 1);
      assert.equal(loads, 2);
      assert.equal(await page.locator("iframe").count(), 0);
      await page.screenshot({
        path: `/tmp/plasmic-cover-probe/production-${name}.png`,
      });
      await page.evaluate(() => window.previewTests.clear());
      await page.waitForFunction(() => !document.querySelector(".card"));
      assert.equal(await page.locator("iframe").count(), 0);
      const before = loads;
      await page.evaluate(() => window.previewTests.mount(100));
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".card")]
            .filter((card) => {
              const r = card.getBoundingClientRect();
              return r.top < innerHeight && r.bottom > 0;
            })
            .every((card) => card.querySelector("img")) &&
          document.querySelectorAll(".card img").length > 0,
      );
      assert.equal(loads, before);
      // Scroll to the last cards; images outside the viewport release their Blob URLs.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".card")]
            .filter((card) => {
              const r = card.getBoundingClientRect();
              return r.top < innerHeight && r.bottom > 0;
            })
            .every((card) => card.querySelector("img")) &&
          document.querySelectorAll(".card img").length > 0,
      );
      assert.equal(loads, before);
      assert.equal(await page.locator("iframe").count(), 0);
      // Active cancellation: no iframe remains after unmount.
      await page.evaluate(() => window.previewTests.clear());
      await page.evaluate(() => window.previewTests.purge());
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        window.previewTests.mount(2);
      });
      await page.waitForFunction(() => document.querySelector("iframe"));
      await page.evaluate(() => window.previewTests.clear());
      await page.waitForFunction(() => !document.querySelector("iframe"));
      assert.equal(writes, 0);
      results.push({
        name,
        maxFrames,
        initialLoads: before,
        cacheAdditionalLoads: loads - before - 1,
        writes,
        errors,
      });
    } finally {
      await browser.close();
    }
  }
  await fs.writeFile(
    "/tmp/plasmic-cover-probe/production-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
