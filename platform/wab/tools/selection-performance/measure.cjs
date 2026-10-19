const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("node:module").createRequire(
  path.resolve(__dirname, "../../package.json"),
)("playwright");
const reportDir = process.env.PLASMIC_SELECTION_REPORT_DIR;
const target = JSON.parse(process.env.PLASMIC_SELECTION_TARGET || "null");
assert(
  reportDir &&
    target?.name &&
    target.select?.length === 2 &&
    target.blank?.length === 2,
  "Set PLASMIC_SELECTION_REPORT_DIR and PLASMIC_SELECTION_TARGET",
);
const label = process.argv[2] || "before";
let browser;
(async () => {
  const b = await chromium.connectOverCDP(
    "http://127.0.0.1:" + (process.env.PLASMIC_SELECTION_CDP_PORT || "9339"),
  );
  browser = b;
  const p = b.contexts()[0].pages()[0];
  console.log("Preparing", label);
  let f;
  for (let attempt = 0; attempt < 120; attempt++) {
    for (const candidate of p.frames()) {
      if (
        candidate.url().endsWith("/static/host.html") &&
        (await candidate
          .evaluate(
            () => !!window.studioCtx && window.studioCtx.viewCtxs.length > 0,
          )
          .catch(() => false))
      ) {
        f = candidate;
        break;
      }
    }
    if (f) break;
    await p.waitForTimeout(500);
  }
  if (!f) throw new Error("Studio failed to load");
  console.log("Studio ready");
  await p.waitForTimeout(2000);
  await f.evaluate((targetName) => {
    const sc = window.studioCtx;
    clearInterval(sc.asyncSaverTimer);
    const ed = window.dbg.viewEditor;
    window.selectionBench?.observers?.forEach((observer) =>
      observer.disconnect(),
    );
    for (const method of ["handleMouseDown", "handleMouseUp"])
      delete ed[method];
    for (const vc of sc.viewCtxs) delete vc.csEvaluator.evalAsync;
    window.selectionBench = { rows: [], stage: null, evals: 0 };
    const bench = window.selectionBench;
    bench.events = [];
    bench.observers = [];
    for (const v of sc.viewCtxs) {
      const target = v.canvasCtx.doc().defaultView;
      const observer = new target.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          bench.events.push({
            name: entry.name,
            start:
              entry.startTime +
              target.performance.timeOrigin -
              performance.timeOrigin,
            duration: entry.duration,
            processing: entry.processingEnd - entry.processingStart,
          });
        }
      });
      observer.observe({ type: "event", durationThreshold: 16 });
      bench.observers.push(observer);
    }
    const studioObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        bench.events.push({
          name: entry.name,
          start: entry.startTime,
          duration: entry.duration,
          processing: entry.processingEnd - entry.processingStart,
        });
    });
    studioObserver.observe({ type: "event", durationThreshold: 16 });
    bench.observers.push(studioObserver);
    for (const vc of sc.viewCtxs) {
      const orig = vc.csEvaluator.evalAsync;
      vc.csEvaluator.evalAsync = function (...args) {
        bench.evals++;
        return orig.apply(this, args);
      };
    }
    for (const method of ["handleMouseDown", "handleMouseUp"]) {
      const orig = ed[method];
      ed[method] = function (e, ...args) {
        const stage = bench.stage;
        const started = performance.now();
        if (stage && !stage.started) {
          const perf = e.target?.ownerDocument?.defaultView?.performance;
          stage.started = started;
          stage.eventStart =
            e.timeStamp +
            (perf?.timeOrigin || performance.timeOrigin) -
            performance.timeOrigin;
          stage.evalStart = bench.evals;
          const poll = () => {
            const focused = sc.focusedViewCtx()?.focusedTpl();
            const match =
              stage.kind === "select"
                ? focused?.name === targetName
                : !sc.focusedViewCtx() && !sc.focusedFrame();
            if (
              match &&
              ((stage.kind === "select" &&
                document.querySelector(".hoverbox")) ||
                (stage.kind === "deselect" &&
                  !document.querySelector(".hoverbox")))
            ) {
              stage.feedback = performance.now() - stage.eventStart;
              stage.evals = bench.evals - stage.evalStart;
              stage.pending = sc.isSelectionPending ?? false;
              bench.rows.push(stage);
              if (bench.stage === stage) bench.stage = null;
            } else if (performance.now() - stage.started < 4000) {
              requestAnimationFrame(poll);
            } else {
              stage.error = "No matching selection feedback";
              bench.rows.push(stage);
              bench.stage = null;
            }
          };
          requestAnimationFrame(poll);
        }
        const result = orig.call(this, e, ...args);
        if (stage) {
          stage[method === "handleMouseDown" ? "down" : "up"] =
            performance.now() - started;
        }
        return result;
      };
    }
  }, target.name);
  await p.mouse.click(...target.blank);
  await p.waitForTimeout(500);
  for (let i = 0; i < 24; i++) {
    for (const kind of ["select", "deselect"]) {
      await f.evaluate(
        ({ kind, i }) => {
          window.selectionBench.stage = { kind, round: i };
        },
        { kind, i },
      );
      await p.mouse.click(
        ...(kind === "select" ? target.select : target.blank),
        { delay: 32 },
      );
      await f.waitForFunction(() => !window.selectionBench.stage, null, {
        timeout: 5000,
      });
      await p.waitForTimeout(350);
    }
  }
  const rows = await f.evaluate(() => {
    const bench = window.selectionBench;
    return bench.rows.map((row) => ({
      ...row,
      eventTiming: bench.events.filter(
        (e) =>
          Math.abs(e.start - row.eventStart) < 2 && e.name === "pointerdown",
      ),
    }));
  });
  if (rows.some((x) => x.error))
    throw new Error(JSON.stringify(rows.filter((x) => x.error)));
  const stats = {};
  for (const kind of ["select", "deselect"]) {
    const sample = rows.filter((x) => x.kind === kind && x.round >= 4);
    stats[kind] = { n: sample.length };
    for (const key of ["down", "up", "feedback", "evals"]) {
      const values = sample.map((x) => x[key] || 0).sort((a, b) => a - b);
      stats[kind][key] = {
        median:
          (values[Math.floor((values.length - 1) / 2)] +
            values[Math.floor(values.length / 2)]) /
          2,
        p95: values[Math.ceil(values.length * 0.95) - 1],
      };
    }
  }
  fs.writeFileSync(
    path.join(reportDir, `metrics-${label}.json`),
    JSON.stringify({ label, stats, rows }, null, 2),
  );
  console.log(JSON.stringify({ label, stats }, null, 2));
  await p.screenshot({ path: path.join(reportDir, `${label}.png`) });
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
