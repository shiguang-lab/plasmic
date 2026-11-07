import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock } from "vitest-mock-extended";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SingleRsExpsProvider, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { CONTENT_LAYOUT_STANDARD_WIDTH_PROP } from "@/wab/shared/core/style-props";
import { RSH, ThemeLayoutRuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { ThemeLayoutSettings, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { getBaseVariant } from "@/wab/shared/Variants";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { useStyleCell } from "@/wab/client/studio-ctx/style-inputs-react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Cell({ provider, name = "opacity" }: { provider: SingleRsExpsProvider | TplExpsProvider; name?: string }) {
  const cell = useStyleCell(provider, name);
  return <span data-testid="style-cell">{cell?.value}</span>;
}

async function setup() {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Native style", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), base = getBaseVariant(component);
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const variant = manager.createVariant(component, group, "Dark");
  const frame = mkArenaFrame({ site, component, name: "Style", width: 200, height: 100, left: 0, top: 0 });
  const arena = mkMixedArena("Style", [frame]); site.arenas.push(arena);
  const fixture = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Style" });
  const studio = fixture.studioCtx;
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component]);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Style view");
  vi.spyOn(view, "awaitSync").mockResolvedValue(undefined);
  await studio.changeUnsafe(() => {
    RSH(view.variantTplMgr().ensureBaseVariantSetting(root).rs, root).set("opacity", "0.2");
    RSH(view.variantTplMgr().ensureVariantSetting(root, [variant]).rs, root).set("opacity", "0.8");
  });
  return { ...fixture, studio, view, root, base, variant };
}

it("uses the actual native target producer and installs CSS cells before its first variant subscriber", async () => {
  const f = await setup();
  const provider = new TplExpsProvider(f.view, f.root);
  const mounted = render(<Cell provider={provider} />);
  const source = provider.getNativeStyleSource();
  if (source.kind !== "tpl") { throw new Error("Tpl provider source"); }
  const cells = source.inputs.get(source.source, ["opacity"]).projection.store;
  const read = vi.fn(() => expect(cells.getState()[0]?.value).toBe("0.8"));
  const stop = f.view.variantStore.subscribe(read);
  try {
    expect(screen.getByTestId("style-cell").textContent).toBe("0.2");
    await act(async () => { f.view.currentComponentStackFrame().setTargetVariants([f.variant]); });
    expect(read).toHaveBeenCalledOnce();
    expect(screen.getByTestId("style-cell").textContent).toBe("0.8");
    await act(async () => { await f.studio.changeUnsafe(() => RSH(f.view.variantTplMgr().ensureVariantSetting(f.root, [f.variant]).rs, f.root).set("opacity", "0.9")); });
    expect(screen.getByTestId("style-cell").textContent).toBe("0.9");
  } finally { stop(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("does not register abandoned render candidates and releases committed fields on unmount and owner disposal", async () => {
  const f = await setup();
  const provider = new TplExpsProvider(f.view, f.root);
  const subscribe = f.studio.modelSnapshots.subscribePreparedField.bind(f.studio.modelSnapshots);
  let activeFields = 0;
  vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField").mockImplementation((field, callback) => {
    const stop = subscribe(field, callback); activeFields++;
    let stopped = false;
    return () => { if (!stopped) { stopped = true; activeFields--; stop(); } };
  });
  const pending = new Promise<void>(() => undefined);
  function Abandoned(): React.ReactNode { useStyleCell(provider, "opacity"); throw pending; }
  try {
    const abandoned = render(<React.Suspense fallback={<span>Pending</span>}><Abandoned /></React.Suspense>);
    expect(activeFields).toBe(0);
    expect(f.view.styleInputs["entries"].size).toBe(0);
    abandoned.unmount();
    const committed = render(<React.StrictMode><Cell provider={provider} /></React.StrictMode>);
    expect(activeFields).toBeGreaterThan(0);
    expect(f.view.styleInputs["entries"].size).toBe(1);
    committed.unmount();
    expect(activeFields).toBe(0);
    expect(f.view.styleInputs["entries"].size).toBe(0);
    const retained = render(<Cell provider={provider} />);
    const terminal = screen.getByTestId("style-cell").textContent;
    await act(async () => { f.view.dispose(); });
    expect(activeFields).toBe(0);
    const field = vi.spyOn(f.studio.modelSnapshots, "field"); field.mockClear();
    retained.rerender(<Cell provider={provider} />);
    expect(screen.getByTestId("style-cell").textContent).toBe(terminal);
    expect(field).not.toHaveBeenCalled();
    retained.unmount();
  } finally { f.studio.dispose(); }
});

it("materializes the actual layout command on its first edit and restores defaults through real Studio undo/redo", async () => {
  const site = createSite(), theme = ensure(site.activeTheme, "Active theme"); theme.layout = undefined;
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio["clearUndoLog"](); studio.createViewStateUndoRecord();
  const layout = new ThemeLayoutSettings({ rs: mkRuleSet({ values: {} }) });
  const exp = new ThemeLayoutRuleSetHelpers(layout, theme);
  const provider = new SingleRsExpsProvider(layout.rs, exp, studio, [], { kind: "themeLayout", theme, layout });
  const beforeCounter = studio._changeCounter;
  const mounted = render(<Cell provider={provider} name={CONTENT_LAYOUT_STANDARD_WIDTH_PROP} />);
  try {
    expect(theme.layout).toBeUndefined(); expect(studio._changeCounter).toBe(beforeCounter);
    expect(screen.getByTestId("style-cell").textContent).toBe("800px");
    await act(async () => { await studio.changeUnsafe(() => provider.targetExp().set(CONTENT_LAYOUT_STANDARD_WIDTH_PROP, "923px")); });
    expect(theme.layout).toBe(layout);
    expect(screen.getByTestId("style-cell").textContent).toBe("923px");
    await act(async () => { await studio.undo(); });
    expect(theme.layout).toBeUndefined();
    expect(screen.getByTestId("style-cell").textContent).toBe("800px");
    await act(async () => { await studio.redo(); });
    expect(screen.getByTestId("style-cell").textContent).toBe("923px");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});


it("keeps an old SingleRs provider bound to its closed owner across actual Studio loadVersion", async () => {
  const site = createSite(), theme = ensure(site.activeTheme, "Active theme");
  new RuleSetHelpers(theme.defaultStyle.rs, "div").set("opacity", "0.6");
  const { studioCtx: studio, api } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const rs = theme.defaultStyle.rs;
  const provider = new SingleRsExpsProvider(rs, new RuleSetHelpers(rs, "div"), studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const oldOwner = studio.singleRsStyleInputs, oldModels = studio.modelSnapshots;
  const mounted = render(<Cell provider={provider} />);
  const bundle = studio.bundleSite().site;
  const release = mock<PkgVersionInfoMeta>({ id: "style-world", pkgId: "style-pkg", version: "1.0.0", branchId: null });
  api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "style-world-etag" });
  try {
    expect(screen.getByTestId("style-cell").textContent).toBe("0.6");
    await act(async () => { await studio["loadVersion"](release, true); });
    expect(studio.modelSnapshots).not.toBe(oldModels);
    expect(oldOwner.isDisposed).toBe(true);
    expect(studio.singleRsStyleInputs).not.toBe(oldOwner);
    const source = provider.getNativeStyleSource();
    expect(source.inputs).toBe(oldOwner);
    const get = vi.spyOn(studio.singleRsStyleInputs, "get");
    const declare = vi.spyOn(studio.modelSnapshots, "declaredField");
    const prepared = vi.spyOn(studio.modelSnapshots, "subscribePreparedField");
    mounted.rerender(<Cell provider={provider} />);
    expect(screen.getByTestId("style-cell").textContent).toBe("0.6");
    expect(get).not.toHaveBeenCalled(); expect(declare).not.toHaveBeenCalled(); expect(prepared).not.toHaveBeenCalled();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
