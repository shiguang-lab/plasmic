import { CanvasObserver } from "../../../../../../canvas-packages/src/canvas-observer";
import { CanvasErrorBoundary, CanvasErrorDisplay } from "../../../../../../canvas-packages/src/canvas-error";
import { wrapCanvasErrorBoundary } from "@/wab/client/components/canvas/canvas-error";
import { mkUseCanvasObserver } from "@/wab/client/components/canvas/canvas-observer";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render } from "@testing-library/react";
import { createStore } from "zustand/vanilla";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import type { CanvasObserverInput } from "@/wab/client/components/canvas/canvas-observer";
import React from "react";
import * as ReactDOM from "react-dom";

const releases: (() => void)[] = [];
function fixture(input?: CanvasObserverInput) {
  const lifetime = new AbortController();
  const session = new CanvasSessionState(), owner = new CanvasRenderOwner(session);
  releases.push(() => { lifetime.abort(); owner.dispose(); session.dispose(); });
  const frame = globalHookCtx.createFrameState({ uid: 402, objectPrototype: {} });
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _isDisposed: false, disposeSignal: lifetime.signal, frameState: frame, canvasRenderOwner: owner, arenaFrame: () => ({ uid: 402 }),
    canvasObservers: new Set(), uncommittedCanvasObservers: new Map(),
    canvasErrorObservers: new Set(), _canvasRerenderQueue: new Set(),
    canvasCtx: { Sub: { React, ReactDOM, DataContext: CanvasErrorBoundary.contextType, CanvasErrorBoundary, CanvasErrorDisplay } },
    syncQueue: { idle: () => true },
    studioCtx: { hasPendingModelChanges: () => false },
    updateCtxPostChange: vi.fn(),
  });
  const useObserver = mkUseCanvasObserver({ React, CanvasObserver } as any, view, input);
  const Boundary = CanvasErrorBoundary;
  const boundaryProps = wrapCanvasErrorBoundary({ ctx: { viewCtx: view, env: {}, wrappingEnv: {}, valKey: "table", ownerKey: "page" }, nodeOrComponent: mkTplTagX("div"), children: null } as any).props;
  return { view, useObserver, Boundary, boundaryProps, lifetime };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.spyOn(console, "error").mockReturnValue(undefined);
});
afterEach(() => {
  cleanup(); releases.splice(0).forEach((release) => release());
  globalHookCtx.frames.get(402)?.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("latches a persistent component error, cleans abandoned observers and recovers on model evaluation", async () => {
  const options = createStore<unknown>(() => ({ 常规: { label: "常规", color: "geekblue" } }));
  const { view, useObserver, Boundary, boundaryProps } = fixture(options);
  const attempts = vi.fn();
  function Widget({ value }: { value: any }) {
    attempts();
    return <span>{value?.find((item: any) => item.value === "常规")?.label}</span>;
  }
  function Observer() {
    return useObserver(() => <Widget value={options.getState()} />);
  }
  const result = render(<Boundary {...boundaryProps}><Observer /></Boundary>);
  expect(result.container.textContent).toContain("find is not a function");
  const failedAttempts = attempts.mock.calls.length;
  await act(() => vi.advanceTimersByTime(30000));
  expect(attempts).toHaveBeenCalledTimes(failedAttempts);
  expect(view.canvasObservers.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  await act(() => {
    options.setState([{ value: "常规", label: "已恢复" }], true);
    view.flushRerenderQueue();
  });
  expect(result.getByText("已恢复")).toBeTruthy();
  expect(view.canvasObservers.size).toBe(1);
  result.unmount();
  expect(view.canvasObservers.size).toBe(0);
  await act(() => view.flushRerenderQueue());
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps committed observers reactive through StrictMode and cleans them on unmount", async () => {
  const value = createStore(() => "初始");
  const { view, useObserver } = fixture(value);
  function Observer() { return useObserver(() => <span>{value.getState()}</span>); }
  const result = render(<React.StrictMode><Observer /></React.StrictMode>);
  await act(() => vi.advanceTimersByTime(30000));
  expect(view.canvasObservers.size).toBe(1);
  await act(() => {
    value.setState("已更新", true);
    vi.advanceTimersByTime(32);
  });
  expect(result.getByText("已更新")).toBeTruthy();
  result.unmount();
  expect(view.canvasObservers.size).toBe(0);
});

it("can resume a suspended render after its uncommitted render lease was reclaimed", async () => {
  const value = createStore(() => "已加载");
  const { view, useObserver } = fixture(value);
  let ready = false;
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => { resume = resolve; });
  function Observer() {
    return useObserver(() => {
      if (!ready) { throw pending; }
      return <span>{value.getState()}</span>;
    });
  }
  const result = render(<React.Suspense fallback="加载中"><Observer /></React.Suspense>);
  await act(() => vi.advanceTimersByTime(30000));
  expect(view.canvasObservers.size).toBe(0);
  await act(async () => { ready = true; resume(); await pending; });
  expect(result.getByText("已加载")).toBeTruthy();
  await act(() => {
    value.setState("查询更新", true);
    vi.advanceTimersByTime(32);
  });
  expect(result.getByText("查询更新")).toBeTruthy();
  result.unmount();
  expect(view.canvasObservers.size).toBe(0);
});


it("uses the iframe's native boundary type with independent view lifetimes", () => {
  const first = fixture(), second = fixture();
  expect(first.Boundary).toBe(CanvasErrorBoundary);
  expect(second.Boundary).toBe(CanvasErrorBoundary);
  expect(first.boundaryProps.lifetime).toBe(first.lifetime.signal);
  expect(second.boundaryProps.lifetime).toBe(second.lifetime.signal);
  expect(first.Boundary.contextType).toBe(first.view.canvasCtx.Sub.DataContext);
  first.lifetime.abort();
  expect(second.boundaryProps.lifetime.aborted).toBe(false);
  expect(() => wrapCanvasErrorBoundary({ ctx: { viewCtx: first.view }, nodeOrComponent: mkTplTagX("div"), children: null } as any)).toThrow("Cannot create a canvas error boundary for a disposed view");
});


it("releases a persistent error subscription at view abort before React unmount and ignores a queued retry", () => {
  const { view, Boundary, boundaryProps, lifetime } = fixture();
  const register = view.subscribeToCanvasChanges.bind(view), stopped = vi.fn();
  const subscribed = vi.spyOn(view, "subscribeToCanvasChanges").mockImplementation((listener) => {
    const off = register(listener);
    return () => { stopped(); return off(); };
  });
  function Broken(): React.ReactNode { throw new Error("Persistent failure"); }
  const result = render(<React.StrictMode><Boundary {...boundaryProps}><Broken /></Boundary></React.StrictMode>);
  expect(result.container.textContent).toContain("Persistent failure");
  expect(subscribed).toHaveBeenCalled();
  const retry = ensure(subscribed.mock.lastCall?.[0], "Actual retry callback");
  stopped.mockClear();
  const stateUpdates = vi.spyOn(Boundary.prototype, "setState");
  act(() => lifetime.abort());
  expect(stopped).toHaveBeenCalledOnce();
  act(() => retry());
  expect(stateUpdates).not.toHaveBeenCalled();
  expect(result.container.textContent).toContain("Persistent failure");
  result.unmount(); lifetime.abort();
  expect(stopped).toHaveBeenCalledOnce();
  stateUpdates.mockRestore();
});

it.each(["view", "owner"] as const)("unmounts a hooked canvas render at %s retirement before a queued retry", (retirement) => {
  const value = createStore(() => "live"), f = fixture(value), rendered = vi.fn(), cleaned = vi.fn();
  let queued: (() => void) | undefined;
  function HookedContent() {
    const [count, setCount] = React.useState(0);
    React.useMemo(() => count + 1, [count]);
    React.useEffect(() => cleaned, []);
    queued = () => setCount((previous) => previous + 1);
    rendered(); return <span>{value.getState()}:{count}</span>;
  }
  function Content() { return f.useObserver(() => <HookedContent />); }
  const mounted = render(<React.StrictMode><Content /></React.StrictMode>);
  expect(mounted.getByText("live:0")).toBeTruthy();
  const beforeCleanup = cleaned.mock.calls.length;
  act(() => { if (retirement === "view") { f.lifetime.abort(); } else { f.view.canvasRenderOwner.dispose(); } });
  expect(mounted.queryByText("live:0")).toBeNull();
  expect(cleaned).toHaveBeenCalledTimes(beforeCleanup + 1);
  const beforeRender = rendered.mock.calls.length;
  act(() => { queued?.(); value.setState("stale", true); f.view.flushRerenderQueue(); });
  expect(rendered).toHaveBeenCalledTimes(beforeRender);
  expect(f.view.canvasObservers.size).toBe(0);
  expect(vi.mocked(console.error).mock.calls.some((args) => args.some((arg) => String(arg).includes("Rendered fewer hooks") || String(arg).includes("order of Hooks")))).toBe(false);
  mounted.unmount();
});
