import { showPreviewLoadError, syncPreview } from "@/wab/client/components/live/preview-sync";
import type { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { pushPreviewModules } from "@/wab/client/components/live/live-syncer";
import * as codegen from "@/wab/client/components/live/preview-codegen";
import {
  LiveFrame,
  PreviewRender,
  PreviewUpdate,
} from "@/wab/client/components/live/preview-types";
import { observable, runInAction } from "mobx";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { createPreview } from "../../../../../../live-frame/src/preview";
import { createRenderer } from "../../../../../../live-frame/src/render";
import { createLiveRuntime } from "../../../../../../live-frame/src/runtime";
import { createDiagnostics, installErrorHandlers } from "../../../../../../live-frame/src/diagnostics";

let container: HTMLDivElement;
let root: Root;
let frame: LiveFrame;
let runtime: ReturnType<typeof createLiveRuntime>;
const listeners = new Set<(error: Error) => void>();

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  { error?: Error }
> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    listeners.forEach((listener) => listener(error));
  }
  render() {
    return this.state.error
      ? `Error: ${this.state.error.message}`
      : this.props.children;
  }
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  let renders = 0;
  const Sub = {
    React,
    DataProvider: ({ children }: React.PropsWithChildren<{}>) => children,
    hostUtils: {
      setPlasmicRootNode: (node: React.ReactNode) =>
        root.render(<ErrorBoundary key={++renders}>{node}</ErrorBoundary>),
      registerRenderErrorListener: (listener: (error: Error) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
  const renderer = createRenderer(Sub);
  runtime = createLiveRuntime({
    react: React,
    "test-renderer": renderer,
    "@plasmicapp/react-web": {
      PlasmicDataSourceContextProvider: ({
        children,
      }: React.PropsWithChildren<{}>) => children,
    },
  });
  const preview = createPreview(Sub, runtime.require, renderer.renderRoot);
  frame = {
    ...preview,
    ...renderer,
    update: async (modules, spec) => {
      if (spec) renderer.beginRender("componentUuid" in spec ? spec.componentUuid : undefined);
      runtime.update(modules);
      if (spec) {
        await preview.render(spec);
      }
    },
  };
});
afterEach(() => {
  root.unmount();
  container.remove();
  listeners.clear();
  document
    .querySelectorAll("style[data-live-module]")
    .forEach((el) => el.remove());
});

const spec: PreviewRender = {
  componentUuid: "root-component",
  root: "./root.tsx",
  isPage: true,
  depCss: [],
  propsModule: "./props.ts",
  globalVariants: [],
  globals: {},
  appUser: {},
};
const update = (
  source = 'import React from "react"; export default () => <h1>Fresh preview</h1>',
): PreviewUpdate => ({
  modules: [
    { name: "./root.tsx", lang: "tsx", source },
    { name: "./props.ts", lang: "ts", source: "export default {}" },
  ],
  render: spec,
});
function deliver(value: PreviewUpdate) {
  return new Promise<{ error?: unknown; text: string }>((resolve) => {
    const dispose = syncPreview(
      { __plasmicLive: frame } as unknown as Window,
      () => value,
      (error) => {
        resolve({ error, text: container.textContent ?? "" });
        dispose();
      },
    );
  });
}

it("reports completion only after the live preview commits", async () => {
  expect(await deliver(update())).toEqual({
    error: undefined,
    text: "Fresh preview",
  });
  expect(listeners.size).toBe(0);
});

it("waits for docs entry modules to commit before measuring their DOM", async () => {
  const result = await deliver({
    modules: [
      {
        name: "./docs.tsx",
        lang: "tsx",
        source: `
    import React from "react";
    import { renderRoot } from "test-renderer";
    export function __run() { return renderRoot(<h1>Docs preview</h1>); }
  `,
      },
    ],
    render: { run: "./docs.tsx" },
  });
  expect(result).toEqual({ error: undefined, text: "Docs preview" });
});

function preventRenderErrorReport(event: ErrorEvent) {
  // React reports a caught render error through jsdom before the boundary handles it.
  if (event.error?.message === "render failed") {
    event.preventDefault();
  }
}

it.each([
  ["syntax", "export default ("],
  [
    "evaluation",
    'throw new Error("evaluation failed"); export default () => null',
  ],
])(
  "replaces stale content after a %s error and recovers",
  async (_kind, source) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await deliver(update());
    const result = await deliver(update(source));
    expect(result.error).toBeDefined();
    expect(result.text).toContain("Error:");
    expect(frame.getDiagnostics().status).toBe("failed");
    expect(result.text).not.toContain("Fresh preview");
    expect(await deliver(update())).toEqual({
      error: undefined,
      text: "Fresh preview",
    });
    expect(listeners.size).toBe(0);
  },
);

it("contains a render error, records its cause, and recovers on the next render", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.addEventListener("error", preventRenderErrorReport);
  await deliver(update());
  expect(
    await deliver(
      update('export default () => { throw new Error("render failed"); }'),
    ),
  ).toEqual({ error: undefined, text: "Error: render failed" });
  expect(container.querySelector('[data-plasmic-preview-error]')).not.toBeNull();
  expect(frame.getDiagnostics()).toMatchObject({ status: "failed", errors: [
    { message: "render failed", kind: "render", fatal: true, stack: expect.stringContaining("render failed") },
  ] });
  expect(await deliver(update())).toEqual({
    error: undefined,
    text: "Fresh preview",
  });
  expect(listeners.size).toBe(0);
  expect(frame.getDiagnostics()).toMatchObject({ status: "ready", errors: [] });
  window.removeEventListener("error", preventRenderErrorReport);
});

it("serializes commits and coalesces pending updates", async () => {
  const first = Promise.withResolvers<void>();
  const calls: string[] = [];
  const completed = Promise.withResolvers<void>();
  const fake = {
    ...frame,
    update: vi.fn(async (modules) => {
      calls.push(modules[0].source);
      if (calls.length === 1) {
        await first.promise;
      }
    }),
  };
  const css = (code: string): PreviewUpdate => ({
    modules: [{ name: "./test.css", lang: "css", source: code }],
  });
  const value = observable.box(css("first"), { deep: false });
  let done = 0;
  const dispose = syncPreview(
    { __plasmicLive: fake } as unknown as Window,
    () => value.get(),
    () => {
      if (++done === 2) {
        completed.resolve();
      }
    },
  );
  await vi.waitFor(() => expect(calls).toEqual(["first"]));
  runInAction(() => value.set(css("second")));
  runInAction(() => value.set(css("latest")));
  first.resolve();
  await completed.promise;
  expect(calls).toEqual(["first", "latest"]);
  dispose();
});

it("serializes build failures after in-flight commits, then recovers on a valid build", async () => {
  const gate = Promise.withResolvers<void>();
  const originalUpdate = frame.update;
  frame.update = vi.fn(async (...args: Parameters<LiveFrame["update"]>) => { await gate.promise; return originalUpdate(...args); });
  const version = observable.box(0);
  const error = new Error("Invalid preview model");
  const onDone = vi.fn();
  const dispose = syncPreview({ __plasmicLive: frame } as unknown as Window, () => {
    if (version.get() === 1) { throw error; }
    return update();
  }, onDone);
  try {
    await vi.waitFor(() => expect(frame.update).toHaveBeenCalledOnce());
    runInAction(() => version.set(1));
    gate.resolve();
    await vi.waitFor(() => expect(onDone).toHaveBeenLastCalledWith(error));
    expect(container.textContent).toContain("Invalid preview model");
    expect(container.textContent).not.toContain("Fresh preview");
    expect(frame.getDiagnostics()).toMatchObject({ status: "failed", errors: [{ message: error.message, stack: error.stack }] });
    runInAction(() => version.set(2));
    await vi.waitFor(() => expect(container.textContent).toBe("Fresh preview"));
    expect(frame.getDiagnostics()).toMatchObject({ status: "ready", errors: [] });
  } finally { gate.resolve(); dispose(); }
});

it("shows bootstrap failures before the runtime exists without losing their stack", async () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  try {
    const win = iframe.contentWindow as Window;
    const error = new Error("Runtime download failed");
    await showPreviewLoadError(win, error);
    const failure = win.document.querySelector('[data-plasmic-preview-error]');
    expect(failure?.textContent).toBe(error.message);
    expect(failure?.getAttribute("data-plasmic-error-stack")).toBe(error.stack);
    expect(failure?.getAttribute("role")).toBe("alert");
  } finally { iframe.remove(); }
});

it.each(["data", "hide", "unmount"])("recovers a local failure after %s changes without an automatic retry loop", async (recovery) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.addEventListener("error", preventRenderErrorReport);
  const disposeErrors = installErrorHandlers(window, frame.reportError);
  try {
    await deliver(update(`import React from "react"; import { renderBoundary } from "test-renderer";
      export default function Page() {
        const [mode, setMode] = React.useState("broken");
        return <div>
          <button onClick={() => setMode("${recovery}")}>Recover</button>
          {mode !== "unmount" && renderBoundary(() => {
            window.boundaryAttempts = (window.boundaryAttempts || 0) + 1;
            if (mode === "broken") throw new Error("render failed");
            return mode === "hide" ? null : <span>Valid data</span>;
          }, { elementUuid: "records" })}
        </div>;
      }`));
    const attempts = (window as any).boundaryAttempts;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect((window as any).boundaryAttempts).toBe(attempts);
    expect(frame.getDiagnostics().status).toBe("degraded");
    const unrelated = new Error("Unrelated action failed");
    frame.reportError(unrelated, { kind: "interaction", fatal: false });
    container.querySelector("button")?.click();
    await vi.waitFor(() => expect(container.querySelector('[data-plasmic-preview-error]')).toBeNull());
    expect(container.textContent).toBe(recovery === "data" ? "RecoverValid data" : "Recover");
    expect(frame.getDiagnostics().errors).toEqual([expect.objectContaining({ message: unrelated.message })]);
  } finally {
    disposeErrors();
    window.removeEventListener("error", preventRenderErrorReport);
    delete (window as any).boundaryAttempts;
  }
});

it.each(["props", "render"])("isolates %s failures while siblings remain interactive", async (kind) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.addEventListener("error", preventRenderErrorReport);
  try {
    const value = update(`import React from "react";
      import { renderBoundary } from "test-renderer";
      function Broken() { throw new Error("render failed"); }
      export default function Page() {
        const [count, setCount] = React.useState(0);
        const [broken, setBroken] = React.useState(false);
        return <div>
          <button onClick={() => setCount(count + 1)}>Count {count}</button>
          <button onClick={() => setBroken(true)}>Break</button>
          {renderBoundary(() => broken ? ${kind === "props" ? '(() => { throw new Error("render failed"); })()' : "<Broken />"} : <span>Table ready</span>,
            { componentUuid: "page", elementUuid: "table", nodeName: "Records" })}
        </div>;
      }`);
    await deliver(value);
    container.querySelectorAll("button")[1].click();
    await vi.waitFor(() => expect(container.textContent).toContain("Error: render failed"));
    expect(frame.getDiagnostics()).toMatchObject({ status: "degraded", errors: [
      { elementUuid: "table", nodeName: "Records", fatal: false, componentStack: expect.any(String) },
    ] });
    expect(container.querySelector(".live-root-container")).not.toBeNull();
    container.querySelector("button")?.click();
    await vi.waitFor(() => expect(container.textContent).toContain("Count 1"));
    await deliver(update());
    expect(frame.getDiagnostics()).toMatchObject({ status: "ready", errors: [] });
  } finally {
    window.removeEventListener("error", preventRenderErrorReport);
  }
});

it("captures browser and promise failures with bounded, render-scoped diagnostics", () => {
  const diagnostics = createDiagnostics();
  diagnostics.begin("first");
  diagnostics.commit();
  const dispose = installErrorHandlers(window, diagnostics.report);
  const error = new Error("request failed");
  try {
    window.dispatchEvent(new ErrorEvent("error", { error }));
    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", { value: error });
    window.dispatchEvent(rejection);
    expect(diagnostics.read()).toMatchObject({ status: "degraded", errors: [{ message: "request failed", stack: error.stack }] });
    const old = diagnostics.read().generation;
    diagnostics.begin("second");
    diagnostics.commit();
    diagnostics.report(error, { kind: "interaction", fatal: false }, old);
    // Rethrowing the old interaction also reaches the browser rejection event.
    window.dispatchEvent(rejection);
    expect(diagnostics.read()).toMatchObject({ componentUuid: "second", status: "ready", errors: [] });
    for (let i = 0; i < 100; i++) diagnostics.report(new Error(`Failure ${i}`), { kind: "unhandled", fatal: false });
    expect(diagnostics.read().errors).toHaveLength(50);
    expect(diagnostics.read().errors.at(-1)?.message).toBe("Failure 99");
  } finally { dispose(); }
});

it("does not discard historical or asynchronous failures when correlating React development probes", async () => {
  const diagnostics = createDiagnostics();
  diagnostics.begin("page");
  diagnostics.commit();
  const error = () => Object.assign(new Error("same failure"), { stack: "Error: same failure\n    at widget (widget.js:1:1)\n    at render (view.js:1:1)\n    at caller (main.js:1:1)" });
  diagnostics.report(error(), { kind: "unhandled", fatal: false, source: "window-error" });
  await Promise.resolve();
  diagnostics.report(error(), { kind: "unhandled", fatal: false, source: "unhandledrejection" });
  diagnostics.report(error(), { kind: "unhandled", fatal: false, source: "window-error" });
  const caught = error();
  diagnostics.report(caught, { kind: "render", fatal: false, elementUuid: "widget" });
  expect(diagnostics.read().errors).toHaveLength(3);
  diagnostics.resolve(caught, diagnostics.read().generation);
  expect(diagnostics.read().errors.map((item) => item.source)).toEqual(["window-error", "unhandledrejection"]);
});

it("invalidates importers while preserving unrelated modules and CSS order", async () => {
  runtime.update([
    {
      fileName: "./a.js",
      code: 'exports.value=require("./b").value;',
      imports: [],
      type: "code",
    },
    { fileName: "./b.js", code: "exports.value=1;", imports: [], type: "code" },
    {
      fileName: "./unrelated.js",
      code: "exports.value={};",
      imports: [],
      type: "code",
    },
    { fileName: "./first.css", source: "div {color: red}", type: "asset" },
    { fileName: "./second.css", source: "div {color: blue}", type: "asset" },
  ]);
  expect(runtime.require("./a").value).toBe(1);
  const unrelated = runtime.require("./unrelated");
  runtime.require("./first.css");
  runtime.require("./second.css");
  const styles = [...document.querySelectorAll("style[data-live-module]")];
  runtime.update([
    { fileName: "./b.js", code: "exports.value=2;", imports: [], type: "code" },
    { fileName: "./first.css", source: "div {color: green}", type: "asset" },
  ]);
  expect(runtime.require("./a").value).toBe(2);
  expect(runtime.require("./unrelated")).toBe(unrelated);
  expect([...document.querySelectorAll("style[data-live-module]")]).toEqual(
    styles,
  );
  expect(styles[0].textContent).toContain("green");
  expect(() => runtime.require("missing-package")).toThrow(
    'unknown module "missing-package"',
  );
});

it("includes the JSX pragma in the transpilation cache key", async () => {
  const codes: string[] = [];
  const fake = {
    ...frame,
    update: vi.fn(async (modules) => {
      codes.push(modules[0].code);
    }),
  };
  const mod = {
    name: "./component.tsx",
    lang: "tsx",
    source: "export default <div />",
  };
  const value = observable.box<PreviewUpdate>(
    { modules: [mod] },
    { deep: false },
  );
  const dispose = syncPreview(
    { __plasmicLive: fake } as unknown as Window,
    () => value.get(),
    () => undefined,
  );
  await vi.waitFor(() => expect(codes).toHaveLength(1));
  runInAction(() =>
    value.set({
      modules: [{ ...mod, jsxPragma: "createPlasmicElementProxy" }],
    }),
  );
  await vi.waitFor(() => expect(codes).toHaveLength(2));
  expect(codes[0]).toContain("React.createElement");
  expect(codes[1]).toContain("createPlasmicElementProxy");
  dispose();
});

it("updates component and global variants without losing component state", async () => {
  const value =
    update(`import React from "react"; import { Theme } from "./theme";
    export default function Counter(props) {
      const [count, setCount] = React.useState(0);
      const theme = React.useContext(Theme);
      return <button onClick={() => setCount(count + 1)}>{count}/{props.variant}/{theme}</button>;
    }`);
  value.modules.push({
    name: "./theme.tsx",
    lang: "tsx",
    source:
      'import React from "react"; export const Theme=React.createContext("light"); export const Provider=Theme.Provider;',
  });
  value.render = {
    ...spec,
    globalVariants: [
      { module: "./theme.tsx", provider: "Provider", prop: "theme" },
    ],
    globals: { theme: "light" },
  };
  await deliver(value);
  container.querySelector("button")?.click();
  await vi.waitFor(() => expect(container.textContent).toBe("1//light"));
  frame.setProps({ variant: "active" });
  frame.setGlobals({ theme: "dark" });
  await vi.waitFor(() => expect(container.textContent).toBe("1/active/dark"));
});

it("keeps variant changes made before the first render commits", async () => {
  const state = observable({ variant: "before", theme: "light" });
  const value = update(`import React from "react"; import { Theme } from "./theme";
    export default function Counter(props) {
      const [count, setCount] = React.useState(0);
      return <button onClick={() => setCount(count + 1)}>{count}/{props.variant}/{React.useContext(Theme)}</button>;
    }`);
  value.modules[1].source = 'export default {variant:"before"}';
  value.modules.push({ name: "./theme.tsx", lang: "tsx", source: 'import React from "react"; export const Theme=React.createContext("light"); export const Provider=Theme.Provider;' });
  value.render = { ...spec, globals: {theme:"light"}, globalVariants: [{module:"./theme.tsx", provider:"Provider", prop:"theme"}] };
  vi.spyOn(codegen, "buildPreviewUpdate").mockReturnValue(value);
  const ctx = {
    studioCtx: {currentAppUserCtx:{}}, previewData: {},
    get variants() { return {variant:state.variant}; },
    get global() { return {theme:state.theme}; },
    getVariants: () => [state.variant, state.theme],
  } as unknown as PreviewCtx;
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const updateFrame = frame.update;
  let started = false;
  frame.update = async (...args) => { started = true; await gate; await updateFrame(...args); };
  const onRendered = vi.fn();
  const dispose = pushPreviewModules({__plasmicLive:frame} as unknown as Window, ctx, {onRendered});
  try {
    await vi.waitFor(() => expect(started).toBe(true));
    runInAction(() => { state.variant="after"; state.theme="dark"; });
    release();
    await vi.waitFor(() => expect(onRendered).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(container.textContent).toBe("0/after/dark"));
    container.querySelector("button")?.click();
    await vi.waitFor(() => expect(container.textContent).toBe("1/after/dark"));
    runInAction(() => { state.variant="latest"; state.theme="light"; });
    await vi.waitFor(() => expect(container.textContent).toBe("1/latest/light"));
    expect(codegen.buildPreviewUpdate).toHaveBeenCalledOnce();
  } finally {
    release();
    dispose();
  }
});

it("commits a Suspense fallback without blocking the render queue", async () => {
  const result = await deliver(
    update("export default function Pending(){throw new Promise(() => {});}"),
  );
  expect(result).toEqual({ error: undefined, text: "Loading..." });
  expect(await deliver(update())).toEqual({
    error: undefined,
    text: "Fresh preview",
  });
});

it("commits an escaped 404 and recovers to a component", async () => {
  const result = await deliver({
    modules: [],
    render: { notFound: "/<script>bad()</script>" },
  });
  expect(result.error).toBeUndefined();
  expect(container.querySelector("tt")?.textContent).toBe(
    "/<script>bad()</script>",
  );
  expect(container.querySelector("script")).toBeNull();
  expect(await deliver(update())).toEqual({
    error: undefined,
    text: "Fresh preview",
  });
});

it("does not deliver pending updates after disposal", async () => {
  const fake = { ...frame, update: vi.fn(), showError: vi.fn() };
  const onDone = vi.fn();
  const dispose = syncPreview(
    { __plasmicLive: fake } as unknown as Window,
    () => update(),
    onDone,
  );
  dispose();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(fake.update).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});
