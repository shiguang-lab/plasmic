const fs = require("node:fs"),
  path = require("node:path");
// Offline diagnostics only: API fixtures and all profiles live in a private directory.
const repo = path.resolve(__dirname, "../../..");
const { app, BrowserWindow, session } = require(
  require.resolve("electron", { paths: [repo + "/desktop"] }),
);
if (!process.argv[2] || !process.argv[3])
  throw Error("Required: private fixture directory, build variant");
const task = path.resolve(process.argv[2]),
  variant = process.argv[3];
if (process.env.PERF_UNDO_GC_CONTROL === "1") app.commandLine.appendSwitch("js-flags", "--expose-gc");
app.setPath(
  "userData",
  path.join(
    task,
    "profile-" + variant + "-" + (process.env.PERF_RUN_ID || "main"),
  ),
);
app.setName("Plasmic diagnostic");
app.on("window-all-closed", () => {});
const opening = JSON.parse(
    fs.readFileSync(path.join(task, "project-response.json")),
  ),
  startup = opening.startup;
const models = JSON.parse(
    fs.readFileSync(path.join(task, "model-resources.json")),
  ),
  codes = JSON.parse(fs.readFileSync(path.join(task, "code-resources.json")));
const keepAlive = process.env.PERF_KEEP_ALIVE
  ? Number(process.env.PERF_KEEP_ALIVE)
  : null;
if (keepAlive) startup.appConfig.config.liveArenas = keepAlive;
Object.assign(
  models,
  JSON.parse(fs.readFileSync(path.join(task, "plume-resources.json"))),
);
const plume = JSON.parse(
  fs.readFileSync(path.join(task, "plume-opening.json")),
);
const savedFullRevisions = new Map();
const revisionDiagnostics = process.env.PERF_UNDO_VERSION_RESTORE === "1" || process.env.PERF_PREVIEW_CACHE === "1";
const report = {
  keepAlive,
  variant,
  scope:
    "Isolated offline actual-project model fixture; no network or production writes",
  requests: [],
  errors: [],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win;
function bootstrap() {
  window.__perf = { longTasks: [], errors: [] };
  const log = console.error;
  console.error = (...args) => {
    __perf.errors.push(
      args.map((x) => ({
        message: x?.message || x?.error?.message || String(x),
        stack: x?.stack || x?.error?.stack,
        title: x?.title,
        description: x?.description,
      })),
    );
    return log(...args, JSON.stringify(__perf.errors.slice(-1)));
  };
  new PerformanceObserver((l) =>
    __perf.longTasks.push(
      ...l
        .getEntries()
        .map((x) => ({ start: x.startTime, duration: x.duration })),
    ),
  ).observe({ type: "longtask", buffered: true });
  let ctx;
  Object.defineProperty(window, "studioCtx", {
    configurable: true,
    get: () => ctx,
    set: (v) => {
      ctx = v;
      if (v) {
        clearInterval(v.asyncSaverTimer);
        window.__perf.ctxAt = performance.now();
      }
    },
  });
}
app.on("web-contents-created", (_, w) => {
  w.on("console-message", (e) => {
    if (e.level === "error") {
      report.errors.push(e.message?.slice(0, 600));
      console.log("ERR", e.message?.slice(0, 600));
    }
  });
  w.on("will-prevent-unload", (e) => e.preventDefault());
  const d = w.debugger;
  d.attach("1.3");
  const setup = async (id) => {
    await d.sendCommand("Page.enable", {}, id);
    await d.sendCommand(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: `(${bootstrap.toString()})()` },
      id,
    );
    await d.sendCommand(
      "Target.setAutoAttach",
      { autoAttach: true, waitForDebuggerOnStart: false, flatten: true },
      id,
    );
  };
  d.on("message", (_, m, p) => {
    if (m === "Target.attachedToTarget")
      void (async () => {
        try {
          if (["page", "iframe"].includes(p.targetInfo.type))
            await setup(p.sessionId);
        } finally {
          await d
            .sendCommand("Runtime.runIfWaitingForDebugger", {}, p.sessionId)
            .catch(() => {});
        }
      })().catch((e) => report.errors.push(e.message));
  });
  void setup().catch((e) => report.errors.push(e.message));
});
app
  .whenReady()
  .then(async () => {
    app.setActivationPolicy?.("accessory");
    const ses = session.fromPartition("perf-" + variant);
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };
    const json = (v) => new Response(JSON.stringify(v), { headers });
    const canonical = (s) => {
      const u = new URL(s, "https://plasmic-studio.shiguanglab.com");
      u.searchParams.sort();
      return u.pathname + u.search;
    };
    const codeMap = new Map(
      Object.entries(codes).map(([k, v]) => [canonical(k), v]),
    );
    // Auxiliary comments, AI status and roles are empty fixtures. This does not
    // validate authentication, save/publish, AI tools or the Plume insertion UI.
    const remoteFetch = async (req) => {
      const u = new URL(req.url),
        s = u.pathname;
      report.requests.push({ method: req.method, path: s });
      console.log(req.method, s);
      if (req.method === "OPTIONS")
        return new Response(null, {
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        });
      if ((process.env.PERF_UNDO_RETAIN === "1" || process.env.PERF_UNDO_REOPEN === "1" || revisionDiagnostics) && req.method === "POST" &&
          s.startsWith(`/api/v1/projects/${startup.projectId}/revisions/`)) {
        const body = await req.json();
        const bundle = JSON.parse(body.data);
        if (!bundle.map || !bundle.root || typeof body.incremental !== "boolean")
          throw Error("Invalid diagnostic save request");
        report.saveAcknowledgements ??= [];
        report.saveAcknowledgements.push({ revision: Number(s.split("/").at(-1)),
          incremental: body.incremental, objects: Object.keys(bundle.map).length,
          deleted: body.toDeleteIids.length, bytes: body.data.length });
        if ((process.env.PERF_UNDO_REOPEN === "1" || revisionDiagnostics) && !body.incremental) {
          opening.rev.data = body.data;
          opening.rev.revision = Number(s.split("/").at(-1));
          opening.latestRevisionSynced = opening.rev.revision;
          if (revisionDiagnostics) {
            opening.rev.id = `diagnostic-revision-${opening.rev.revision}`;
            savedFullRevisions.set(opening.rev.id, {...opening.rev});
          }
        }
        return json({});
      }
      if (revisionDiagnostics) {
        if (req.method === "GET" && s.endsWith('/revs/unpublished'))
          return json({revisions:[...savedFullRevisions.values()].sort((a,b)=>b.revision-a.revision).map(({data,...metadata})=>metadata)});
        if (req.method === "POST" && s.endsWith('/revert-to-revision')) {
          const body=await req.json(),rev=savedFullRevisions.get(body.revisionId);
          if (!rev || (body.branchId ?? null)!==(rev.branchId ?? null)) throw Error('Invalid offline restore request');
          opening.rev={...rev,revision:opening.rev.revision+1};
          opening.rev.id=`diagnostic-revision-${opening.rev.revision}`;
          opening.latestRevisionSynced=opening.rev.revision;
          savedFullRevisions.set(opening.rev.id,{...opening.rev});
          report.versionRestores??=[];report.versionRestores.push({from:rev.revision,to:opening.rev.revision});
          return json({projectId:startup.projectId});
        }
      }
      if (models[s])
        return new Response(models[s].body, {
          headers: { ...headers, ...models[s].headers },
        });
      const code = codeMap.get(canonical(req.url));
      if (code)
        return new Response(Buffer.from(code.body, "base64"), {
          headers: {
            ...headers,
            ...code.headers,
            "Content-Type": "application/javascript",
          },
        });
      if (s === `/api/v1/projects/${startup.projectId}`) return json(opening);
      if (s === "/api/v1/auth/self") return json(startup.selfInfo);
      if (s === "/api/v1/app-config") return json(startup.appConfig);
      if (s === "/api/v1/app-ctx") return json(startup.appCtx);
      if (s === "/api/v1/latest-bundle-version")
        return json({ latestBundleVersion: startup.latestBundleVersion });
      if (s === "/api/v1/hosts") return json(startup.hosts);
      if (s === "/api/v1/projects") return json(startup.projectData);
      if (s.endsWith("/branches")) return json({ branches: startup.branches });
      if (s.endsWith("/revs/unpublished")) return json({ revisions: [] });
      if (s.endsWith("/app-user")) return json({});
      if (s.endsWith("/roles")) return json([]);
      if (s === "/api/v1/plume-pkg") return json(plume);
      if (s.startsWith("/api/v1/pkgs/")) {
        const pkg = opening.depPkgs.find((p) => s.endsWith(p.pkgId));
        if (pkg)
          return json({
            pkg,
            depPkgs: opening.depPkgs.filter((p) => p.id !== pkg.id),
          });
      }
      if (s.endsWith("/ai/edit/status") || s.endsWith("/pkg")) return json({});
      if (s.startsWith("/api/v1/comments/"))
        return json({ threads: [], reactions: [], users: [] });
      if (s.includes("socket.io"))
        return new Response("", { status: 503, headers });
      if (s.includes("fonts") || u.hostname === "fonts.googleapis.com")
        return new Response("", {
          headers: {
            "Content-Type": "text/css",
            "Access-Control-Allow-Origin": "*",
          },
        });
      report.unknown ??= [];
      if (!report.unknown.includes(s)) report.unknown.push(s);
      return json({});
    };
    const { createAssetHandler } = require(
      repo + "/desktop/src/asset-handler.cjs",
    );
    ses.webRequest.onBeforeRequest(
      { urls: ["ws://*/*", "wss://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    ses.protocol.handle("http", remoteFetch);
    ses.protocol.handle(
      "https",
      createAssetHandler({
        root: path.join(task, "build-" + variant),
        studioOrigin: "https://plasmic-studio.shiguanglab.com",
        canvasOrigin: "https://plasmic-canvas.shiguanglab.com",
        remoteFetch,
      }),
    );
    win = new BrowserWindow({
      width: 1512,
      height: 887,
      show: true,
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    const start = performance.now();
    void win
      .loadURL(
        "https://plasmic-studio.shiguanglab.com/projects/" + startup.projectId,
      )
      .catch((e) => console.log("LOAD", e.message));
    let frame;
    for (let i = 0; i < 450; i++) {
      for (const f of win.webContents.mainFrame.framesInSubtree) {
        try {
          if (
            await f.executeJavaScript(
              "!!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady",
            )
          )
            frame = f;
        } catch {}
      }
      if (frame) break;
      await sleep(100);
    }
    report.readyMs = performance.now() - start;
    if (!frame) {
      report.frames = [];
      for (const f of win.webContents.mainFrame.framesInSubtree) {
        try {
          report.frames.push(
            await f.executeJavaScript(
              "({url:location.href,ctx:!!window.studioCtx,body:document.body?.innerText?.slice(0,1500)})",
            ),
          );
        } catch {}
      }
      throw Error("Not ready");
    }
    report.initial = await frame.executeJavaScript(
      `({environment:{dpr:devicePixelRatio,width:innerWidth,height:innerHeight,userAgent:navigator.userAgent},arenaCounts:{mixed:studioCtx.site.arenas.length,page:studioCtx.site.pageArenas.length,component:studioCtx.site.componentArenas.length},revision:studioCtx.dbCtx().revisionNum,counter:studioCtx._changeCounter,views:studioCtx.viewCtxs.length,arena:studioCtx.currentArena?.name,arenas:[...studioCtx.arenaViewStates].map(([a,i])=>({name:a.name,...i})),probe:__perf})`,
    );
    await frame.executeJavaScript("studioCtx.awaitStudioReady()");
    await sleep(1000);
    if (process.env.PERF_PREVIEW_CACHE === "1") {
      report.previewCache = await require('./preview-cache.cjs').run({frame,win,task,variant});
    }
    if (process.env.PERF_UNDO_RETAIN === "1") {
      report.undoRetain = await require("./undo-retention.cjs").run({ frame, win, task, variant });
    }
    if (process.env.PERF_UNDO_COLD_COST === "1") {
      report.undoColdCost = await require("./undo-cold-cost.cjs").run({ frame, win, task, variant });
    }
    if (process.env.PERF_UNDO_GROWTH) {
      report.undoGrowth = await require("./undo-history-growth.cjs").run({ frame, win, task, variant });
    }
    if (process.env.PERF_UNDO === "1") {
      report.undo = await require("./undo-studio.cjs").run({ frame, win, task, variant });
    }
    if (process.env.PERF_UNDO_REOPEN === "1") {
      const reopened = await require("./undo-reopen.cjs").run({ frame, win });
      frame = reopened.frame;
      report.reopen = reopened.result;
    }
    if (process.env.PERF_UNDO_VERSION_RESTORE === "1") {
      report.versionRestore = await require('./undo-version-restore.cjs').run({frame,expectedSteps:Number(process.env.PERF_RETAIN_HISTORY_STEPS||0)});
    }
    if (process.env.PERF_FRAME_INTERACTIONS === "1") {
      report.frameInteractions = await require('./frame-interaction-lifecycle.cjs').run({frame});
    }
    if (process.env.PERF_FUNCTIONAL === "1")
      report.functional = await frame.executeJavaScript(
        `(async()=>{const s=studioCtx,c=s.site.pageArenas[0].component,before=c.name,changed=before+'PerfProbe';await s.changeUnsafe(()=>s.siteOps().tryRenameArenas([{arena:s.site.pageArenas[0],newName:changed}]));if(c.name!==changed||!s.canUndo())throw Error('Edit failed');await s.undo();if(c.name!==before)throw Error('Undo failed');await s.redo();if(c.name!==changed)throw Error('Redo failed');await s.undo();if(c.name!==before)throw Error('Restore failed');return {edit:true,undo:true,redo:true,restored:true,revision:s.dbCtx().revisionNum,views:s.viewCtxs.length}})()`,
      );
    await sleep(3000);
    report.stable = await frame.executeJavaScript(
      `({views:studioCtx.viewCtxs.length,frames:document.querySelectorAll('iframe').length,activeSkeletons:document.querySelectorAll('.ant-skeleton-active').length,probe:__perf})`,
    );
    if (process.env.PERF_ENV_GC === "1") {
      report.envGc = { samples: [] };
      for (let i = 0; i < 20; i++) {
        await frame.executeJavaScript(
          `(async()=>{const s=studioCtx,a=s.site.pageArenas[0],name=a.component.name;await s.changeUnsafe(()=>s.siteOps().tryRenameArenas([{arena:a,newName:name+'Probe'}]));await s.awaitStudioReady();await s.undo();await s.awaitStudioReady()})()`,
        );
        if (i % 5 === 4) {
          await win.webContents.debugger.sendCommand(
            "HeapProfiler.collectGarbage",
          );
          await sleep(200);
          report.envGc.samples.push(
            await frame.executeJavaScript(
              `(()=>{const g=window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.plasmic;return {iteration:${i + 1},envs:g?.envIdToEnvs.size,keys:g?.fullKeyToEnvId.size,owned:g?[...g.frames.values()].map(f=>f.envIdToFullKey.size):[],errors:__perf.errors.length}})()`,
            ),
          );
        }
      }
      report.envGc.errors = await frame.executeJavaScript("__perf.errors");
    }
    if (keepAlive) {
      const build = await frame.executeJavaScript(
        `(async()=>{const s=studioCtx,source=s.site.arenas[0].children[0];window.__perfArenas=[];await s.changeUnsafe(()=>{for(let i=0;i<6;i++){const a=s.tplMgr().addArena('PerfArena'+i);s.tplMgr().addNewMixedArenaFrame(a,'Frame',source.container.component,{width:source.width,height:source.height,insertPt:s.viewportCtx.visibleScalerBox().topLeft()});__perfArenas.push(a)}});return {created:__perfArenas.length}})()`,
      );
      report.retention = { build, switches: [] };
      const open = async (index) => {
        const t = performance.now();
        await frame.executeJavaScript(
          `studioCtx.switchToArena(__perfArenas[${index}])`,
        );
        await frame.executeJavaScript("studioCtx.awaitStudioReady()");
        await sleep(100);
        const state = await frame.executeJavaScript(
          `(()=>{const s=studioCtx,a=__perfArenas[${index}],vc=s.tryGetViewCtxForFrame(a.children[0]);return {status:s.getArenaStatus(a),renderReady:vc?.initialRenderReady,views:s.viewCtxs.length,marker:vc?.canvasCtx.win().__retentionMarker,live:[...s.arenaViewStates.values()].filter(i=>i.isAlive).length}})()`,
        );
        report.retention.switches.push({
          index,
          ms: performance.now() - t,
          ...state,
        });
        console.log("SWITCH", index, report.retention.switches.at(-1));
        fs.writeFileSync(
          path.join(task, "retention-progress-" + keepAlive + ".json"),
          JSON.stringify(report.retention, null, 2),
        );
        if (!state.renderReady) throw Error("Arena did not finish rendering");
        return state;
      };
      for (let i = 0; i < 6; i++) {
        await open(i);
        if (i === 0)
          await frame.executeJavaScript(
            `studioCtx.tryGetViewCtxForFrame(__perfArenas[0].children[0]).canvasCtx.win().__retentionMarker='still-alive'`,
          );
      }
      await sleep(1000);
      await win.webContents.debugger.sendCommand("HeapProfiler.collectGarbage");
      await sleep(250);
      report.retention.beforeRevisit = {
        metrics: app
          .getAppMetrics()
          .map((p) => ({ type: p.type, rssKiB: p.memory.workingSetSize })),
        state: await frame.executeJavaScript(
          `({views:studioCtx.viewCtxs.length,live:[...studioCtx.arenaViewStates.values()].filter(i=>i.isAlive).length})`,
        ),
      };
      for (const i of [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]) await open(i);
      report.retention.finalErrors =
        await frame.executeJavaScript("__perf.errors");
    }
    fs.writeFileSync(
      path.join(task, variant + ".png"),
      await win.webContents.capturePage().then((i) => i.toPNG()),
    );
  })
  .catch((e) => {
    report.error = { message: e?.message || String(e), stack: e?.stack };
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(
      path.join(task, "frontend-" + variant + ".json"),
      JSON.stringify(report, null, 2),
    );
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
    app.exit(process.exitCode || 0);
  });
setTimeout(() => {
  fs.writeFileSync(
    path.join(task, "frontend-" + variant + ".json"),
    JSON.stringify(report, null, 2),
  );
  console.error("Timeout");
  app.exit(2);
}, process.env.PERF_UNDO === "1" || process.env.PERF_UNDO_GROWTH || process.env.PERF_UNDO_RETAIN === "1" || process.env.PERF_UNDO_COLD_COST === "1" || process.env.PERF_PREVIEW_CACHE === "1" ? 600000 : 75000);
