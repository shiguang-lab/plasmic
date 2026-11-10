import { pushPreviewModules } from "@/wab/client/components/live/live-syncer";
import * as codegen from "@/wab/client/components/live/preview-codegen";
import {
  showPreviewLoadError,
  syncPreview,
  type PreviewBatchCompiler,
} from "@/wab/client/components/live/preview-sync";
import { createPreviewCompiler } from "@/wab/client/components/live/preview-compiler";
import { createTranspiler } from "@/wab/client/components/live/preview-transpiler";
import {
  LiveFrame,
  PreviewRender,
  PreviewUpdate,
} from "@/wab/client/components/live/preview-types";
import type { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import React from "react";
import * as reactCompilerRuntime from "react/compiler-runtime";
import { Root, createRoot } from "react-dom/client";
import { createStore } from "zustand/vanilla";
import {
  createDiagnostics,
  installErrorHandlers,
  type PreviewErrorLocation,
} from "../../../../../../live-frame/src/diagnostics";
import { createPreview } from "../../../../../../live-frame/src/preview";
import { createRenderer } from "../../../../../../live-frame/src/render";
import { createLiveRuntime } from "../../../../../../live-frame/src/runtime";

// jsdom exercises real generated code and runtime updates; worker transport
// and browser responsiveness are checked by their dedicated contracts.
vi.mock("@/wab/client/components/live/preview-compiler", async () => {
  const { createTranspiler: createTestTranspiler } = await import("@/wab/client/components/live/preview-transpiler");
  return { createPreviewCompiler: () => {
    const transpile = createTestTranspiler();
    return { compile: (modules: import("@/wab/client/components/live/preview-types").SourceModule[]) => Promise.all(modules.map(transpile)), dispose: vi.fn() };
  } };
});

let container: HTMLDivElement;
let root: Root;
let frame: LiveFrame;
let runtime: ReturnType<typeof createLiveRuntime>;
const listeners = new Set<(error: Error) => void>();
const boundaryAttempts = vi.fn();

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
  boundaryAttempts.mockClear();
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
    "react/compiler-runtime": reactCompilerRuntime,
    "test-renderer": {
      ...renderer,
      renderBoundary: (render: () => React.ReactNode, location: PreviewErrorLocation) =>
        renderer.renderBoundary(() => { boundaryAttempts(); return render(); }, location),
    },
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
      if (spec)
        {renderer.beginRender(
          "componentUuid" in spec ? spec.componentUuid : undefined,
        );}
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
function deliver(value: PreviewUpdate, compileModules?: PreviewBatchCompiler) {
  return new Promise<{ error?: unknown; text: string }>((resolve) => {
    const dispose = syncPreview(
      { __plasmicLive: frame } as unknown as Window,
      () => value,
      (error) => {
        resolve({ error, text: container.textContent ?? "" });
        dispose();
      },
      { compileModules },
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

it("commits a custom compiled batch through the same runtime and completion queue", async () => {
  const transpile = createTranspiler();
  const compile = vi.fn<PreviewBatchCompiler>((modules) => Promise.all(modules.map(transpile)));
  expect(await deliver(update(), compile)).toEqual({ error: undefined, text: "Fresh preview" });
  expect(compile).toHaveBeenCalledOnce();
  expect(compile.mock.calls[0][1].aborted).toBe(true);
});

it("reports custom batch compiler failures through the shared visible error path", async () => {
  const failure = new Error("Isolated compiler failed");
  const onReturn = vi.fn();
  frame.setErrorTitle("预览加载失败", { label: "返回编辑", onReturn });
  const compile = vi.fn<PreviewBatchCompiler>(async () => { throw failure; });
  const result = await deliver(update(), compile);
  expect(result.error).toBe(failure);
  expect(result.text).toBe("预览加载失败返回编辑");
  expect(container.textContent).not.toContain(failure.message);
  container.querySelector("button")?.click();
  expect(onReturn).toHaveBeenCalledOnce();
  expect(compile.mock.calls[0][1].aborted).toBe(true);
});

it.each(["compile", "evaluation"])("retains interactive DOM and inputs after an update %s failure", async kind => {
  await deliver(update(`import React from "react"; export default function Counter(props) {
    const [count, setCount] = React.useState(0);
    return <><button onClick={() => setCount(value => value + 1)}>{props.label}:{count}</button><input defaultValue="initial" /></>;
  }`));
  const button = container.querySelector("button"), input = container.querySelector("input");
  if (!button || !input) { throw new Error("Counter must mount"); }
  button.click(); input.value = "edited";
  await vi.waitFor(() => expect(button.textContent).toBe(":1"));
  const result = kind === "compile"
    ? await deliver(update(), async () => { throw new Error("Worker failed"); })
    : await deliver(update('throw new Error("Module failed"); export default () => null;'));
  expect(result.error).toBeDefined();
  expect(container.querySelector("button")).toBe(button);
  expect(container.querySelector("input")).toBe(input);
  expect(input.value).toBe("edited");
  frame.setProps({ label: "updated" });
  button.click();
  await vi.waitFor(() => expect(button.textContent).toBe("updated:2"));
  expect(container.querySelector("[data-plasmic-preview-error]")).toBeNull();
  await deliver(update());
  expect(frame.getDiagnostics().status).toBe("ready");
});

it("aborts a custom compiler on disposal without updating a retired runtime", async () => {
  const pending = Promise.withResolvers<Awaited<ReturnType<PreviewBatchCompiler>>>();
  const compile = vi.fn<PreviewBatchCompiler>(() => pending.promise);
  const fake = { ...frame, update: vi.fn(), showError: vi.fn() };
  const onDone = vi.fn();
  const dispose = syncPreview({ __plasmicLive: fake } as unknown as Window, () => update(), onDone, { compileModules: compile });
  await vi.waitFor(() => expect(compile).toHaveBeenCalledOnce());
  const signal = compile.mock.calls[0][1];
  expect(signal.aborted).toBe(false);
  dispose();
  expect(signal.aborted).toBe(true);
  pending.resolve([]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fake.update).not.toHaveBeenCalled();
  expect(fake.showError).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

it("keeps a custom compiler serial and coalesces queued updates to the latest batch", async () => {
  const first = Promise.withResolvers<Awaited<ReturnType<PreviewBatchCompiler>>>();
  const value = createStore(() => ({ color: "first" }));
  const calls: string[] = [];
  const fake = { update: vi.fn(async (modules) => { calls.push(modules[0].source); }) };
  const compile = vi.fn<PreviewBatchCompiler>((modules) => compile.mock.calls.length === 1
    ? first.promise
    : Promise.resolve(modules.map((mod) => ({ type: "asset" as const, fileName: mod.name, source: mod.source }))));
  const dispose = syncPreview({ __plasmicLive: fake } as unknown as Window,
    () => ({ modules: [{ name: "./value.css", lang: "css", source: value.getState().color }] }),
    vi.fn(), { compileModules: compile, subscribe: (invalidate) => value.subscribe(invalidate) });
  await vi.waitFor(() => expect(compile).toHaveBeenCalledOnce());
  value.setState({ color: "intermediate" });
  await Promise.resolve();
  value.setState({ color: "latest" });
  await Promise.resolve();
  expect(compile).toHaveBeenCalledOnce();
  first.resolve([{ type: "asset", fileName: "./value.css", source: "first" }]);
  await vi.waitFor(() => expect(calls).toEqual(["first", "latest"]));
  expect(compile).toHaveBeenCalledTimes(2);
  dispose();
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
  "retains the last committed page after a %s error and recovers",
  async (_kind, source) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await deliver(update());
    const result = await deliver(update(source));
    expect(result.error).toBeDefined();
    expect(result.text).toBe("Fresh preview");
    expect(frame.getDiagnostics().status).toBe("failed");
    expect(container.querySelector("[data-plasmic-preview-error]")).toBeNull();
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
  ).toMatchObject({ error: expect.objectContaining({ message: "render failed" }), text: "Fresh preview" });
  expect(
    container.querySelector("[data-plasmic-preview-error]"),
  ).toBeNull();
  expect(frame.getDiagnostics()).toMatchObject({
    status: "failed",
    errors: [
      {
        message: "render failed",
        kind: "render",
        fatal: true,
        stack: expect.stringContaining("render failed"),
      },
    ],
  });
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
  const value = createStore(() => css("first"));
  let done = 0;
  const dispose = syncPreview(
    { __plasmicLive: fake } as unknown as Window,
    () => value.getState(),
    () => {
      if (++done === 2) {
        completed.resolve();
      }
    },
    { subscribe: value.subscribe },
  );
  await vi.waitFor(() => expect(calls).toEqual(["first"]));
  value.setState(css("second"), true);
  value.setState(css("latest"), true);
  first.resolve();
  await completed.promise;
  expect(calls).toEqual(["first", "latest"]);
  dispose();
});

it("serializes build failures after in-flight commits, then recovers on a valid build", async () => {
  const gate = Promise.withResolvers<void>();
  const originalUpdate = frame.update;
  frame.update = vi.fn(async (...args: Parameters<LiveFrame["update"]>) => {
    await gate.promise;
    return originalUpdate(...args);
  });
  const version = createStore(() => 0);
  const error = new Error("Invalid preview model");
  const onDone = vi.fn();
  const dispose = syncPreview(
    { __plasmicLive: frame } as unknown as Window,
    () => {
      if (version.getState() === 1) {
        throw error;
      }
      return update();
    },
    onDone,
    { subscribe: version.subscribe },
  );
  try {
    await vi.waitFor(() => expect(frame.update).toHaveBeenCalledOnce());
    version.setState(1, true);
    gate.resolve();
    await vi.waitFor(() => expect(onDone).toHaveBeenLastCalledWith(error));
    expect(container.textContent).toBe("Fresh preview");
    expect(container.querySelector("[data-plasmic-preview-error]")).toBeNull();
    expect(frame.getDiagnostics()).toMatchObject({
      status: "failed",
      errors: [{ message: error.message, stack: error.stack }],
    });
    version.setState(2, true);
    await vi.waitFor(() => expect(onDone).toHaveBeenLastCalledWith());
    expect(container.textContent).toBe("Fresh preview");
    expect(frame.getDiagnostics()).toMatchObject({
      status: "ready",
      errors: [],
    });
  } finally {
    gate.resolve();
    dispose();
  }
});

it("shows a bootstrap error card with return to editor and no technical details", async () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  try {
    const win = iframe.contentWindow as Window;
    const error = new Error("Runtime download failed");
    const onReturn = vi.fn();
    await showPreviewLoadError(win, error, { title: "预览加载失败", label: "返回编辑", onReturn });
    const failure = win.document.querySelector("[data-plasmic-preview-error]");
    expect(failure?.textContent).toBe("预览加载失败返回编辑");
    (failure?.querySelector("button") as HTMLButtonElement).click();
    expect(onReturn).toHaveBeenCalledOnce();
    expect(failure?.outerHTML).not.toContain(error.message);
    expect(failure?.getAttribute("data-plasmic-error-stack")).toBeNull();
    expect(failure?.getAttribute("role")).toBe("alert");
  } finally {
    iframe.remove();
  }
});

it.each(["data", "hide", "unmount"])(
  "recovers a local failure after %s changes without an automatic retry loop",
  async (recovery) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.addEventListener("error", preventRenderErrorReport);
    const disposeErrors = installErrorHandlers(window, frame.reportError);
    try {
      const result = await deliver(
        update(`import React from "react"; import { renderBoundary } from "test-renderer";
      export default function Page() {
        const [mode, setMode] = React.useState("broken");
        return <div>
          <button onClick={() => setMode("${recovery}")}>Recover</button>
          {mode !== "unmount" && renderBoundary(() => {
            if (mode === "broken") throw new Error("render failed");
            return mode === "hide" ? null : <span>Valid data</span>;
          }, { elementUuid: "records" })}
        </div>;
      }`),
      );
      expect(result.error).toBeUndefined();
      const attempts = boundaryAttempts.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(boundaryAttempts).toHaveBeenCalledTimes(attempts);
      expect(frame.getDiagnostics().status).toBe("degraded");
      const unrelated = new Error("Unrelated action failed");
      frame.reportError(unrelated, { kind: "interaction", fatal: false });
      container.querySelector("button")?.click();
      await vi.waitFor(() =>
        expect(
          container.querySelector("[data-plasmic-preview-error]"),
        ).toBeNull(),
      );
      expect(container.textContent).toBe(
        recovery === "data" ? "RecoverValid data" : "Recover",
      );
      expect(frame.getDiagnostics().errors).toEqual([
        expect.objectContaining({ message: unrelated.message }),
      ]);
    } finally {
      disposeErrors();
      window.removeEventListener("error", preventRenderErrorReport);
    }
  },
);

it.each(["props", "render"])(
  "isolates %s failures while siblings remain interactive",
  async (kind) => {
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
      await vi.waitFor(() =>
        expect(container.textContent).toContain("Preview unavailable"),
      );
      expect(frame.getDiagnostics()).toMatchObject({
        status: "degraded",
        errors: [
          {
            elementUuid: "table",
            nodeName: "Records",
            fatal: false,
            componentStack: expect.any(String),
          },
        ],
      });
      expect(container.querySelector(".live-root-container")).not.toBeNull();
      container.querySelector("button")?.click();
      await vi.waitFor(() =>
        expect(container.textContent).toContain("Count 1"),
      );
      await deliver(update());
      expect(frame.getDiagnostics()).toMatchObject({
        status: "ready",
        errors: [],
      });
    } finally {
      window.removeEventListener("error", preventRenderErrorReport);
    }
  },
);

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
    expect(diagnostics.read()).toMatchObject({
      status: "degraded",
      errors: [{ message: "request failed", stack: error.stack }],
    });
    const old = diagnostics.read().generation;
    diagnostics.begin("second");
    diagnostics.commit();
    diagnostics.report(error, { kind: "interaction", fatal: false }, old);
    // Rethrowing the old interaction also reaches the browser rejection event.
    window.dispatchEvent(rejection);
    expect(diagnostics.read()).toMatchObject({
      componentUuid: "second",
      status: "ready",
      errors: [],
    });
    for (let i = 0; i < 100; i++)
      {diagnostics.report(new Error(`Failure ${i}`), {
        kind: "unhandled",
        fatal: false,
      });}
    expect(diagnostics.read().errors).toHaveLength(50);
    expect(diagnostics.read().errors.at(-1)?.message).toBe("Failure 99");
  } finally {
    dispose();
  }
});

it("does not discard historical or asynchronous failures when correlating React development probes", async () => {
  const diagnostics = createDiagnostics();
  diagnostics.begin("page");
  diagnostics.commit();
  const error = () =>
    Object.assign(new Error("same failure"), {
      stack:
        "Error: same failure\n    at widget (widget.js:1:1)\n    at render (view.js:1:1)\n    at caller (main.js:1:1)",
    });
  diagnostics.report(error(), {
    kind: "unhandled",
    fatal: false,
    source: "window-error",
  });
  await Promise.resolve();
  diagnostics.report(error(), {
    kind: "unhandled",
    fatal: false,
    source: "unhandledrejection",
  });
  diagnostics.report(error(), {
    kind: "unhandled",
    fatal: false,
    source: "window-error",
  });
  const caught = error();
  diagnostics.report(caught, {
    kind: "render",
    fatal: false,
    elementUuid: "widget",
  });
  expect(diagnostics.read().errors).toHaveLength(3);
  diagnostics.resolve(caught, diagnostics.read().generation);
  expect(diagnostics.read().errors.map((item) => item.source)).toEqual([
    "window-error",
    "unhandledrejection",
  ]);
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
  const value = createStore<PreviewUpdate>(() => ({ modules: [mod] }));
  const dispose = syncPreview(
    { __plasmicLive: fake } as unknown as Window,
    () => value.getState(),
    () => undefined,
    { subscribe: value.subscribe },
  );
  await vi.waitFor(() => expect(codes).toHaveLength(1));
  value.setState({ modules: [{ ...mod, jsxPragma: "createPlasmicElementProxy" }] }, true);
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
  const state = createStore(() => ({ previewData: { componentPath: "/preview", variants: { variant: "before" }, global: { theme: "light" } } }));
  const value =
    update(`import React from "react"; import { Theme } from "./theme";
    export default function Counter(props) {
      const [count, setCount] = React.useState(0);
      return <button onClick={() => setCount(count + 1)}>{count}/{props.variant}/{React.useContext(Theme)}</button>;
    }`);
  value.modules[1].source = 'export default {variant:"before"}';
  value.modules.push({
    name: "./theme.tsx",
    lang: "tsx",
    source:
      'import React from "react"; export const Theme=React.createContext("light"); export const Provider=Theme.Provider;',
  });
  value.render = {
    ...spec,
    globals: { theme: "light" },
    globalVariants: [
      { module: "./theme.tsx", provider: "Provider", prop: "theme" },
    ],
  };
  vi.spyOn(codegen, "buildPreviewUpdate").mockReturnValue(value);
  const ctx = {
    store: state,
    previewCompiler: createPreviewCompiler(),
    studioCtx: { currentAppUserCtx: {}, currentAppUserStore: createStore(() => ({})) },
    previewData: {},
    get variants() {
      return state.getState().previewData.variants;
    },
    get global() {
      return state.getState().previewData.global;
    },
    getVariants: () => [],
  } as unknown as PreviewCtx;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const updateFrame = frame.update;
  let started = false;
  frame.update = async (...args) => {
    started = true;
    await gate;
    await updateFrame(...args);
  };
  const onRendered = vi.fn();
  const dispose = pushPreviewModules(
    { __plasmicLive: frame } as unknown as Window,
    ctx,
    { onRendered },
  );
  try {
    await vi.waitFor(() => expect(started).toBe(true));
    state.setState({ previewData: { componentPath: "/preview", variants: { variant: "after" }, global: { theme: "dark" } } });
    release();
    await vi.waitFor(() => expect(onRendered).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(container.textContent).toBe("0/after/dark"));
    container.querySelector("button")?.click();
    await vi.waitFor(() => expect(container.textContent).toBe("1/after/dark"));
    state.setState({ previewData: { componentPath: "/preview", variants: { variant: "latest" }, global: { theme: "light" } } });
    await vi.waitFor(() =>
      expect(container.textContent).toBe("1/latest/light"),
    );
    expect(codegen.buildPreviewUpdate).toHaveBeenCalledOnce();
  } finally {
    release();
    dispose();
  }
});

it("receives native preview commands before the first fiber renders and survives StrictMode replay", async () => {
  const Theme = React.createContext("light");
  function Counter({variant}: {variant: string}) {
    const [count, setCount] = React.useState(0);
    const theme = React.useContext(Theme);
    return <button onClick={() => setCount(value => value + 1)}>{count}/{variant}/{theme}</button>;
  }
  let node: React.ReactNode;
  let complete = () => {};
  const committed = new Promise<void>(resolve => {complete = resolve;});
  const modules: Record<string, unknown> = {
    "./root.tsx": {default: Counter},
    "./props.ts": {default: {variant: "initial"}},
    "./theme.tsx": {Provider: Theme.Provider},
    "@plasmicapp/react-web": {PlasmicDataSourceContextProvider: ({children}: React.PropsWithChildren) => children},
  };
  const preview = createPreview({}, name => modules[name], child => {node = child; return committed;});
  const rendering = preview.render({...spec, globals: {theme: "light"}, globalVariants: [{module: "./theme.tsx", provider: "Provider", prop: "theme"}]});
  preview.setProps({variant: "queued"});
  preview.setGlobals({theme: "dark"});
  root.render(<React.StrictMode>{node}</React.StrictMode>);
  await vi.waitFor(() => expect(container.textContent).toBe("0/queued/dark"));
  complete();
  await rendering;
  container.querySelector("button")?.click();
  await vi.waitFor(() => expect(container.textContent).toBe("1/queued/dark"));
  preview.setProps({variant: "next"});
  preview.setGlobals({theme: "light"});
  await vi.waitFor(() => expect(container.textContent).toBe("1/next/light"));
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
  expect(container.querySelector("code")?.textContent).toBe(
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

it("coalesces native store inputs without observable revisions and releases subscriptions", async () => {
  const value = createStore(() => ({ color: "first", unrelated: false }));
  const calls: string[] = [];
  const fake = {
    update: vi.fn(async (modules) => {
      calls.push(modules[0].source);
    }),
  };
  const build = vi.fn(() => ({
    modules: [
      {
        name: "./native.css",
        lang: "css" as const,
        source: value.getState().color,
      },
    ],
  }));
  const dispose = syncPreview(
    { __plasmicLive: fake } as unknown as Window,
    build,
    () => {},
    {
      subscribe: (invalidate) =>
        value.subscribe((next, previous) => {
          if (next.color !== previous.color) {
            invalidate();
          }
        }),
    },
  );
  await vi.waitFor(() => expect(calls).toEqual(["first"]));
  value.setState({ color: "intermediate" });
  value.setState({ color: "latest" });
  await vi.waitFor(() => expect(calls).toEqual(["first", "latest"]));
  expect(build).toHaveBeenCalledTimes(2);
  value.setState({ unrelated: true });
  await Promise.resolve();
  expect(build).toHaveBeenCalledTimes(2);
  value.setState({ color: "after disposal" });
  dispose();
  await Promise.resolve();
  expect(build).toHaveBeenCalledTimes(2);
  expect(calls).toEqual(["first", "latest"]);
});

it("preserves native state across same-root updates and recovers a failed root", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const nativeRoot = createRoot(host);
  const renderer = createRenderer({ hostUtils: {
    setPlasmicRootNode: (node: React.ReactNode) => nativeRoot.render(node),
    registerRenderErrorListener: () => vi.fn(),
  } });
  let mounts = 0;
  function Counter({label}: {label: string}) {
    const [value, setValue] = React.useState(0);
    React.useEffect(() => { mounts++; }, []);
    return <><button onClick={() => setValue(count => count + 1)}>{label}:{value}</button><input defaultValue="initial" /></>;
  }
  function Broken(): React.ReactNode { throw new Error("broken root"); }
  try {
    await renderer.renderRoot(<Counter label="First" />);
    const button = host.querySelector("button"), input = host.querySelector("input");
    if (!button || !input) { throw new Error("Counter must mount"); }
    button.click(); input.value = "edited";
    await vi.waitFor(() => expect(button.textContent).toBe("First:1"));
    await renderer.renderRoot(<Counter label="Second" />);
    expect(host.querySelector("button")).toBe(button);
    expect(host.querySelector("input")).toBe(input);
    expect(button.textContent).toBe("Second:1"); expect(input.value).toBe("edited");
    expect(mounts).toBe(1);
    renderer.beginRender("broken"); await expect(renderer.renderRoot(<Broken />)).rejects.toThrow("broken root");
    expect(host.textContent).toContain("Second:");
    expect(host.textContent).not.toContain("broken root");
    renderer.beginRender("recovered"); await renderer.renderRoot(<Counter label="Recovered" />);
    expect(host.textContent).toBe("Recovered:0");
    expect(renderer.getDiagnostics().status).toBe("ready");
  } finally { nativeRoot.unmount(); host.remove(); }
});

it("compiles large outlined preview boundaries with a custom JSX pragma and retains live state", async () => {
  const host = window as Window & { __plasmicLive?: LiveFrame };
  const previous = host.__plasmicLive;
  host.__plasmicLive = frame;
  const value = update(`import React, {createElement as createPlasmicElementProxy} from "react";
    export default function Page({label}) {
      const [count, setCount] = React.useState(0);
      return <main>{window.__plasmicLive.renderBoundary(() => (() => {
        const rendered = <button onClick={() => setCount(value => value + 1)}>{label}:{count}</button>;
        return <section>{rendered}</section>;
      })(), {elementUuid:"large-boundary"})}</main>;
    }
    /*${"source padding ".repeat(40000)}*/`);
  value.modules[0].jsxPragma = "createPlasmicElementProxy";
  value.modules[1].source = 'export default {label:"first"}';
  try {
    expect(await deliver(value)).toEqual({ error: undefined, text: "first:0" });
    container.querySelector("button")?.click();
    await vi.waitFor(() => expect(container.textContent).toBe("first:1"));
    frame.setProps({ label: "second" });
    await vi.waitFor(() => expect(container.textContent).toBe("second:1"));
    expect(frame.getDiagnostics().errors).toEqual([]);
  } finally {
    if (previous) { host.__plasmicLive = previous; } else { delete host.__plasmicLive; }
  }
});
