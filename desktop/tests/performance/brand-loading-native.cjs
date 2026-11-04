// electron brand-loading-construction.cjs <output> <renderer> <animationSource>
// Visible-window probe. Run serially, separately from project timing.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createHash } = require("node:crypto");
const { PNG } = require("pngjs");
const [output, renderer, source] = process.argv
  .slice(2)
  .map((p) => path.resolve(p));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
app.setPath("userData", path.join(output, "profile"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app
  .whenReady()
  .then(async () => {
    let html;
    const server = http.createServer((req, res) => {
      if (req.url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(html);
        return;
      }
      const file = path.resolve(
        renderer,
        "." + new URL(req.url, "http://localhost").pathname,
      );
      if (!file.startsWith(renderer + path.sep) || !fs.existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".webp") ? "image/webp" : "application/octet-stream",
      );
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    html = fs
      .readFileSync(path.join(renderer, "index.html"), "utf8")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replaceAll("https://plasmic-studio.shiguanglab.com", origin)
      .replace(/<link\b[^>]*>/gi, "");
    const window = new BrowserWindow({
      width: 500,
      height: 500,
      show: true,
      webPreferences: { backgroundThrottling: false },
    });
    app.focus({ steal: true });
    window.focus();
    const c = window.webContents;
    c.on("console-message", (_, level, message) => {
      if (level >= 2) console.error("renderer:", message);
    });
    await c.loadURL(origin);
    await c.debugger.attach("1.3");
    await c.debugger.sendCommand("Performance.enable");
    await c.debugger.sendCommand("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });
    if (process.env.PERF_LOADING_THEME === "dark") {
    await c.executeJavaScript("document.documentElement.dataset.uiAppearance='dark'");
  }
  const js = fs.readFileSync(source, "utf8");
    await c.executeJavaScript(
      `window.exports={};window.rafCalls=0;window.attrWrites=0;window.longTasks=[];new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>{rafCalls++;return raf(cb)};const attr=Element.prototype.setAttribute;Element.prototype.setAttribute=function(...args){attrWrites++;return attr.apply(this,args)};${js};document.querySelector('#studio-startup-loading').classList.add('visible');window.logo=document.querySelector('#studio-startup-loading svg');window.image=logo.parentElement.querySelector('[data-construction]');window.t0=performance.now();window.stopLogo=exports.animateBrandLoading(logo);true`,
    );
    const ready = () =>
      c.executeJavaScript(
        `image ? new Promise((resolve,reject)=>{if(image.complete&&image.getAttribute('src'))resolve(performance.now()-t0);else {image.addEventListener('load',()=>resolve(performance.now()-t0),{once:true});image.addEventListener('error',()=>reject(Error('image failed')),{once:true})}}) : 0`,
      );
    const loadMs = await ready();
    const state = () =>
      c.executeJavaScript(
        `({scaffoldStroke:getComputedStyle(logo.querySelector('[data-scaffold]')).stroke,rafCalls,attrWrites,url:image?.getAttribute('src'),solid:logo.querySelector('[data-solid]').getAttribute('opacity'),imageOpacity:image?getComputedStyle(image).opacity:null,scaffoldOpacity:getComputedStyle(logo).opacity,running:logo.parentElement.getAnimations({subtree:true}).filter(a=>a.playState==='running').length,longTasks:longTasks.slice()})`,
      );
    await sleep(300);
    const before = await c.debugger.sendCommand("Performance.getMetrics");
    const initial = await state();
    await sleep(700);
    const after = await c.debugger.sendCommand("Performance.getMetrics");
    const construction = await state();
    const captureBlock = async (name) => {
      await c.executeJavaScript(
        `setTimeout(()=>{window.blockStart=performance.now();while(performance.now()-blockStart<1200){}window.blockEnd=performance.now()},100);true`,
      );
      const start = performance.now(),
        shots = [];
      while (performance.now() - start < 1500) {
        const at = performance.now() - start;
        const picture = await c.capturePage();
        const pixels = PNG.sync.read(picture.toPNG()).data;
        let colored = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 2] - pixels[i] > 45) colored++;
        shots.push({
          at,
          finished: performance.now() - start,
          colored,
          hash: createHash("sha256").update(pixels).digest("hex"),
        });
        if (shots.length === 6)
          fs.writeFileSync(
            path.join(output, `${name}-busy.png`),
            picture.toPNG(),
          );
        await sleep(100);
      }
      const busy = shots.filter((s) => s.at >= 180 && s.finished <= 1100);
      return {
        shots,
        differentFrames: new Set(busy.map((s) => s.hash)).size,
        colorRange:
          Math.max(...busy.map((s) => s.colored)) -
          Math.min(...busy.map((s) => s.colored)),
        blockMs: await c.executeJavaScript("blockEnd-blockStart"),
      };
    };
    const constructionBlock = await captureBlock("construction");
    await sleep(1000);
    const completed = await state();
    const memory = app
      .getAppMetrics()
      .filter((p) => ["GPU", "Tab"].includes(p.type))
      .map((p) => ({ type: p.type, memory: p.memory }));
    const waitingBlock = await captureBlock("waiting");
    const waited = await state();
    const oldUrl = waited.url;
    await c.executeJavaScript("stopLogo()");
    const stopped = await state();
    await c.executeJavaScript(
      "t0=performance.now();window.stopLogo=exports.animateBrandLoading(logo);true",
    );
    await ready();
    await sleep(400);
    const replayed = await state();
    const replayPixels = PNG.sync.read((await c.capturePage()).toPNG()).data;
    let replayColored = 0;
    for (let i = 0; i < replayPixels.length; i += 4)
      if (replayPixels[i + 2] - replayPixels[i] > 45) replayColored++;
    await c.executeJavaScript(
      "window.motionChanged=new Promise(resolve=>matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',resolve,{once:true}));true",
    );
    await c.debugger.sendCommand("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await c.executeJavaScript("motionChanged.then(()=>true)");
    const reduced = await state();
    await c.executeJavaScript("stopLogo()");
    const metric = (m, name) => m.metrics.find((x) => x.name === name).value;
    const result = {
      memory,
      loadMs,
      taskMs:
        (metric(after, "TaskDuration") - metric(before, "TaskDuration")) * 1000,
      scriptMs:
        (metric(after, "ScriptDuration") - metric(before, "ScriptDuration")) *
        1000,
      layoutMs:
        (metric(after, "LayoutDuration") - metric(before, "LayoutDuration")) *
        1000,
      recalcMs:
        (metric(after, "RecalcStyleDuration") -
          metric(before, "RecalcStyleDuration")) *
        1000,
      initial,
      construction,
      completed,
      waited,
      stopped,
      replayed,
      replayColored,
      reduced,
      constructionBlock,
      waitingBlock,
    };
    fs.writeFileSync(
      path.join(output, "construction.json"),
      JSON.stringify(result, null, 2),
    );
    const native = !!oldUrl;
  if (process.env.PERF_LOADING_THEME === "dark" && initial.scaffoldStroke !== "rgb(146, 149, 167)") { throw Error("Dark scaffold color was lost"); }
    if (
      native &&
      (construction.rafCalls ||
        construction.attrWrites !== initial.attrWrites ||
        constructionBlock.differentFrames < 3 ||
        constructionBlock.colorRange < 100 ||
        completed.scaffoldOpacity !== "0" ||
        (oldUrl.startsWith("blob:") && oldUrl === replayed.url) ||
        replayColored > 2500 ||
        stopped.url ||
        reduced.url ||
        reduced.solid !== "1")
    )
      throw Error(
        "Construction/lifecycle regression: " + JSON.stringify(result),
      );
    if (
      stopped.running ||
      reduced.running ||
      waitingBlock.differentFrames < 3 ||
      waited.rafCalls !== completed.rafCalls
    )
      throw Error("Waiting/cleanup regression");
    console.log(
      JSON.stringify({
        loadMs,
        taskMs: result.taskMs,
        scriptMs: result.scriptMs,
        rafCalls: construction.rafCalls,
        attrWrites: construction.attrWrites,
        busyFrames: constructionBlock.differentFrames,
        busyColorRange: constructionBlock.colorRange,
        waitingFrames: waitingBlock.differentFrames,
        replayColored,
      }),
    );
    window.destroy();
    server.close();
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
