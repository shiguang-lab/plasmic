import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { fakeRegistryViewCtx, fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";

function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Wheel", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, width: 100, height: 100, name: "Wheel" });
  const { studioCtx } = fakeStudioCtx({ site });
  const clipper = document.createElement("div");
  const overlay = document.createElement("div");
  const iframe = document.createElement("iframe");
  clipper.append(iframe, overlay);
  document.body.append(clipper);
  vi.spyOn(studioCtx, "canvasClipper").mockReturnValue(clipper);
  vi.spyOn(studioCtx, "zoom", "get").mockReturnValue(0.5);
  vi.spyOn(iframe, "getBoundingClientRect").mockReturnValue(
    new DOMRect(200, 100, 400, 300),
  );
  const panel = document.createElement("div");
  panel.style.overflowX = "auto";
  panel.style.overflowY = "auto";
  iframe.contentDocument?.body.append(panel);
  for (const [key, value] of Object.entries({
    clientWidth: 800,
    clientHeight: 600,
    scrollWidth: 1200,
    scrollHeight: 1800,
  })) {
    Object.defineProperty(panel, key, { value });
  }
  panel.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    const opts =
      typeof options === "number" ? { left: options, top: y } : (options ?? {});
    panel.scrollTop = opts.top ?? panel.scrollTop;
    panel.scrollLeft = opts.left ?? panel.scrollLeft;
  });
  const { view: vc } = fakeRegistryViewCtx(studioCtx, frame);
  vc.canvasCtx.viewport.mockReturnValue(iframe);
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(panel);
  return { studioCtx, vc, panel, overlay, clipper };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("content wheel routing through Studio overlays", () => {
  it("scrolls both axes under the outer overlay at canvas zoom without clearing Alt measurement state", () => {
    const { studioCtx, vc, panel, overlay, clipper } = setup();
    studioCtx.markKeydown(18);
    clipper.addEventListener("wheel", studioCtx.handleCanvasWheel, {
      passive: false,
    });
    const event = new WheelEvent("wheel", {
      altKey: true,
      clientX: 300,
      clientY: 175,
      deltaX: 80,
      deltaY: 220,
      bubbles: true,
      cancelable: true,
    });
    overlay.dispatchEvent(event);
    expect(vc.canvasCtx.getActualTargetUnderCanvasOverlay).toHaveBeenCalledWith(
      200,
      150,
    );
    expect(panel.scrollTop).toBe(220);
    expect(panel.scrollLeft).toBe(80);
    expect(event.defaultPrevented).toBe(true);
    expect(studioCtx.isAltDown()).toBe(true);
    studioCtx.markKeyup(18);
    expect(studioCtx.isAltDown()).toBe(false);
  });

  it("also routes iframe events using the supplied Studio coordinates", () => {
    const { studioCtx, vc, panel } = setup();
    const event = new WheelEvent("wheel", {
      altKey: true,
      clientX: 200,
      clientY: 150,
      deltaY: 75,
      cancelable: true,
    });
    studioCtx.handleWheel(event, 300, 175);
    expect(vc.canvasCtx.getActualTargetUnderCanvasOverlay).toHaveBeenCalledWith(
      200,
      150,
    );
    expect(panel.scrollTop).toBe(75);
  });

  it.each([
    { altKey: false },
    { altKey: true, ctrlKey: true },
    { altKey: true, metaKey: true },
  ])("does not intercept normal pan or zoom gestures: %j", (keys) => {
    const { studioCtx, vc, panel } = setup();
    studioCtx.handleWheel(
      new WheelEvent("wheel", { ...keys, deltaY: 50 }),
      300,
      175,
    );
    expect(
      vc.canvasCtx.getActualTargetUnderCanvasOverlay,
    ).not.toHaveBeenCalled();
    expect(panel.scrollTo).not.toHaveBeenCalled();
  });

  it("leaves interactive scrolling and points outside artboards to existing handlers", () => {
    const { studioCtx, vc, panel } = setup();
    const event = new WheelEvent("wheel", { altKey: true, deltaY: 50 });
    studioCtx.handleWheel(event, 50, 50);
    studioCtx.isInteractiveMode = true;
    studioCtx.handleWheel(event, 300, 175);
    expect(
      vc.canvasCtx.getActualTargetUnderCanvasOverlay,
    ).not.toHaveBeenCalled();
    expect(panel.scrollTo).not.toHaveBeenCalled();
  });
});
