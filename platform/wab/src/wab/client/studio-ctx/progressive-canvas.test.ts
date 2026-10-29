import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { requestIdleCallbackAsync } from "@/wab/client/requestidlecallback";
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
import { observable, runInAction } from "mobx";
import { mock, mockDeep } from "vitest-mock-extended";

vi.mock("@/wab/client/requestidlecallback", () => ({
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

it.each([
  ["running", false],
  ["suspended", false],
  ["running", true],
  ["suspended", true],
])("restores a saved non-first target with %s animation frames and expanded surface %s before revealing, preserving zoom, scroll and props while other boards are pending", async (animationState, expandedSurface) => {
  vi.stubGlobal("navigator", { userAgent: "PlasmicDesktop/darwin" });
  const animationFrames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  const { site, arena } = canvasFixture();
  const target = arena.children[3];
  const savedProps = JSON.stringify(target.container.vsettings);
  const api = mock<TopFrameApi>();
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
  const rendered = observable.box(false);
  const { studioCtx } = fakeStudioCtx({
    site,
    topFrameApi: api,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  const vc = mockDeep<ViewCtx>();
  vc.arenaFrame.mockReturnValue(target);
  vc.isStale.mockReturnValue(true);
  let finishSync: () => void = () => undefined;
  vc.awaitSync.mockReturnValue(new Promise<void>((resolve) => { finishSync = resolve; }));
  Object.defineProperty(vc, "isDisposed", { value: false });
  Object.defineProperty(vc, "component", { value: target.container.component });
  Object.defineProperty(vc, "initialRenderReady", { get: () => rendered.get() });
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockImplementation((frame) =>
    frame === target ? vc : undefined,
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
    await waitFor(() => expect(vc.awaitSync).toHaveBeenCalledTimes(1));
    studioCtx.tryZoomToFitArena();
    expect(fit).not.toHaveBeenCalled();
    await waitFor(() => expect(animationFrames.length).toBeGreaterThan(0));
    while (animationState === "running" && animationFrames.length) {
      animationFrames.shift()?.(0);
      await Promise.resolve();
    }
    await waitFor(() => expect(viewport.scale()).toBe(0.5));
    expect(studioCtx.initialViewportReady).toBe(false);
    expect(studioCtx.activeCanvasReady).toBe(false);
    runInAction(() => rendered.set(true));
    await waitFor(() => expect(studioCtx.initialViewportReady).toBe(true));
    expect(studioCtx.tryGetViewCtxForFrame(arena.children[0])).toBeUndefined();
    expect(studioCtx.focusedFrame()).toBe(target);
    let toolReady = false;
    const tools = studioCtx.awaitStudioReady().then(() => { toolReady = true; });
    await waitFor(() => expect(vc.awaitSync).toHaveBeenCalledTimes(2));
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
    vi.mocked(requestIdleCallbackAsync).mockClear();
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
    expect(requestIdleCallbackAsync).not.toHaveBeenCalled();
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
    expect(requestIdleCallbackAsync).toHaveBeenCalledTimes(3);
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
  const vc = mock<ViewCtx>();
  let rendered = false;
  Object.defineProperty(vc, "initialRenderReady", { get: () => rendered });
  vc.arenaFrame.mockReturnValue(arena.children[0]);
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const focus = vi
      .spyOn(studioCtx, "focusedFrame")
      .mockReturnValue(arena.children[3]);
    vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockImplementation((frame) =>
      frame === arena.children[0] ? vc : undefined,
    );
    studioCtx.viewCtxs.push(vc);
    expect(studioCtx.activeCanvasReady).toBe(false);
    rendered = true;
    expect(studioCtx.activeCanvasReady).toBe(false);
    focus.mockRestore();
    expect(studioCtx.activeCanvasFrame).toBe(arena.children[0]);
    expect(studioCtx.activeCanvasReady).toBe(true);
    rendered = false;
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
    expect(started).toEqual(["old", "next"]);
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
    vi.mocked(requestIdleCallbackAsync).mockImplementation(async (callback) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await callback({ didTimeout: false, timeRemaining: () => 50 });
    });
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
          const vc = mock<ViewCtx>();
          Object.defineProperty(vc, "initialRenderReady", { value: true });
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
