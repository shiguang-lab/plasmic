const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const { createRequire } = Module;
delete process.env.HTTPS_PROXY;
delete process.env.HTTP_PROXY;
delete process.env.ALL_PROXY;
const desktopRoot = process.env.PROBE_DESKTOP_ROOT;
const req = createRequire(path.join(desktopRoot, "package.json"));
const { app, session, contentTracing } = req("electron");
app.getPreferredSystemLanguages = () => ["en-US"];
app.commandLine.appendSwitch("remote-debugging-port", "0");
const out = process.env.PROBE_OUTPUT_ROOT;
const assetRoot = process.env.PROBE_ASSETS;
app.commandLine.appendSwitch("force-device-scale-factor", "2");
const mode = process.env.PROBE_MODE || "optimized";
const runId = process.env.PROBE_RUN || mode;
const runDir = path.join(out, runId);
assert(!fs.existsSync(runDir), "Use a new PROBE_RUN for an uncached profile");
fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
const profile = path.join(runDir, "profile");
fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
app.setName("Plasmic");
app.setPath("userData", profile);
app.setPath("sessionData", profile);
const config = req("./desktop.config.json");
const seed = JSON.parse(
  fs.readFileSync(path.join(out, "workspace-seed.json"), "utf8"),
);
const target = seed.workspace[0];
if (process.env.PROBE_VIEW)
  target.editorView = JSON.parse(process.env.PROBE_VIEW);
fs.writeFileSync(
  path.join(profile, "workspace.json"),
  JSON.stringify([target]),
);
fs.writeFileSync(
  path.join(profile, "workspace-route.json"),
  JSON.stringify(target.url),
);
const report = {
  desktopMainHash: require("node:crypto")
    .createHash("sha256")
    .update(fs.readFileSync(path.join(desktopRoot, "src/main.cjs")))
    .digest("hex"),
  mode,
  runId,
  startedAt: new Date().toISOString(),
  projectName: target.name,
  expectedViewport: target.editorView,
  build: JSON.parse(
    fs.readFileSync(path.join(assetRoot, "studio-build.json"), "utf8"),
  ),
  samples: [],
  requests: [],
  blockedWrites: [],
  errors: [],
  status: "RUNNING",
};
const persist = () =>
  fs.writeFileSync(
    path.join(runDir, "report.json"),
    JSON.stringify(report, null, 2),
  );
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { bootstrap, startProxy } = require("./probe-common.cjs");
app.commandLine.appendSwitch("ignore-certificate-errors");
app.commandLine.appendSwitch("proxy-server", "http://127.0.0.1:3444");

let proxy;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const exported = originalLoad.call(this, request, parent, isMain);
  if (
    request === "./asset-handler.cjs" &&
    parent.filename.endsWith("/desktop/src/main.cjs")
  ) {
    return {
      ...exported,
      createAssetHandler: (options) => {
        return exported.createAssetHandler({ ...options, root: assetRoot });
      },
    };
  }
  return exported;
};
const { startDesktop } = req("./src/main.cjs");
Module._load = originalLoad;
app.on("web-contents-created", (_event, contents) => {
  const debuggerApi = contents.debugger;
  debuggerApi.attach("1.3");
  const source = `(${bootstrap.toString()})(${JSON.stringify(false)})`;
  const setup = async (sessionId) => {
    await debuggerApi.sendCommand("Page.enable", {}, sessionId);
    await debuggerApi.sendCommand(
      "Page.addScriptToEvaluateOnNewDocument",
      { source },
      sessionId,
    );
    await debuggerApi.sendCommand(
      "Target.setAutoAttach",
      { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
      sessionId,
    );
  };
  debuggerApi.on("message", (_event, method, params) => {
    if (method === "Target.attachedToTarget") {
      const id = params.sessionId;
      (async () => {
        try {
          if (
            params.targetInfo.type === "iframe" ||
            params.targetInfo.type === "page"
          )
            await setup(id);
        } catch (error) {
          report.debuggerError = error.message;
        } finally {
          await debuggerApi
            .sendCommand("Runtime.runIfWaitingForDebugger", {}, id)
            .catch(() => {});
        }
      })();
    }
  });
  setup().catch((error) => {
    report.debuggerError = error.message;
  });
  contents.on("dom-ready", () =>
    contents
      .executeJavaScript(
        `if(!window.__startupProbe)(${bootstrap.toString()})()`,
      )
      .catch((error) => {
        report.injectionError = error.message;
      }),
  );
});
app.on("browser-window-created", (_event, win) => {
  win.setContentSize(1512, 887);
  win.webContents.setBackgroundThrottling(false);
  win.show = win.showInactive.bind(win);
  win.webContents.on("console-message", (details) => {
    if (
      details.level === "error" ||
      /Uncaught|Unexpected error/.test(details.message || "")
    )
      report.errors.push({
        phase: currentPhase,
        message: (details.message || "").slice(0, 1500),
      });
  });
});
let currentPhase = "boot";
let win;
async function studioFrame() {
  for (const frame of win.webContents.mainFrame.framesInSubtree) {
    try {
      if (await frame.executeJavaScript("!!window.studioCtx?.loadTimings"))
        return frame;
    } catch {}
  }
  return null;
}
async function collect(start, phase) {
  let frame;
  let data;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    frame ??= await studioFrame();
    if (frame) {
      try {
        data = await frame.executeJavaScript(
          `(()=>{const s=window.studioCtx,p=window.__startupProbe;return {cssViewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},timingStartAt:performance.timeOrigin+s.loadTimings.startedAt,timeOrigin:performance.timeOrigin,timings:s.loadTimings.snapshot(),probe:p,initialRoute:s.initialRouteReady,initialViewport:s.initialViewportReady,target:s.activeCanvasFrame?.uuid,frames:(s.currentArena?.children||[]).map(f=>({uuid:f.uuid,name:f.name,width:f.width,height:f.height,left:f.left,top:f.top,componentUuid:f.container.component.uuid,componentName:f.container.component.name,ready:!!s.tryGetViewCtxForFrame(f)?.initialRenderReady})),revision:s.dbCtx().revisionNum}})()`,
        );
        if (
          data.probe?.visibleCanvasAt &&
          data.probe?.editableAt &&
          data.timings.entries.some(
            (e) => e.phase === "all-frame-contexts-created",
          )
        )
          break;
      } catch (error) {
        report.lastCollectError = error.message;
        frame = null;
        persist();
      }
    }
    if (data) {
      report.latest = data;
    }
    await sleep(50);
  }
  if (!data?.probe?.globalRevealAt) {
    report.frameDiagnostics = [];
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      try {
        report.frameDiagnostics.push(
          await f.executeJavaScript(
            "({href:location.href,ctx:!!window.studioCtx,timings:!!window.studioCtx?.loadTimings,probe:!!window.__startupProbe,body:document.body?.innerText?.slice(0,700)})",
          ),
        );
      } catch (e) {
        report.frameDiagnostics.push({ error: e.message });
      }
    }
    fs.writeFileSync(
      path.join(runDir, "failed.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    persist();
  }
  assert(data?.probe?.globalRevealAt, "Global canvas did not reveal");
  assert(data?.probe?.visibleCanvasAt, "Visible artboard did not render");
  assert.equal(data.revision, 18, "Project revision changed");
  assert(data.initialViewport, "Viewport restoration incomplete");
  const context = await call("getEditorContext");
  const expected = target.editorView,
    actual = context.editorView;
  assert.equal(actual.arenaId, expected.arenaId);
  assert(
    Math.abs(actual.scale - expected.scale) < 0.00001,
    "Saved scale changed",
  );
  assert(
    Math.abs(actual.scroll.x - expected.scroll.x) < 2 &&
      Math.abs(actual.scroll.y - expected.scroll.y) < 2,
    "Saved pan changed",
  );
  if (expected.frameUuid) assert.equal(actual.frameUuid, expected.frameUuid);
  let topReveal;
  for (let i = 0; i < 100; i++) {
    topReveal = await win.webContents.executeJavaScript(
      "window.__startupProbe?.topRevealAt",
    );
    if (topReveal) break;
    await sleep(50);
  }
  if (!topReveal) {
    report.topDiagnostic = await win.webContents.executeJavaScript(
      `({url:location.href,probe:window.__startupProbe,iframe:!!document.querySelector('iframe.studio-frame'),canvas:!!document.querySelector('.canvas-editor'),layers:[...document.querySelectorAll('.studio-loading.visible')].map(x=>({classes:x.className,opacity:getComputedStyle(x).opacity}))})`,
    );
    persist();
  }
  assert(topReveal, "Top loading layer did not reveal");
  const uiLocale = await win.webContents.executeJavaScript(
    "document.documentElement.lang",
  );
  assert.equal(uiLocale, "en", "UI locale differs from benchmark fixture");
  const sample = {
    uiLocale,
    topRevealAt: topReveal,
    editableMs: Math.max(data.probe.editableAt, topReveal || 0) - start,
    firstRenderedMs: data.probe.visibleCanvasAt - start,
    cssViewport: data.cssViewport,
    phase,
    startAt: start,
    timingStartAt: data.timingStartAt,
    timeOrigin: data.timeOrigin,
    globalRevealMs: data.probe.globalRevealAt - start,
    visibleCanvasMs:
      Math.max(data.probe.visibleCanvasAt, topReveal || 0) - start,
    allContextsMs: data.timings.entries.find(
      (e) => e.phase === "all-frame-contexts-created",
    )?.startMs,
    timings: data.timings,
    longTasks: data.probe.longTasks,
    frames: data.frames,
    revision: data.revision,
    targetFrameUuid: data.target,
    editorContext: context,
    viewportRestored: true,
  };
  report.samples.push(sample);
  persist();
  console.log(
    JSON.stringify({
      runId,
      phase,
      globalRevealMs: sample.globalRevealMs,
      visibleCanvasMs: sample.visibleCanvasMs,
      revision: sample.revision,
      frames: sample.frames.length,
    }),
  );
  fs.writeFileSync(
    path.join(runDir, phase + ".png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  return { frame, sample };
}
async function call(name, input = {}) {
  const response = await win.webContents.executeJavaScript(
    `window.PLASMIC_AI_TOOLS[${JSON.stringify(name)}](${JSON.stringify(input)})`,
  );
  assert(response.success, response.error?.message || name + " failed");
  return response.output ? JSON.parse(response.output) : null;
}
const timeout = setTimeout(() => {
  report.status = "TIMEOUT";
  persist();
  app.exit(1);
}, 260000);
app
  .whenReady()
  .then(async () => {
    proxy = await startProxy(Number(process.env.PROBE_GATEWAY_PORT));
    const ses = session.fromPartition("persist:plasmic-desktop");
    await ses.setProxy({ proxyRules: "http://127.0.0.1:3444" });
    for (const cookie of JSON.parse(
      fs.readFileSync(path.join(out, "seed-cookies.json"), "utf8"),
    )) {
      await ses.cookies.set({
        url: config.studioOrigin,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate,
      });
    }
    const rawFetch = ses.fetch.bind(ses);
    ses.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      const method = options.method || input.method || "GET";
      const start = Date.now();
      if (
        !["GET", "HEAD"].includes(method) &&
        /^\/api\/v1\/projects\//.test(url.pathname)
      ) {
        report.blockedWrites.push({
          phase: currentPhase,
          path: url.pathname,
          method,
        });
        return Response.json(
          { error: "Probe blocks design writes" },
          { status: 409 },
        );
      }
      const response = await rawFetch(input, options);
      if (url.pathname.startsWith("/api/")) {
        const record = {
          phase: currentPhase,
          path: url.pathname,
          method,
          status: response.status,
          headersMs: Date.now() - start,
          startAt: start,
          contentLength: response.headers.get("content-length"),
        };
        if (
          response.status >= 500 &&
          ["/api/v1/latest-bundle-version", "/api/v1/app-ctx"].includes(
            url.pathname,
          )
        ) {
          record.failure = {
            server: response.headers.get("server"),
            requestId: response.headers.get("x-request-id"),
            body: (await response.clone().text()).slice(0, 500),
          };
        }
        report.requests.push(record);
      }
      return response;
    };
    if (process.env.PROBE_TRACE === "1")
      await contentTracing.startRecording({
        included_categories: [
          "devtools.timeline",
          "blink.user_timing",
          "v8",
          "disabled-by-default-v8.cpu_profiler",
        ],
      });
    currentPhase = "cold";
    const coldStart = Date.now();
    win = await startDesktop();
    const cold = await collect(coldStart, "cold");
    if (process.env.PROBE_TRACE === "1") {
      await contentTracing.stopRecording(
        path.join(runDir, "startup.trace.json"),
      );
    }
    let warm = cold;
    if (process.env.PROBE_ONLY_COLD !== "1") {
      currentPhase = "between";
      await win.loadURL("about:blank");
      await sleep(250);
      currentPhase = "reopen";
      const warmStart = Date.now();
      await win.loadURL(target.url);
      warm = await collect(warmStart, "reopen");
    }
    if (process.env.PROBE_EDIT === "1")
      report.editing = await require("./qa.cjs").verify(
        call,
        (source) => warm.frame.executeJavaScript(source),
        async (name) =>
          fs.writeFileSync(
            path.join(runDir, name + ".png"),
            (await win.webContents.capturePage()).toPNG(),
          ),
      );
    if (process.env.PROBE_CAPTURE_VIEW === "1") {
      await warm.frame.executeJavaScript(
        "(()=>{const s=window.studioCtx;const f=s.currentArena.children.at(-1);s.setStudioFocusOnFrame({frame:f,autoZoom:false});s.tryZoomToFitFrame(f,s.zoom)})()",
      );
      await sleep(200);
      const c = await call("getEditorContext");
      fs.writeFileSync(
        path.join(runDir, "non-first-view.json"),
        JSON.stringify(c.editorView),
      );
    }
    assert.equal(
      proxy.requests.filter((r) => r.blocked).length,
      0,
      "A design-write request reached the proxy",
    );
    assert.equal(
      report.blockedWrites.length,
      0,
      "A design-save request was attempted during the probe",
    );
    assert(
      proxy.requests.some(
        (r) => r.path === "/api/v1/projects/iqBeCQWLFWvGwftodkcHbN",
      ),
      "Model bypassed controlled gateway",
    );
    if (mode === "after")
      assert(
        proxy.requests.some((r) =>
          r.path.startsWith("/api/v1/editor-bootstrap/"),
        ),
        "Bootstrap not exercised",
      );
    report.proxyRequests = proxy.requests;
    report.status = "PASS";
    persist();
    clearTimeout(timeout);
    win.destroy();
    app.exit(0);
  })
  .catch((error) => {
    report.status = "FAIL";
    report.error = error.message;
    persist();
    console.error(error.message);
    clearTimeout(timeout);
    if (win && !win.isDestroyed()) win.destroy();
    app.exit(1);
  });
