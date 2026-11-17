import { AppContext } from "@/wab/client/components/top-view";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { BorderPanelSection, BorderRadiusSection } from "@/wab/client/components/style-controls/BorderControls";
import indicatorStyles from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
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
import Chroma from "@/wab/shared/utils/color-utils";
import { standardCorners, standardSides } from "@/wab/shared/geom";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

beforeEach(() => vi.stubGlobal("IntersectionObserver", class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
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
  await waitFor(() => expect(studio.isSelectionPending).toBe(false));
  const provider = tpl ? new TplExpsProvider(view, root) : new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const styling = new StyleTarget({ expsProvider: provider }), vsh = new VariantedStylesHelper(site);
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}>{children}</StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider></AppCtxContext.Provider>;
  const panel = () => wrap(<><BorderPanelSection expsProvider={provider} vsh={vsh} /><BorderRadiusSection expsProvider={provider} vsh={vsh} /></>);
  return { ...f, studio, site, manager, component, root, frame, view, exp, provider, wrap, vsh, panel };
}

function strokeRow(sides: string) {
  return ensure(document.querySelector<HTMLElement>(`[data-stroke-sides="${sides}"]`), "Stroke row");
}
function openSettings(row: HTMLElement) {
  fireEvent.click(ensure(row.querySelector('[data-test-id="stroke-settings"]'), "Settings trigger"));
}

it("groups matching sides and edits only the owning sides with shared color and width controls", async () => {
  const f = await setup(), mounted = render(f.panel());
  try {
    expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(1);
    const stroke = ensure(screen.getByText("Stroke").closest(".SidebarSection__Container"), "Stroke section");
    expect(stroke.querySelectorAll(`.${indicatorStyles["DefinedIndicator--set"]}`)).toHaveLength(1);
    await act(async () => { await f.studio.changeUnsafe(() => { f.exp.set("border-top-width", "5px"); f.exp.set("border-top-left-radius", "9px"); }); });
    expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(2);
    const row = strokeRow("top"), width = ensure(row.querySelector<HTMLInputElement>('[data-test-id="stroke-width"]'), "Width input");
    fireEvent.change(width, { target: { value: "8px" } }); fireEvent.keyDown(width, { key: "Enter" });
    await waitFor(() => expect(f.exp.get("border-top-width")).toBe("8px"));
    expect(f.exp.get("border-right-width")).toBe("1px");
    const color = within(row).getByRole("button", { name: "Stroke color" });
    fireEvent.click(color);
    const picker = await screen.findByRole("dialog", { name: "Stroke color" });
    const hex = ensure(picker.querySelector('[data-test-id="Color-input"]'), "Color input");
    fireEvent.change(hex, { target: { value: "263a70" } }); fireEvent.blur(hex);
    await waitFor(() => expect(f.exp.get("border-top-color").toLowerCase()).toBe("#263a70"));
    expect(f.exp.get("border-right-color")).toBe("#123456");
    fireEvent.keyDown(picker, { key: "Escape" });
    await waitFor(() => expect(color.getAttribute("aria-expanded")).toBe("false"));
    openSettings(strokeRow("top"));
    expect(await screen.findByRole("button", { name: "Right border" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Dashed" }));
    await waitFor(() => expect(f.exp.get("border-top-style")).toBe("dashed"));
    expect(f.exp.get("border-right-style")).toBe("solid");
    fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
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
    expect(document.querySelector('[data-test-id="stroke-settings"]')).toBeNull(); expect(active).toBeGreaterThan(0);
    await act(async () => { await f.studio.changeUnsafe(() => { f.root.tag = "input"; }); });
    expect(document.querySelector('[data-test-id="stroke-settings"]')).toBeTruthy();
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

it("distinguishes inherited stroke from none and restores the base stroke without changing it", async () => {
  const f = await setup(true);
  await f.studio.changeUnsafe(() => {
    const exp = f.provider.targetExp();
    standardSides.forEach((side) => {
      exp.set(`border-${side}-style`, "solid");
      exp.set(`border-${side}-width`, "3px");
    });
  });
  const readBase = () => standardSides.map((side) => [
    f.provider.targetExp().getRaw(`border-${side}-style`),
    f.provider.targetExp().getRaw(`border-${side}-width`),
  ]);
  const base = readBase();
  const [variant] = await f.studio.changeUnsafe(() => f.manager.createStyleVariant(f.component, [":hover"]));
  await act(async () => { await f.studio.changeUnsafe(() => {
    f.view.currentComponentStackFrame().setTargetVariants([variant]);
  }); });
  await waitFor(() => expect(f.studio.isSelectionPending).toBe(false));
  const provider = new TplExpsProvider(f.view, f.root);
  expect(provider.canEdit()).toBe(true);
  const mounted = render(f.wrap(<BorderPanelSection expsProvider={provider} vsh={f.vsh} />));
  try {
    expect(screen.queryByRole("button", { name: "Stroke: Default" })).toBeNull();
    openSettings(strokeRow("top right bottom left"));
    fireEvent.click(await screen.findByRole("button", { name: "None" }));
    await waitFor(() => expect(strokeRow("top right bottom left").textContent).toBe("None"));
    expect(screen.queryByRole("button", { name: "Stroke color" })).toBeNull();
    expect(document.querySelector('[data-test-id="stroke-width"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Add stroke" })).toHaveProperty("disabled", true);
    standardSides.forEach((side) => expect(provider.targetExp().getRaw(`border-${side}-style`)).toBe("none"));
    fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Remove stroke" }));
    await screen.findByRole("button", { name: "Stroke color" });
    expect(screen.getByDisplayValue("3px")).toBeTruthy();
    standardSides.forEach((side) => expect(provider.maybeTargetExp()?.has(`border-${side}-style`) ?? false).toBe(false));
    await act(async () => { await f.studio.changeUnsafe(() => f.view.currentComponentStackFrame().setTargetVariants([])); });
    expect(readBase()).toEqual(base);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("adds free sides, prevents overlap, supports all directions and releases removed sides", async () => {
  const f = await setup(true), mounted = render(f.panel());
  try {
    fireEvent.click(screen.getByRole("button", { name: "Add stroke" }));
    await screen.findByRole("button", { name: "Stroke color" });
    expect(f.provider.targetExp().get("border-top-style")).toBe("solid");
    expect(f.provider.targetExp().has("border-right-style")).toBe(false);
    openSettings(strokeRow("top"));
    fireEvent.click(await screen.findByRole("button", { name: "All borders" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add stroke" })).toHaveProperty("disabled", true));
    for (const side of standardSides) {
      expect(f.provider.targetExp().get(`border-${side}-width`)).toBe("1px");
      expect(f.provider.targetExp().get(`border-${side}-style`)).toBe("solid");
    }
    fireEvent.click(screen.getByRole("button", { name: "Top border" }));
    await waitFor(() => expect(f.provider.targetExp().has("border-top-style")).toBe(false));
    fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Add stroke" }));
    await waitFor(() => expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(2));
    openSettings(strokeRow("top"));
    expect(await screen.findByRole("button", { name: "Right border" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "All borders" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Right border" }));
    expect(strokeRow("top")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
    const topItem = ensure(strokeRow("top").closest<HTMLElement>(".list-box-item"), "List item");
    fireEvent.click(within(topItem).getByRole("button", { name: "Remove stroke" }));
    await waitFor(() => expect(f.provider.targetExp().has("border-top-style")).toBe(false));
    expect(f.provider.targetExp().get("border-right-style")).toBe("solid");
    expect(screen.getByRole("button", { name: "Add stroke" })).toHaveProperty("disabled", false);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("undoes row removal with the original color alpha and line style", async () => {
  const f = await setup(true);
  await f.studio.changeUnsafe(() => {
    const exp = f.provider.targetExp();
    exp.set("border-top-width", "4px"); exp.set("border-top-style", "dashed"); exp.set("border-top-color", "#ff000033");
  });
  f.studio.createViewStateUndoRecord();
  const mounted = render(f.panel());
  try {
    fireEvent.click(screen.getByRole("button", { name: "Remove stroke" }));
    await waitFor(() => expect(document.querySelector('[data-test-id="stroke-row"]')).toBeNull());
    await act(async () => { await f.studio.undo(); });
    await screen.findByRole("button", { name: "Stroke color" });
    expect(f.provider.targetExp().get("border-top-style")).toBe("dashed");
    expect(f.provider.targetExp().get("border-top-width")).toBe("4px");
    expect(Chroma(f.provider.targetExp().get("border-top-color")).alpha()).toBeCloseTo(0.2);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps token references when assigning another side and updates the combined color preview", async () => {
  const f = await setup(true);
  const color = mkStyleToken({ name: "Border accent", type: "Color", value: "#8844cc" });
  const width = mkStyleToken({ name: "Border width", type: "Spacing", value: "2px" });
  await f.studio.changeUnsafe(() => {
    f.site.styleTokens.push(color, width);
    const exp = f.provider.targetExp();
    exp.set("border-top-color", mkTokenRef(color));
    exp.set("border-top-width", mkTokenRef(width));
    exp.set("border-top-style", "solid");
  });
  const mounted = render(f.panel());
  try {
    const previewColor = () => strokeRow("top").querySelector<HTMLElement>('[data-test-id="stroke-settings"] span > span')?.style.color;
    await waitFor(() => expect(previewColor()).toBe("rgb(136, 68, 204)"));
    await act(async () => { await f.studio.changeUnsafe(() => { color.value = "#ff8800"; }); });
    await waitFor(() => expect(previewColor()).toBe("rgb(255, 136, 0)"));
    openSettings(strokeRow("top"));
    fireEvent.click(await screen.findByRole("button", { name: "Right border" }));
    await waitFor(() => expect(f.provider.targetExp().getRaw("border-right-color")).toBe(mkTokenRef(color)));
    expect(f.provider.targetExp().getRaw("border-right-width")).toBe(mkTokenRef(width));
    fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
    const input = ensure(strokeRow("top right").querySelector<HTMLInputElement>('[data-test-id="stroke-width"]'), "Width input");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "thin" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Border width" })).toBeTruthy();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps None scoped to its directions and removes it directly", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => f.exp.set("border-top-width", "5px"));
  const mounted = render(f.panel());
  try {
    openSettings(strokeRow("top"));
    fireEvent.click(await screen.findByRole("button", { name: "None" }));
    await waitFor(() => expect(strokeRow("top").textContent).toBe("None"));
    expect(strokeRow("top").querySelector('[data-test-id="stroke-width"]')).toBeNull();
    expect(within(strokeRow("top")).queryByRole("button", { name: "Stroke color" })).toBeNull();
    expect(f.exp.has("border-top-width")).toBe(false);
    expect(f.exp.has("border-top-color")).toBe(false);
    for (const side of ["right", "bottom", "left"]) {
      expect(f.exp.get(`border-${side}-style`)).toBe("solid");
      expect(f.exp.get(`border-${side}-color`)).toBe("#123456");
      expect(f.exp.get(`border-${side}-width`)).toBe("1px");
    }
    expect(f.exp.get("border-top-left-radius")).toBe("4px");
    expect(screen.getByRole("button", { name: "Right border" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Dashed" }));
    await waitFor(() => expect(f.exp.get("border-top-style")).toBe("dashed"));
    expect(within(strokeRow("top")).getByRole("button", { name: "Stroke color" })).toBeTruthy();
    expect(f.exp.get("border-top-width")).toBe("1px");
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    await waitFor(() => expect(f.exp.get("border-top-style")).toBe("none"));
    fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Add stroke" })).toHaveProperty("disabled", true);
    expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(2);
    const item = ensure(strokeRow("top").closest<HTMLElement>(".list-box-item"), "None item");
    fireEvent.click(within(item).getByRole("button", { name: "Remove stroke" }));
    await waitFor(() => expect(f.exp.has("border-top-style")).toBe(false));
    expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(1);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("shows a persisted all-sides None as one row and edits it through line style", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => {
    standardSides.forEach((side) => f.exp.set(`border-${side}-style`, "none"));
  });
  const mounted = render(f.panel());
  try {
    expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(1);
    expect(strokeRow("top right bottom left").textContent).toBe("None");
    expect(screen.queryByRole("button", { name: "Stroke color" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add stroke" })).toHaveProperty("disabled", true);
    openSettings(strokeRow("top right bottom left"));
    fireEvent.click(await screen.findByRole("button", { name: "Solid line" }));
    await screen.findByRole("button", { name: "Stroke color" });
    for (const side of standardSides) {
      expect(f.exp.get(`border-${side}-style`)).toBe("solid");
      expect(f.exp.get(`border-${side}-width`)).toBe("1px");
    }
    expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(1);
    expect(f.exp.get("border-top-left-radius")).toBe("4px");
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("adds independent sides without replacing None on any other side", async () => {
  const f = await setup(true), mounted = render(f.panel());
  try {
    for (const [index, side] of standardSides.entries()) {
      fireEvent.click(screen.getByRole("button", { name: "Add stroke" }));
      await waitFor(() => expect(f.provider.targetExp().getRaw(`border-${side}-style`)).toBe("solid"));
      for (const previous of standardSides.slice(0, index)) {
        expect(f.provider.targetExp().getRaw(`border-${previous}-style`)).toBe("none");
      }
      openSettings(strokeRow(side));
      fireEvent.click(within(await screen.findByRole("group", { name: "Stroke settings" })).getByRole("button", { name: "None" }));
      await waitFor(() => expect(strokeRow(side).textContent).toBe("None"));
      fireEvent.keyDown(screen.getByRole("group", { name: "Stroke settings" }), { key: "Escape" });
      expect(document.querySelectorAll('[data-test-id="stroke-row"]')).toHaveLength(index + 1);
      expect(screen.getByRole("button", { name: "Add stroke" })).toHaveProperty("disabled", index === 3);
    }
    openSettings(strokeRow("right"));
    fireEvent.click(await screen.findByRole("button", { name: "Dashed" }));
    await waitFor(() => expect(f.provider.targetExp().getRaw("border-right-style")).toBe("dashed"));
    for (const side of ["top", "bottom", "left"]) {
      expect(f.provider.targetExp().getRaw(`border-${side}-style`)).toBe("none");
    }
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
