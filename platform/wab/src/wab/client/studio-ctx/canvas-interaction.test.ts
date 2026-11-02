import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { makeClientPinManager } from "@/wab/client/components/variants/ClientPinManager";
import { getArenaFrames, mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ComponentType } from "@/wab/shared/core/components";
import { getStateVarName } from "@/wab/shared/core/states";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { Pt } from "@/wab/shared/geom";
import { $State } from "@plasmicapp/react-web";
import { waitFor } from "@testing-library/react";
import { runInAction } from "mobx";

async function fixture() {
  // This fixture has no browser viewport; leave canvas rendering paused.
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({ name: "Tabs", type: ComponentType.Plain });
  const group = tplMgr.createVariantGroup({ component, name: "Tab" });
  const first = tplMgr.createVariant(component, group, "First");
  const second = tplMgr.createVariant(component, group, "Second");
  const frames = [first, second].map((variant, i) => mkArenaFrame({
    site, component, name: variant.name, width: 800, height: 600,
    left: i * 900, top: 0, targetVariants: [variant],
  }));
  const arena = mkMixedArena("Scenarios", frames);
  site.arenas.push(arena);
  const { studioCtx, appCtx } = fakeStudioCtx({
    site, initialUrl: "/projects/test?arena_type=custom&arena=Scenarios",
  });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  vi.spyOn(studioCtx, "getCurrentStudioViewportSnapshot").mockReturnValue({
    scroll: Pt.zero(), canvasPadding: Pt.zero(), scale: 1,
  });
  vi.spyOn(studioCtx, "restoreStudioViewportSnapshot").mockImplementation(() => undefined);
  const views = frames.map((frame) => ensure(studioCtx.tryGetViewCtxForFrame(frame), "Missing view"));
  const state = (value: string) => ({ [getStateVarName(ensure(group.linkedState, "Missing linked state"))]: value } as $State);
  return { studioCtx, appCtx, component, frames, views, arena, first, second, state };
}

afterEach(() => vi.restoreAllMocks());

it("enables all artboards without entering Focus or changing the group layout", async () => {
  const f = await fixture();
  try {
    expect(f.studioCtx.focusedMode).toBe(false);
    await f.studioCtx.changeUnsafe(() => f.studioCtx.toggleInteractiveMode());
    expect(f.studioCtx.isInteractiveMode).toBe(true);
    f.views.forEach((view) => expect(view.canvasCtx.setInteractiveMode).toHaveBeenLastCalledWith(true));
    expect(f.studioCtx.focusedMode).toBe(false);
    expect(getArenaFrames(f.arena)).toEqual(f.frames);
    expect(f.frames.map((frame) => frame.left)).toEqual([0, 900]);
    await f.studioCtx.changeUnsafe(() => f.studioCtx.toggleInteractiveMode());
    expect(f.studioCtx.isInteractiveMode).toBe(false);
    f.views.forEach((view) => expect(view.canvasCtx.setInteractiveMode).toHaveBeenLastCalledWith(false));
  } finally { f.studioCtx.dispose(); }
});

it("keeps each artboard's state independent and retains it for editing without persisting runtime pins", async () => {
  const f = await fixture();
  try {
    const before = f.appCtx.bundler.bundle(f.studioCtx.site, f.studioCtx.siteInfo.id, f.appCtx.lastBundleVersion);
    runInAction(() => {
      f.studioCtx.isInteractiveMode = true;
      f.views[0].syncInteractiveVariants(f.state("second"));
      f.views[1].syncInteractiveVariants(f.state("second"));
    });
    expect(makeClientPinManager(f.views[0]).isActive(f.second)).toBe(true);
    expect(makeClientPinManager(f.views[0]).isActive(f.first)).not.toBe(true);
    expect(makeClientPinManager(f.views[1]).isActive(f.second)).toBe(true);
    runInAction(() => f.views[1].syncInteractiveVariants(f.state("first")));
    expect(makeClientPinManager(f.views[0]).isActive(f.second)).toBe(true);
    expect(makeClientPinManager(f.views[1]).isActive(f.first)).toBe(true);
    runInAction(() => { f.studioCtx.isInteractiveMode = false; });
    expect(f.views[0].componentStackFrames()[0]).toBeInstanceOf(TransientComponentVariantFrame);
    expect(makeClientPinManager(f.views[0]).isActive(f.second)).toBe(true);
    expect(makeClientPinManager(f.views[1]).isActive(f.first)).toBe(true);
    expect(f.appCtx.bundler.bundle(f.studioCtx.site, f.studioCtx.siteInfo.id, f.appCtx.lastBundleVersion)).toEqual(before);
    expect(f.frames.map((frame) => frame.targetVariants)).toEqual([[f.first], [f.second]]);
    expect(f.frames.map((frame) => frame.pinnedVariants)).toEqual([{}, {}]);
  } finally { f.studioCtx.dispose(); }
});

it("keeps interaction enabled when navigating between dedicated editors and artboard groups", async () => {
  const f = await fixture();
  try {
    runInAction(() => { f.studioCtx.isInteractiveMode = true; });
    const dedicated = getDedicatedArena(f.studioCtx.site, f.component);
    await f.studioCtx.changeUnsafe(() => f.studioCtx.switchToArena(dedicated));
    expect(f.studioCtx.isInteractiveMode).toBe(true);
    await f.studioCtx.changeUnsafe(() => f.studioCtx.turnFocusedModeOn());
    expect(f.studioCtx.focusedMode).toBe(true);
    await f.studioCtx.changeUnsafe(() => f.studioCtx.turnFocusedModeOff());
    expect(f.studioCtx.isInteractiveMode).toBe(true);
    await f.studioCtx.changeUnsafe(() => f.studioCtx.switchToArena(f.arena));
    expect(f.studioCtx.isInteractiveMode).toBe(true);
  } finally { f.studioCtx.dispose(); }
});
