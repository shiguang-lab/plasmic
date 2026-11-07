import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RENDER_READY_ATTR } from "@/wab/client/studio-ctx/render-ready";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { waitFor } from "@testing-library/react";
import { ok } from "neverthrow";
import { mock } from "vitest-mock-extended";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Ready", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Ready frame", width: 100, height: 100 });
  const first = mkMixedArena("Empty");
  const arena = mkMixedArena("Ready", [frame]); site.arenas.push(first, arena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const createView = studio.tryGetViewCtxForFrame;
  const view = ensure(createView(frame), "Registered ViewCtx");
  vi.spyOn(studio, "tryGetViewCtxForFrame").mockImplementation((target) => studio.arenaState.viewRegistry.forFrame(target)?.view);
  const doc = document.implementation.createHTMLDocument("View readiness");
  vi.mocked(view.canvasCtx.doc).mockReturnValue(doc);
  vi.spyOn(view.csEvaluator, "evalAsync").mockResolvedValue();
  vi.spyOn(view.csEvaluator, "runPostEvalTasks").mockImplementation(() => undefined);
  vi.spyOn(view, "updateCtxPostChange").mockImplementation(() => undefined);
  vi.spyOn(view, "isVisible").mockReturnValue(true);
  vi.spyOn(view, "valState").mockReturnValue(new ValState({ sysRoot: mock<ValComponent>(), globalRoot: undefined }));
  vi.spyOn(studio, "change").mockImplementation(async (callback) => ok(await callback()));
  return { studio, frame, arena, view, doc, createView, dispose() { studio.dispose(); } };
}

it("publishes the one ViewCtx readiness store after eval, post-eval and the actual iframe marker", async () => {
  const f = await setup(); const { studio, view, frame, doc } = f;
  const entry = ensure(studio.arenaState.viewRegistry.forFrame(frame), "Registered entry");
  const frameInfo = view.canvasCtx.frameInfo(view);
  const notified = vi.fn(() => {
    expect(doc.documentElement.hasAttribute(RENDER_READY_ATTR)).toBe(true);
    expect(studio.arenaState.viewRegistry.forFrame(frame)).toBe(entry);
    expect(entry.ready).toBe(view.initialRenderReadyStore);
    expect(view.initialRenderReady).toBe(true);
    expect(frameInfo.getState().height).toBe(frame.height);
    expect(view.selectionStore.getState().tpls).toEqual([]);
    expect(view.canvasSessionState.revealsStore.getState()).toBe(false);
    expect(studio.loadTimings.has("frame-rendered", frame.uuid)).toBe(true);
  });
  const off = entry.ready.subscribe(notified);
  try {
    expect(entry.ready.getState()).toBe(false);
    view.scheduleSync({ eval: true, styles: false, asap: true }); await view.awaitSync();
    expect(notified).toHaveBeenCalledOnce();
    expect(studio.arenaState.viewRegistry.forFrame(frame)?.ready).toBe(entry.ready);
    view.scheduleSync({ eval: true, styles: false, asap: true }); await view.awaitSync();
    expect(notified).toHaveBeenCalledOnce(); expect(view.initialRenderReady).toBe(true);
  } finally { off(); f.dispose(); }
});

it("cannot publish a late eval into either a removed view or its replacement", async () => {
  const f = await setup(); const { studio, view, frame } = f;
  let release: () => void = () => undefined;
  vi.mocked(view.csEvaluator.evalAsync).mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));
  const oldReady = view.initialRenderReadyStore;
  const changed = vi.fn(); const off = oldReady.subscribe(changed);
  try {
    view.scheduleSync({ eval: true, styles: false, asap: true });
    const pending = view.awaitSync();
    await waitFor(() => expect(view.csEvaluator.evalAsync).toHaveBeenCalledOnce());
    studio.disposeViewCtx(view);
    const replacement = ensure(f.createView(frame), "Replacement ViewCtx");
    expect(replacement).not.toBe(view);
    const entry = ensure(studio.arenaState.viewRegistry.forFrame(frame), "Replacement entry");
    expect(entry.ready).toBe(replacement.initialRenderReadyStore);
    release(); await pending;
    expect(changed).not.toHaveBeenCalled(); expect(oldReady.getState()).toBe(false);
    expect(entry.ready.getState()).toBe(false); expect(replacement.initialRenderReady).toBe(false);
  } finally { release(); off(); f.dispose(); }
});

it("restores the original registered view and source after a real nested prepared failure", async () => {
  const f = await setup(); const { studio, view, frame } = f;
  const registry = studio.arenaState.viewRegistry;
  const entry = ensure(registry.forFrame(frame), "Original entry");
  const state = registry.store.getState(); const views = studio.viewCtxs;
  const notified = vi.fn(); const off = registry.store.subscribe(notified);
  let waiter: Promise<ViewCtx> | undefined;
  try {
    expect(() => studio["runNativeArenaCommand"](() => {
      studio.disposeViewCtx(view);
      expect(registry.forFrame(frame)).toBeUndefined(); expect(view.isDisposed).toBe(false);
      waiter = studio.awaitViewCtxForFrame(frame);
      try {
        studio["runNativeArenaCommand"](() => {
          registry.register(view); registry.prepareCommit(); throw new Error("nested prepared failure");
        });
      } catch (error) { expect(error).toEqual(new Error("nested prepared failure")); }
      expect(registry.forFrame(frame)).toBeUndefined();
      throw new Error("outer prepared failure");
    })).toThrow("outer prepared failure");
    expect(registry.store.getState()).toBe(state); expect(studio.viewCtxs).toBe(views);
    expect(registry.forFrame(frame)).toBe(entry); expect(entry.ready).toBe(view.initialRenderReadyStore);
    expect(view.isDisposed).toBe(false); expect(notified).not.toHaveBeenCalled();
    expect(await ensure(waiter, "Staged frame waiter")).toBe(view);
  } finally { off(); f.dispose(); }
});
