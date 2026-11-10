import { ValComponent } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { ok } from "neverthrow";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Box, Pt } from "@/wab/shared/geom";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(); const manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Target component", type: ComponentType.Plain });
  const variant = mkVariant({ name: "Selected" }); component.variants.push(variant);
  const otherComponent = manager.addComponent({ name: "", type: ComponentType.Frame });
  const first = mkMixedArena("Empty");
  const frame = mkArenaFrame({ site, component, name: "Target frame", width: 100, height: 100, left: 0, top: 0 });
  const target = mkMixedArena("Target", [frame]);
  const otherFrame = mkArenaFrame({ site, component: otherComponent, name: "Other frame", width: 100, height: 100, left: 0, top: 0 });
  const other = mkMixedArena("Other", [otherFrame]); site.arenas.push(first, target, other);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  vi.spyOn(studio, "tryZoomToFitArena").mockImplementation(() => undefined);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Target view");
  studio.dbCtx().maybeObserveComponents([component, otherComponent]);
  vi.spyOn(view, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(view, "awaitSync").mockResolvedValue();
  vi.spyOn(view, "updateCtxPostChange").mockImplementation(() => undefined);
  const dom = mock<DomActions>(); const viewport = new ViewportCtx({ dom, initialArena: first, initialClipperBox: new Box(0, 0, 100, 100), initialClipperScroll: Pt.zero() });
  studio.viewportCtx = viewport;
  return { studio, first, target, other, frame, view, component, otherComponent, otherFrame, variant, viewport, dom,
    dispose() { studio.dispose(); viewport.dispose(); },
  };
}

it("installs actual Studio arena/focus/variant/policy/viewport/session inputs before model-field subscribers", async () => {
  const f = await setup(); const { studio, view, target, frame, variant, viewport } = f;
  const tpl = ensureKnownTplTag(f.component.tplTree);
  studio.commentsCtx.openNewCommentDialog(view, tpl);
  const stores = [studio.arenaState.store, studio.selectionStore, view.selectionStore, view.variantStore, studio.uiEnvironment.store, viewport.store, studio.commentsCtx.dialogStore, studio.arenaState.viewRegistry.store];
  const notifications = stores.map(() => vi.fn()); const order: number[] = [];
  const stops = stores.map((store, index) => store.subscribe(() => { expect(new URLSearchParams(studio.appCtx.history.location.search).get("arena")).toBe("Committed target"); notifications[index](); order.push(index); }));
  const field = studio.modelSnapshots.field(target, "name");
  const read = vi.fn(() => {
    expect(field.getState()).toBe("Committed target");
    expect(new URLSearchParams(studio.appCtx.history.location.search).get("arena")).toBe("Committed target");
    expect(studio.arenaState.store.getState().current).toBe(studio.modelSnapshots.ref(target));
    expect(studio.arenaState.store.getState().frames).toEqual([studio.modelSnapshots.ref(frame)]);
    expect(studio.selectionStore.getState().view).toBe(view);
    expect(studio.selectionStore.getState().frames).toEqual([studio.modelSnapshots.ref(frame)]);
    expect(ensure(view.variantStore.getState().frames[0], "Root variant inputs").targets).toEqual([studio.modelSnapshots.ref(variant)]);
    expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(false);
    expect(viewport.store.getState().hasFrames).toBe(true);
    expect(studio.commentsCtx.dialogStore.getState().newThread).toBeUndefined();
    notifications.forEach((notification) => expect(notification).not.toHaveBeenCalled());
  });
  const stopField = field.subscribe(read);
  try {
    await studio.changeUnsafe(() => { target.name = "Committed target"; frame.targetVariants = [variant]; studio.switchToArena(target); });
    expect(read).toHaveBeenCalledOnce();
    expect(order[0]).toBe(6);
    expect(notifications[0]).toHaveBeenCalledOnce(); expect(notifications[1]).toHaveBeenCalledOnce(); expect(notifications[3]).toHaveBeenCalledOnce(); expect(notifications[4]).toHaveBeenCalledOnce(); expect(notifications[5]).toHaveBeenCalledOnce(); expect(notifications[6]).toHaveBeenCalledOnce();
  } finally { stopField(); stops.forEach((stop) => stop()); f.dispose(); }
});

it("restores a prepared failed Studio switch without destroying the cached view or its comment session", async () => {
  const f = await setup(); const { studio, view, target, first, viewport } = f;
  await studio.changeUnsafe(() => studio.switchToArena(target));
  const tpl = ensureKnownTplTag(f.component.tplTree); studio.commentsCtx.openNewCommentDialog(view, tpl);
  const session = ensure(studio.commentsCtx.openedNewThread(), "Comment session");
  const stores = [studio.arenaState.store, studio.selectionStore, view.selectionStore, view.variantStore, studio.uiEnvironment.store, viewport.store, studio.commentsCtx.dialogStore, studio.arenaState.viewRegistry.store];
  const snapshots = stores.map((store) => store.getState()); const notified = vi.fn(); const stops = stores.map((store) => store.subscribe(notified));
  const originalLocation = studio.appCtx.history.location;
  const savedLimit = DEVFLAGS.liveArenas; DEVFLAGS.liveArenas = 1;
  try {
    await expect(studio.changeUnsafe(() => {
      studio.switchToArena(first);
      studio.arenaState.prepareCommit(); studio.selection.prepareCommit(); view.selection.prepareCommit();
      view.variants.setShowDefaultSlots(true); view.variants.prepareCommit();
      expect(studio.arenaState.store.getState().current).toBe(studio.modelSnapshots.ref(first));
      expect(view.isDisposed).toBe(false);
      throw new Error("failed prepared arena switch");
    })).rejects.toThrow("failed prepared arena switch");
    stores.forEach((store, index) => expect(store.getState()).toBe(snapshots[index]));
    expect(studio.currentArena).toBe(target); expect(studio.viewCtxs).toContain(view); expect(view.isDisposed).toBe(false);
    expect(studio.commentsCtx.openedNewThread()).toBe(session);
    expect(studio.appCtx.history.location).toBe(originalLocation);
    expect(notified).not.toHaveBeenCalled();
    await studio.changeUnsafe(() => {
      try {
        // Exercise the same synchronous coordinator used by switch/model commands.
        studio["runNativeArenaCommand"](() => {
          studio.switchToArena(first); studio.arenaState.prepareCommit(); studio.selection.prepareCommit(); view.selection.prepareCommit();
          throw new Error("nested prepared switch");
        });
      } catch (error) { expect(error).toEqual(new Error("nested prepared switch")); }
      stores.forEach((store, index) => expect(store.getState()).toBe(snapshots[index]));
      expect(view.isDisposed).toBe(false);
    });
    expect(studio.appCtx.history.location).toBe(originalLocation); expect(notified).not.toHaveBeenCalled();
  } finally { DEVFLAGS.liveArenas = savedLimit; stops.forEach((stop) => stop()); f.dispose(); }
});

it("wakes initial-ready work when native focus switches to an already-cached ready view", async () => {
  const f = await setup(); const { studio, target, other, otherFrame } = f;
  const otherView = ensure(studio.tryGetViewCtxForFrame(otherFrame), "Cached view");
  vi.spyOn(otherView, "updateCtxPostChange").mockImplementation(() => undefined);
  vi.spyOn(otherView, "isVisible").mockReturnValue(true);
  vi.spyOn(otherView, "valState").mockReturnValue(new ValState({ sysRoot: mock<ValComponent>(), globalRoot: undefined }));
  vi.spyOn(otherView.csEvaluator, "evalAsync").mockResolvedValue();
  vi.spyOn(otherView.csEvaluator, "runPostEvalTasks").mockImplementation(() => undefined);
  vi.spyOn(studio, "change").mockImplementation(async (command) => ok(await command()));
  otherView.scheduleSync({ eval: true, styles: false, asap: true }); await otherView.awaitSync();
  expect(otherView.initialRenderReadyStore.getState()).toBe(true);
  vi.spyOn(otherView, "scheduleSync").mockImplementation(() => undefined);
  const savedLimit = DEVFLAGS.liveArenas; DEVFLAGS.liveArenas = 10;
  try {
    studio.switchToArena(target);
    const views = studio.viewCtxs.slice(); const task = vi.fn(async () => undefined);
    const stopRoute = studio.arenaState.store.subscribe((state) => { if (state.current) { expect(new URLSearchParams(studio.appCtx.history.location.search).get("arena")).toBe(state.name); } });
    studio.runAfterInitialCanvasReady(task); expect(task).not.toHaveBeenCalled();
    studio.switchToArena(other);
    expect(studio.viewCtxs.slice()).toEqual(views); expect(studio.activeCanvasReady).toBe(true);
    expect(task).toHaveBeenCalledOnce();
    studio.switchToArena(target); studio.switchToArena(other); expect(task).toHaveBeenCalledOnce();
    stopRoute();
  } finally { DEVFLAGS.liveArenas = savedLimit; f.dispose(); }
});

it("cancels a real queued background view wait on Studio disposal without invoking its callback", async () => {
  const f = await setup(); const { studio, other, otherComponent } = f;
  vi.spyOn(studio, "tryGetViewCtxForFrame").mockImplementation((frame) => studio.viewCtxs.find((view) => view.arenaFrame() === frame));
  const callback = vi.fn(async () => "read old owner");
  try {
    const pending = studio.withBackgroundViewCtxForComponent(otherComponent, callback);
    await waitFor(() => expect(studio.getArenaStatus(other)).toBe("background"));
    studio.dispose();
    expect(await pending).toBeUndefined(); expect(callback).not.toHaveBeenCalled();
    expect(studio.arenaState.statusStore(other).getState()).toBe("dead");
  } finally { f.dispose(); }
});
