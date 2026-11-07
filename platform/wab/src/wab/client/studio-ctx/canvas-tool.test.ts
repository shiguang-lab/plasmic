import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { ensure } from "@/wab/shared/common";
import { Pt } from "@/wab/shared/geom";

it("pans with the hand tool after releasing Space, then restores selection", async () => {
  const { studioCtx } = fakeStudioCtx();
  const viewport = ensure(createViewportFixture().viewportCtx, "Viewport");
  viewport.setScroll(new Pt(100, 200));
  const panTo = vi.spyOn(viewport, "panTo").mockImplementation(() => undefined);
  studioCtx.viewportCtx = viewport;
  vi.spyOn(studioCtx, "showPannableCursor").mockImplementation(() => undefined);
  vi.spyOn(studioCtx, "hidePannableCursor").mockImplementation(() => undefined);
  vi.spyOn(studioCtx, "showPanningCursor").mockImplementation(() => undefined);
  vi.spyOn(studioCtx, "hidePanningCursor").mockImplementation(() => undefined);
  const revision = studioCtx.dbCtx().revisionNum;
  try {
    studioCtx.setCanvasTool("pan");
    studioCtx.startPanning(
      new MouseEvent("mousedown", { screenX: 20, screenY: 30 }),
    );
    studioCtx.markKeydown(32);
    studioCtx.markKeyup(32);
    expect(studioCtx.isPanMode()).toBe(true);
    expect(studioCtx.isSpaceDown()).toBe(false);
    expect(studioCtx.isPanning()).toBe(true);
    studioCtx.tryPanning(
      new MouseEvent("mousemove", { screenX: 30, screenY: 50 }),
    );
    expect(panTo).toHaveBeenCalledWith(new Pt(90, 180));
    studioCtx.setCanvasTool("select");
    expect(studioCtx.isPanMode()).toBe(false);
    expect(studioCtx.isPanning()).toBe(false);
    expect(studioCtx.dbCtx().revisionNum).toBe(revision);
    studioCtx.markKeydown(32);
    expect(studioCtx.isPanMode()).toBe(true);
    studioCtx.markKeyup(32);
    expect(studioCtx.isPanMode()).toBe(false);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    studioCtx.dispose();
  }
});

it("publishes only real tool changes while retaining the repeated-command cleanup", async () => {
  const { studioCtx } = fakeStudioCtx();
  const other = fakeStudioCtx().studioCtx;
  vi.spyOn(studioCtx, "showPannableCursor").mockImplementation(() => undefined);
  vi.spyOn(studioCtx, "hidePannableCursor").mockImplementation(() => undefined);
  const cleanup = vi.spyOn(studioCtx, "setFreestyleState");
  const changed = vi.fn();
  const unrelated = vi.fn();
  const off = studioCtx.canvasToolStore.subscribe(changed);
  const offOther = other.canvasToolStore.subscribe(unrelated);
  const revision = studioCtx.dbCtx().revisionNum;
  try {
    studioCtx.setCanvasTool("pan");
    for (let i = 0; i < 100; i++) {
      studioCtx.setCanvasTool("pan");
    }
    expect(changed).toHaveBeenCalledOnce();
    expect(unrelated).not.toHaveBeenCalled();
    expect(other.canvasToolStore.getState()).toBe("select");
    expect(cleanup).toHaveBeenCalledTimes(101);
    expect(studioCtx.dbCtx().revisionNum).toBe(revision);
    off();
    offOther();
    changed.mockClear();
    studioCtx.setCanvasTool("select");
    expect(changed).not.toHaveBeenCalled();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    studioCtx.dispose();
    other.dispose();
  }
});
