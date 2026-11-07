import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import VariantComboRow from "@/wab/client/components/variants/VariantComboRow";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import rowStyles from "@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantComboRow.module.css";
import { VariantComboSource } from "@/wab/client/studio-ctx/variant-combo-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureVariantSetting, makeVariantName, VariantCombo } from "@/wab/shared/Variants";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

beforeEach(() => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup(code = false) {
  const site = createSite(), manager = new TplMgr({ site });
  const cc = code ? mkCodeComponent("Button", { name: "Button", importPath: "./button", props: {}, variants: { focused: { cssSelector: ".focused", displayName: "Focused" } } }, {}) : undefined;
  if (cc) { site.components.push(cc); }
  const component = cc ? mkComponent({ name: "Wrapper", type: ComponentType.Plain, tplTree: (base) => mkTplComponent(cc, base) }) : manager.addComponent({ name: "Card", type: ComponentType.Plain });
  if (cc) { site.components.push(component); }
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const variant = cc ? manager.createCodeComponentVariant(component, "Button", ["focused"]) : manager.createVariant(component, group, "First");
  const setting = ensureVariantSetting(component.tplTree, [variant]);
  const frame = mkArenaFrame({ site, component, name: "Card", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Combos", [frame]));
  const { studioCtx: studio, api } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Combos" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Combo view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(component.tplTree);
  return { site, manager, component, variant, setting, frame, studio, api, view, cc };
}
function row(f: Awaited<ReturnType<typeof setup>>, combo: VariantCombo, onClick = () => undefined, onActivate = () => undefined) {
  return <StudioCtxContext.Provider value={f.studio}><VariantComboRow viewCtx={f.view} combo={combo} onClick={onClick} onActivate={onActivate} /></StudioCtxContext.Provider>;
}

it("updates native labels and indicator existence in completed commits while preserving activation/menu commands", async () => {
  const f = await setup(), source = new VariantComboSource(f.view, [f.variant]), notified = vi.fn(), stop = source.subscribe(notified);
  const clicked = vi.fn(), activated = vi.fn(), mounted = render(row(f, [f.variant], clicked, activated));
  const root = ensure(mounted.container.firstElementChild, "Actual combo row");
  const observe = vi.fn(() => { expect(source.getSnapshot().labels[0].name).toBe("Renamed"); expect(source.getSnapshot().setting).toBe(f.studio.modelSnapshots.ref(f.setting)); });
  const stopField = f.studio.modelSnapshots.field(f.variant, "name").subscribe(observe);
  try {
    expect(screen.getByText("First")).toBeTruthy(); expect(root.classList.contains(rowStyles.rootisIndicated)).toBe(false);
    await act(async () => { await f.studio.changeUnsafe(() => { f.variant.name = "Renamed"; f.setting.rs.values.opacity = "0.5"; }); });
    expect(observe).toHaveBeenCalledOnce(); stopField();
    expect(screen.getByText("Renamed")).toBeTruthy(); expect(root.classList.contains(rowStyles.rootisIndicated)).toBe(true);
    const indicator = ensure(root.querySelector(`.${rowStyles.indicator}`), "Actual settings indicator");
    fireEvent.mouseEnter(indicator);
    await screen.findByText(/Settings for element vertical stack/);
    await act(async () => { await f.studio.changeUnsafe(() => { ensureKnownTplTag(f.component.tplTree).tag = "a"; }); });
    await screen.findByText(/Settings for element link/);
    const before = source.getSnapshot(), count = notified.mock.calls.length;
    await act(async () => { await f.studio.changeUnsafe(() => { f.view.currentComponentStackFrame().setPinnedVariants(new Map([[f.variant, true]])); f.frame.width += 1; }); });
    expect(source.getSnapshot()).toBe(before); expect(notified).toHaveBeenCalledTimes(count);
    await act(async () => { await f.studio.changeUnsafe(() => { f.setting.rs.values = {}; }); });
    expect(root.classList.contains(rowStyles.rootisIndicated)).toBe(false);
    fireEvent.click(screen.getByText("Renamed")); expect(clicked).toHaveBeenCalledOnce();
    fireEvent.mouseEnter(root);
    await waitFor(() => expect(root.querySelector(`.${rowStyles.visibleButton}`)).not.toBeNull());
    const visible = ensure(root.querySelector(`.${rowStyles.visibleButton}`), "Original activation button");
    fireEvent.click(visible); expect(activated).toHaveBeenCalledOnce(); expect(clicked).toHaveBeenCalledOnce();
    await act(async () => { f.studio.setStudioFocusOnlyOnFrame(f.frame); });
    expect(f.studio.focusedFrame()).toBe(f.frame);
    const clear = vi.spyOn(f.view.getViewOps(), "clearFrameComboSettings");
    fireEvent.contextMenu(root); fireEvent.click(await screen.findByText("Clear settings for this combo"));
    await waitFor(() => expect(clear).toHaveBeenCalledWith(f.frame));
  } finally { stopField(); stop(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("uses the original code-variant registry labels for same-ref metadata and key changes", async () => {
  const f = await setup(true), mounted = render(row(f, [f.variant]));
  try {
    expect(screen.getByText("Focused")).toBeTruthy();
    const meta = ensure(f.cc?.codeComponentMeta, "Code component metadata");
    await act(async () => { await f.studio.changeUnsafe(() => { ensure(meta.variants.focused, "Focused metadata").displayName = "Keyboard focus"; }); });
    expect(screen.getByText(makeVariantName({ variant: f.variant, site: f.site }))).toBeTruthy(); expect(screen.getByText("Keyboard focus")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.variant.codeComponentVariantKeys = ["unknown"]; }); });
    expect(screen.getByText("UnnamedVariant")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.variant.codeComponentVariantKeys = ["focused"]; }); });
    expect(screen.getByText("Keyboard focus")).toBeTruthy();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps abandoned projections unsubscribed and old view/combo props closed across a real model replacement", async () => {
  const f = await setup(), originalRef = f.studio.modelSnapshots.ref(f.variant), prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField");
  const abandoned = new VariantComboSource(f.view, [f.variant]); abandoned.getSnapshot(); expect(prepared).not.toHaveBeenCalled();
  const source = new VariantComboSource(f.view, [f.variant]), stop = source.subscribe(() => undefined);
  const mounted = render(row(f, [f.variant]));
  try {
    const release = mock<PkgVersionInfoMeta>({ id: "combo-world", pkgId: "combo-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "combo-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    const declared = vi.spyOn(f.studio.modelSnapshots, "declaredField");
    mounted.rerender(row(f, [f.variant]));
    expect(declared).not.toHaveBeenCalled(); expect(source.getSnapshot().labels).toEqual([]); expect(screen.queryByText("First")).toBeNull();
    const late = vi.fn(), off = source.subscribe(late); expect(late).not.toHaveBeenCalled(); off();
    expect(() => source.resolve(originalRef)).toThrow("closed variant combo");
  } finally { stop(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
