const { chromium } = require("../../node_modules/playwright");
const {
  PNG,
} = require("../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/lib/utilsBundle.js");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const outDir = "/tmp/plasmic-cover-probe";
function compare(a, b) {
  const p = PNG.sync.read(a),
    q = PNG.sync.read(b);
  assert.equal(p.width, q.width);
  assert.equal(p.height, q.height);
  let delta = 0,
    changed = 0;
  const diff = new PNG({ width: p.width, height: p.height });
  for (let i = 0; i < p.data.length; i += 4) {
    let max = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(p.data[i + c] - q.data[i + c]);
      delta += d;
      max = Math.max(max, d);
      diff.data[i + c] = d;
    }
    diff.data[i + 3] = 255;
    if (max > 20) {
      changed++;
    }
  }
  return {
    width: p.width,
    height: p.height,
    meanChannelDelta: delta / (p.width * p.height * 3),
    pixelsOver20Percent: (100 * changed) / (p.width * p.height),
    diff: PNG.sync.write(diff),
  };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1,
    });
    const errors = [],
      requests = [],
      fidelity = [],
      results = [];
    let references = new Map(),
      peakMiB = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) =>
      requests.push({ method: r.method(), url: r.url() }),
    );
    await page.addInitScript(() => {
      window.probeLongTasks = [];
      new PerformanceObserver((l) =>
        window.probeLongTasks.push(...l.getEntries().map((e) => e.duration)),
      ).observe({ type: "longtask", buffered: true });
    });
    const browserCdp = await browser.newBrowserCDPSession();
    const rss = async () => {
      const { processInfo } = await browserCdp.send(
        "SystemInfo.getProcessInfo",
      );
      return processInfo.map((p) => ({
        ...p,
        rssMiB:
          Number(
            execFileSync("ps", ["-o", "rss=", "-p", String(p.id)], {
              encoding: "utf8",
            }).trim(),
          ) / 1024,
      }));
    };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const heap = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      return Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    };
    await page.exposeFunction("captureReference", async (label) => {
      const png = await page.locator("#engine").screenshot({ timeout: 15000 });
      references.set(label, png);
      await fs.writeFile(`${outDir}/${label}-live.png`, png);
      const m = await heap();
      peakMiB = Math.max(peakMiB, m.JSHeapUsedSize / 1048576);
    });
    await page.exposeFunction("captureResult", async (label, url, stats) => {
      const png = Buffer.from(url.split(",")[1], "base64");
      await fs.writeFile(`${outDir}/${label}-static.png`, png);
      const { diff, ...numbers } = compare(references.get(label), png);
      references.delete(label);
      await fs.writeFile(`${outDir}/${label}-diff.png`, diff);
      fidelity.push({ label, ...numbers, ...stats });
      console.log("fidelity", label, JSON.stringify(numbers));
    });
    const measure = async (name) => {
      const m = await heap();
      results.push({
        name,
        heapMiB: m.JSHeapUsedSize / 1048576,
        processes: await rss(),
        domNodes: m.Nodes,
        ...(await page.evaluate(() => ({
          stats: window.coverProbe.stats(),
          timings: window.coverProbe.timings,
          longTasks: window.probeLongTasks,
        }))),
      });
      console.log("measure", name, results.at(-1).heapMiB);
    };
    await page.goto("http://127.0.0.1:3217/?count=0");
    await page.waitForFunction(() => !!window.coverProbe);
    await page.evaluate(() => window.coverProbe.purge());
    await measure("empty");
    let started = Date.now();
    await page.evaluate(() => window.coverProbe.mount(2));
    await measure("two-cold-static");
    results.at(-1).wallMs = Date.now() - started;
    await page.screenshot({ path: `${outDir}/canvas-overviews.png` });
    for (const t of results.at(-1).timings.filter((x) => x.positions)) {
      for (const p of t.positions) {
        assert.ok(
          p.left >= 0 &&
            p.top >= 0 &&
            p.left + p.width <= 640.01 &&
            p.top + p.height <= 360.01,
          "Every artboard fits the preview",
        );
      }
    }
    await page.evaluate(() => window.coverProbe.clear());
    await measure("two-cleared");
    await page.evaluate(() => window.coverProbe.fidelity());
    await measure("fidelity-unmounted");
    // Recreate the renderer repeatedly to expose retained cross-window references.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.coverProbe.purge());
      await page.evaluate(() => window.coverProbe.mount(2));
      await page.evaluate(() => window.coverProbe.clear());
      await measure(`regenerate-${i + 1}-cleared`);
    }
    await page.reload();
    await page.waitForFunction(() => !!window.coverProbe);
    await page.route("**/fixture/*.json", (route) =>
      route.request().url().endsWith("/config.json")
        ? route.continue()
        : route.abort(),
    );
    const before = requests.length;
    started = Date.now();
    await page.evaluate(() => window.coverProbe.mount(100));
    await measure("hundred-from-persistent-cache");
    results.at(-1).wallMs = Date.now() - started;
    assert.equal(results.at(-1).stats.engines, 0);
    assert.equal(results.at(-1).stats.images, 100);
    assert.equal(results.at(-1).stats.maxActive, 0);
    assert.equal(results.at(-1).stats.cacheHits, 100);
    assert.equal(
      requests
        .slice(before)
        .filter(
          (r) =>
            r.url.includes("/static/") || /\/fixture\/.+\.json/.test(r.url),
        ).length,
      0,
      "Cache hits must not start any project renderer or download models",
    );
    await page.evaluate(() => window.coverProbe.clear());
    await measure("hundred-cleared");
    // Diagnostic only: browsers reclaim native caches under pressure. This is not a web-app API.
    await browserCdp.send("Memory.simulatePressureNotification", {
      level: "critical",
    });
    await measure("after-native-memory-pressure");
    assert.equal(errors.length, 0);
    assert.equal(requests.filter((r) => r.method !== "GET").length, 0);
    assert.ok(
      results.every((r) => r.stats.engines === 0 && r.stats.maxActive <= 1),
    );
    const sample = fidelity.find((f) => f.label === "fidelity");
    assert.equal(
      sample.canvases,
      1,
      "Canvas must be copied before the engine is destroyed",
    );
    assert.equal(sample.svgs, 4, "All chart and icon SVG roots are retained");
    assert.ok(
      sample.pixelsOver20Percent < 1,
      "Chart / Canvas / complex CSS fidelity",
    );
    assert.ok(
      fidelity.every((f) => f.assetErrors.length === 0),
      "No lost stylesheet, font or image assets",
    );
    const cleared = results.filter((r) => /regenerate-.*-cleared/.test(r.name));
    assert.ok(
      cleared.every((r) => r.heapMiB < 10),
      "Heavy engine must be released",
    );
    assert.ok(
      cleared.at(-1).heapMiB - cleared[0].heapMiB < 1,
      "Repeated generation must not retain project models",
    );
    const out = {
      fixtureCount: 2,
      peakRendererHeapMiB: peakMiB,
      results,
      fidelity,
      errors,
      nonGetRequests: requests.filter((r) => r.method !== "GET"),
    };
    await fs.writeFile(
      `${outDir}/static-benchmark.json`,
      JSON.stringify(out, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          results: results.map(({ timings: _timings, longTasks, ...r }) => ({
            ...r,
            maxLongTaskMs: Math.max(0, ...longTasks),
          })),
          peakRendererHeapMiB: peakMiB,
          fidelity: fidelity.filter((f) => f.label === "fidelity"),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
