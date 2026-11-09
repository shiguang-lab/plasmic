const path = require("node:path"),
  fs = require("node:fs");
const repo = path.resolve(__dirname, "../../..");
const { app, BrowserWindow } = require(
  require.resolve("electron", { paths: [repo + "/desktop"] }),
);
if (!process.argv[2]) throw Error("Required: private output directory");
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
app.setPath("userData", path.join(out, "skeleton-profile"));
const esbuild = require(
  require.resolve("esbuild", { paths: [repo + "/desktop"] }),
);
esbuild.buildSync({
  stdin: {
    contents:
      'import React from "react";import {createRoot} from "react-dom/client";import {flushSync} from "react-dom";import {Skeleton} from "antd";\nconst root=createRoot(document.getElementById(\'root\'));window.renderFixture=(activeCount=12)=>flushSync(()=>root.render(<div style={{display:"grid",gridTemplateColumns:"repeat(4,320px)",gap:16,padding:16}}>{Array.from({length:12},(_,i)=><div key={i} style={{background:"white",padding:20,height:190}}><Skeleton active={i<activeCount} paragraph={{rows:5}} /></div>)}</div>));window.unmountFixture=()=>flushSync(()=>root.unmount());window.renderFixture();\n',
    loader: "jsx",
    resolveDir: repo + "/platform/wab",
  },
  bundle: true,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: path.join(out, "skeleton-bundle.js"),
});
fs.writeFileSync(
  path.join(out, "skeleton.html"),
  '<html><body style="margin:0;background:#eee"><div id="root"></div><script src="skeleton-bundle.js"></script></body></html>',
);
app.on("window-all-closed", () => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {
  scope:
    "Real Ant Design Skeleton, 12 visible queued/loading previews, fixed 1512x887 window; diagnostic fixture, not project open timing",
  samples: [],
};
app
  .whenReady()
  .then(async () => {
    app.setActivationPolicy?.("accessory");
    const win = new BrowserWindow({
      width: 1512,
      height: 887,
      show: true,
      webPreferences: { backgroundThrottling: false },
    });
    await win.loadFile(path.join(out, "skeleton.html"));
    const d = win.webContents.debugger;
    d.attach("1.3");
    await d.sendCommand("Performance.enable");
    await sleep(500);
    for (const n of [12, 0, 0, 12, 0, 12, 12, 0, 0, 12, 1]) {
      await win.webContents.executeJavaScript(`renderFixture(${n})`);
      await sleep(250);
      const a = await d.sendCommand("Performance.getMetrics"),
        m = Object.fromEntries(a.metrics.map((x) => [x.name, x.value]));
      const cpu0 = app
        .getAppMetrics()
        .filter((x) => x.type === "Tab")
        .map((x) => ({ pid: x.pid, ...x.cpu }));
      const t = performance.now();
      await sleep(2000);
      const b = await d.sendCommand("Performance.getMetrics");
      const diff = Object.fromEntries(
        b.metrics
          .filter((x) =>
            [
              "TaskDuration",
              "ScriptDuration",
              "LayoutDuration",
              "RecalcStyleDuration",
              "LayoutCount",
              "RecalcStyleCount",
            ].includes(x.name),
          )
          .map((x) => [x.name, x.value - m[x.name]]),
      );
      report.samples.push({
        activeCount: n,
        elapsedMs: performance.now() - t,
        metrics: diff,
        cpu0,
        cpu1: app
          .getAppMetrics()
          .filter((x) => x.type === "Tab")
          .map((x) => ({ pid: x.pid, ...x.cpu })),
      });
    }
    await win.webContents.executeJavaScript("renderFixture(1)");
    fs.writeFileSync(
      path.join(out, "skeleton.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    win.destroy();
  })
  .catch((e) => {
    report.error = e.stack;
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(
      path.join(out, "skeleton-results.json"),
      JSON.stringify(report, null, 2),
    );
    app.exit(process.exitCode || 0);
  });
