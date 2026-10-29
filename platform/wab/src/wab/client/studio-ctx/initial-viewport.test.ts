import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { ViewportCtx, DomActions } from "@/wab/client/studio-ctx/ViewportCtx";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { Box, Pt } from "@/wab/shared/geom";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

afterEach(() => vi.unstubAllGlobals());

it.each(["saved", "suspended-layout", "suspended-commit", "missing-frame", "missing-padding", "invalid"])("initializes %s viewport before releasing loading", async (mode) => {
  vi.stubGlobal("navigator", { userAgent: "PlasmicDesktop/darwin" });
  // Electron can stop animation frames while still reporting a visible document.
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  const site = createSite();
  const arena = mkMixedArena("Overview");
  site.arenas.push(arena);
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.getSavedEditorView.mockResolvedValue(JSON.parse(JSON.stringify({
    arenaId: arena.name, arenaType: "custom",
    frameUuid: mode === "missing-frame" ? "deleted" : null,
    scale: mode === "invalid" ? -1 : 0.5,
    scroll: { x: 240, y: 360 },
    canvasPadding: mode === "missing-padding" ? undefined : { x: 0, y: 0 },
  })));
  const { studioCtx } = fakeStudioCtx({ site, topFrameApi, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  const dom = mock<DomActions>();
  const viewport = new ViewportCtx({ dom, initialArena: arena, initialClipperBox: new Box(0, 0, 1000, 800), initialClipperScroll: new Pt(0, 0) });
  studioCtx.viewportCtx = viewport;
  const zoom = vi.spyOn(viewport, "zoomToScalerBox");
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    if (mode !== "missing-frame" && mode !== "missing-padding" && mode !== "invalid") {
      expect(studioCtx.initialViewportReady).toBe(false);
      expect(studioCtx.hasInitialEditorView).toBe(true);
      let toolReady = false;
      const ready = studioCtx.awaitStudioReady().then(() => { toolReady = true; });
      await Promise.resolve();
      expect(toolReady).toBe(false);
      studioCtx.tryZoomToFitArena();
      expect(zoom).not.toHaveBeenCalled();
      await waitFor(() => expect(frames.length).toBeGreaterThan(0));
      let remainingFrames = mode === "suspended-layout" ? 0 : mode === "suspended-commit" ? 2 : Infinity;
      while (frames.length && remainingFrames-- > 0) {
        frames.shift()?.(0);
        await Promise.resolve();
      }
      await waitFor(() => expect(studioCtx.initialViewportReady).toBe(true));
      await ready;
      expect(toolReady).toBe(true);
      expect(viewport.scale()).toBe(0.5);
      expect(dom.scrollTo).toHaveBeenLastCalledWith(new Pt(240, 360), false);
      expect(zoom).not.toHaveBeenCalled();
      if (mode !== "saved") {
        expect(frames.length).toBeGreaterThan(0);
        // Showing the main window later must not apply the saved viewport again.
        dom.scrollTo.mockClear();
        while (frames.length) {
          frames.shift()?.(0);
          await Promise.resolve();
        }
        expect(dom.scrollTo).not.toHaveBeenCalled();
      }
      studioCtx.tryZoomToFitArena();
      expect(zoom).toHaveBeenCalledTimes(1);
    } else {
      await waitFor(() => expect(studioCtx.initialViewportReady).toBe(true));
      expect(studioCtx.hasInitialEditorView).toBe(false);
      expect(viewport.scale()).not.toBe(-1);
      expect(zoom).toHaveBeenCalled();
    }
  } finally {
    viewport.dispose();
    studioCtx.dispose();
  }
});
