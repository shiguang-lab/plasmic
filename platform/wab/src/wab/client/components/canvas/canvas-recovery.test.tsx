import { mkCanvasErrorBoundary } from "@/wab/client/components/canvas/canvas-error";
import { mkUseCanvasObserver } from "@/wab/client/components/canvas/canvas-observer";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import React from "react";
import * as ReactDOM from "react-dom";

function fixture() {
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _isDisposed: false,
    canvasObservers: new Set(), uncommittedCanvasObservers: new Map(),
    canvasErrorObservers: new Set(), _canvasRerenderQueue: new Set(),
    canvasCtx: { Sub: { React, ReactDOM, DataContext: React.createContext({}) } },
    syncQueue: { idle: () => true },
    studioCtx: { hasPendingModelChanges: () => false },
    updateCtxPostChange: vi.fn(),
  });
  const useObserver = mkUseCanvasObserver({ React } as any, view);
  const Boundary = mkCanvasErrorBoundary(view, React);
  const boundaryProps = { ctx: { env: {}, wrappingEnv: {}, valKey: "table", ownerKey: "page" }, nodeOrComponent: mkTplTagX("div") } as any;
  return { view, useObserver, Boundary, boundaryProps };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.spyOn(console, "error").mockReturnValue(undefined);
});
afterEach(() => {
  cleanup();
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
