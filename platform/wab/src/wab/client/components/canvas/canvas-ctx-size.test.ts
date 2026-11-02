import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getFrameHeight, mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
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
  let notify: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { notify = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
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
  const resize = (height: number) => notify(
    [{ contentRect: { height } } as ResizeObserverEntry],
    canvas["_resizeObserver"],
  );
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  };
  return { canvas, frame, state, resize, paint, frames, disconnect };
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
