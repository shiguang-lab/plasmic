import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getFrameHeight, mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { ensure } from "@/wab/shared/common";
import { notification } from "antd";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

function fixture() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  const disconnect = vi.fn();
  const observers: TestResizeObserver[] = [];
  class TestResizeObserver implements ResizeObserver {
    constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = disconnect;
  }
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  const site = createSite();
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Page,
    tplTree: mkTplTag("div"),
  });
  const frame = mkArenaFrame({ site, component, name: "Page", width: 800, height: 600 });
  const studio = mock<StudioCtx>();
  const state = { full: false, edits: 0 };
  Object.defineProperties(studio, {
    fullPageHeight: { get: () => state.full },
    _changeCounter: { get: () => state.edits },
  });
  studio.tplMgr.mockReturnValue({ describeArenaFrame: () => "Page" } as never);
  const canvas = new CanvasCtx({
    $viewport: $(document.createElement("iframe")),
    name: "Page",
  });
  canvas["observeUserBodySize"](studio, frame, document.body);
  const resizeFrom = (observer: TestResizeObserver, height: number) => observer.callback(
    [{ contentRect: { height } } as ResizeObserverEntry], observer,
  );
  const resize = (height: number) => resizeFrom(ensure(observers[0], "Initial observer"), height);
  const resizeLatest = (height: number) => resizeFrom(ensure(observers[observers.length - 1], "Latest observer"), height);
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  };
  return { canvas, frame, state, resize, paint, frames, disconnect, studio, resizeLatest };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("applies full and viewport heights on the next frame without changing authored height", () => {
  const f = fixture();
  f.state.full = true;
  f.resize(2400);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(2400);
  f.state.full = false;
  f.resize(600);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(600);
  expect(f.frame.height).toBe(600);
  f.canvas.dispose();
});

it("uses the latest measurement once per frame even while content keeps resizing", () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    f.resize(1000 + i * 100);
  }
  expect(f.frames.size).toBe(1);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(1400);
  f.resize(1500);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(1500);
  f.canvas.dispose();
});

it("retains the feedback-loop limit and resets it for a height toggle", () => {
  const warning = vi.spyOn(notification, "warning").mockImplementation(() => undefined);
  const f = fixture();
  for (let i = 0; i < 20; i++) {
    f.resize(1000 + i * 100);
    f.paint();
  }
  expect(warning).toHaveBeenCalledTimes(1);
  expect(getFrameHeight(f.frame)).toBe(2400);
  f.state.full = true;
  f.resize(3000);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(3000);
  f.canvas.dispose();
});

it("cancels pending geometry updates when the canvas is disposed", () => {
  const f = fixture();
  f.resize(2400);
  f.canvas.dispose();
  expect(f.disconnect).toHaveBeenCalledTimes(1);
  expect(f.frames.size).toBe(0);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(600);
});


it("ignores already-queued observer delivery after disposal and preserves the cached measurement", () => {
  const f = fixture();
  f.resize(1900); f.paint();
  f.resize(2400);
  const queued = [...f.frames.values()];
  f.canvas.dispose(); f.canvas.dispose();
  queued.forEach((callback) => callback(performance.now()));
  f.resize(2800);
  expect(f.frames.size).toBe(0); expect(f.disconnect).toHaveBeenCalledOnce();
  expect(getFrameHeight(f.frame)).toBe(1900);
});

it("retires replaced observer callbacks without cancelling the new measurement task", () => {
  const f = fixture();
  f.resize(1600);
  const oldResize = f.resize;
  f.canvas["observeUserBodySize"](f.studio, f.frame, document.body);
  expect(f.disconnect).toHaveBeenCalledOnce();
  f.resizeLatest(2000);
  expect(f.frames.size).toBe(1);
  oldResize(3000);
  expect(f.frames.size).toBe(1);
  f.paint();
  expect(getFrameHeight(f.frame)).toBe(2000);
  f.canvas.dispose();
});
