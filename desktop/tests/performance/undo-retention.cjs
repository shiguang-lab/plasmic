// Disposable offline Studio only. The save API acknowledges locally; this does
// not validate a business backend or write to a real project.
const fs = require("node:fs");
const path = require("node:path");
const { connectStudioCdp } = require("./undo-studio.cjs");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.run = async ({ frame, win, task, variant }) => {
  const run = source => frame.executeJavaScript(source);
  const cdp = await connectStudioCdp(win);
  const id = process.env.PERF_RUN_ID || "retain";
  const operations = Number(process.env.PERF_RETAIN_OPERATIONS || 600);
  if (!Number.isInteger(operations) || operations <= 0 || operations % 2) throw Error("Expected a positive even command count");
  const retainedSteps = Math.min(operations, Number(process.env.PERF_RETAIN_HISTORY_STEPS || 50));
  if (!Number.isInteger(retainedSteps) || retainedSteps <= 0 || retainedSteps % 2) throw Error("Expected a positive even retained step count");
  const report = { variant, operations, retainedSteps, samples: [], scope: "Complete client save with local diagnostic acknowledgement; no backend save validation" };
  const file = path.join(task, `undo-retain-${variant}-${id}.json`);
  async function collect(label) {
    await cdp("Runtime.discardConsoleEntries");
    for (let i = 0; i < 2; i++) {
      await cdp("HeapProfiler.collectGarbage");
      await sleep(100);
    }
    const heap = await cdp("Runtime.getHeapUsage");
    const state = await run(`(()=>{const s=studioCtx;return {model:__undoGrowth.state(),records:s.undoLog._log.length,pending:s._changeRecords.length,revision:s.dbCtx().revisionNum,saveStatus:s.saveStatus,errors:__perf.errors}})()`);
    report.samples.push({ label, heap, state });
    fs.writeFileSync(file, JSON.stringify(report, null, 2), {mode:0o600});
    console.log(JSON.stringify({ label, heapMiB:heap.usedSize/1048576, records:state.records, pending:state.pending,saveStatus:state.saveStatus }));
    if (process.env.PERF_RETAIN_SNAPSHOTS === "1" && ["baseline", "target", "history-released"].includes(label)) {
      const output = fs.openSync(path.join(task, `retain-${variant}-${id}-${label}.heapsnapshot`), "w", 0o600);
      const listener = (_event, method, params, session) => {
        if (method === "HeapProfiler.addHeapSnapshotChunk" && (session || undefined) === cdp.sessionId) fs.writeSync(output, params.chunk);
      };
      win.webContents.debugger.on("message", listener);
      try { await cdp("HeapProfiler.takeHeapSnapshot", {reportProgress:false}); }
      finally { win.webContents.debugger.off("message", listener);fs.closeSync(output); }
    }
  }
  try {
    await run("__undoGrowth.setup('subtree')");
    await run("__undoGrowth.advance(10)");
    await run("(async()=>{const s=studioCtx;await s.awaitStudioReady();s.needsFullSave=true;await s.save();if(s.saveStatus!=='saved')throw Error('Baseline save failed');s.clearUndoLog();s.createViewStateUndoRecord();__undoGrowth.resetCounter()})()");
    await collect("baseline");
    const cpu = process.env.PERF_RETAIN_CPU === "1";
    if (cpu) await cdp("Performance.enable");
    const metricsBefore = cpu ? await cdp("Performance.getMetrics") : null;
    const longTasksBefore = await run("__perf.longTasks.length");
    const start = performance.now();
    await run(`__undoGrowth.advance(${operations})`);
    await run("studioCtx.awaitStudioReady()");
    report.mutationsAndReadyMs = performance.now() - start;
    if (cpu) {
      const metricsAfter = await cdp("Performance.getMetrics");
      report.performanceSeconds = Object.fromEntries(metricsAfter.metrics
        .filter(m => ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].includes(m.name))
        .map(m => [m.name, m.value - metricsBefore.metrics.find(b => b.name === m.name).value]));
      report.longTasks = await run(`__perf.longTasks.slice(${longTasksBefore})`);
    }
    await collect("target");
    await run(`(async()=>{const s=studioCtx;if(s.undoLog._log.length!==${retainedSteps+1})throw Error('Unexpected retained history');const records=s.undoLog._log.length;await s.save();if(s.saveStatus!=='saved'||s._changeRecords.length)throw Error('Client save did not drain');if(s.undoLog._log.length!==records)throw Error('Save changed history')})()`);
    await collect("saved");
    report.functional = await run("__undoGrowth.verifyUndoRedo()");
    await run("studioCtx.save()");
    await collect("verified");
    if (process.env.PERF_RETAIN_LATENCY === "1") {
      report.latency = [];
      for (let i = 0; i < 20; i++) for (const action of ["undo", "redo"]) {
        const start = performance.now();
        await run(`(async()=>{await studioCtx.${action}();await studioCtx.awaitStudioReady()})()`);
        report.latency.push({action,ms:performance.now()-start});
      }
    }
    if (process.env.PERF_RETAIN_FULL_UNDO === "1") {
      report.fullHistory = await run(`(async()=>{const s=studioCtx,latency=[];for(const action of ['undo','redo']){for(let i=1;i<=${retainedSteps};i++){
        const start=performance.now();await s[action]();await s.awaitStudioReady();latency.push({action,ms:performance.now()-start});
        const expected=120+(i%2),state=__undoGrowth.state();if(state.rootChildren!==expected)throw Error('History position model mismatch '+action+' '+i);
      }if(action==='undo'&&s.canUndo())throw Error('Oldest history boundary mismatch');}if(s.canRedo()||!s.canUndo()||s.undoLog._log.length!==${retainedSteps+1})throw Error('History final position mismatch');return {undo:${retainedSteps},redo:${retainedSteps},records:s.undoLog._log.length,latency}})()`);
    }
    await run("studioCtx.clearUndoLog();true");
    await collect("history-released");
    if (report.samples.some(s => s.state.errors.length)) throw Error("Studio errors during retention scenario");
  } catch (error) {
    report.error=String(error?.stack || error);
    throw error;
  } finally {fs.writeFileSync(file,JSON.stringify(report,null,2),{mode:0o600});}
  return report;
};
