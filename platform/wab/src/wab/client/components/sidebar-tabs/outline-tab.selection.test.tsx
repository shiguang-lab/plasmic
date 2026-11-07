import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { OutlineTab } from "@/wab/client/components/sidebar-tabs/outline-tab";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { Box, Pt } from "@/wab/shared/geom";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const fixture = vi.hoisted(() => ({ studio: undefined as StudioCtx | undefined }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => fixture.studio }));
vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", async (original) => {
  const actual = await original<typeof import("@/wab/client/components/sidebar-tabs/tpl-tree")>();
  return { ...actual, ArenaTree: () => null };
});
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("updates the real OutlineCtx footer when native focus changes within an unchanged mixed arena", async () => {
  // The iframe is outside this mounted property-panel test.
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Customers", type: ComponentType.Page });
  const frames = ["List", "Details"].map((name) => mkArenaFrame({ site, component, name, width: 1440, height: 960, left: 0, top: 0 }));
  const arena = mkMixedArena("Overview", frames); site.arenas.push(arena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  fixture.studio = studio;
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const viewport = new ViewportCtx({ dom: mock<DomActions>(), initialArena: arena, initialClipperBox: new Box(0, 0, 1000, 800), initialClipperScroll: Pt.zero() });
  studio.viewportCtx = viewport;
  for (const frame of frames) {
    const target = studio.tryGetViewCtxForFrame(frame);
    if (!target) { throw new Error("Expected a property-panel view context"); }
    vi.spyOn(target, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(target, "awaitSync").mockResolvedValue(undefined);
    vi.spyOn(target, "updateCtxPostChange").mockImplementation(() => undefined);
  }
  vi.spyOn(studio, "tryZoomToFitArena").mockImplementation(() => undefined);
  const view = render(<OutlineTab />);
  try {
    act(() => { studio.focusCanvasFrame(frames[0]); });
    expect(screen.getByText("Focused in arena · List")).toBeDefined();
    const arenaInput = studio.arenaState.store.getState();
    const saveInput = studio.saveState.store.getState();
    act(() => { studio.setStudioFocusOnFrame({ frame: frames[1], autoZoom: false }); });
    expect(studio.focusedViewCtx()?.arenaFrame()).toBe(frames[1]);
    expect(studio.arenaState.store.getState()).toBe(arenaInput);
    expect(studio.saveState.store.getState()).toBe(saveInput);
    expect(screen.getByText("Focused in arena · Details")).toBeDefined();
    expect(screen.queryByText("Focused in arena · List")).toBeNull();
  } finally { view.unmount(); studio.dispose(); viewport.dispose(); }
});
