// Reuse the saved-project replay with its private profile and offline backend.
// Required arguments and PERF_BUILD_ROOT are those of real-project-open.cjs.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

exports.run = async (frame) => frame.executeJavaScript(`(async () => {
  const studio = studioCtx;
  const view = studio.tryGetViewCtxForFrame(studio.activeCanvasFrame);
  if (!view?.initialRenderReady) throw Error("Missing rendered active artboard");
  await studio.awaitEval();
  const counter = studio._changeCounter;
  const request = window.requestIdleCallback;
  const cancel = window.cancelIdleCallback;
  let idleCallbacks = 0;
  window.requestIdleCallback = callback => {
    idleCallbacks++;
    return window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 1000);
  };
  window.cancelIdleCallback = id => clearTimeout(id);
  try {
    // Reset only transient readiness to exercise the actual first-evaluation
    // policy with the real evaluator, DOM and queue. No model/prop changes.
    view._initialRenderReady.setState(false, true);
    const start = performance.now();
    view.scheduleSync({ eval: true, styles: false });
    await view.awaitSync();
    const elapsedMs = performance.now() - start;
    if (!view.initialRenderReady || studio._changeCounter !== counter) {
      throw Error("First-render probe changed the model or did not finish");
    }
    return {
      scope: "Real evaluator and queue; transient first-render readiness reset; idle callbacks delayed 1000ms",
      elapsedMs, idleCallbacks, ready: true, modelUnchanged: true,
    };
  } finally {
    window.requestIdleCallback = request;
    window.cancelIdleCallback = cancel;
  }
})()`);

const filename = path.join(__dirname, "real-project-open.cjs");
let source = fs.readFileSync(filename, "utf8");
const marker = "    if (i===opens-1 && process.env.PERF_OPEN_RENDERERS";
if (!source.includes(marker)) throw Error("Saved-project replay insertion point changed");
source = source.replace(marker,
  `    if (i===opens-1) { report.schedulingQualification = await require(${JSON.stringify(__filename)}).run(frame); break; }\n${marker}`);
const harness = new Module(filename, module);
harness.filename = filename;
harness.paths = Module._nodeModulePaths(path.dirname(filename));
harness._compile(source, filename);
