const { chromium } = require("../../node_modules/playwright");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1120, height: 800 },
    });
    const cdp = await page.context().newCDPSession(page),
      bc = await browser.newBrowserCDPSession();
    await cdp.send("Performance.enable");
    const results = [];
    const measure = async (name) => {
      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics"),
        { processInfo } = await bc.send("SystemInfo.getProcessInfo");
      const values = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
      const renderer = processInfo.find((p) => p.type === "renderer");
      const result = {
        name,
        heapMiB: values.JSHeapUsedSize / 1048576,
        heapTotalMiB: values.JSHeapTotalSize / 1048576,
        rssMiB:
          Number(
            execFileSync("ps", ["-o", "rss=", "-p", String(renderer.id)], {
              encoding: "utf8",
            }).trim(),
          ) / 1024,
        stats: await page.evaluate(() => window.coverProbe.stats()),
      };
      results.push(result);
      console.log(JSON.stringify(result));
    };
    await page.goto("http://127.0.0.1:3217/?count=0");
    await page.waitForFunction(() => window.coverProbe);
    await measure("empty");
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.coverProbe.purge());
      await page.evaluate(() => window.coverProbe.mount(2));
      await measure(`generation-${i + 1}`);
      await page.evaluate(() => window.coverProbe.clear());
      await measure(`clear-${i + 1}`);
    }
    await page.waitForTimeout(3000);
    await measure("idle-cleared");
    await bc.send("Memory.simulatePressureNotification", { level: "critical" });
    await page.waitForTimeout(3000);
    await measure("diagnostic-pressure-cleared");
    await fs.writeFile(
      "/tmp/plasmic-cover-probe/memory.json",
      JSON.stringify(results, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
