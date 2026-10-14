import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { ViewportCtx, DomActions } from "@/wab/client/studio-ctx/ViewportCtx";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { Box, Pt } from "@/wab/shared/geom";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

afterEach(() => vi.unstubAllGlobals());

it.each(["saved", "missing-frame", "invalid"])("initializes %s viewport before releasing loading", async (mode) => {
  vi.stubGlobal("navigator", { userAgent: "PlasmicDesktop/darwin" });
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  const site = createSite();
  const arena = mkMixedArena("Overview");
  site.arenas.push(arena);
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.getSavedEditorView.mockResolvedValue({
    arenaId: arena.name, arenaType: "custom",
    frameUuid: mode === "missing-frame" ? "deleted" : null,
    scale: mode === "invalid" ? -1 : 0.5,
    scroll: { x: 240, y: 360 },
  });
  const { studioCtx } = fakeStudioCtx({ site, topFrameApi, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  const dom = mock<DomActions>();
  const viewport = new ViewportCtx({ dom, initialArena: arena, initialClipperBox: new Box(0, 0, 1000, 800), initialClipperScroll: new Pt(0, 0) });
  studioCtx.viewportCtx = viewport;
  const zoom = vi.spyOn(viewport, "zoomToScalerBox");
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    if (mode === "saved") {
      expect(studioCtx.initialViewportReady).toBe(false);
      expect(studioCtx.hasInitialEditorView).toBe(true);
      let toolReady = false;
      const ready = studioCtx.awaitStudioReady().then(() => { toolReady = true; });
      await Promise.resolve();
      expect(toolReady).toBe(false);
      studioCtx.tryZoomToFitArena();
      expect(zoom).not.toHaveBeenCalled();
      await waitFor(() => expect(frames.length).toBeGreaterThan(0));
      while (frames.length) {
        frames.shift()?.(0);
        await Promise.resolve();
      }
      await waitFor(() => expect(studioCtx.initialViewportReady).toBe(true));
      await ready;
      expect(toolReady).toBe(true);
      expect(viewport.scale()).toBe(0.5);
      expect(dom.scrollTo).toHaveBeenLastCalledWith(new Pt(240, 360), false);
      expect(zoom).not.toHaveBeenCalled();
      studioCtx.tryZoomToFitArena();
      expect(zoom).toHaveBeenCalledTimes(1);
    } else {
      await waitFor(() => expect(studioCtx.initialViewportReady).toBe(true));
      expect(studioCtx.hasInitialEditorView).toBe(false);
      expect(viewport.scale()).not.toBe(-1);
    }
  } finally {
    viewport.dispose();
    studioCtx.dispose();
  }
});
