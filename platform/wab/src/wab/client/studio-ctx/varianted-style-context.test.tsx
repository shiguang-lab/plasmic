import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { VariantedStyleContext, useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { makeVariantedStylesHelperFromCurrentCtx } from "@/wab/client/utils/style-utils";
import { getArenaFrames, mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Context({ studio }: { studio: ReturnType<typeof fakeStudioCtx>["studioCtx"] }) {
  const helper = useVariantedStylesHelperFromCurrentCtx(studio);
  return <output data-testid="varianted-context">{helper.key()}:{String(helper.canUpdateToken())}</output>;
}

it("uses the actual Custom pin producers and stays quiet for unrelated model edits", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Card", type: ComponentType.Plain });
  const group = manager.createGlobalVariantGroup("Theme"), dark = manager.createGlobalVariant(group, "Dark");
  const frame = mkArenaFrame({ site, component, name: "Card", width: 100, height: 100 });
  const arena = mkMixedArena("Mixed", [frame]); site.arenas.push(arena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Mixed" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Custom view");
  studio.setStudioFocusOnViewCtxContent(view);
  const mounted = render(<Context studio={studio} />);
  const source = new VariantedStyleContext(studio), changed = vi.fn(), stop = source.subscribe(changed);
  try {
    await act(async () => { await studio.changeUnsafe(() => { view.globalFrame.setPinnedVariants(new Map([[dark, true]])); }); });
    expect(screen.getByTestId("varianted-context").textContent).toBe(`${JSON.stringify([dark.uuid])}:true`);
    expect(source.getSnapshot().active).toEqual([studio.modelSnapshots.ref(dark)]);
    expect(source.getSnapshot().target).toEqual([]);
    const current = source.getSnapshot(); changed.mockClear();
    await act(async () => { await studio.changeUnsafe(() => { component.name = "Renamed card"; }); });
    expect(source.getSnapshot()).toBe(current);
    expect(changed).not.toHaveBeenCalled();
    await act(async () => { await studio.changeUnsafe(() => { view.globalFrame.setTargetVariants([dark]); }); });
    expect(source.getSnapshot().target).toEqual([studio.modelSnapshots.ref(dark)]);
    expect(makeVariantedStylesHelperFromCurrentCtx(studio).key()).toBe(JSON.stringify([dark.uuid]));
  } finally { stop(); mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});

it("reads Page FramePinManager inputs without a View and installs imported global refs before field subscribers", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const page = manager.addComponent({ name: "Customers", type: ComponentType.Page });
  const pageArena = ensure(getDedicatedArena(site, page), "Page arena");
  const arena = mkMixedArena("Empty"); site.arenas.push(arena);
  const dependencySite = createSite(), dependencyManager = new TplMgr({ site: dependencySite });
  const group = dependencyManager.createGlobalVariantGroup("Imported Theme"), dark = dependencyManager.createGlobalVariant(group, "Dark");
  site.projectDependencies.push(new ProjectDependency({ uuid: "imported-theme", pkgId: "imported-pkg", projectId: "imported-project", version: "1.0.0", name: "Imported", site: dependencySite }));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  // Imported models need their actual external bundle addresses, as in a loaded dependency.
  appCtx.bundler.bundle(dependencySite, "imported-project", appCtx.lastBundleVersion);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  // Restore the real registry lookup: this test intentionally has no loaded iframe.
  studio.tryGetViewCtxForFrame = (frame) => studio.arenaState.viewRegistry.forFrame(frame)?.view;
  studio.currentArena = pageArena;
  const frame = ensure(getArenaFrames(pageArena)[0], "Page frame");
  studio.setStudioFocusOnlyOnFrame(frame);
  expect(studio.tryGetViewCtxForFrame(frame)).toBeUndefined();
  const source = new VariantedStyleContext(studio), stop = source.subscribe(() => undefined);
  const published = vi.fn(() => {
    expect(source.getSnapshot().target).toEqual([studio.modelSnapshots.ref(dark)]);
    expect(source.getSnapshot().active).toEqual([studio.modelSnapshots.ref(dark)]);
  });
  const stopField = studio.modelSnapshots.field(frame, "targetGlobalVariants").subscribe(published);
  const mounted = render(<Context studio={studio} />);
  try {
    await act(async () => { await studio.changeUnsafe(() => { frame.targetGlobalVariants.push(dark); }); });
    expect(published).toHaveBeenCalledOnce();
    expect(screen.getByTestId("varianted-context").textContent).toBe(`${JSON.stringify([dark.uuid])}:true`);
    expect(makeVariantedStylesHelperFromCurrentCtx(studio).key()).toBe(JSON.stringify([dark.uuid]));
    stopField();
    await act(async () => { await studio.changeUnsafe(() => { frame.targetGlobalVariants.splice(0); frame.pinnedGlobalVariants[dark.uuid] = true; }); });
    expect(source.getSnapshot().active).toEqual([studio.modelSnapshots.ref(dark)]);
    expect(source.getSnapshot().target).toEqual([]);
  } finally { stopField(); stop(); mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
