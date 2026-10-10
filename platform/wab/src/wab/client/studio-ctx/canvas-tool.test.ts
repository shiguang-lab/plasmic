import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { Pt } from "@/wab/shared/geom";
import { mock } from "vitest-mock-extended";

it("pans with the hand tool after releasing Space, then restores selection", async () => {
  const { studioCtx } = fakeStudioCtx();
  const viewport = mock<ViewportCtx>();
  viewport.scroll.mockReturnValue(new Pt(100, 200));
  viewport.canvasPadding.mockReturnValue(new Pt(0, 0));
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
    expect(viewport.panTo).toHaveBeenCalledWith(new Pt(90, 180));
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
