import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TransitionsPanelSection } from "@/wab/client/components/sidebar-tabs/TransitionsSection";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { BaseTransitionInputs } from "@/wab/client/studio-ctx/transition-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureVariantSetting, mkVariant, tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup(single = false) {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Transition", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), variant = mkVariant({ name: "Active" });
  component.variants.push(variant);
  const base = ensure(tryGetBaseVariantSetting(root), "Real base setting");
  const active = ensureVariantSetting(root, [variant]);
  const rs = single ? ensure(site.activeTheme, "Theme").defaultStyle.rs : base.rs;
  const exp = new RuleSetHelpers(rs, "div"), activeExp = new RuleSetHelpers(active.rs, "div");
  exp.set("transition-property", "opacity"); exp.set("transition-duration", "1s");
  activeExp.set("transition-property", "transform"); activeExp.set("transition-duration", "9s");
  const frame = mkArenaFrame({ site, component, name: "Transition", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Transitions", [frame]));
  const fixture = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Transitions" });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const studio = fixture.studioCtx, view = ensure(studio.tryGetViewCtxForFrame(frame), "Transition view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = single ? new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" }) : new TplExpsProvider(view, root);
  const styling = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={fixture.appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><SidebarModalProvider containerSelector="#transition-test-sidebar"><div id="transition-test-sidebar" />{children}</SidebarModalProvider></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  const panel = () => wrap(<TransitionsPanelSection expsProvider={provider} />);
  return { ...fixture, studio, site, component, root, variant, base, rs, exp, activeExp, frame, view, provider, panel, wrap };
}

it("reads frozen base-only raw rules in a cold View and installs targets and raw values before completed subscribers", async () => {
  const f = await setup();
  expect(f.provider).toBeInstanceOf(TplExpsProvider);
  const source = new BaseTransitionInputs(new TplExpsProvider(f.view, f.root)), changed = vi.fn();
  const stop = source.subscribe(changed), before = source.getSnapshot();
  const reads: { raw: readonly (string | undefined)[]; targeting: boolean; editing: boolean }[] = [];
  const read = () => reads.push({ raw: source.getSnapshot(), targeting: f.view.variantStore.getState().isTargetingNonBaseVariant, editing: f.view.variantStore.getState().isEditingNonBaseVariant });
  const stopField = f.studio.modelSnapshots.field(f.rs, "values").subscribe(read);
  const stopCommit = f.studio.subscribeModelChanges((event) => { if (event.type === "commit") { read(); } });
  const mounted = render(f.panel());
  try {
    expect(screen.getByText("opacity")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => {
      f.view.currentComponentStackFrame().setTargetVariants([f.variant]);
      f.exp.set("transition-property", "color"); f.exp.set("transition-duration", "2s");
      expect(source.getSnapshot()).toBe(before);
    }); });
    expect(f.view.hasValState).toBe(false);
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const value of reads) { expect(value).toEqual({ raw: ["color", undefined, "2s", undefined], targeting: true, editing: false }); }
    expect(screen.getByText("color")).toBeTruthy(); expect(screen.queryByText("transform")).toBeNull();
    expect(screen.getByText(/transitions style is always applied/)).toBeTruthy();
    const stable = source.getSnapshot(); changed.mockClear();
    await act(async () => { await f.studio.changeUnsafe(() => { f.component.name = "Renamed transition"; }); });
    expect(source.getSnapshot()).toBe(stable); expect(changed).not.toHaveBeenCalled();
    await act(async () => { await f.studio.changeUnsafe(() => { f.exp.set("transition-duration", "2s"); }); });
    expect(source.getSnapshot()).toBe(stable); expect(changed).not.toHaveBeenCalled();
  } finally { stopCommit(); stopField(); stop(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("preserves actual SingleRs transition edits and removes the original rule fields through the original commands", async () => {
  const f = await setup(true), mounted = render(f.panel());
  try {
    fireEvent.click(screen.getByText("opacity"));
    const duration = await screen.findByRole("textbox", { name: "Duration" });
    fireEvent.change(duration, { target: { value: "003s" } }); fireEvent.blur(duration);
    await waitFor(() => expect(f.exp.getRaw("transition-duration")).toBe("3s"));
    expect(f.exp.getRaw("transition-property")).toBe("opacity");
    const delay = screen.getByRole("textbox", { name: "Delay" });
    fireEvent.change(delay, { target: { value: "1s" } }); fireEvent.blur(delay);
    await waitFor(() => expect(f.exp.getRaw("transition-delay")).toBe("1s"));
    fireEvent.click(ensure(document.querySelector('[data-test-id="close-sidebar-modal"]'), "Close transition panel"));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Duration" })).toBeNull());
    fireEvent.click(ensure(mounted.container.querySelector(".list-box-item__actions button"), "Original transition remove command"));
    await waitFor(() => expect(f.exp.getRaw("transition-property")).toBeUndefined());
    expect(f.exp.getRaw("transition-duration")).toBeUndefined(); expect(f.exp.getRaw("transition-delay")).toBeUndefined();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("leases only committed frozen fields and preserves a captured old View result without registering old refs in a replacement world", async () => {
  const f = await setup(), provider = new TplExpsProvider(f.view, f.root);
  const models = f.studio.modelSnapshots, prepared = vi.spyOn(models, "subscribePreparedField");
  const source = new BaseTransitionInputs(provider), old = source.getSnapshot();
  expect(prepared).not.toHaveBeenCalled();
  const pending = new Promise<void>(() => undefined);
  function Suspend(): React.ReactNode { throw pending; }
  const abandoned = render(f.wrap(<React.Suspense fallback={<span>Pending transitions</span>}><TransitionsPanelSection expsProvider={provider} /><Suspend /></React.Suspense>));
  expect(prepared).not.toHaveBeenCalled(); abandoned.unmount();
  const stop = source.subscribe(() => undefined); expect(prepared).toHaveBeenCalled();
  const mounted = render(f.panel());
  try {
    const release = mock<PkgVersionInfoMeta>({ id: "transition-world", pkgId: "transition-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "transition-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"), changed = vi.fn();
    expect(source.getSnapshot()).toBe(old); const late = source.subscribe(changed);
    mounted.rerender(f.panel());
    expect(fields.mock.calls.some(([model]) => model === f.root || model === f.rs || model === f.variant)).toBe(false);
    expect(changed).not.toHaveBeenCalled(); late();
    expect(screen.getByText("opacity")).toBeTruthy();
  } finally { stop(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
