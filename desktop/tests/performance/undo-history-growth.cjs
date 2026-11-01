// Memory attribution in an offline disposable Studio. Diagnostic controls below
// deliberately remove roots only after measuring/verifying the full undo history.
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const { connectStudioCdp } = require("./undo-studio.cjs");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.run = async ({ frame, win, task, variant }) => {
  const scenario = process.env.PERF_UNDO_GROWTH;
  const historySteps = Number(process.env.PERF_RETAIN_HISTORY_STEPS || 50);
  if (!Number.isInteger(historySteps) || historySteps <= 0) throw Error("Expected a positive history step limit");
  const milestones = ["small", "grouped", "drag"].includes(scenario) ? [0, 100, 500, 1000, 3000, 5000]
    : scenario === "text" ? [0, 100, 500, 1000]
    : scenario === "subtree" ? [0, 100, 300, 600] : null;
  if (!milestones) throw Error("PERF_UNDO_GROWTH must be small, grouped, drag, text or subtree");
  const run = source => frame.executeJavaScript(source);
  const cdp = await connectStudioCdp(win);
  const report = { scenario, variant, milestones, samples: [], controls: [],
    scope: "Full Studio, standalone offline project. Commands are model transactions, not input events. No production history limit or cache setting changed." };
  const file = path.join(task, `undo-growth-${scenario}-${process.env.PERF_RUN_ID || "main"}.json`);
  const persist = () => fs.writeFileSync(file, JSON.stringify(report, null, 2), { mode: 0o600 });
  async function collect(label, operations) {
    await cdp("Runtime.discardConsoleEntries");
    await cdp("HeapProfiler.collectGarbage");
    await sleep(100);
    await cdp("HeapProfiler.collectGarbage");
    const heap = await cdp("Runtime.getHeapUsage");
    const state = await run(`(()=>{
      const s=studioCtx,log=s.undoLog._log,vals=new Set(),stacks=new Set(),strings=new Set();
      let changes=0,newInsts=0,removedInsts=0;
      for(const r of log){
        if(r.view.focusedSelectable) vals.add(r.view.focusedSelectable);
        for(const f of r.view.vcComponentStack||[]) stacks.add(f);
        changes+=r.changes.changes.length;newInsts+=r.changes.newInsts.length;removedInsts+=r.changes.removedInsts.length;
        for(const c of r.changes.changes){if(typeof c.oldValue==='string')strings.add(c.oldValue);if(typeof c.newValue==='string')strings.add(c.newValue)}
      }
      return {records:log.length,changes,newInsts,removedInsts,uniqueSelectables:vals.size,variantFrameClones:stacks.size,
        uniqueScalarStringCharacters:[...strings].reduce((n,v)=>n+v.length,0),pendingRecords:s._changeRecords.length,
        views:s.viewCtxs.length,model:__undoGrowth.state(),errors:__perf.errors};
    })()`);
    return { label, operations, heap, state,
      rss: app.getAppMetrics().map(p => ({ type: p.type, rssKiB: p.memory.workingSetSize })) };
  }
  try {
    await run(`__undoGrowth.setup(${JSON.stringify(scenario)})`);
    // Warm the exact mutation path, then discard warm-up history in this fixture.
    await run("__undoGrowth.advance(10)");
    await run("(async()=>{await studioCtx.awaitStudioReady();studioCtx.clearUndoLog();studioCtx.createViewStateUndoRecord();__undoGrowth.resetCounter()})()");
    let operations = 0;
    for (const target of milestones) {
      const start = performance.now();
      if (target > operations) await run(`__undoGrowth.advance(${target - operations})`);
      operations = target;
      await run("studioCtx.awaitStudioReady()");
      const raw = await collect("before-pending-drain", operations);
      // Match only buffer/counter bookkeeping after an acknowledgement. There
      // is no server save or revision increment, and the history is unchanged.
      await run("studioCtx._changeRecords.splice(0);studioCtx._savedChangeCounter=studioCtx._changeCounter;true");
      const drained = await collect("pending-drained", operations);
      const expectedRecords = Math.min(historySteps, ["grouped", "drag"].includes(scenario) ? Math.ceil(target / 50) : target) + 1;
      if (drained.state.records !== expectedRecords) throw Error("Model commands did not produce the expected history records");
      if (drained.state.errors.length) throw Error("Studio error during growth scenario");
      report.samples.push({ operations, elapsedMs: performance.now() - start, raw, drained });
      persist();
      console.log(JSON.stringify({ scenario, operations, records:drained.state.records,heapMiB:drained.heap.usedSize/1048576 }));
    }
    report.functional = await run("__undoGrowth.verifyUndoRedo()");
    report.controls.push(await collect("after-undo-redo-verification", operations));
    await run("studioCtx._changeRecords.splice(0);studioCtx._savedChangeCounter=studioCtx._changeCounter;true");
    report.controls.push(await collect("pending-drained-after-verification", operations));
    // These are attribution controls only, never a proposed product behavior.
    await run("for(const r of studioCtx.undoLog._log){r.view.focusedSelectable=undefined;r.view.currentComponentCtx=undefined}true");
    report.controls.push(await collect("runtime-view-links-removed", operations));
    await run("{const view={focusedOnFrame:false};for(const r of studioCtx.undoLog._log)r.view=view}true");
    report.controls.push(await collect("all-view-snapshots-released", operations));
    await run("studioCtx.undoLog._log.splice(0);true");
    report.controls.push(await collect("history-released", operations));
  } catch (error) {
    report.error = String(error?.stack || error);
    throw error;
  } finally { persist(); }
  return report;
};
