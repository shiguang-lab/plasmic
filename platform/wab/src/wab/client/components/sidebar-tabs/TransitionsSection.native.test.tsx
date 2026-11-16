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

it("edits transitions in a popup instead of a sidebar modal and removes the original rule fields through the original commands", async () => {
  const f = await setup(true), mounted = render(f.panel());
  try {
    const header = ensure(mounted.container.querySelector('[data-plasmic-role="labeled-item"]'), "Transitions header");
    expect(header.querySelector('[data-plasmic-name="menuButton"]')).toBeNull();
    expect(screen.queryByText("Property")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Transition: opacity" });
    expect(trigger.textContent).toContain("opacity");
    expect(trigger.textContent).toContain("1s · ease");
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Transition" });
    expect(dialog).toBeTruthy();
    expect(document.querySelector('[data-test-id="sidebar-modal"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Property" }));
    fireEvent.click(await screen.findByRole("option", { name: "transform" }));
    await waitFor(() => expect(f.exp.getRaw("transition-property")).toBe("transform"));
    expect(screen.getByRole("dialog", { name: "Transition" })).toBeTruthy();
    const duration = await screen.findByRole("textbox", { name: "Duration" });
    fireEvent.change(duration, { target: { value: "003s" } }); fireEvent.blur(duration);
    await waitFor(() => expect(f.exp.getRaw("transition-duration")).toBe("3s"));
    expect(f.exp.getRaw("transition-property")).toBe("transform");
    const delay = screen.getByRole("textbox", { name: "Delay" });
    fireEvent.change(delay, { target: { value: "1s" } }); fireEvent.blur(delay);
    await waitFor(() => expect(f.exp.getRaw("transition-delay")).toBe("1s"));
    expect(screen.getByRole("button", { name: "Transition: transform" }).textContent).toContain("3s + 1s · ease");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Duration" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Remove transition" }));
    await waitFor(() => expect(f.exp.getRaw("transition-property")).toBeUndefined());
    expect(f.exp.getRaw("transition-duration")).toBeUndefined(); expect(f.exp.getRaw("transition-delay")).toBeUndefined();
    fireEvent.click(header);
    await act(async () => { await f.studio.awaitEval(); });
    expect(f.exp.getRaw("transition-property")).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: "Transition" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add transition" }));
    expect(await screen.findByRole("dialog", { name: "Transition" })).toBeTruthy();
    expect(document.querySelector('[data-test-id="sidebar-modal"]')).toBeNull();
    expect(mounted.container.querySelectorAll('[data-test-id="drag-handle"][data-disabled="true"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Add transition" }));
    expect(mounted.container.querySelectorAll('[data-rfd-drag-handle-draggable-id] [data-test-id="drag-handle"]:not([data-disabled])')).toHaveLength(2);
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

it("selects exclusive None in the popup, replaces it on add, and clears base rules without editing the active variant", async () => {
  const f = await setup();
  await act(async () => { await f.studio.changeUnsafe(() => f.view.currentComponentStackFrame().setTargetVariants([f.variant])); });
  const mounted = render(f.panel());
  try {
    expect(screen.queryByRole("button", { name: "Transitions: Custom" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add transition" }));
    await waitFor(() => expect(f.exp.getRaw("transition-property")).toBe("opacity, all"));
    fireEvent.click(await screen.findByRole("button", { name: "Property" }));
    fireEvent.click(await screen.findByRole("option", { name: "None" }));
    await screen.findByRole("button", { name: "Transition: None" });
    expect(f.exp.getRaw("transition-property")).toBe("none");
    expect(f.exp.getRaw("transition-duration")).toBeUndefined();
    expect(mounted.container.querySelectorAll(".list-box-item")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Transition: opacity" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Duration" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Delay" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Timing curve" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add transition" }).hasAttribute("disabled")).toBe(false);
    expect(f.activeExp.getRaw("transition-property")).toBe("transform");
    expect(f.activeExp.getRaw("transition-duration")).toBe("9s");
    fireEvent.click(screen.getByRole("button", { name: "Add transition" }));
    await screen.findByRole("button", { name: "Transition: all" });
    expect(f.exp.getRaw("transition-property")).toBe("all");
    expect(screen.queryByRole("button", { name: "Transition: None" })).toBeNull();
    expect((await screen.findByRole("textbox", { name: "Duration" }) as HTMLInputElement).value).toBe("1s");
    fireEvent.click(screen.getByRole("button", { name: "Property" }));
    fireEvent.click(await screen.findByRole("option", { name: "None" }));
    await screen.findByRole("button", { name: "Transition: None" });
    fireEvent.click(screen.getByRole("button", { name: "Property" }));
    fireEvent.click(await screen.findByRole("option", { name: "opacity" }));
    await waitFor(() => expect(f.exp.getRaw("transition-property")).toBe("opacity"));
    expect(f.exp.getRaw("transition-duration")).toBe("1s");
    fireEvent.click(screen.getByRole("button", { name: "Property" }));
    fireEvent.click(await screen.findByRole("option", { name: "None" }));
    await screen.findByRole("button", { name: "Transition: None" });
    fireEvent.click(screen.getByRole("button", { name: "Remove None override" }));
    await waitFor(() => expect(f.exp.getRaw("transition-property")).toBeUndefined());
    expect(f.exp.getRaw("transition-property")).toBeUndefined();
    expect(f.exp.getRaw("transition-duration")).toBeUndefined();
    expect(f.exp.getRaw("transition-delay")).toBeUndefined();
    expect(f.exp.getRaw("transition-timing-function")).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: "Transition" })).toBeNull();
    expect(f.activeExp.getRaw("transition-property")).toBe("transform");
    expect(f.activeExp.getRaw("transition-duration")).toBe("9s");
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
