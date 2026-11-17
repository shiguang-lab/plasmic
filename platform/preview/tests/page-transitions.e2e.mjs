import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../wab/package.json", import.meta.url));
const { build } = require("esbuild");
const { chromium } = require("playwright");
const app = `
  import React from "react";
  import {createRoot} from "react-dom/client";
  import {usePublishedRoute} from "./components/usePublishedRoute";
  const pages = [{id:"list",name:"List",path:"/list"},{id:"detail",name:"Detail",path:"/detail"}];
  window.effects = [];
  const nativeStart = document.startViewTransition.bind(document);
  document.startViewTransition = update => {
    const style = document.querySelector("style[data-plasmic-page-transition]");
    const effect = {preset:style.dataset.plasmicPageTransition,direction:style.dataset.direction};
    window.effects.push(effect);
    const transition = nativeStart(update);
    window.animationFinished = transition.finished;
    transition.ready.then(() => {
      effect.animations = document.documentElement.getAnimations({subtree:true}).map(a=>a.animationName).filter(name=>name?.startsWith("plasmic-page-"));
    }).catch(error=>{effect.error=String(error)});
    return transition;
  };
  function App() {
    const [device, setDevice] = React.useState("phone");
    const route = usePublishedRoute("/list", pages, device);
    window.setDevice = setDevice;
    window.go = (path, preset) => route.navigate("/s/test#" + path, false, preset);
    const detail = route.hash.startsWith("#/detail");
    return <main style={{minHeight:"100vh",boxSizing:"border-box",padding:24,background:detail?"#c5f2dc":"#d0e7ff"}}>
      <h1>{detail ? "Details" : "List"}</h1><output>{route.hash}</output>
      <button onClick={()=>window.go(detail?"/list":"/detail")}>Navigate</button>
      <button onClick={route.goBack}>Go back</button><output aria-label="Device">{device}</output>
    </main>;
  }
  createRoot(document.getElementById("root")).render(<App/>);
`;
const bundle = await build({ stdin: { contents: app, loader: "tsx", resolveDir: fileURLToPath(new URL("..", import.meta.url)) }, bundle: true, write: false, format: "iife", platform: "browser", define: { "process.env.NODE_ENV": '"production"' } });
const server = createServer((req, res) => {
  if (req.url === "/app.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else {
    res.setHeader("content-type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui}button{display:block;margin-top:24px}</style><div id="root"></div><script src="/app.js"></script>');
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({headless:true});
const errors = [];
const results = [];
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/s/test#/list`);
  await page.getByText("#/list", {exact:true}).waitFor();
  assert.equal(await page.evaluate(() => window.effects.length), 0);
  for (const preset of [undefined, "none", "fade", "push-right", "slide-up"]) {
    const count = await page.evaluate(() => window.effects.length);
    await page.evaluate(preset => window.go("/detail", preset), preset);
    await page.getByRole("heading", {name:"Details"}).waitFor();
    await page.evaluate(() => window.animationFinished);
    const effects = await page.evaluate(() => window.effects);
    assert.equal(effects.length, count + (preset === "none" ? 0 : 1));
    if (preset !== "none") {
      assert.equal(effects.at(-1).preset, preset ?? "push-right");
      assert.deepEqual(effects.at(-1).animations.sort(), ["plasmic-page-new", "plasmic-page-old"]);
      assert.equal(effects.at(-1).error, undefined);
    }
    await page.getByRole("button", {name:"Go back"}).click();
    await page.getByRole("heading", {name:"List"}).waitFor();
    await page.evaluate(() => window.animationFinished);
    if (preset !== "none") {
      const back = await page.evaluate(() => window.effects.at(-1));
      assert.equal(back.direction, "back");
      assert.equal(back.preset, preset ?? "push-right");
    }
    results.push({preset:preset ?? "unset",mobile:true,back:true});
  }
  let count = await page.evaluate(() => window.effects.length);
  await page.evaluate(() => window.go("/list?filter=1#field", "fade"));
  assert.equal(await page.evaluate(() => window.effects.length), count);
  for (const device of ["phone", "tablet"]) {
    await page.evaluate(device => window.setDevice(device), device);
    await page.getByLabel("Device").filter({hasText:device}).waitFor();
    await page.setViewportSize({width:1024,height:768});
    await page.evaluate(() => window.go("/detail", "slide-up"));
    await page.evaluate(() => window.animationFinished);
    await page.getByRole("button", {name:"Go back"}).click();
    await page.getByRole("heading", {name:"List"}).waitFor();
    await page.evaluate(() => window.animationFinished);
    count += 2;
    assert.equal(await page.evaluate(() => window.effects.length), count);
    results.push({device,width:1024,animation:true});
  }
  for (const [device, width] of [["desktop",390], ["custom",390], ["desktop",1440]]) {
    await page.evaluate(device => window.setDevice(device), device);
    await page.getByLabel("Device").filter({hasText:device}).waitFor();
    await page.setViewportSize({width,height:900});
    await page.evaluate(() => window.go("/detail", "slide-up"));
    await page.getByRole("heading", {name:"Details"}).waitFor();
    await page.evaluate(() => window.go("/list", "fade"));
    assert.equal(await page.evaluate(() => window.effects.length), count);
    results.push({device,width,animation:false});
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => window.setDevice("phone"));
  await page.getByLabel("Device").filter({hasText:"phone"}).waitFor();
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(() => window.go("/detail", "fade"));
  await page.getByRole("heading", {name:"Details"}).waitFor();
  assert.equal(await page.evaluate(() => window.effects.length), count);
  await page.reload();
  await page.getByRole("heading", {name:"Details"}).waitFor();
  assert.equal(await page.evaluate(() => window.effects.length), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed:true,results,queryAndAnchor:true,reducedMotion:true,reload:true,consoleErrors:errors},null,2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
