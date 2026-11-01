// Isolated Studio diagnostics. No production imports or background samplers.
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.connectStudioCdp = async (win) => {
  const debuggerApi = win.webContents.debugger;
  let sessionId;
  async function hasStudio(id) {
    const contexts = [];
    const listener = (_event, method, params, eventSession) => {
      if (method === "Runtime.executionContextCreated" && (eventSession || undefined) === id) contexts.push(params.context.id);
    };
    debuggerApi.on("message", listener);
    try {
      await debuggerApi.sendCommand("Runtime.enable", {}, id);
      for (const contextId of contexts) {
        const result = await debuggerApi.sendCommand("Runtime.evaluate", { expression: "!!globalThis.studioCtx", contextId, returnByValue: true }, id);
        if (result.result.value) return true;
      }
      return false;
    } finally { debuggerApi.off("message", listener); }
  }
  if (!(await hasStudio(undefined))) {
    const { targetInfos } = await debuggerApi.sendCommand("Target.getTargets");
    for (const target of targetInfos.filter(t => ["iframe", "page"].includes(t.type))) {
      const attached = await debuggerApi.sendCommand("Target.attachToTarget", { targetId: target.targetId, flatten: true });
      if (await hasStudio(attached.sessionId)) { sessionId = attached.sessionId; break; }
      await debuggerApi.sendCommand("Target.detachFromTarget", { sessionId: attached.sessionId });
    }
    if (!sessionId) throw Error("Studio CDP target not found");
  }
  const command = (name, args = {}) => debuggerApi.sendCommand(name, args, sessionId);
  command.sessionId = sessionId;
  return command;
};

exports.run = async ({ frame, win, task, variant }) => {
  const run = source => frame.executeJavaScript(source);
  const debuggerApi = win.webContents.debugger;
  const cdp = await exports.connectStudioCdp(win);
  const gcControl = process.env.PERF_UNDO_GC_CONTROL === "1";
  if (gcControl && process.env.PERF_UNDO_SNAPSHOTS === "1") throw Error("Run detached-CDP GC control separately from heap snapshots");
  if (gcControl) {
    if (!(await run("typeof gc === 'function'"))) throw Error("Diagnostic GC flag did not expose gc");
    debuggerApi.detach();
  }
  const result = { variant, gcControl, samples: [], latency: [], scope: "Production Studio runtime, controlled standalone project, isolated offline profile" };
  async function collect(label) {
    if (gcControl) {
      await run("gc(); true");
      await sleep(100);
      await run("gc(); true");
    } else {
      await cdp("Runtime.discardConsoleEntries");
      await cdp("HeapProfiler.collectGarbage");
    }
    await sleep(100);
    const state = await run(`(()=>{
      const s=studioCtx;
      return {records:s.undoLog._log.length,views:s.viewCtxs.length,
        refs:(window.__undoRefs||[]).map(r=>({frame:r.frame,disposed:!s.viewCtxs.some(v=>v.arenaFrame().uuid===r.frame),viewDisposed:r.view.deref()?.isDisposed,valAlive:!!r.val.deref(),viewAlive:!!r.view.deref(),documentAlive:!!r.document.deref()})),errors:__perf.errors};
    })()`);
    const heap = gcControl
      ? await run("({usedSize:performance.memory.usedJSHeapSize,source:'performance.memory, coarse, not CDP heap size'})")
      : await cdp("Runtime.getHeapUsage");
    result.samples.push({ label, state, heap, rss: app.getAppMetrics().map(p => ({ type: p.type, pid: p.pid, rssKiB: p.memory.workingSetSize })) });
    if (process.env.PERF_UNDO_SNAPSHOTS === "1") {
      const output = path.join(task, `undo-${variant}-${label}.heapsnapshot`);
      const file = fs.openSync(output, "w", 0o600);
      const listener = (_event, method, params, id) => {
        if (method === "HeapProfiler.addHeapSnapshotChunk" && (id || undefined) === cdp.sessionId) fs.writeSync(file, params.chunk);
      };
      debuggerApi.on("message", listener);
      try { await cdp("HeapProfiler.takeHeapSnapshot", { reportProgress: false }); }
      finally { debuggerApi.off("message", listener); fs.closeSync(file); }
    }
  }
  await collect("baseline");
  await run(`(async()=>{
    const s=studioCtx,component=s.site.pageArenas[0].component;
    window.__undoArenas=[];window.__undoRefs=[];
    await s.changeUnsafe(()=>{for(let i=0;i<10;i++){
      const arena=s.tplMgr().addArena('UndoArena'+i);
      s.tplMgr().addNewMixedArenaFrame(arena,'UndoFrame',component,{width:640,height:480,insertPt:s.viewportCtx.visibleScalerBox().topLeft()});
      __undoArenas.push(arena);
    }});
  })()`);
  for (let i = 0; i < 10; i++) {
    await run(`(async()=>{
      const s=studioCtx,a=__undoArenas[${i}];s.switchToArena(a);await s.awaitStudioReady();
      const vc=s.tryGetViewCtxForFrame(a.children[0]),tpl=vc.component.tplTree;
      s.changeSelection(()=>vc.setStudioFocusByTpl(tpl));
      for(let n=0;n<2;n++) await s.changeUnsafe(()=>{tpl.name='Edited'+${i}+'_'+n});
      await s.awaitStudioReady();
      Object.defineProperty(vc.focusedSelectable(),'__undoRetentionProbe',{value:'undo-frame-'+${i},configurable:true});
      __undoRefs.push({frame:a.children[0].uuid,val:new WeakRef(vc.focusedSelectable()),view:new WeakRef(vc),document:new WeakRef(vc.canvasCtx.doc())});
    })()`);
  }
  await collect("target");
  await run(`(async()=>{const s=studioCtx;s.switchToArena(s.site.pageArenas[0]);await s.awaitStudioReady()})()`);
  await collect("final");
  const rounds = Number(process.env.PERF_UNDO_ROUNDS || 20);
  for (let i = 0; i < rounds; i++) {
    result.latency.push(await run(`(async()=>{
      const s=studioCtx,t=performance.now();await s.undo();await s.awaitStudioReady();
      const vc=s.focusedViewCtx();return {operation:'undo',ms:performance.now()-t,focused:vc?.focusedTpl()?.name,arena:s.currentArena?.name,selection:!!vc?.focusedSelectable(),records:s.undoLog._log.length};
    })()`));
  }
  for (let i = 0; i < rounds; i++) {
    result.latency.push(await run(`(async()=>{
      const s=studioCtx,t=performance.now();await s.redo();await s.awaitStudioReady();
      const vc=s.focusedViewCtx();return {operation:'redo',ms:performance.now()-t,focused:vc?.focusedTpl()?.name,arena:s.currentArena?.name,selection:!!vc?.focusedSelectable(),records:s.undoLog._log.length};
    })()`));
  }
  result.final = await run(`({name:studioCtx.site.pageArenas[0].component.tplTree.name,errors:__perf.errors,canUndo:studioCtx.canUndo(),canRedo:studioCtx.canRedo(),records:studioCtx.undoLog._log.length,revision:studioCtx.dbCtx().revisionNum})`);
  if (result.final.errors.length) throw Error("Studio errors during undo diagnostics");
  if (result.final.name !== "Edited9_1") throw Error("Redo model mismatch");
  if (process.env.PERF_UNDO_FUNCTIONAL === "1") {
    try {
      await run(`window.__undoBoundTest=${process.env.PERF_UNDO_BOUND === "1"};true`);
      await run(`(()=>{
        const s=studioCtx,undo=s.undo.bind(s),switchToArena=s.switchToArena.bind(s);
        s.undo=(...args)=>{window.__undoLastAction='undo';return undo(...args)};
        s.switchToArena=(arena,...args)=>{window.__undoLastAction='switch:'+arena.name;return switchToArena(arena,...args)};
      })()`);
      result.functional = await Promise.race([
        run("__undoFunctional()"),
        sleep(60000).then(() => { throw Error("Undo functional scenario timed out"); }),
      ]);
      if (result.functional.errors.length) throw Error("Studio errors during undo functional scenario");
      result.renderedStyles = await run(`(async()=>{
        window.__undoStage='computed-styles';
        const s=studioCtx,arena=s.site.arenas.find(a=>a.name==='UndoCases');
        const component=s.site.components.find(c=>c.name==='UndoInner');
        const tpl=component.tplTree.children.find(t=>t.name==='DefaultText');
        s.changeSelection(()=>s.switchToArena(arena));await s.awaitEval();await s.awaitStudioReady();
        const frames=[];
        for(const frame of arena.children){
          const vc=await s.awaitViewCtxForFrame(frame);await vc.awaitSync();
          const elements=vc.renderState.tpl2fullKeys(tpl).flatMap(key=>{
            const val=vc.renderState.fullKey2val(key);return val?Array.from(vc.renderState.sel2dom(val,vc.canvasCtx)||[]):[];
          }).filter(element=>element.nodeType===1);
          const colors=elements.map(element=>vc.canvasCtx.win().getComputedStyle(element).color);
          if(!colors.length||colors.some(color=>color!=='rgb(7, 13, 29)'))throw Error('Rendered style mismatch after undo');
          frames.push({instances:colors.length,colors});
        }
        return {passed:true,frames};
      })()`);
    } catch (error) {
      result.functionalError = String(error?.message || error);
      result.functionalProgress = await run("({stage:window.__undoStage,action:window.__undoLastAction,arena:studioCtx.currentArena?.name,position:studioCtx.undoLog._nextInsertPos,cases:window.__undoCases,coldProof:window.__undoColdProof,errors:__perf.errors,stack:studioCtx.focusedViewCtx()?.componentStackFrames().map(f=>f.component.name),focus:studioCtx.focusedViewCtx()?.focusedTpl()?.name})").catch(() => null);
      fs.writeFileSync(path.join(task, `undo-${variant}-${process.env.PERF_RUN_ID || "main"}.json`), JSON.stringify(result, null, 2));
      throw error;
    }
  }
  fs.writeFileSync(path.join(task, `undo-${variant}-${process.env.PERF_RUN_ID || "main"}.json`), JSON.stringify(result, null, 2));
  return result;
};
