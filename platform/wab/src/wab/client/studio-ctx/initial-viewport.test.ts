import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { AppCtx } from "@/wab/client/app-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { UserId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTag } from "@/wab/shared/core/tpls";
import type { DesktopDraft } from "@/wab/shared/desktop-drafts";
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
  topFrameApi.componentReuse.mockResolvedValue({ available: false });
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


it("restores the saved viewport against the recovered draft model on startup", async () => {
  const site = createSite();
  const component = mkComponent({
    name: "BeforeRecovery",
    type: ComponentType.Plain,
    tplTree: mkTplTag("div"),
  });
  site.components.push(component);
  site.arenas.push(mkMixedArena("Overview"));
  const fixture = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
    devFlagOverrides: { ccStubs: true },
  });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  fixture.studioCtx.dispose();

  vi.stubGlobal("navigator", { userAgent: "PlasmicDesktop/darwin" });
  const { appCtx, dbCtx } = fixture;
  appCtx.selfInfo = mock<NonNullable<AppCtx["selfInfo"]>>({ id: "user" as UserId });
  dbCtx.revisionNum = 10;
  const bundle = structuredClone(appCtx.bundler.bundle(site, dbCtx.siteInfo.id, appCtx.lastBundleVersion));
  const address = ensure(appCtx.bundler.addrOf(component), "Missing component address");
  bundle.map[address.iid].name = "RecoveredComponent";
  const draft: DesktopDraft = {
    format: 1, id: "draft", projectId: dbCtx.siteInfo.id, projectName: "Draft project", branchId: null,
    baseRevision: 10, sequence: 3, savedAt: 1, modelVersion: dbCtx.modelVersion,
    hostlessDataVersion: dbCtx.hostlessDataVersion, bundle, dependencies: [],
  };
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.componentReuse.mockResolvedValue({ available: false });
  topFrameApi.openDesktopDrafts.mockResolvedValue({ handle: "draft-handle", drafts: [draft] });
  topFrameApi.readDesktopDraft.mockResolvedValue(draft);
  topFrameApi.writeDesktopDraft.mockResolvedValue(undefined);
  topFrameApi.getSavedEditorView.mockResolvedValue({
    arenaId: "Overview", arenaType: "custom", frameUuid: null,
    scale: 0.5, scroll: { x: 240, y: 360 }, canvasPadding: { x: 0, y: 0 },
  });
  appCtx.topFrameApi = topFrameApi;
  const studio = new StudioCtx({ dbCtx, autoSave: false });
  let viewport: ViewportCtx | undefined;
  try {
    expect(topFrameApi.getSavedEditorView).not.toHaveBeenCalled();
    await studio.initializeDesktopDrafts();
    expect(studio.site).not.toBe(site);
    expect(studio.site.components.find(c => c.uuid === component.uuid)?.name).toBe("RecoveredComponent");
    expect(studio.initialRouteReady).toBe(false);
    const dom = mock<DomActions>();
    viewport = new ViewportCtx({
      dom, initialArena: studio.currentArena,
      initialClipperBox: new Box(0, 0, 1000, 800), initialClipperScroll: new Pt(0, 0),
    });
    studio.viewportCtx = viewport;
    studio.startInitialRoute();
    await waitFor(() => expect(studio.initialViewportReady && studio.initialRouteReady).toBe(true));
    expect(studio.loadTimings.has("initial-viewport-commit")).toBe(true);
    expect(studio.currentArena).toBe(studio.site.arenas.find(arena => arena.name === "Overview"));
    expect(viewport.scale()).toBe(0.5);
    expect(dom.scrollTo).toHaveBeenLastCalledWith(new Pt(240, 360), false);
    expect(studio.desktopDraft?.store.getState().status?.error).toBeUndefined();
  } finally {
    viewport?.dispose();
    studio.dispose();
  }
});
