const { chromium } = require("../../node_modules/playwright");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1000 },
    });
    await page.goto("http://127.0.0.1:3218/");
    await page.waitForFunction(() => window.previewTests);
    const cdp = await page.context().newCDPSession(page),
      bc = await browser.newBrowserCDPSession();
    await cdp.send("Performance.enable");
    const measurements = [];
    const measure = async (name) => {
      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      const { processInfo } = await bc.send("SystemInfo.getProcessInfo");
      const values = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
      const rss = processInfo
        .filter((p) => p.type === "renderer")
        .reduce(
          (sum, p) =>
            sum +
            Number(
              execFileSync("ps", ["-o", "rss=", "-p", String(p.id)], {
                encoding: "utf8",
              }).trim(),
            ),
          0,
        );
      const targets = await bc.send("Target.getTargets");
      const result = {
        targets: targets.targetInfos.map((t) => ({
          type: t.type,
          url: t.url.slice(0, 160),
        })),
        name,
        heapMiB: values.JSHeapUsedSize / 1048576,
        rendererRssMiB: rss / 1024,
        frames: await page.locator("iframe").count(),
        documents: values.Documents,
        nodes: values.Nodes,
      };
      measurements.push(result);
      console.log(JSON.stringify(result));
    };
    await measure("baseline");
    for (let round = 0; round < 3; round++) {
      for (let id = 0; id < 2; id++) {
        await page.evaluate((i) => window.previewTests.generate(i), id);
      }
      await page.evaluate(() => window.previewTests.clear());
      await page.waitForTimeout(500);
      await measure(`round-${round + 1}`);
    }
    await page.waitForTimeout(3000);
    await measure("idle");
    await fs.writeFile(
      "/tmp/plasmic-cover-probe/production-memory.json",
      JSON.stringify(measurements, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
