const fs = require("node:fs"),
  path = require("node:path");
const { connectStudioCdp } = require("./undo-studio.cjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.run = async ({ frame, win, task, variant }) => {
  const cdp = await connectStudioCdp(win),
    run = (source) => frame.executeJavaScript(source);
  const id = process.env.PERF_RUN_ID || "main";
  const cycles = Number(process.env.PERF_PREVIEW_CACHE_CYCLES || 12);
  if (!Number.isInteger(cycles) || cycles < 1)
    throw Error("Expected a positive cycle count");
  const report = {
    variant,
    cycles: [],
    samples: [],
    scope:
      "Actual Studio model replacement + real live/docs code generation; protected second codegen consumer. Offline revision protocol; no business backend writes.",
  };
  const file = path.join(task, `preview-cache-${variant}-${id}.json`);
  async function collect(label) {
    await cdp("Runtime.discardConsoleEntries");
    for (let i = 0; i < 2; i++) {
      await cdp("HeapProfiler.collectGarbage");
      await sleep(100);
    }
    const heap = await cdp("Runtime.getHeapUsage"),
      state = await run(`({
      ...__previewCacheDiag.state(),
      retiredViewsAlive: __retiredPreviewFrames.filter(ref => !!ref.view.deref()).length,
      retiredDocumentsAlive: __retiredPreviewFrames.filter(ref => !!ref.document.deref()).length
    })`);
    report.samples.push({ label, heap, state });
    console.log(
      JSON.stringify({ label, heapMiB: heap.usedSize / 1048576, ...state }),
    );
    fs.writeFileSync(file, JSON.stringify(report, null, 2), { mode: 0o600 });
    if (process.env.PERF_PREVIEW_CACHE_SNAPSHOTS === "1") {
      const out = fs.openSync(
        path.join(task, `preview-cache-${variant}-${id}-${label}.heapsnapshot`),
        "w",
        0o600,
      );
      const listener = (_e, method, p, session) => {
        if (
          method === "HeapProfiler.addHeapSnapshotChunk" &&
          (session || undefined) === cdp.sessionId
        )
          fs.writeSync(out, p.chunk);
      };
      win.webContents.debugger.on("message", listener);
      try {
        await cdp("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
      } finally {
        win.webContents.debugger.off("message", listener);
        fs.closeSync(out);
      }
    }
  }
  try {
    report.setup = await run("__previewCacheDiag.setup()");
    await run("window.__retiredPreviewFrames = []");
    await collect("baseline");
    for (let i = 0; i < cycles; i++) {
      if (i > 0)
        await run(`(() => {
        const view = studioCtx.viewCtxs[0];
        __retiredPreviewFrames.push({view:new WeakRef(view),document:new WeakRef(view.canvasCtx.doc())});
      })()`);
      report.cycles.push(await run("__previewCacheDiag.cycle()"));
      if (i === 5) await collect("target");
    }
    await collect("final");
    if (report.samples.some((s) => s.state.errors.length))
      throw Error("Studio errors in cache diagnostics");
  } catch (error) {
    report.error = String(error?.stack || error);
    throw error;
  } finally {
    fs.writeFileSync(file, JSON.stringify(report, null, 2), { mode: 0o600 });
  }
  return report;
};
