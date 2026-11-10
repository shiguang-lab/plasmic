const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
// The platform integration harness supplies the browser used by all preview tests.
const { JSDOM } = createRequire(path.join(__dirname, "../wab/package.json"))("jsdom");
const { transformSync } = require("@babel/core");
const compiler = require("babel-plugin-react-compiler").default;
const { transform } = createRequire(require.resolve("@rollup/plugin-sucrase"))("sucrase");

test("strict production previews use their own iframe React, Compiler runtime and command state", async () => {
  const { reactCompilerOptions } = await import("../wab/tools/react-compiler.mjs");
  let compiled = 0;
  const source = `import * as React from "react"; import {Theme} from "./theme.js";
    export default function PreviewCounter(props) {
      const [count, setCount] = React.useState(0);
      const theme = React.useContext(Theme);
      if (props.fail) { throw new Error("preview failure"); }
      return React.createElement("button", {onClick: () => setCount(count + 1)}, props.label + ":" + count + ":" + theme);
    }`;
  const output = transformSync(source, { filename: "generated-preview.js", babelrc: false, configFile: false,
    plugins: [[compiler, reactCompilerOptions({logEvent(_file, event) {
      if (event.kind === "CompileSuccess") { compiled++; }
      if (event.kind === "CompileError") { assert.fail(JSON.stringify(event)); }
    }})]],
  });
  assert.equal(compiled, 1);
  const code = transform(output.code, {transforms: ["imports"]}).code;
  assert.match(code, /react\/compiler-runtime/);
  const host = fs.readFileSync(path.join(__dirname, "../sub/public/static/sub/build/client.js"), "utf8");
  const sdk = fs.readFileSync(path.join(__dirname, "../react-web-bundle/build/client.js"), "utf8");
  const live = fs.readFileSync(path.join(__dirname, "build/client.js"), "utf8");
  const frames = [], errors = [];
  const flush = async frame => { await new Promise(resolve => frame.win.setTimeout(resolve, 30)); };
  function createFrame(label) {
    const dom = new JSDOM('<div id="root"></div>', {url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true});
    const win = dom.window;
    win.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}});
    win.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
    win.eval(host);
    const {React, ReactDOM, ReactDOMClient} = win.__Sub;
    const root = ReactDOMClient.createRoot(win.document.getElementById("root"), {onCaughtError() {}, onUncaughtError: error => errors.push(error)});
    const listeners = new Set();
    win.__Sub.hostUtils.setPlasmicRootNode = node => ReactDOM.flushSync(() => root.render(node));
    win.__Sub.hostUtils.registerRenderErrorListener = listener => {listeners.add(listener); return () => listeners.delete(listener);};
    win.eval(sdk); win.eval(live);
    const frame = {win, dom, root, React, ReactDOM, api: win.__plasmicLive, listeners, label};
    frames.push(frame); return frame;
  }
  const modules = label => [
    {fileName: "./root.js", type: "code", imports: ["react", "react/compiler-runtime", "./theme.js"], code},
    {fileName: "./theme.js", type: "code", imports: ["react"], code: 'exports.Theme = require("react").createContext("light"); exports.Provider = exports.Theme.Provider;'},
    {fileName: "./props.js", type: "code", imports: [], code: `exports.default = {label: ${JSON.stringify(label)}};`},
  ];
  const spec = {root: "./root.js", propsModule: "./props.js", componentUuid: "preview", isPage: true, depCss: [],
    globalVariants: [{module: "./theme.js", provider: "Provider", prop: "theme"}], globals: {theme: "light"}, appUser: {}};
  try {
    const first = createFrame("first"), second = createFrame("second");
    assert.notEqual(first.React, second.React);
    await first.api.update(modules("first"), spec); await second.api.update(modules("second"), spec);
    const button = first.win.document.querySelector("button");
    assert.equal(button.textContent, "first:0:light");
    first.ReactDOM.flushSync(() => button.click()); await flush(first);
    assert.equal(button.textContent, "first:1:light");
    first.ReactDOM.flushSync(() => {first.api.setProps({label: "updated"}); first.api.setGlobals({theme: "dark"});});
    await flush(first);
    assert.equal(first.win.document.querySelector("button"), button);
    assert.equal(button.textContent, "updated:1:dark");
    await first.api.update([{fileName: "./props.js", type: "code", imports: [], code: 'exports.default = {label: "route-updated"};'}], spec);
    assert.equal(first.win.document.querySelector("button"), button);
    assert.equal(button.textContent, "route-updated:1:light");
    assert.equal(second.win.document.querySelector("button").textContent, "second:0:light");
    assert.equal(first.api.getDiagnostics().status, "ready");
    first.ReactDOM.flushSync(() => first.api.setProps({fail: true}));
    await flush(first);
    assert.match(first.win.document.getElementById("root").textContent, /Preview unavailable/);
    assert.doesNotMatch(first.win.document.getElementById("root").textContent, /preview failure/);
    assert.equal(first.api.getDiagnostics().errors[0].message, "preview failure");
    assert.equal(first.api.getDiagnostics().status, "failed");
    await first.api.update(modules("recovered"), spec);
    assert.equal(first.win.document.querySelector("button").textContent, "recovered:0:light");
    assert.equal(first.api.getDiagnostics().status, "ready");
    assert.equal(second.win.document.querySelector("button").textContent, "second:0:light");
    assert.equal(second.api.getDiagnostics().status, "ready");
    assert.equal(first.listeners.size, 0); assert.equal(second.listeners.size, 0);
    assert.deepEqual(errors, []);
  } finally {
    for (const frame of frames) {frame.ReactDOM.flushSync(() => frame.root.unmount()); frame.dom.window.close();}
  }
});
