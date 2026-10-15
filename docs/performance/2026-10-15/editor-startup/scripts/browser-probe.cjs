const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const req = createRequire(path.join(process.env.PROBE_REPO, "package.json"));
const { chromium } = req("playwright");
const { startProxy, bootstrap } = require("./probe-common.cjs");
const crypto = require("node:crypto");
const spki = crypto
  .createHash("sha256")
  .update(
    new crypto.X509Certificate(
      fs.readFileSync(
        path.join(process.env.PROBE_OUTPUT_ROOT, "proxy-cert.pem"),
      ),
    ).publicKey.export({ type: "spki", format: "der" }),
  )
  .digest("base64");
const base = process.env.PROBE_OUTPUT_ROOT,
  mode = process.env.PROBE_MODE,
  runId = process.env.PROBE_RUN;
const out = path.join(base, runId);
assert(!fs.existsSync(out), "Use a new PROBE_RUN for an uncached profile");
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
const target = JSON.parse(fs.readFileSync(base + "/workspace-seed.json"))
  .workspace[0];
const report = {
  mode,
  runId,
  startedAt: new Date().toISOString(),
  samples: [],
  errors: [],
  status: "RUNNING",
};
const persist = () =>
  fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
let proxy, browser, page;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(name, input = {}) {
  const result = await page.evaluate(
    ({ name, input }) => window.PLASMIC_AI_TOOLS[name](input),
    { name, input },
  );
  assert(result.success, result.error?.message || name);
  return result.output ? JSON.parse(result.output) : null;
}
async function collect(start, phase) {
  let frame, data;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (!frame) {
      for (const f of page.frames()) {
        try {
          if (await f.evaluate(() => !!window.studioCtx?.loadTimings)) {
            frame = f;
            break;
          }
        } catch {}
      }
    }
    if (frame) {
      try {
        data = await frame.evaluate(() => {
          const s = window.studioCtx;
          return {
            timingStartAt: performance.timeOrigin + s.loadTimings.startedAt,
            timeOrigin: performance.timeOrigin,
            timings: s.loadTimings.snapshot(),
            probe: window.__startupProbe,
            revision: s.dbCtx().revisionNum,
            initialViewport: s.initialViewportReady,
            target: s.activeCanvasFrame?.uuid,
            frames: (s.currentArena?.children || []).map((f) => ({
              uuid: f.uuid,
              ready: !!s.tryGetViewCtxForFrame(f)?.initialRenderReady,
            })),
            cssViewport: {
              width: innerWidth,
              height: innerHeight,
              dpr: devicePixelRatio,
            },
          };
        });
        if (
          data.probe.visibleCanvasAt &&
          data.probe.editableAt &&
          data.timings.entries.some(
            (e) => e.phase === "all-frame-contexts-created",
          )
        )
          break;
      } catch (e) {
        report.lastError = e.message;
        frame = null;
      }
    }
    await sleep(50);
  }
  assert(data?.probe?.visibleCanvasAt, "Visible artboard did not render");
  assert(data?.probe?.editableAt, "Target did not become editable");
  assert.equal(data.revision, 18, "Project revision changed");
  const topReveal = await page.evaluate(
    () => window.__startupProbe?.topRevealAt,
  );
  assert(topReveal, "Top loading layer did not reveal");
  const context = await call("getEditorContext");
  const sample = {
    phase,
    startAt: start,
    timingStartAt: data.timingStartAt,
    timeOrigin: data.timeOrigin,
    topRevealAt: topReveal,
    firstRenderedMs: data.probe.visibleCanvasAt - start,
    visibleCanvasMs: Math.max(data.probe.visibleCanvasAt, topReveal) - start,
    editableMs: Math.max(data.probe.editableAt, topReveal) - start,
    globalRevealMs: data.probe.globalRevealAt - start,
    timings: data.timings,
    longTasks: data.probe.longTasks,
    frames: data.frames,
    revision: data.revision,
    cssViewport: data.cssViewport,
    editorContext: context,
  };
  report.samples.push(sample);
  persist();
  console.log(
    JSON.stringify({
      runId,
      phase,
      visibleCanvasMs: sample.visibleCanvasMs,
      editableMs: sample.editableMs,
      revision: sample.revision,
    }),
  );
  await page.screenshot({ path: out + "/" + phase + ".png" });
  return frame;
}
(async () => {
  proxy = await startProxy(Number(process.env.PROBE_GATEWAY_PORT));
  const context = await chromium.launchPersistentContext(
    path.join(out, "profile"),
    {
      headless: process.env.PROBE_HEADFUL !== "1",
      proxy: { server: "http://127.0.0.1:3444" },
      viewport: { width: 1512, height: 887 },
      deviceScaleFactor: 2,
      ignoreHTTPSErrors: false,
      args: ["--ignore-certificate-errors-spki-list=" + spki],
    },
  );
  browser = context;
  await context.addCookies(
    JSON.parse(fs.readFileSync(base + "/seed-cookies.json")).map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite:
        {
          no_restriction: "None",
          lax: "Lax",
          strict: "Strict",
          unspecified: "Lax",
        }[c.sameSite] || "Lax",
      expires: c.expirationDate || -1,
    })),
  );
  await context.addInitScript(bootstrap);
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message.slice(0, 1500)));
  let start = Date.now();
  await page.goto(target.url, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await collect(start, "cold");
  await page.goto("about:blank");
  await sleep(250);
  start = Date.now();
  await page.goto(target.url, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  const frame = await collect(start, "reopen");
  if (process.env.PROBE_EDIT === "1")
    report.editing = await require("./qa.cjs").verify(
      call,
      (source) => frame.evaluate(source),
      (name) => page.screenshot({ path: out + "/" + name + ".png" }),
    );
  assert.equal(
    proxy.requests.filter((r) => r.blocked).length,
    0,
    "Design write attempted",
  );
  assert(
    proxy.requests.some(
      (r) => r.path === "/api/v1/projects/iqBeCQWLFWvGwftodkcHbN",
    ),
    "Project model bypassed controlled gateway",
  );
  if (mode === "after")
    assert(
      proxy.requests.some((r) =>
        r.path.startsWith("/api/v1/editor-bootstrap/"),
      ),
      "Bootstrap optimization not exercised",
    );
  report.status = "PASS";
})()
  .catch((e) => {
    report.status = "FAIL";
    report.error = e.stack;
    console.error(e.stack);
  })
  .finally(async () => {
    report.proxyRequests = proxy?.requests;
    persist();
    await browser?.close();
    proxy?.close();
    process.exit(report.status === "PASS" ? 0 : 1);
  });
