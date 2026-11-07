import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StyleMgr } from "@/wab/client/style-mgr";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { Box, Pt } from "@/wab/shared/geom";
import { SEARCH_PARAM_COMMENT } from "@/wab/shared/route/app-routes";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { createSite } from "@/wab/shared/core/sites";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const { studioCtx: sc, history } = fakeStudioCtx();
  vi.spyOn(sc, "tryZoomToFitArena").mockImplementation(() => undefined);
  await waitFor(() => expect(sc.initialRouteReady).toBe(true));
  const components = await sc.changeUnsafe(() =>
    ["First", "Second"].map((name) => sc.addComponent(name, {
      type: ComponentType.Plain, noSwitchArena: true,
    })),
  );
  const arenas = components.map((component) => ensure(
    getDedicatedArena(sc.site, component), "Dedicated arena",
  ));
  const viewport = new ViewportCtx({
    dom: mock<DomActions>(), initialArena: arenas[0],
    initialClipperBox: new Box(0, 0, 1000, 1000),
    initialClipperScroll: new Pt(0, 0),
  });
  sc.viewportCtx = viewport;
  sc.switchToComponentArena(components[0]);
  await sc.changeUnsafe(() => undefined);
  // Let initial arena/model notifications drain before observing repeated navigation.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { sc, history, components, arenas, async dispose() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    viewport.dispose();
    sc.dispose();
  } };
}

afterEach(() => vi.restoreAllMocks());

it("publishes arena membership only after committed model edits, undo and redo", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Page", type: ComponentType.Plain });
  const arena = mkMixedArena("Native viewport");
  site.arenas.push(arena);
  const frame = mkArenaFrame({ site, component, name: "Page", width: 100, height: 100, left: 0, top: 0 });
  const { studioCtx: sc } = fakeStudioCtx({ site });
  await waitFor(() => expect(sc.initialRouteReady).toBe(true));
  const viewport = new ViewportCtx({ dom: mock<DomActions>(), initialArena: arena,
    initialClipperBox: new Box(0, 0, 1000, 800), initialClipperScroll: Pt.zero() });
  sc.viewportCtx = viewport;
  sc.switchToArena(arena);
  sc.createViewStateUndoRecord();
  const publish = vi.fn();
  const stop = viewport.store.subscribe(publish);
  try {
    expect(viewport.canvasPadding()).toEqual(Pt.zero());
    await sc.changeUnsafe(() => {
      arena.children.push(frame);
      expect(viewport.store.getState().hasFrames).toBe(false);
    });
    expect(viewport.store.getState().hasFrames).toBe(true);
    expect(viewport.canvasPadding()).toEqual(new Pt(950, 760));
    expect(publish).toHaveBeenCalledOnce();
    await sc.undo();
    expect(viewport.canvasPadding()).toEqual(Pt.zero());
    await sc.redo();
    expect(viewport.canvasPadding()).toEqual(new Pt(950, 760));
    expect(publish).toHaveBeenCalledTimes(3);
    await sc.changeUnsafe(() => { component.name = "Renamed"; });
    expect(publish).toHaveBeenCalledTimes(3);
  } finally { stop(); viewport.dispose(); sc.dispose(); }
});

it("keeps selection, viewport, animation preview and history stable when reopening the current component", async () => {
  const { sc, history, components, arenas, dispose } = await setup();
  try {
    const vc = ensure(sc.focusedViewCtx(), "Focused view context");
    sc.changeSelection(() => vc.setStudioFocusByTpl(components[0].tplTree));
    const location = history.location;
    const recent = sc.recentArenas;
    const stop = vi.spyOn(StyleMgr.prototype, "stopAllAnimationPreviews");
    const restore = vi.spyOn(sc, "restoreStudioViewportSnapshot");
    const frames = vi.fn();
    sc.framesChanged.add(frames);
    const push = vi.spyOn(history, "push");
    const replace = vi.spyOn(history, "replace");
    sc.switchToComponentArena(components[0]);
    sc.switchToArena(arenas[0], { replace: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sc.currentArena).toBe(arenas[0]);
    expect(vc.focusedTpl()).toBe(components[0].tplTree);
    expect(sc.recentArenas).toBe(recent);
    expect(history.location).toBe(location);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
    expect(frames).not.toHaveBeenCalled();
  } finally {
    await dispose();
  }
});

it("switches to another component and supports history back", async () => {
  const { sc, history, components, arenas, dispose } = await setup();
  try {
    sc.switchToComponentArena(components[1]);
    expect(sc.currentArena).toBe(arenas[1]);
    history.back();
    await waitFor(() => expect(sc.currentArena).toBe(arenas[0]));
  } finally {
    await dispose();
  }
});

it("updates a renamed component's URL without resetting its current canvas", async () => {
  const { sc, history, components, arenas, dispose } = await setup();
  try {
    const previous = history.location;
    const stop = vi.spyOn(StyleMgr.prototype, "stopAllAnimationPreviews");
    await sc.changeUnsafe(() => sc.siteOps().tryRenameArenas([
      { arena: arenas[0], newName: "Renamed" },
    ]));
    expect(components[0].name).toBe("Renamed");
    expect(history.location.pathname).not.toBe(previous.pathname);
    expect(history.location.pathname).toContain("Renamed");
    expect(sc.currentArena).toBe(arenas[0]);
    expect(stop).not.toHaveBeenCalled();
  } finally {
    await dispose();
  }
});

it("keeps comment navigation and explicit stop-watching behavior on the same arena", async () => {
  const { sc, history, arenas, dispose } = await setup();
  try {
    const openThread = vi.spyOn(sc.commentsCtx, "waitForInitialCommentsLoad").mockResolvedValue();
    sc.switchToArena(arenas[0], { threadId: "thread" });
    expect(new URLSearchParams(history.location.search).get(SEARCH_PARAM_COMMENT)).toBe("thread");
    await waitFor(() => expect(openThread).toHaveBeenCalled());
    // Preserve the current watched player unless stopping was requested.
    sc.setWatchPlayerId(7);
    sc.isInteractiveMode = true;
    sc.switchToArena(arenas[0], { threadId: "thread", stopWatching: false });
    expect(sc.watchPlayerId).toBe(7);
    expect(sc.isInteractiveMode).toBe(false);
    sc.switchToArena(arenas[0], { threadId: "thread" });
    expect(sc.watchPlayerId).toBeNull();
  } finally {
    await dispose();
  }
});
