import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import type { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Render policy", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Policy frame", width: 400, height: 300, left: 0, top: 0 });
  frame.viewMode = "centered";
  const empty = mkMixedArena("Empty"), arena = mkMixedArena("Policy", [frame]);
  site.arenas.push(empty, arena);
  const fixture = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  const studio = fixture.studioCtx;
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  vi.spyOn(studio, "tryZoomToFitArena").mockImplementation(() => undefined);
  studio.switchToArena(arena);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Policy view");
  vi.spyOn(view, "awaitSync").mockResolvedValue(undefined);
  studio.dbCtx().maybeObserveComponents([component]);
  const info = new CanvasFrameInfoOwner(view);
  view.canvasCtx.prepareFrameInfo = () => info.prepare();
  view.canvasCtx.frameInfo = () => info.store;
  return { ...fixture, studio, view, frame, info,
    async dispose() { info.dispose(); await studio.awaitEval(); studio.dispose(); },
  };
}

it("installs final policy and frame output for same-commit view-mode edits before any affected subscriber", async () => {
  const f = await setup(); const { studio, view, frame, info } = f;
  studio.setFullPageHeightOverride(true);
  studio.isInteractiveMode = true;
  const viewMode = studio.modelSnapshots.field(frame, "viewMode");
  const read = vi.fn(() => {
    expect(viewMode.getState()).toBe("stretch");
    expect(studio.renderPolicy.store.getState()).toMatchObject({ interactive: false, fullPageHeight: true });
    expect(info.store.getState().isHeightAutoDerived).toBe(true);
    expect(info.store.getState().fullPageHeight).toBe(true);
    expect(view.isFullContentView()).toBe(true);
  });
  const stops = [viewMode.subscribe(read), studio.renderPolicy.store.subscribe(read), info.store.subscribe(read)];
  try {
    await studio.changeUnsafe(() => {
      frame.viewMode = "stretch";
      const root = view.component.tplTree;
      RSH(ensure(root.vsettings[0], "Base root settings").rs, root).set("width", "stretch");
      studio.isInteractiveMode = false;
    });
    expect(read).toHaveBeenCalledTimes(3);
  } finally { stops.forEach((stop) => stop()); await f.dispose(); }
});

it("keeps equal interactive DOM effects and prepares auto-open changes before selection notifications", async () => {
  const f = await setup(); const { studio, view } = f;
  const setMode = vi.spyOn(view.canvasCtx, "setInteractiveMode");
  const changed = vi.fn(); const stop = studio.renderPolicy.store.subscribe(changed);
  try {
    studio.isInteractiveMode = true;
    const snapshot = studio.renderPolicy.store.getState(); changed.mockClear(); setMode.mockClear();
    studio.isInteractiveMode = true;
    expect(setMode).toHaveBeenCalledWith(true);
    expect(studio.renderPolicy.store.getState()).toBe(snapshot);
    expect(changed).not.toHaveBeenCalled();
    view.disabledAutoOpenUuid = "closed";
    const read = vi.fn(() => {
      expect(view.selectionStore.getState().disabledAutoOpenUuid).toBeUndefined();
      expect(studio.renderPolicy.store.getState().autoOpen).toBe(false);
    });
    const stopSelection = view.selectionStore.subscribe(read);
    try { studio.toggleAutoOpenMode(); expect(read).toHaveBeenCalledOnce(); }
    finally { stopSelection(); }
  } finally { stop(); await f.dispose(); }
});

it("prepares source and owner live changes before their subscribers, ignores inactive owners, and seals disposed policy", async () => {
  const f = await setup(); const { studio } = f;
  const host = mock<HostFrameCtx>();
  Object.defineProperty(host, "history", { value: studio.appCtx.history });
  const first = new PreviewCtx(host, studio);
  const read = vi.fn(() => {
    expect(studio.renderPolicy.store.getState().devMode).toBe(!studio.isLiveMode && !studio.isDocs);
  });
  const stops = [studio.previewOwnerStore.subscribe(read), first.store.subscribe(read)];
  let second: PreviewCtx | undefined;
  try {
    first.isLive = true;
    expect(read).toHaveBeenCalled();
    second = new PreviewCtx(host, studio);
    expect(studio.previewCtx).toBe(second);
    first.isLive = false; first.isLive = true;
    expect(studio.renderPolicy.store.getState().devMode).toBe(true);
    studio.isDocs = true;
    second.isLive = true; second.isLive = false;
    expect(studio.renderPolicy.store.getState().devMode).toBe(false);
    studio.isDocs = false;
    const terminal = studio.renderPolicy.store.getState();
    studio.dispose(); second.isLive = true;
    expect(studio.renderPolicy.store.getState()).toBe(terminal);
  } finally { stops.forEach((stop) => stop()); first.dispose(); second?.dispose(); await f.dispose(); }
});
