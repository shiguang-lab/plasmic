import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ColumnsPanelSection } from "@/wab/client/components/sidebar-tabs/columns-section";
import { ColumnsWrapControls } from "@/wab/client/components/sidebar-tabs/ResponsiveColumns/ColumnsWrapControls";
import { addNewColumn } from "@/wab/client/components/sidebar-tabs/ResponsiveColumns/tpl-columns-utils";
import { StyleComponent, StyleComponentContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ColumnsWrapInputs } from "@/wab/client/studio-ctx/columns-wrap-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureVariantSetting, mkVariant, tryGetBaseVariantSetting, tryGetVariantSetting } from "@/wab/shared/Variants";
import { equalColumnDistribution } from "@/wab/shared/columns-utils";
import { assert, ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { isTplColumns, mkTplTagX, TplTagType } from "@/wab/shared/core/tpls";
import { ColumnsConfig } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const columnNodes = Array.from({ length: 3 }, () => mkTplTagX("div", { type: TplTagType.Column }));
  const root = mkTplTagX("div", { type: TplTagType.Columns }, columnNodes);
  assert(isTplColumns(root), "Real responsive columns tag");
  const component = manager.addComponent({ name: "Columns", type: ComponentType.Plain, rootTpl: root });
  const base = ensure(tryGetBaseVariantSetting(root), "Columns base setting");
  base.columnsConfig = new ColumnsConfig({ breakUpRows: false, colsSizes: [4, 4, 4] });
  const config = base.columnsConfig;
  const exp = new RuleSetHelpers(base.rs, "div"); exp.set("display", "flex"); exp.set("flex-direction", "row"); exp.set("flex-wrap", "nowrap");
  for (const child of columnNodes) { new RuleSetHelpers(ensureVariantSetting(child, base.variants).rs, "div").set("display", "flex"); }
  const variant = mkVariant({ name: "Compact" }); component.variants.push(variant);
  const frame = mkArenaFrame({ site, component, name: "Columns", width: 600, height: 200 });
  site.arenas.push(mkMixedArena("Columns", [frame]));
  const fixture = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Columns" });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const studio = fixture.studioCtx, view = ensure(studio.tryGetViewCtxForFrame(frame), "Columns view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = new TplExpsProvider(view, root), styling = new StyleComponent({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={fixture.appCtx}><StudioCtxContext.Provider value={studio}><StyleComponentContext.Provider value={styling}>{children}</StyleComponentContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  const panel = (input = provider) => wrap(<StyleComponentContext.Provider value={new StyleComponent({ expsProvider: input })}><ColumnsPanelSection studioCtx={studio} tpl={root} expsProvider={input} /></StyleComponentContext.Provider>);
  return { ...fixture, site, studio, view, root, component, config, base, exp, variant, frame, provider, panel, wrap };
}

it("installs canonical config and child count together and derives the original equal fallback without model registration", async () => {
  const f = await setup(), source = new ColumnsWrapInputs(f.view, f.root, f.config), fallback = new ColumnsWrapInputs(f.view, f.root, undefined);
  const stop = source.subscribe(() => undefined), stopFallback = fallback.subscribe(() => undefined), before = source.getSnapshot();
  const reads: ReturnType<ColumnsWrapInputs["getSnapshot"]>[] = [];
  const stopField = f.studio.modelSnapshots.field(f.root, "children").subscribe(() => reads.push(source.getSnapshot()));
  const stopCommit = f.studio.subscribeModelChanges((event) => { if (event.type === "commit") { reads.push(source.getSnapshot()); } });
  try {
    await f.studio.changeUnsafe(() => {
      f.config.breakUpRows = true; f.config.colsSizes = [6, 6];
      addNewColumn(f.root, f.view);
      expect(source.getSnapshot()).toBe(before);
    });
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const read of reads) { expect(read).toEqual({ breakUpRows: true, colsSizes: [6, 6], childCount: 4 }); }
    expect(fallback.getSnapshot()).toEqual({ breakUpRows: false, colsSizes: equalColumnDistribution(4), childCount: 4 });
    const stable = source.getSnapshot(), changed = vi.fn(), off = source.subscribe(changed);
    await f.studio.changeUnsafe(() => { f.component.name = "Renamed columns"; });
    expect(source.getSnapshot()).toBe(stable); expect(changed).not.toHaveBeenCalled();
    await f.studio.changeUnsafe(() => { f.config.colsSizes = [6, 6]; });
    expect(source.getSnapshot()).toBe(stable); off();
    const foreign = new ColumnsConfig({ breakUpRows: true, colsSizes: [12] }), fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
    expect(() => new ColumnsWrapInputs(f.view, f.root, foreign)).toThrow("original selected VS object");
    expect(fields.mock.calls.some(([model]) => model === foreign)).toBe(false);
  } finally { stopCommit(); stopField(); stopFallback(); stop(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps actual wrapping and reverse commands on the current target variant instead of feeding cached UI rows back into models", async () => {
  const f = await setup(), mounted = render(f.panel());
  try {
    const wrapping = screen.getByRole("checkbox", { name: "Wrap?" });
    expect(wrapping).toHaveProperty("checked", false);
    fireEvent.click(wrapping);
    await waitFor(() => expect(f.config.breakUpRows).toBe(true));
    expect(f.config.colsSizes).toEqual([4, 4, 4]);
    const perRow = ensure(screen.getAllByDisplayValue("3").at(-1), "Original columns-per-row input");
    fireEvent.change(perRow, { target: { value: "2" } }); fireEvent.blur(perRow);
    await waitFor(() => expect(f.config.colsSizes).toEqual([6, 6]));
    await act(async () => { await f.studio.changeUnsafe(() => { f.view.currentComponentStackFrame().setTargetVariants([f.variant]); }); });
    mounted.rerender(f.panel(new TplExpsProvider(f.view, f.root)));
    fireEvent.click(screen.getByRole("checkbox", { name: "Wrap?" }));
    const activeConfig = () => ensure(tryGetVariantSetting(f.root, [f.variant])?.columnsConfig, "Original target config");
    await waitFor(() => expect(activeConfig().breakUpRows).toBe(false));
    expect(f.config.breakUpRows).toBe(true); expect(f.config.colsSizes).toEqual([6, 6]);
    expect(activeConfig().colsSizes).toEqual([4, 4, 4]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Reverse?" }));
    await waitFor(() => expect(new RuleSetHelpers(ensure(tryGetVariantSetting(f.root, [f.variant]), "Current target VS").rs, "div").getRaw("flex-direction")).toBe("row-reverse"));
    expect(f.exp.getRaw("flex-direction")).toBe("row");
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps abandoned renders lease-free and a captured config safe after a real model world replacement", async () => {
  const f = await setup(), prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField");
  const source = new ColumnsWrapInputs(f.view, f.root, f.config), old = source.getSnapshot();
  const pending = new Promise<void>(() => undefined);
  function Suspend(): React.ReactNode { throw pending; }
  const abandoned = render(f.wrap(<React.Suspense fallback={<span>Pending columns</span>}><ColumnsWrapControls viewCtx={f.view} tpl={f.root} config={f.config} expsProvider={f.provider} /><Suspend /></React.Suspense>));
  expect(prepared).not.toHaveBeenCalled(); abandoned.unmount();
  const stop = source.subscribe(() => undefined); expect(prepared).toHaveBeenCalled();
  const mounted = render(f.wrap(<ColumnsWrapControls viewCtx={f.view} tpl={f.root} config={f.config} expsProvider={f.provider} />));
  try {
    const release = mock<PkgVersionInfoMeta>({ id: "columns-world", pkgId: "columns-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "columns-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"), changed = vi.fn();
    expect(source.getSnapshot()).toBe(old); const late = source.subscribe(changed);
    mounted.rerender(f.wrap(<ColumnsWrapControls viewCtx={f.view} tpl={f.root} config={f.config} expsProvider={f.provider} />));
    expect(fields.mock.calls.some(([model]) => model === f.root || model === f.config)).toBe(false);
    expect(changed).not.toHaveBeenCalled(); late();
  } finally { stop(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
