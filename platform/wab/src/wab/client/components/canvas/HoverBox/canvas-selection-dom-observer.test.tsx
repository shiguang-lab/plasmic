import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { observeCanvasSelectionDom } from "@/wab/client/components/canvas/HoverBox/canvas-selection-dom-observer";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import React from "react";

// Keep the production polyfill contract, routing its DOM resource to the
// controlled browser API used by the queued-resize delivery test.
vi.mock("resize-observer-polyfill", () => ({ default: function (callback: ResizeObserverCallback) { return new globalThis.ResizeObserver(callback); } }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function viewFixture() {
  const site = createSite();
  const component = mkComponent({ name: "Selection lifetime", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const frame = mkArenaFrame({ site, component, name: "Inactive test frame", width: 100, height: 100 });
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual ViewCtx");
  return { studio, view };
}

it("cancels real queued DOM records before actual View selection disposal while React is still mounted", async () => {
  const { studio, view } = await viewFixture();
  const body = document.createElement("div"); document.body.append(body);
  const recompute = vi.spyOn(view, "recomputeFocusedDomElts");
  const setDoms = vi.spyOn(view.selection, "setDoms");
  const disposeSelection = vi.spyOn(view.selection, "dispose");
  const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
  const drain = vi.spyOn(MutationObserver.prototype, "takeRecords");
  function MountedObserver() {
    React.useEffect(() => observeCanvasSelectionDom(view.disposeSignal, [body], { childList: true }, () => view.recomputeFocusedDomElts()), []);
    return <span data-testid="still-mounted" />;
  }
  const mounted = render(<MountedObserver />);
  const atAbort = vi.fn(() => {
    expect(disposeSelection).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(drain).toHaveBeenCalled();
  });
  view.disposeSignal.addEventListener("abort", atAbort, { once: true });
  try {
    await act(async () => { body.append(document.createElement("i")); await Promise.resolve(); });
    expect(recompute).toHaveBeenCalledOnce(); expect(setDoms).toHaveBeenCalledOnce();
    recompute.mockClear(); setDoms.mockClear();
    // A native delivery is already queued. View lifetime ends before React's
    // passive effect cleanup, matching the iframe/Studio owner-exit window.
    body.append(document.createElement("b"));
    view.dispose(); view.dispose();
    expect(atAbort).toHaveBeenCalledOnce(); expect(disposeSelection).toHaveBeenCalledOnce();
    expect(mounted.getByTestId("still-mounted")).toBeTruthy();
    await act(async () => { await Promise.resolve(); body.append(document.createElement("em")); await Promise.resolve(); });
    expect(recompute).not.toHaveBeenCalled(); expect(setDoms).not.toHaveBeenCalled();
    // The command contract still rejects an invalid late writer; cancellation
    // belongs to the observer producer, not a guard in the selection command.
    expect(() => view.recomputeFocusedDomElts()).toThrow("Cannot change a disposed canvas selection");
  } finally { mounted.unmount(); body.remove(); studio.dispose(); }
});

it("revokes already-captured mutation/resize callbacks, disconnects once, and leaves active failures visible", () => {
  const NativeMutationObserver = MutationObserver;
  const mutations: (() => void)[] = [], resizes: (() => void)[] = [];
  const mutationDisconnect = vi.fn(), resizeDisconnect = vi.fn();
  vi.stubGlobal("MutationObserver", class extends NativeMutationObserver {
    constructor(callback: MutationCallback) { super(callback); mutations.push(() => callback([], this)); }
    disconnect() { mutationDisconnect(); super.disconnect(); }
  });
  vi.stubGlobal("ResizeObserver", class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) { resizes.push(() => callback([], this)); }
    observe() { return undefined; } unobserve() { return undefined; } disconnect() { resizeDisconnect(); }
  });
  const lifetime = new AbortController(), body = document.createElement("div");
  const failure = new Error("active mutation failure"), changed = vi.fn(() => { throw failure; }), resized = vi.fn();
  const stop = observeCanvasSelectionDom(lifetime.signal, [body], { childList: true }, changed, { targets: [body], onResize: resized });
  expect(() => mutations[0]()).toThrow(failure);
  resizes[0](); expect(resized).toHaveBeenCalledOnce();
  lifetime.abort(); stop(); stop();
  expect(mutationDisconnect).toHaveBeenCalledOnce(); expect(resizeDisconnect).toHaveBeenCalledOnce();
  expect(() => mutations[0]()).not.toThrow(); resizes[0]();
  expect(changed).toHaveBeenCalledOnce(); expect(resized).toHaveBeenCalledOnce();
  observeCanvasSelectionDom(lifetime.signal, [body], { childList: true }, changed)();
  expect(mutations).toHaveLength(1);
});

function animationFrames() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => { pending.set(++next, callback); return next; });
  const cancel = vi.fn((_id: number) => undefined);
  vi.stubGlobal("requestAnimationFrame", request); vi.stubGlobal("cancelAnimationFrame", cancel);
  return { pending, request, cancel };
}

it("cancels a queued frame on abort and refuses callbacks delivered after cancellation", () => {
  const frames = animationFrames(), lifetime = new AbortController(), renders = vi.fn();
  const hook = renderHook(() => { renders(); return useFrameForceUpdate(lifetime.signal); });
  renders.mockClear();
  act(() => { hook.result.current(); hook.result.current(); });
  expect(frames.request).toHaveBeenCalledOnce();
  lifetime.abort(); expect(frames.cancel).toHaveBeenCalledWith(1);
  act(() => { frames.pending.get(1)?.(0); hook.result.current(); });
  expect(renders).not.toHaveBeenCalled(); expect(frames.request).toHaveBeenCalledOnce();
});

it("keeps new-view frames independent from the old signal and passive cleanup", () => {
  const frames = animationFrames(), old = new AbortController(), current = new AbortController(), renders = vi.fn();
  const hook = renderHook(({ signal, arm }) => {
    renders(); const update = useFrameForceUpdate(signal);
    // A new layout effect can enqueue before old passive cleanup executes.
    React.useLayoutEffect(() => { if (arm) { update(); } }, [arm, update]);
    return update;
  }, { initialProps: { signal: old.signal, arm: false } });
  act(() => hook.result.current());
  hook.rerender({ signal: current.signal, arm: true });
  expect(frames.request).toHaveBeenCalledTimes(2);
  renders.mockClear(); old.abort();
  expect(frames.cancel).toHaveBeenCalledWith(1); expect(frames.cancel).not.toHaveBeenCalledWith(2);
  act(() => { frames.pending.get(1)?.(0); }); expect(renders).not.toHaveBeenCalled();
  act(() => { frames.pending.get(2)?.(0); }); expect(renders).toHaveBeenCalledOnce();
});

it("retains default coalescing without a signal and cleans up correctly under StrictMode", () => {
  const frames = animationFrames(), renders = vi.fn();
  const hook = renderHook(() => { renders(); return useFrameForceUpdate(); }, { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> });
  renders.mockClear();
  act(() => { hook.result.current(); hook.result.current(); });
  expect(frames.request).toHaveBeenCalledOnce();
  act(() => { frames.pending.get(1)?.(0); }); expect(renders).toHaveBeenCalled();
  act(() => hook.result.current()); hook.unmount();
  expect(frames.cancel).toHaveBeenCalledWith(2);
  renders.mockClear(); act(() => { frames.pending.get(2)?.(0); }); expect(renders).not.toHaveBeenCalled();
});
