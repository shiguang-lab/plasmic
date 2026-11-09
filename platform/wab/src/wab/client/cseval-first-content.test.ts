const hook = vi.hoisted(() => {
  const renderers = new Map<number, unknown>();
  let nextId = 0;
  const value = {
    supportsFiber: true, renderers,
    inject: (renderer: unknown) => { const id = ++nextId; renderers.set(id, renderer); return id; },
    onCommitFiberRoot: (_renderer: number, _root: unknown) => undefined,
    onCommitFiberUnmount: (_renderer: number, _fiber: unknown) => undefined,
  };
  vi.stubGlobal("__REACT_DEVTOOLS_GLOBAL_HOOK__", value);
  return value;
});
const projection = vi.hoisted(() => ({ renderFrameRoot: vi.fn() }));
vi.mock("@/wab/client/components/canvas/canvas-rendering", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/wab/client/components/canvas/canvas-rendering")>(),
  renderFrameRoot: projection.renderFrameRoot,
}));

import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { DevCliSvrEvaluator } from "@/wab/client/cseval";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { classNameProp, frameUidProp, valKeyProp } from "@/wab/shared/canvas-constants";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import type { TplNode } from "@/wab/shared/model/classes";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import type React from "react";
import { createStore } from "zustand/vanilla";
import { mock } from "vitest-mock-extended";

const hostCode = fs.readFileSync(path.resolve(__dirname, "../../../../sub/public/static/sub/build/client.js"), "utf8");
const canvasCode = fs.readFileSync(path.resolve(__dirname, "../../../../canvas-packages/build/client.js"), "utf8");
const frames: { view: ViewCtx; page: React.ReactElement; dispose(): void }[] = [];

async function fixture(label: string, content?: (sub: SubDeps, page: React.ReactElement) => React.ReactElement) {
  const dom = new JSDOM('<div class="app-root"></div>', { url: "http://localhost/#canvas=true", runScripts: "outside-only", pretendToBeVisual: true });
  const win = dom.window;
  Reflect.set(win, "__REACT_DEVTOOLS_GLOBAL_HOOK__", hook);
  win.matchMedia = () => ({ matches: false, media: "", onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false });
  win.eval(hostCode);
  win.eval(canvasCode);
  const native: SubDeps = Reflect.get(win, "__Sub");
  const sub: SubDeps = Object.assign({}, native, Reflect.get(win, "__CanvasPkgs"));
  const nativeFlush = sub.ReactDOM.flushSync;
  const flush = vi.fn<() => void>();
  sub.ReactDOM = { ...sub.ReactDOM, flushSync<R>(command: () => R): R {
    flush();
    return nativeFlush(command);
  } };
  const r = sub.React.createElement;
  const host = sub.ReactDOMClient.createRoot(ensure(win.document.querySelector(".app-root"), "Host root"));
  nativeFlush(() => host.render(r(Reflect.get(native, "PlasmicCanvasHost"))));
  await vi.waitFor(() => expect(win.document.querySelector(".__wab_user-body")).not.toBeNull());
  const site = createSite();
  const component = mkComponent({ name: label, type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const arena = mkArenaFrame({ site, component, width: 800, height: 600, name: label });
  const frame = globalHookCtx.createFrameState({ uid: arena.uid, objectPrototype: win.Object.prototype });
  globalHookCtx.uuidToTplNode.set(arena.container.uuid, new WeakRef(arena.container));
  const models = new ModelSnapshots(), session = new CanvasSessionState(), owner = new CanvasRenderOwner(session);
  const selection = new ViewSelection(() => models), variants = new ViewVariantState(() => models, () => arena, () => site, () => false, () => false);
  const registrations = new CanvasRegistrations(), lifetime = new AbortController();
  const frameInfo = createStore(() => ({ viewMode: "centered" as const, height: 600, isHeightAutoDerived: false, fullPageHeight: false, bgColor: undefined, exporting: false }));
  const data = sub.React.createContext<unknown>(undefined);
  sub.dataSourcesContext = { ...sub.dataSourcesContext, PlasmicDataSourceContextProvider: data.Provider };
  const rerenders = new Set<() => void>();
  const canvas = mock<CanvasCtx>();
  Object.assign(canvas, { Sub: sub, registrations, rerender: CanvasCtx.prototype.rerender });
  canvas.frameInfo.mockReturnValue(frameInfo);
  canvas.syncFrameInfo.mockReturnValue(undefined);
  const view = mock<ViewCtx>();
  Object.assign(view, {
    site, component, frameState: frame, canvasCtx: canvas, canvasRenderOwner: owner, canvasSessionState: session,
    disposeSignal: lifetime.signal, isDisposed: false,
    studioCtx: { site, siteInfo: { id: "first-content" }, modelSnapshots: models,
      draggingObjectStore: createStore<boolean>(() => false), currentAppUserStore: createStore(() => ({ appUser: {} })),
      subscribeModelChanges: () => () => undefined, hasPendingModelChanges: () => false },
    selectionStore: selection.store, variantStore: variants.store,
    arenaFrame: () => arena, componentArgsContainer: () => arena.container,
    currentComponent: () => component, valComponentStack: () => [],
    focusedSelectable: () => true,
    trackCanvasObserver: () => undefined, commitCanvasObserver: () => undefined, disposeCanvasObserver: () => undefined,
    addRerenderObserver: (callback: () => void) => { rerenders.add(callback); },
    flushRerenderQueue: () => { const callbacks = [...rerenders]; rerenders.clear(); sub.ReactDOM.unstable_batchedUpdates(() => callbacks.forEach((callback) => callback())); },
  });
  const layout = vi.fn();
  function Page() {
    const [count, setCount] = sub.React.useState(0);
    sub.React.useLayoutEffect(() => { layout(); });
    return r("button", { onClick: () => setCount((value) => value + 1) }, `${label}:${count}`);
  }
  const page = r(Page, { [frameUidProp]: arena.uid, [valKeyProp]: arena.container.uuid, [classNameProp]: label });
  const output = content ? content(sub, page) : page;
  const evaluator = new DevCliSvrEvaluator({ viewCtx: view, frameState: frame });
  const f = { dom, sub, view, evaluator, frame, lifetime, page: output, layout, flush, nativeFlush, host, dispose() {
    nativeFlush(() => host.unmount()); evaluator.dispose(); lifetime.abort(); owner.dispose(); session.dispose();
    selection.dispose(); variants.dispose(); models.dispose(); registrations.dispose(); frame.dispose();
    globalHookCtx.uuidToTplNode.delete(arena.container.uuid); win.close();
  } };
  frames.push(f);
  return f;
}

beforeEach(() => {
  projection.renderFrameRoot.mockImplementation((view: ViewCtx, _root: TplNode) => ensure(frames.find((frame) => frame.view === view), "Native projection fixture").page);
});
afterEach(() => { frames.splice(0).forEach((frame) => frame.dispose()); projection.renderFrameRoot.mockClear(); });

it("commits the initial Host content and ValTree before post-eval DOM reads, in each native React realm", async () => {
  const first = await fixture("First"), second = await fixture("Second");
  expect(first.sub.React).not.toBe(second.sub.React);
  expect(first.nativeFlush).not.toBe(second.nativeFlush);
  for (const f of [first, second]) {
    const geometry = vi.fn(() => {
      const button = ensure(f.dom.window.document.querySelector("button"), "The initial content must already be committed");
      expect(button.textContent).toMatch(/:0$/);
      expect(f.layout).toHaveBeenCalledOnce();
      expect(f.evaluator.valState().maybeValSysRoot()).toBeTruthy();
      button.getBoundingClientRect();
    });
    f.evaluator.addPostEval(geometry);
    await f.evaluator.evalAsync();
    expect(f.frame.valRootStore.getState()).not.toBeNull();
    expect(f.flush).toHaveBeenCalledOnce();
    f.evaluator.runPostEvalTasks();
    expect(geometry).toHaveBeenCalledOnce();
    await f.evaluator.evalAsync(); f.evaluator.runPostEvalTasks();
    expect(f.flush).toHaveBeenCalledOnce();
    const button = ensure(f.dom.window.document.querySelector("button"), "Committed button");
    button.dispatchEvent(new f.dom.window.MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(button.textContent).toMatch(/:1$/));
    const invalidation = ensure(projection.renderFrameRoot.mock.calls.find(([view]) => view === f.view)?.[2], "Initial observer invalidator");
    invalidation(); f.view.flushRerenderQueue();
    await vi.waitFor(() => expect(projection.renderFrameRoot.mock.calls.filter(([view]) => view === f.view)).toHaveLength(2));
    expect(f.flush).toHaveBeenCalledOnce();
  }
});

it.each([false, true])("does not turn suspended initial content into a committed ValTree, including cancellation: %s", async (cancelled) => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => { resolve = done; });
  const f = await fixture("Pending", (sub, page) => {
    function Pending() { sub.React.use(pending); return page; }
    return sub.React.createElement(sub.React.Suspense, { fallback: sub.React.createElement("span", {}, "Loading") }, sub.React.createElement(Pending));
  });
  await f.evaluator.evalAsync();
  expect(f.dom.window.document.body.textContent).toContain("Loading");
  expect(f.dom.window.document.querySelector("button")).toBeNull();
  expect(f.frame.valRootStore.getState()).toBeNull();
  expect(f.evaluator.valState().maybeValSysRoot()).toBeUndefined();
  expect(f.layout).not.toHaveBeenCalled();
  if (cancelled) {
    f.lifetime.abort();
    f.evaluator.dispose();
  }
  resolve();
  if (cancelled) {
    await vi.waitFor(() => expect(f.dom.window.document.querySelector(".__wab_root")).toBeNull());
    expect(f.dom.window.document.querySelector("button")).toBeNull();
    expect(f.frame.valRootStore.getState()).toBeNull();
    expect(f.layout).not.toHaveBeenCalled();
  } else {
    await vi.waitFor(() => expect(f.dom.window.document.querySelector("button")?.textContent).toBe("Pending:0"));
    expect(f.frame.valRootStore.getState()).not.toBeNull();
  }
  expect(f.flush).toHaveBeenCalledOnce();
});

it("retains the Host error boundary and does not publish a ValTree for failed initial content", async () => {
  const failure = new Error("Initial query failed");
  const f = await fixture("Broken", (sub) => {
    function Broken(): never { throw failure; }
    return sub.React.createElement(Broken);
  });
  const caught = vi.fn();
  const stop = f.sub.hostUtils.registerRenderErrorListener(caught);
  try {
    await f.evaluator.evalAsync();
    expect(caught).toHaveBeenCalledExactlyOnceWith(failure);
    expect(f.dom.window.document.body.textContent).toContain("Initial query failed");
    expect(f.frame.valRootStore.getState()).toBeNull();
    expect(f.evaluator.valState().maybeValSysRoot()).toBeUndefined();
    expect(f.layout).not.toHaveBeenCalled();
    expect(f.flush).toHaveBeenCalledOnce();
  } finally { stop(); }
});
