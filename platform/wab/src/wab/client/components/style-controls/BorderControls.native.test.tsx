import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { BorderPanelSection, BorderRadiusSection } from "@/wab/client/components/style-controls/BorderControls";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { standardCorners, standardSides } from "@/wab/shared/geom";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup(tpl = false) {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Border", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree);
  const frame = mkArenaFrame({ site, component, name: "Border", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Borders", [frame]));
  const rs = ensure(site.activeTheme, "Theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  if (!tpl) {
    standardSides.forEach((side) => { exp.set(`border-${side}-width`, "1px"); exp.set(`border-${side}-style`, "solid"); exp.set(`border-${side}-color`, "#123456"); });
    standardCorners.forEach((corner) => exp.set(`border-${corner}-radius`, "4px"));
  }
  const f = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Borders" });
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, view = ensure(studio.tryGetViewCtxForFrame(frame), "Border view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = tpl ? new TplExpsProvider(view, root) : new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const styling = new StyleTarget({ expsProvider: provider }), vsh = new VariantedStylesHelper(site);
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}>{children}</StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider></AppCtxContext.Provider>;
  const panel = () => wrap(<><BorderPanelSection expsProvider={provider} vsh={vsh} /><BorderRadiusSection expsProvider={provider} vsh={vsh} /></>);
  return { ...f, studio, site, manager, component, root, frame, view, exp, provider, wrap, vsh, panel };
}

it("renders native side/corner values and preserves the original selected-side and radius edit commands", async () => {
  const f = await setup(), mounted = render(f.panel());
  try {
    expect(screen.getByDisplayValue("1px")).toBeTruthy(); expect(screen.getByDisplayValue("4px")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.exp.set("border-top-width", "5px"); f.exp.set("border-top-left-radius", "9px"); }); });
    fireEvent.click(screen.getByRole("button", { name: "Top border" }));
    const width = screen.getByDisplayValue("5px");
    fireEvent.change(width, { target: { value: "8px" } }); fireEvent.keyDown(width, { key: "Enter" });
    await waitFor(() => expect(f.exp.get("border-top-width")).toBe("8px"));
    expect(f.exp.get("border-right-width")).toBe("1px");
    fireEvent.click(screen.getByRole("button", { name: "Right border" }));
    expect(screen.getByDisplayValue("1px")).toBeTruthy(); expect(f.exp.get("border-top-width")).toBe("8px");
    fireEvent.click(screen.getByRole("button", { name: "Top-left corner" }));
    const radius = screen.getByDisplayValue("9px");
    fireEvent.change(radius, { target: { value: "12px" } }); fireEvent.keyDown(radius, { key: "Enter" });
    await waitFor(() => expect(f.exp.get("border-top-left-radius")).toBe("12px"));
    expect(f.exp.get("border-top-right-radius")).toBe("4px");
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("leases the captured tag only at commit, updates native default borders and disconnects on real View/world exit", async () => {
  const f = await setup(true), tag = f.studio.modelSnapshots.field(f.root, "tag"), originalSubscribe = tag.subscribe;
  let active = 0;
  vi.spyOn(tag, "subscribe").mockImplementation((listener) => {
    active++; const stop = originalSubscribe(listener); let stopped = false;
    return () => { if (!stopped) { stopped = true; active--; stop(); } };
  });
  const pending = new Promise<void>(() => undefined);
  function Suspended(): React.ReactNode { throw pending; }
  const abandoned = render(f.wrap(<React.Suspense fallback={<span>Pending borders</span>}><BorderPanelSection expsProvider={f.provider} vsh={f.vsh} /><Suspended /></React.Suspense>));
  expect(active).toBe(0); abandoned.unmount();
  const mounted = render(f.panel());
  try {
    expect(screen.queryByRole("button", { name: "Top border" })).toBeNull(); expect(active).toBeGreaterThan(0);
    await act(async () => { await f.studio.changeUnsafe(() => { f.root.tag = "input"; }); });
    expect(screen.getByRole("button", { name: "Top border" })).toBeTruthy();
    await act(async () => { f.studio.disposeViewCtx(f.view); }); expect(active).toBe(0);
    await act(async () => { await f.studio.changeUnsafe(() => { f.root.tag = "div"; }); });
    mounted.rerender(f.panel()); expect(active).toBe(0);
    const release = mock<PkgVersionInfoMeta>({ id: "border-world", pkgId: "border-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "border-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
    mounted.rerender(f.panel()); expect(fields.mock.calls.some(([model]) => model === f.root)).toBe(false); expect(active).toBe(0);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

class Boundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <output data-testid="border-error">{this.state.error.message}</output> : this.props.children; }
}
it("preserves the original provider rejection of a foreign tag before creating its model fields", async () => {
  const f = await setup(true), foreignSite = createSite();
  const foreign = new TplMgr({ site: foreignSite }).addComponent({ name: "Foreign border", type: ComponentType.Plain });
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"); vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Foreign() { const provider = React.useMemo(() => new TplExpsProvider(f.view, foreign.tplTree), []); return <BorderPanelSection expsProvider={provider} vsh={f.vsh} />; }
  const mounted = render(f.wrap(<Boundary><Foreign /></Boundary>));
  try {
    // The real provider refuses this foreign component before the tag reader
    // is constructed; preserve that original admission invariant.
    expect(screen.getByTestId("border-error").textContent).toContain("getComponentFrame did not return a valid frame");
    expect(fields.mock.calls.some(([model]) => model === foreign.tplTree)).toBe(false);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
