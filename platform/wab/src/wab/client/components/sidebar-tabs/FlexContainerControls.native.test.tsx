import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ContentLayoutContainerControls } from "@/wab/client/components/sidebar-tabs/ContentLayoutControls";
import { FlexContainerControls } from "@/wab/client/components/sidebar-tabs/FlexContainerControls";
import { SingleRsExpsProvider, StyleComponent, StyleComponentContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Flex", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), base = ensure(tryGetBaseVariantSetting(root), "Actual Flex base setting");
  const propsExp = new RuleSetHelpers(base.rs, "div");
  propsExp.set("display", "flex"); propsExp.set("flex-direction", "row"); propsExp.set("flex-wrap", "nowrap");
  propsExp.set("column-gap", "1px"); propsExp.set("row-gap", "2px");
  const contextRs = ensure(site.activeTheme, "Theme").defaultStyle.rs, contextExp = new RuleSetHelpers(contextRs, "div");
  contextExp.set("column-gap", "7px"); contextExp.set("row-gap", "9px");
  contextExp.set("justify-content", "center"); contextExp.set("align-items", "flex-start");
  contextExp.set("justify-items", "flex-end"); contextExp.set("align-content", "center");
  const frame = mkArenaFrame({ site, component, name: "Flex", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Flex", [frame]));
  const fixture = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Flex" });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const studio = fixture.studioCtx, view = ensure(studio.tryGetViewCtxForFrame(frame), "Flex view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const propsProvider = new TplExpsProvider(view, root);
  const contextProvider = new SingleRsExpsProvider(contextRs, contextExp, studio, [], { kind: "ruleSet", rs: contextRs, forTag: "div" });
  const styling = new StyleComponent({ expsProvider: contextProvider }), vsh = new VariantedStylesHelper(site);
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={fixture.appCtx}><StudioCtxContext.Provider value={studio}><StyleComponentContext.Provider value={styling}>{children}</StyleComponentContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  const panel = () => wrap(<FlexContainerControls expsProvider={propsProvider} vsh={vsh} renderMaybeCollapsibleRows={(rows) => rows.map((row, index) => row && <section key={index}>{row.content}</section>)} />);
  return { ...fixture, studio, site, root, base, frame, view, propsExp, contextRs, contextExp, propsProvider, contextProvider, wrap, panel };
}

it("keeps props-provider gap eligibility separate from context-provider values, native alignment indicators and original edit commands", async () => {
  const f = await setup(), mounted = render(f.panel());
  try {
    expect(screen.getByDisplayValue("7px")).toBeTruthy(); expect(screen.queryByDisplayValue("9px")).toBeNull();
    expect(within(screen.getByRole("button", { name: "Distribute horizontally" })).getByText("Center")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.contextExp.set("column-gap", "11px"); f.contextExp.set("justify-content", "flex-end"); }); });
    expect(screen.getByDisplayValue("11px")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Distribute horizontally" })).getByText("Right")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.propsExp.set("display", "block"); }); });
    expect(screen.queryByDisplayValue("11px")).toBeNull(); expect(screen.queryByDisplayValue("9px")).toBeNull();
    await act(async () => { await f.studio.changeUnsafe(() => { f.propsExp.set("display", "flex"); f.propsExp.set("flex-direction", "column"); }); });
    expect(screen.getByDisplayValue("9px")).toBeTruthy(); expect(screen.queryByDisplayValue("11px")).toBeNull();
    const gap = screen.getByDisplayValue("9px"); fireEvent.change(gap, { target: { value: "12px" } }); fireEvent.keyDown(gap, { key: "Enter" });
    await waitFor(() => expect(f.contextExp.getRaw("row-gap")).toBe("12px")); expect(f.propsExp.getRaw("row-gap")).toBe("2px");
    fireEvent.click(screen.getByRole("button", { name: "Distribute horizontally" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Right" }));
    await waitFor(() => expect(f.contextExp.getRaw("align-items")).toBe("flex-end"));
    expect(f.propsExp.getRaw("align-items")).toBeUndefined();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("updates the shared content-layout justify-items/align-content grid and retains old provider results across actual model replacement", async () => {
  const f = await setup(), content = () => f.wrap(<ContentLayoutContainerControls expsProvider={f.contextProvider} />), mounted = render(content());
  try {
    expect(within(screen.getByRole("button", { name: "Distribute horizontally" })).getByText("Right")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Distribute vertically" })).getByText("Center")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.contextExp.set("justify-items", "center"); f.contextExp.set("align-content", "flex-end"); }); });
    expect(within(screen.getByRole("button", { name: "Distribute horizontally" })).getByText("Center")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Distribute vertically" })).getByText("Bottom")).toBeTruthy();
    const release = mock<PkgVersionInfoMeta>({ id: "flex-world", pkgId: "flex-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "flex-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"); mounted.rerender(content());
    expect(fields.mock.calls.some(([model]) => model === f.root || model === f.contextRs)).toBe(false);
    expect(within(screen.getByRole("button", { name: "Distribute horizontally" })).getByText("Center")).toBeTruthy();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
