// Offline native IPC acceptance. Models and profiles stay in the private fixture.
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");

exports.install = async ({ task, mode, origin, startup, ipcMain, getWindow, report }) => {
  const desktop = process.env.PERF_DESKTOP_ROOT || path.resolve(__dirname, "../../src");
  const { DesktopDraftStore, createDraftHandler } = require(path.join(desktop, "drafts.cjs"));
  const { DesktopWorkspace } = require(path.join(desktop, "workspace.cjs"));
  const directory = path.join(task, "native-" + mode);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const workspace = new DesktopWorkspace(directory, origin);
  let store = new DesktopDraftStore(path.join(directory, "drafts"));
  const scope = { origin, userId: startup.selfInfo.user.id, projectId: startup.projectId, branchId: null };
  const metrics = report.native = { scenario: process.env.PERF_OPEN_NATIVE, calls: [], checks: [] };
  const unrelated = Number(process.env.PERF_OPEN_NATIVE_OTHER || 0);
  if (unrelated) {
    const opening = JSON.parse(await fs.readFile(path.join(task, "project-response.json"), "utf8"));
    const resources = JSON.parse(await fs.readFile(path.join(task, "model-resources.json"), "utf8"));
    const payload = {
      format: 1, branchId: null, projectName: "Offline fixture", baseRevision: opening.rev.revision,
      sequence: 1, savedAt: 1, modelVersion: opening.modelVersion, hostlessDataVersion: opening.hostlessDataVersion,
      bundle: JSON.parse(opening.rev.data),
      dependencies: opening.depPkgs.map(pkg => ({ id: pkg.id, model: JSON.parse(resources["/api/v1/dependency-models/" + pkg.modelResourceId].body) })),
    };
    for (let i = 0; i < unrelated; i++) {
      const projectId = "unrelated-" + i;
      const value = { ...payload, projectId, id: randomUUID() };
      await store.write({ ...scope, projectId }, process.env.PERF_DESKTOP_ROOT ? value : new TextEncoder().encode(JSON.stringify(value)));
    }
    if (store.close) { await store.close(); store = new DesktopDraftStore(path.join(directory, "drafts")); }
    else store.summaries.clear();
  }
  metrics.unrelatedProjects = unrelated;
  let payloadReads = 0;
  if (store.readDraft) {
    const readDraft = store.readDraft.bind(store);
    store.readDraft = async file => { payloadReads++; return readDraft(file); };
  }
  report.scope = report.scope.replace("native draft bridge, ", "") + " Native IPC uses production draft/workspace classes with a fixture identity, not live authentication.";
  let expected, originalName, savedView;
  const handler = createDraftHandler({
    store, origin,
    trustedSender: event => event.sender === getWindow().webContents && event.senderFrame === getWindow().webContents.mainFrame,
    projectId: url => workspace.projectId(url),
    currentUser: async () => startup.selfInfo.user.id,
  });
  ipcMain.handle("desktop:drafts", async (event, command, input) => {
    const start = performance.now(), readsBefore = payloadReads;
    const result = await handler.command(event, command, input);
    metrics.calls.push({ command, ms: performance.now() - start, payloadReads: store.readDraft ? payloadReads - readsBefore : null, drafts: command === "open" ? result.drafts.length : undefined });
    return result;
  });
  ipcMain.handle("desktop:saved-editor-view", (event, projectId) => {
    if (event.senderFrame !== getWindow().webContents.mainFrame || workspace.projectId(event.senderFrame.url) !== projectId) throw Error("Invalid Studio project");
    return workspace.savedEditorView(event.senderFrame.url);
  });
  return {
    reload: metrics.scenario !== "empty",
    preload: `contextBridge.exposeInMainWorld('desktopDrafts',{
      open:(userId,projectId,branchId)=>ipcRenderer.invoke('desktop:drafts','open',{userId,projectId,branchId}),
      read:async(handle,id)=>{const value=await ipcRenderer.invoke('desktop:drafts','read',{handle,id});return value instanceof Uint8Array?JSON.parse(new TextDecoder().decode(value)):value;},
      write:(handle,draftJson)=>ipcRenderer.invoke('desktop:drafts','write',{handle,${process.env.PERF_DESKTOP_ROOT ? 'draftJson' : 'draftData:new TextEncoder().encode(draftJson)'}}),
      remove:(handle,id,sequence)=>ipcRenderer.invoke('desktop:drafts','remove',{handle,id,sequence})
    });contextBridge.exposeInMainWorld('desktopEnvironment',{getSavedEditorView:projectId=>ipcRenderer.invoke('desktop:saved-editor-view',projectId)});`,
    async afterOpen(frame, iteration) {
      if (iteration === 0) await frame.executeJavaScript(`(async()=>{
        const s=studioCtx,v=s.getCurrentStudioViewportSnapshot();
        s.restoreStudioViewportSnapshot({...v,scale:v.scale*0.9,scroll:v.scroll.plus({x:71,y:83})},false);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      })()`);
      const state = await frame.executeJavaScript(`(()=>{
        const s=studioCtx,d=s.desktopDraft,v=s.getCurrentStudioViewportSnapshot(),a=s.currentArena;
        if(!d?.enabled||d.initializing||d.error)throw Error('Native drafts did not initialize');
        return {name:s.site.pageArenas[0].component.name,drafts:d.drafts.length,dialogOpen:d.dialogOpen,viewportCommitted:s.loadTimings.has('initial-viewport-commit'),
          view:{arenaId:a.name,arenaType:'custom',frameUuid:s.activeCanvasFrame?.uuid,scale:v.scale,scroll:{x:v.scroll.x,y:v.scroll.y},canvasPadding:{x:v.canvasPadding.x,y:v.canvasPadding.y}}};
      })()`);
      if (iteration === 0) {
        originalName = state.name;
        savedView = state.view;
        workspace.recent = [{ url: origin + "/projects/" + startup.projectId, editorView: savedView }];
        if (metrics.scenario !== "empty") {
          expected = originalName + "RecoveryProbe";
          await frame.executeJavaScript(`(async()=>{
            const s=studioCtx;clearInterval(s.asyncSaverTimer);
            await s.changeUnsafe(()=>s.siteOps().tryRenameArenas([{arena:s.site.pageArenas[0],newName:${JSON.stringify(expected)}}]));
            await s.awaitEval();if(!await s.desktopDraft.flush())throw Error('Native draft write failed');
          })()`);
          if (metrics.scenario === "conflict") {
            const [summary] = await store.list(scope);
            const stored = await store.read(scope, summary.id);
            const draft = stored instanceof Uint8Array ? JSON.parse(new TextDecoder().decode(stored)) : stored;
            const changed = { ...draft, baseRevision: draft.baseRevision + 1, sequence: draft.sequence + 1 };
            await store.write(scope, process.env.PERF_DESKTOP_ROOT ? changed : new TextEncoder().encode(JSON.stringify(changed)));
          }
        }
      } else {
        const wanted = metrics.scenario === "restore" ? expected : originalName;
        if (!state.viewportCommitted) throw Error("Native saved viewport did not take the restoration path");
        if (state.name !== wanted) throw Error("Native draft recovery changed the wrong model");
        if (metrics.scenario === "conflict" && (!state.dialogOpen || state.drafts !== 1)) throw Error("Conflicting draft was not preserved");
        const delta = Math.max(Math.abs(state.view.scale - savedView.scale), ...['x','y'].map(axis => Math.abs((state.view.scroll[axis] - state.view.canvasPadding[axis]) - (savedView.scroll[axis] - savedView.canvasPadding[axis]))));
        if (delta > 1) throw Error("Saved native viewport was not restored");
        metrics.checks.push({ iteration, recovered: state.name === expected, conflict: state.drafts === 1, viewportDelta: delta });
        if (metrics.scenario === "conflict") await frame.executeJavaScript("studioCtx.desktopDraft.dialogOpen=false");
      }
    },
  };
};
