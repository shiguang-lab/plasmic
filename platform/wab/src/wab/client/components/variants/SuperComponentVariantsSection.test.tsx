import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock } from "vitest-mock-extended";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SuperComponentVariantsSection } from "@/wab/client/components/variants/SuperComponentVariantsSection";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import variantStyles from "@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantRow.module.css";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { SuperComponentVariantSource } from "@/wab/client/studio-ctx/variant-group-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaFrames, mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function models(type: ComponentType.Plain | ComponentType.Page) {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Super", type: ComponentType.Plain });
  const child = manager.addComponent({ name: "Child", type });
  child.superComp = component; component.subComps.push(child);
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const first = manager.createVariant(component, group, "First");
  manager.createVariant(component, group, "Second");
  return { site, manager, component, child, group, first };
}

it("renders actual group/name mutations and Custom pin changes while keeping original recording commands", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const f = models(ComponentType.Plain);
  const frame = mkArenaFrame({ site: f.site, component: f.child, name: "Child", width: 200, height: 100 });
  f.site.arenas.push(mkMixedArena("Variants", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site: f.site, initialUrl: "/projects/test?arena_type=custom&arena=Variants" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Custom view");
  studio.setStudioFocusOnViewCtxContent(view);
  const controller = ensure(makeVariantsController(studio), "Custom controller");
  const source = new SuperComponentVariantSource(studio, f.component, controller), stop = source.subscribe(() => undefined);
  const mounted = render(<StudioCtxContext.Provider value={studio}><SuperComponentVariantsSection component={f.component} vcontroller={controller} studioCtx={studio} viewCtx={view} /></StudioCtxContext.Provider>);
  try {
    fireEvent.click(screen.getByText(/Super/));
    expect(screen.getByText(f.group.param.variable.name)).toBeTruthy(); expect(screen.getByText("First")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => {
      studio.tplMgr().renameComponent(f.component, "Parent"); studio.tplMgr().renameVariantGroup(f.group, "Palette");
      studio.tplMgr().createVariant(f.component, f.group, "Third");
    }); });
    expect(screen.getByText(/Parent/)).toBeTruthy(); expect(screen.getByText(f.group.param.variable.name)).toBeTruthy(); expect(screen.getByText("Third")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { view.currentComponentStackFrame().setPinnedVariants(new Map([[f.first, true]])); }); });
    expect(source.getSnapshot().groups[0].variants[0].pinState).toBe(controller.getPinState(f.first));
    const row = ensure(screen.getByText("First").closest('[data-test-class="variant-row"]'), "First actual row");
    expect(row.querySelector(`.${variantStyles.listItempinState_pinnedTrue}`)).not.toBeNull();
    fireEvent.mouseEnter(row);
    await waitFor(() => expect(row.querySelector('[data-test-class="variant-record-button-start"]')).not.toBeNull());
    const record = ensure(row.querySelector('[data-test-class="variant-record-button-start"]'), "Original record command");
    await act(async () => { fireEvent.click(record); await studio.awaitEval(); });
    await waitFor(() => expect(source.getSnapshot().groups[0].variants[0].pinState?.startsWith("selected")).toBe(true));
    expect(frame.targetVariants).toContain(f.first);
    expect(row.classList.contains(variantStyles.rootpinState_selected)).toBe(true);
    const current = source.getSnapshot();
    await act(async () => { await studio.changeUnsafe(() => { frame.width += 1; }); });
    expect(source.getSnapshot()).toBe(current);
  } finally { stop(); mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});

it("uses actual Page FramePin inputs before field publication and closes retained groups before old models are disposed", async () => {
  const f = models(ComponentType.Page);
  f.site.arenas.push(mkMixedArena("Empty"));
  const { studioCtx: studio } = fakeStudioCtx({ site: f.site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  // Use the real registry lookup rather than the fake helper's lazy iframe creation.
  studio.tryGetViewCtxForFrame = (frame) => studio.arenaState.viewRegistry.forFrame(frame)?.view;
  const arena = ensure(getDedicatedArena(f.site, f.child), "Page arena");
  studio.currentArena = arena;
  const frame = ensure(getArenaFrames(arena)[0], "Page frame"); studio.setStudioFocusOnlyOnFrame(frame);
  expect(studio.tryGetViewCtxForFrame(frame)).toBeUndefined();
  const controller = ensure(makeVariantsController(studio), "Page controller");
  const source = new SuperComponentVariantSource(studio, f.component, controller);
  const prepared = vi.spyOn(studio.modelSnapshots, "subscribePreparedField");
  source.getSnapshot(); expect(prepared).not.toHaveBeenCalled();
  const stop = source.subscribe(() => undefined);
  const firstRef = studio.modelSnapshots.ref(f.first);
  const mounted = render(<StudioCtxContext.Provider value={studio}><SuperComponentVariantsSection component={f.component} vcontroller={controller} studioCtx={studio} /></StudioCtxContext.Provider>);
  fireEvent.click(screen.getByText(/Super/));
  const published = vi.fn(() => {
    const row = source.getSnapshot().groups[0].variants[0];
    expect(row.pinState).toBe(controller.getPinState(f.first)); expect(row.pinState?.startsWith("selected")).toBe(true);
    expect(row.canTarget).toBe(controller.canToggleTargeting(f.first));
  });
  const stopField = studio.modelSnapshots.field(frame, "targetVariants").subscribe(published);
  try {
    expect(source.getSnapshot().groups[0].variants[0].canTarget).toBe(false);
    await act(async () => { await studio.changeUnsafe(() => { frame.targetVariants.push(f.first); }); });
    expect(published).toHaveBeenCalledOnce();
    expect(ensure(screen.getByText("First").closest('[data-test-class="variant-row"]'), "Selected Page row").classList.contains(variantStyles.rootpinState_selected)).toBe(true);
    stopField();
    await act(async () => { await studio.awaitEval(); studio.dispose(); });
    expect(source.getSnapshot().groups).toEqual([]);
    expect(screen.queryByText("First")).toBeNull();
    const declared = vi.spyOn(studio.modelSnapshots, "declaredField");
    mounted.rerender(<StudioCtxContext.Provider value={studio}><SuperComponentVariantsSection component={f.component} vcontroller={controller} studioCtx={studio} /></StudioCtxContext.Provider>);
    const late = source.subscribe(vi.fn()); late();
    expect(declared).not.toHaveBeenCalled();
    expect(() => source.resolve(firstRef)).toThrow("closed group owner");
  } finally { stopField(); stop(); mounted.unmount(); studio.dispose(); }
});

it("anchors retained component inputs to their original world while active controller replacements remain live", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const f = models(ComponentType.Plain);
  const firstFrame = mkArenaFrame({ site: f.site, component: f.child, name: "First frame", width: 200, height: 100 });
  const otherFrame = mkArenaFrame({ site: f.site, component: f.child, name: "Other frame", width: 200, height: 100 });
  otherFrame.pinnedVariants[f.first.uuid] = true;
  f.site.arenas.push(mkMixedArena("Controllers", [firstFrame, otherFrame]));
  const { studioCtx: studio, api } = fakeStudioCtx({ site: f.site, initialUrl: "/projects/test?arena_type=custom&arena=Controllers" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const firstView = ensure(studio.tryGetViewCtxForFrame(firstFrame), "First controller view");
  studio.setStudioFocusOnViewCtxContent(firstView);
  const firstController = ensure(makeVariantsController(studio), "First controller");
  const section = (controller: typeof firstController) => <StudioCtxContext.Provider value={studio}><SuperComponentVariantsSection component={f.component} vcontroller={controller} studioCtx={studio} /></StudioCtxContext.Provider>;
  const mounted = render(section(firstController));
  fireEvent.click(screen.getByText(/Super/));
  try {
    const otherView = ensure(studio.tryGetViewCtxForFrame(otherFrame), "Replacement controller view");
    await act(async () => { studio.setStudioFocusOnViewCtxContent(otherView); });
    const replacement = ensure(makeVariantsController(studio), "Active replacement controller");
    mounted.rerender(section(replacement));
    expect(ensure(screen.getByText("First").closest('[data-test-class="variant-row"]'), "Active replacement row").querySelector(`.${variantStyles.listItempinState_pinnedTrue}`)).not.toBeNull();
    const bundle = studio.bundleSite().site;
    const release = mock<PkgVersionInfoMeta>({ id: "variant-world", pkgId: "variant-pkg", version: "1.0.0", branchId: null });
    api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "variant-world-etag" });
    await act(async () => { await studio["loadVersion"](release, true); });
    const arena = ensure(studio.site.arenas.find((item) => item.name === "Controllers"), "Replacement world arena");
    await act(async () => { studio.currentArena = arena; });
    const frame = ensure(getArenaFrames(arena)[0], "Replacement world frame");
    const view = ensure(studio.tryGetViewCtxForFrame(frame), "Replacement world view");
    await act(async () => { studio.setStudioFocusOnViewCtxContent(view); });
    const nextController = ensure(makeVariantsController(studio), "New-world controller");
    const declared = vi.spyOn(studio.modelSnapshots, "declaredField");
    mounted.rerender(section(nextController));
    expect(declared.mock.calls.some(([model]) => model === f.component || model === f.group || model === f.first)).toBe(false);
    expect(screen.queryByText("First")).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
