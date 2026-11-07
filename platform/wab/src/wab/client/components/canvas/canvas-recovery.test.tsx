import { mkCanvasErrorBoundary } from "@/wab/client/components/canvas/canvas-error";
import { mkUseCanvasObserver } from "@/wab/client/components/canvas/canvas-observer";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import React from "react";
import * as ReactDOM from "react-dom";

function fixture() {
  const lifetime = new AbortController();
  const frame = globalHookCtx.createFrameState({ uid: 402, objectPrototype: {} });
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _isDisposed: false, disposeSignal: lifetime.signal, frameState: frame, arenaFrame: () => ({ uid: 402 }),
    canvasObservers: new Set(), uncommittedCanvasObservers: new Map(),
    canvasErrorObservers: new Set(), _canvasRerenderQueue: new Set(),
    canvasCtx: { Sub: { React, ReactDOM, DataContext: React.createContext({}) } },
    syncQueue: { idle: () => true },
    studioCtx: { hasPendingModelChanges: () => false },
    updateCtxPostChange: vi.fn(),
  });
  const useObserver = mkUseCanvasObserver({ React } as any, view);
  const Boundary = mkCanvasErrorBoundary(view, React);
  const boundaryProps = { ctx: { viewCtx: view, env: {}, wrappingEnv: {}, valKey: "table", ownerKey: "page" }, nodeOrComponent: mkTplTagX("div") } as any;
  return { view, useObserver, Boundary, boundaryProps, lifetime };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.spyOn(console, "error").mockReturnValue(undefined);
});
afterEach(() => {
  cleanup();
  globalHookCtx.frames.get(402)?.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("latches a persistent component error, cleans abandoned observers and recovers on model evaluation", async () => {
  const { view, useObserver, Boundary, boundaryProps } = fixture();
  const options = observable.box<any>({ 常规: { label: "常规", color: "geekblue" } });
  const attempts = vi.fn();
  function Widget({ value }: { value: any }) {
    attempts();
    return <span>{value?.find((item: any) => item.value === "常规")?.label}</span>;
  }
  function Observer() {
    return useObserver(() => <Widget value={options.get()} />);
  }
  const result = render(<Boundary {...boundaryProps}><Observer /></Boundary>);
  expect(result.container.textContent).toContain("find is not a function");
  const failedAttempts = attempts.mock.calls.length;
  await act(() => vi.advanceTimersByTime(30000));
  expect(attempts).toHaveBeenCalledTimes(failedAttempts);
  expect(view.canvasObservers.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  await act(() => {
    runInAction(() => options.set([{ value: "常规", label: "已恢复" }]));
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
  const { view, useObserver } = fixture();
  const value = observable.box("初始");
  function Observer() { return useObserver(() => <span>{value.get()}</span>); }
  const result = render(<React.StrictMode><Observer /></React.StrictMode>);
  await act(() => vi.advanceTimersByTime(30000));
  expect(view.canvasObservers.size).toBe(1);
  await act(() => {
    runInAction(() => value.set("已更新"));
    vi.advanceTimersByTime(32);
  });
  expect(result.getByText("已更新")).toBeTruthy();
  result.unmount();
  expect(view.canvasObservers.size).toBe(0);
});

it("can resume a suspended render after its uncommitted reaction was reclaimed", async () => {
  const { view, useObserver } = fixture();
  let ready = false;
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => { resume = resolve; });
  const value = observable.box("已加载");
  function Observer() {
    return useObserver(() => {
      if (!ready) { throw pending; }
      return <span>{value.get()}</span>;
    });
  }
  const result = render(<React.Suspense fallback="加载中"><Observer /></React.Suspense>);
  await act(() => vi.advanceTimersByTime(30000));
  expect(view.canvasObservers.size).toBe(0);
  await act(async () => { ready = true; resume(); await pending; });
  expect(result.getByText("已加载")).toBeTruthy();
  await act(() => {
    runInAction(() => value.set("查询更新"));
    vi.advanceTimersByTime(32);
  });
  expect(result.getByText("查询更新")).toBeTruthy();
  result.unmount();
  expect(view.canvasObservers.size).toBe(0);
});


it("scopes boundary types to the real view, React and DataContext identities", () => {
  const first = fixture(), second = fixture();
  expect(mkCanvasErrorBoundary(first.view, React)).toBe(first.Boundary);
  expect(second.Boundary).not.toBe(first.Boundary);
  const originalContext = first.view.canvasCtx.Sub.DataContext;
  first.view.canvasCtx.Sub.DataContext = React.createContext<React.ContextType<typeof originalContext>>(undefined);
  const otherContext = mkCanvasErrorBoundary(first.view, React);
  expect(otherContext).not.toBe(first.Boundary);
  expect(otherContext.contextType).toBe(first.view.canvasCtx.Sub.DataContext);
  first.view.canvasCtx.Sub.DataContext = originalContext;
  expect(mkCanvasErrorBoundary(first.view, React)).toBe(first.Boundary);
  first.lifetime.abort(); second.lifetime.abort();
  expect(() => mkCanvasErrorBoundary(first.view, React)).toThrow("Cannot create a canvas error boundary for a disposed view");
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
