import { fakeRegistryViewCtx, fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { requestIdleCallback, requestIdleCallbackAsync } from "@/wab/client/requestidlecallback";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { Box, Pt } from "@/wab/shared/geom";
import { waitFor } from "@testing-library/react";
import { ok } from "neverthrow";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/requestidlecallback", () => ({
  requestIdleCallback: vi.fn((callback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0)),
  clearIdleCallback: (id: number) => window.clearTimeout(id),
  requestIdleCallbackAsync: vi.fn(async (callback) => callback()),
}));

function canvasFixture(count = 4) {
  const site = createSite();
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    tplTree: mkTplTag("div"),
  });
  site.components.push(component);
  const arena = mkMixedArena("Overview");
  arena.children.push(
    ...Array.from({ length: count }, (_, i) =>
      mkArenaFrame({
        site,
        component,
        name: `Board${i}`,
        width: 800,
        height: 600,
        left: i * 1000,
        top: 0,
      }),
    ),
  );
  site.arenas.push(arena);
  return { site, arena };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

});

it("keeps the selected content frame as the target, without changing selection or model props", async () => {
  const { site, arena } = canvasFixture();
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const target = arena.children[3];
    const vc = studioCtx.tryGetViewCtxForFrame(target);
    expect(vc).toBeDefined();
    studioCtx.setStudioFocusOnViewCtxContent(
      ensure(vc, "Missing test ViewCtx"),
    );
    expect(studioCtx.focusedFrame()).toBeUndefined();
    expect(studioCtx.activeCanvasFrame).toBe(target);
    expect(studioCtx.focusedViewCtx()).toBe(vc);
    const before = JSON.stringify(target.container.vsettings);
    void studioCtx.activeCanvasReady;
    expect(studioCtx.focusedViewCtx()).toBe(vc);
    expect(JSON.stringify(target.container.vsettings)).toBe(before);
  } finally {
    studioCtx.dispose();
  }
});

it.each([false, true])("renders an offscreen target while other offscreen frames stay paused with or without saved selection (%s)", async (restoreFocus) => {
  const { site, arena } = canvasFixture(2);
  const [target, other] = arena.children;
  target.left = 5000;
  other.left = 6000;
  const api = mock<TopFrameApi>();
  if (restoreFocus) {
    vi.stubGlobal("navigator", { userAgent: "PlasmicDesktop/darwin" });
    api.componentReuse.mockResolvedValue({ available: false });
    api.getSavedEditorView.mockResolvedValue({
      arenaType: "custom", arenaId: arena.name, frameUuid: target.uuid, scale: 1,
      scroll: { x: 0, y: 0 }, canvasPadding: { x: 0, y: 0 },
    });
  }
  const { studioCtx } = fakeStudioCtx({
    site, topFrameApi: restoreFocus ? api : undefined, initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const view = ensure(studioCtx.tryGetViewCtxForFrame(target), "Missing target ViewCtx");
    const background = ensure(studioCtx.tryGetViewCtxForFrame(other), "Missing background ViewCtx");
    expect(studioCtx.activeCanvasFrame).toBe(target);
    expect(view.isVisible()).toBe(false);
    expect(background.isVisible()).toBe(false);
    vi.spyOn(studioCtx, "change").mockImplementation(async (callback) => ok(await callback()));
    for (const vc of [view, background]) {
      vi.spyOn(vc.csEvaluator, "evalAsync").mockResolvedValue();
      vi.spyOn(vc.csEvaluator, "runPostEvalTasks").mockImplementation(() => undefined);
      vi.spyOn(vc, "updateCtxPostChange").mockImplementation(() => undefined);
      vi.spyOn(vc, "valState").mockReturnValue(new ValState({ sysRoot: mock<ValComponent>(), globalRoot: undefined }));
    }
    if (restoreFocus) {
      studioCtx.viewportCtx = new ViewportCtx({
        dom: mock<DomActions>(), initialArena: arena, initialClipperBox: new Box(0, 0, 1000, 800),
        initialClipperScroll: Pt.zero(),
      });
      studioCtx.applyInitialViewportLayout(studioCtx.viewportCtx.clipperBox(), new Pt(7000, 600));
    }
    const revealed = vi.fn(async () => {});
    studioCtx.runAfterInitialCanvasReady(revealed);
    background.scheduleSync({ eval: true });
    view.scheduleSync({ eval: true });
    await waitFor(() => expect(revealed).toHaveBeenCalledOnce());
    expect(view.initialRenderReady).toBe(true);
    expect(view["syncQueue"].paused).toBe(true);
    if (restoreFocus) {
      await waitFor(() => expect(studioCtx.inspectorSelection?.viewCtx).toBe(view));
    }
    expect(background.initialRenderReady).toBe(false);
    expect(background["syncQueue"].paused).toBe(true);
  } finally {
    studioCtx.dispose();
  }
});

it("marks first render only after evaluation and post-eval work, and stays ready during subsequent edits", async () => {
  const { site, arena } = canvasFixture(1);
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const vc = studioCtx.tryGetViewCtxForFrame(arena.children[0]);
    expect(vc).toBeDefined();
    if (!vc) {
      throw new Error("Missing test ViewCtx");
    }
    // Evaluate queue readiness without asking the fake canvas to commit model changes.
    vi.spyOn(studioCtx, "change").mockImplementation(async (callback) =>
      ok(await callback()),
    );
    vi.spyOn(vc.csEvaluator, "evalAsync").mockResolvedValue();
    vi.spyOn(vc.csEvaluator, "runPostEvalTasks").mockImplementation(
      () => undefined,
    );
    vi.spyOn(vc, "updateCtxPostChange").mockImplementation(() => undefined);
    vi.spyOn(vc, "isVisible").mockReturnValue(true);
    vi.spyOn(vc, "valState").mockReturnValue(
      new ValState({ sysRoot: mock<ValComponent>(), globalRoot: undefined }),
    );
    expect(vc.initialRenderReady).toBe(false);
    vc.scheduleSync({ eval: true, styles: false, asap: true });
    await vc.awaitSync();
    expect(vc.initialRenderReady).toBe(true);
    expect(studioCtx.activeCanvasReady).toBe(true);
    expect(
      studioCtx.loadTimings.has("frame-first-render", arena.children[0].uuid),
    ).toBe(true);
    let finishEdit: () => void = () => undefined;
    vi.mocked(vc.csEvaluator.evalAsync).mockReturnValue(
      new Promise<void>((resolve) => {
        finishEdit = resolve;
      }),
    );
    vc.scheduleSync({ eval: true, styles: false, asap: true });
    expect(studioCtx.activeCanvasReady).toBe(true);
    finishEdit();
    await vc.awaitSync();
    expect(vc.initialRenderReady).toBe(true);
  } finally {
    studioCtx.dispose();
  }
});

it("renders the active target without waiting for browser idle, while later evaluations remain idle scheduled", async () => {
  const { site, arena } = canvasFixture(1);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const vc = ensure(studioCtx.tryGetViewCtxForFrame(arena.children[0]), "Missing test ViewCtx");
    vi.spyOn(studioCtx, "change").mockImplementation(async (callback) => ok(await callback()));
    vi.spyOn(vc.csEvaluator, "evalAsync").mockResolvedValue();
    vi.spyOn(vc.csEvaluator, "runPostEvalTasks").mockImplementation(() => undefined);
    vi.spyOn(vc, "updateCtxPostChange").mockImplementation(() => undefined);
    vi.spyOn(vc, "isVisible").mockReturnValue(true);
    vi.spyOn(vc, "valState").mockReturnValue(new ValState({ sysRoot: mock<ValComponent>(), globalRoot: undefined }));
    const firstRender = vi.spyOn(vc, "initialRenderReady", "get").mockReturnValue(false);
    vi.mocked(requestIdleCallbackAsync).mockClear();
    await vc["syncInternal"]([{ eval: true, styles: false }]);
    expect(requestIdleCallbackAsync).not.toHaveBeenCalled();
    firstRender.mockReturnValue(true);
    await vc["syncInternal"]([{ eval: true, styles: false }]);
    expect(requestIdleCallbackAsync).toHaveBeenCalledOnce();
  } finally { studioCtx.dispose(); }
});

it("reports post-evaluation failures and drains the sync queue instead of leaving the canvas loading", async () => {
  const { site, arena } = canvasFixture(1);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const vc = ensure(studioCtx.tryGetViewCtxForFrame(arena.children[0]), "Missing test ViewCtx");
    const error = new Error("Post-evaluation task failed");
    vi.spyOn(studioCtx, "change").mockRejectedValue(error);
    vi.spyOn(vc.csEvaluator, "evalAsync").mockResolvedValue();
    vi.spyOn(vc, "isVisible").mockReturnValue(true);
    vc.scheduleSync({ eval: true, styles: false, asap: true });
    await waitFor(() => expect(studioCtx.canvasLoadStore.getState().error).toBe(error.message));
    await vc.awaitSync();
    expect(vc.initialRenderReady).toBe(false);
    await expect(studioCtx.awaitStudioReady()).rejects.toThrow(error.message);
  } finally { studioCtx.dispose(); }
});

it.each([
  { expandedSurface: false, manualSelection: false },
  { expandedSurface: true, manualSelection: false },
  { expandedSurface: false, manualSelection: true },
  { expandedSurface: false, manualSelection: false, panBeforeRestore: true },
])("positions a saved target immediately and restores focus after visible frames paint ($expandedSurface, $manualSelection, $panBeforeRestore)", async ({ expandedSurface, manualSelection, panBeforeRestore }) => {
  vi.stubGlobal("navigator", { userAgent: "PlasmicDesktop/darwin" });
  const { site, arena } = canvasFixture();
  const target = arena.children[3];
  const savedProps = JSON.stringify(target.container.vsettings);
  const api = mock<TopFrameApi>();
  api.componentReuse.mockResolvedValue({ available: false });
  const savedPadding = expandedSurface
    ? new Pt(9000, 3000) : new Pt(950, 760);
  const savedScroll = expandedSurface
    ? new Pt(9529.5, 2773.5) : new Pt(240, 360);
  api.getSavedEditorView.mockResolvedValue({
    arenaId: arena.name,
    arenaType: "custom",
    frameUuid: target.uuid,
    scale: 0.5,
    scroll: { x: savedScroll.x, y: savedScroll.y },
    canvasPadding: { x: savedPadding.x, y: savedPadding.y },
  });
  const { studioCtx } = fakeStudioCtx({
    site,
    topFrameApi: api,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  const { view: vc, ready: rendered } = fakeRegistryViewCtx(studioCtx, target);
  vc.arenaFrame.mockReturnValue(target);
  vc.isStale.mockReturnValue(true);
  vc.focusedTpls.mockReturnValue([]);
  vc.focusedSelectables.mockReturnValue([]);
  vc.focusedCloneKeys.mockReturnValue([]);
  vc.currentComponentCtx.mockReturnValue(null);
  let finishSync: () => void = () => undefined;
  vc.awaitSync.mockReturnValue(new Promise<void>((resolve) => { finishSync = resolve; }));
  const background = new Map(arena.children.slice(0, 3).map((frame) =>
    [frame, fakeRegistryViewCtx(studioCtx, frame)] as const));
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockImplementation((frame) =>
    frame === target ? vc : frame && background.get(frame)?.view,
  );
  const dom = mock<DomActions>();
  const viewport = new ViewportCtx({
    dom,
    initialArena: arena,
    initialClipperBox: expandedSurface
      ? new Box(0, 0, 1400, 900) : new Box(0, 0, 1000, 800),
    initialClipperScroll: new Pt(0, 0),
  });
  dom.scrollTo.mockImplementation((scroll) => viewport.setScroll(scroll));
  studioCtx.viewportCtx = viewport;
  const fit = vi.spyOn(viewport, "zoomToScalerBox");
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    expect(studioCtx.activeCanvasFrame).toBe(target);
    expect(studioCtx.initialViewportReady).toBe(false);
    expect(studioCtx.activeCanvasReady).toBe(false);
    studioCtx.tryZoomToFitArena();
    expect(fit).not.toHaveBeenCalled();
    studioCtx.applyInitialViewportLayout(viewport.clipperBox(), new Pt(4000, 600));
    expect(viewport.scale()).toBe(0.5);
    expect(studioCtx.initialViewportReady).toBe(true);
    expect(studioCtx.activeCanvasReady).toBe(false);
    expect(studioCtx.focusedFrame()).toBeUndefined();
    expect(studioCtx.inspectorSelection).toBeUndefined();
    rendered.setState(true, true);
    expect(studioCtx.focusedFrame()).toBeUndefined();
    expect(studioCtx.activeCanvasReady).toBe(true);
    expect(studioCtx.savedViewFrame).toBe(target);
    let toolReady = false;
    const tools = studioCtx.awaitStudioReady().then(() => { toolReady = true; });
    await waitFor(() => expect(vc.awaitSync).toHaveBeenCalledTimes(1));
    expect(toolReady).toBe(false);
    vc.isStale.mockReturnValue(false);
    finishSync();
    await tools;
    expect(toolReady).toBe(true);
    expect(viewport.scale()).toBe(0.5);
    expect(viewport.visibleScalerBox().topLeft().x).toBeCloseTo(
      (savedScroll.x - savedPadding.x) / 0.5,
    );
    expect(viewport.visibleScalerBox().topLeft().y).toBeCloseTo(
      (savedScroll.y - savedPadding.y) / 0.5,
    );
    expect(fit).not.toHaveBeenCalled();
    expect(JSON.stringify(target.container.vsettings)).toBe(savedProps);
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => callbacks.push(cb));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const visible = [...background].filter(([frame]) => studioCtx.isFrameInViewport(frame, viewport));
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(background.size);
    for (const [frame, bg] of visible) {
      expect(callbacks).toHaveLength(0);
      expect(studioCtx.focusedFrame()).toBeUndefined();
      studioCtx.recordCanvasFrameRendered(frame);
      bg.ready.setState(true, true);
    }
    expect(callbacks).toHaveLength(1);
    callbacks.shift()?.(16);
    expect(studioCtx.focusedFrame()).toBeUndefined();
    callbacks.shift()?.(32);
    expect(studioCtx.focusedFrame()).toBeUndefined();
    expect(studioCtx.inspectorSelection).toBeUndefined();
    if (panBeforeRestore) {
      const [newFrame] = ensure([...background].find(([frame]) => !studioCtx.isFrameInViewport(frame, viewport)), "Missing offscreen frame");
      viewport.setScroll(viewport.canvasPadding().plus(new Pt((newFrame.left ?? 0) * viewport.scale(), 0)));
      await vi.advanceTimersByTimeAsync(0);
      expect(studioCtx.focusedFrame()).toBeUndefined();
      expect(studioCtx.inspectorSelection).toBeUndefined();
      expect(studioCtx.isFrameInViewport(newFrame, viewport)).toBe(true);
      for (const [frame, bg] of background) {
        if (!bg.ready.getState() && studioCtx.isFrameInViewport(frame, viewport)) {
          studioCtx.recordCanvasFrameRendered(frame);
          bg.ready.setState(true, true);
        }
      }
      expect(callbacks).toHaveLength(1);
      callbacks.shift()?.(48);
      callbacks.shift()?.(64);
    }
    const expected = manualSelection ? arena.children[0] : target;
    if (manualSelection) {
      studioCtx.setStudioFocusOnFrame({ frame: expected });
      callbacks.shift()?.(48);
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(studioCtx.focusedFrame()).toBe(expected);
    expect(studioCtx.inspectorSelection?.viewCtx.arenaFrame()).toBe(expected);
    expect(studioCtx.isSelectionPending).toBe(false);
    expect(studioCtx.loadTimings.has("initial-selection-restored", target.uuid)).toBe(!manualSelection);
    expect(viewport.scale()).toBe(0.5);
  } finally {
    viewport.dispose();
    studioCtx.dispose();
  }
});

it("prioritizes the target ahead of earlier requests, starts it without idle, and keeps subsequent loads serial", async () => {
  const { site, arena } = canvasFixture();
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  const started: string[] = [];
  const releases: Array<() => void> = [];
  const target = arena.children[3];
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    vi.spyOn(studioCtx, "focusedFrame").mockReturnValue(target);
    vi.mocked(requestIdleCallback).mockClear();
    for (const frame of arena.children) {
      studioCtx.queueCanvasFrame({
        arena,
        frame,
        name: frame.name,
        load: () => {
          started.push(frame.uuid);
          return new Promise<void>((resolve) => releases.push(resolve));
        },
      });
    }
    await waitFor(() => expect(started).toEqual([target.uuid]));
    expect(requestIdleCallback).not.toHaveBeenCalled();
    releases[0]();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(started).toEqual([target.uuid]);
    vi.spyOn(studioCtx, "activeCanvasReady", "get").mockReturnValue(true);
    vi.spyOn(studioCtx, "initialViewportReady", "get").mockReturnValue(false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(started).toEqual([target.uuid]);
    vi.spyOn(studioCtx, "initialViewportReady", "get").mockReturnValue(true);
    for (let i = 0; i < arena.children.length; i++) {
      releases[i]();
      if (i < arena.children.length - 1) {
        await waitFor(() => expect(started).toHaveLength(i + 2));
      }
    }
    expect(started).toEqual([
      target.uuid,
      ...arena.children.slice(0, 3).map((frame) => frame.uuid),
    ]);
    expect(requestIdleCallback).toHaveBeenCalledTimes(3);
    expect(studioCtx.focusedFrame()).toBe(target);
  } finally {
    releases.forEach((release) => release());
    studioCtx.dispose();
  }
});

it("does not use another frame or background context as target readiness; missing and empty targets fall back safely", async () => {
  const { site, arena } = canvasFixture();
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  const { view: vc, ready: rendered } = fakeRegistryViewCtx(studioCtx, arena.children[0]);
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const focus = vi
      .spyOn(studioCtx, "focusedFrame")
      .mockReturnValue(arena.children[3]);
    vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockImplementation((frame) =>
      frame === arena.children[0] ? vc : undefined,
    );
    expect(studioCtx.activeCanvasReady).toBe(false);
    rendered.setState(true, true);
    expect(studioCtx.activeCanvasReady).toBe(false);
    focus.mockRestore();
    expect(studioCtx.activeCanvasFrame).toBe(arena.children[0]);
    expect(studioCtx.activeCanvasReady).toBe(true);
    rendered.setState(false, true);
    expect(studioCtx.activeCanvasReady).toBe(false);
    arena.children.splice(0);
    expect(studioCtx.activeCanvasReady).toBe(true);
    studioCtx.currentArena = null;
    expect(studioCtx.activeCanvasReady).toBe(true);
  } finally {
    studioCtx.dispose();
  }
});

it("continues loading the new arena when navigation hides an in-flight target", async () => {
  const { site, arena } = canvasFixture(1);
  const nextArena = mkMixedArena("Next");
  const nextFrame = mkArenaFrame({
    site,
    component: site.components[0],
    name: "NextBoard",
    width: 800,
    height: 600,
    left: 0,
    top: 0,
  });
  nextArena.children.push(nextFrame);
  site.arenas.push(nextArena);
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  let finishOld: () => void = () => undefined;
  const started: string[] = [];
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(undefined);
    vi.useFakeTimers();
    studioCtx.queueCanvasFrame({
      arena,
      frame: arena.children[0],
      name: "old",
      cancel: () => { started.push("cancelled"); finishOld(); },
      load: () => {
        started.push("old");
        return new Promise<void>((resolve) => {
          finishOld = resolve;
        });
      },
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(started).toEqual(["old"]);
    studioCtx.currentArena = nextArena;
    studioCtx.queueCanvasFrame({
      arena: nextArena,
      frame: nextFrame,
      name: "next",
      load: async () => {
        started.push("next");
      },
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(started).toEqual(["old", "cancelled", "next"]);
    expect(studioCtx.activeCanvasFrame).toBe(nextFrame);
    expect(studioCtx.activeCanvasReady).toBe(false);
    finishOld();
    await vi.advanceTimersByTimeAsync(100);
  } finally {
    finishOld();
    studioCtx.dispose();
  }
});

it("reveals the target before remaining contexts, comparing with the previous all-frame gate under fixed load costs", async () => {
  const { site, arena } = canvasFixture();
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  const contexts = new Map<string, ViewCtx>();
  const order: string[] = [];
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    vi.mocked(requestIdleCallback).mockImplementation((callback) =>
      window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 50),
    );
    const target = arena.children[3];
    vi.spyOn(studioCtx, "focusedFrame").mockReturnValue(target);
    vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockImplementation((frame) =>
      frame ? contexts.get(frame.uuid) : undefined,
    );
    const start = Date.now();
    let revealMs = 0;
    let allContextsMs = 0;
    for (const frame of arena.children) {
      studioCtx.queueCanvasFrame({
        arena,
        frame,
        name: frame.name,
        load: async () => {
          order.push(frame.uuid);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const { view: vc, ready } = fakeRegistryViewCtx(studioCtx, frame);
          ready.setState(true, true);
          contexts.set(frame.uuid, vc);
          if (frame === target) {
            expect(studioCtx.activeCanvasReady).toBe(true);
            expect(contexts.size).toBe(1);
            revealMs = Date.now() - start;
          }
          if (contexts.size === arena.children.length) {
            allContextsMs = Date.now() - start;
          }
        },
      });
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(order[0]).toBe(target.uuid);
    expect(revealMs).toBe(100);
    expect(allContextsMs).toBe(550);
    // Previous scheduling: four serial 100ms loads, each with a 50ms idle wait.
    const previousGateMs = arena.children.length * (100 + 50);
    expect(previousGateMs).toBe(600);
    expect(revealMs).toBeLessThan(allContextsMs);
    console.info("Controlled canvas comparison", {
      previousGateMs,
      revealMs,
      allContextsMs,
    });
  } finally {
    studioCtx.dispose();
  }
});

it("ends canvas initialization on a library failure and stops pending frames instead of leaving a blocked serial queue", async () => {
  const { site, arena } = canvasFixture(2);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    vi.spyOn(studioCtx, "focusedFrame").mockReturnValue(arena.children[0]);
    const load = vi.fn().mockRejectedValue(new Error("Unable to load component library antd6: 404"));
    studioCtx.queueCanvasFrame({ arena, frame: arena.children[0], name: "Customers", load });
    await waitFor(() => expect(studioCtx.canvasLoadStore.getState().error).toBe("Unable to load component library antd6: 404"));
    expect(load).toHaveBeenCalledTimes(1);
    const next = vi.fn().mockResolvedValue(undefined);
    studioCtx.queueCanvasFrame({ arena, frame: arena.children[1], name: "Details", load: next });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(next).not.toHaveBeenCalled();
  } finally { studioCtx.dispose(); }
});

it("times out a host that never finishes initialization instead of waiting indefinitely", async () => {
  const { site, arena } = canvasFixture(1);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Overview" });
  // This host has not created a ViewCtx. Keep unrelated fake-canvas evaluation
  // out of the 180-second loader timeout clock.
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(undefined);
  let finish = () => undefined as void;
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    vi.spyOn(studioCtx, "focusedFrame").mockReturnValue(arena.children[0]);
    vi.useFakeTimers();
    const load = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    studioCtx.queueCanvasFrame({ arena, frame: arena.children[0], name: "Customers", load });
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(studioCtx.canvasLoadStore.getState().error).toContain("Unable to load artboard: Customers");
  } finally { finish(); studioCtx.dispose(); }
});
