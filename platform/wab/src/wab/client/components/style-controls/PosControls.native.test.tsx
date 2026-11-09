import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PosControls2 } from "@/wab/client/components/style-controls/PosControls";
import { BackgroundSection } from "@/wab/client/components/sidebar-tabs/background-section";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext, type ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { AppContext } from "@/wab/client/components/top-view";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset, mkImageAssetRef } from "@/wab/shared/core/image-assets";
import { createSite } from "@/wab/shared/core/sites";
import { parseBgPos, parseCss } from "@/wab/shared/css";
import { isDraggableSize } from "@/wab/shared/css-size";
import { standardSides } from "@/wab/shared/geom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import $ from "jquery";
import React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
const doms = new Set<HTMLElement>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } }));
afterEach(async () => { cleanup(); doms.forEach((element) => element.remove()); doms.clear(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup() {
  const site = createSite(), end = mkStyleToken({ name: "Position end", type: "Spacing", value: "8px" }), head = mkStyleToken({ name: "Position token", type: "Spacing", value: mkTokenRef(end) });
  site.styleTokens.push(head, end);
  const image = mkImageAsset({ name: "Position picture", type: ImageAssetType.Picture, dataUri: "position.png" }); site.imageAssets.push(image);
  const rs = ensure(site.activeTheme, "Position theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  standardSides.forEach((side) => exp.set(side, "auto")); exp.set("width", "100px"); exp.set("height", "100px");
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  f.studioCtx.createViewStateUndoRecord();
  const studio = f.studioCtx, provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" }), sc = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppContext.Provider value={studio.app}><AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}><SidebarModalProvider containerSelector="#position-test-sidebar"><div id="position-test-sidebar" />{children}</SidebarModalProvider></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>;
  return { ...f, studio, site, head, image, exp, provider, wrap };
}
function trigger(side: string) { return ensure(document.querySelector<HTMLButtonElement>(`[data-plasmic-pos-trigger="${side}"]`), "Original position trigger"); }

it("renders native head-only token metadata and CSS values while retaining the original drag rules", async () => {
  const f = await setup(); await f.studio.changeUnsafe(() => f.exp.set("left", mkTokenRef(f.head)));
  const mounted = render(f.wrap(<PosControls2 expsProvider={f.provider} />));
  expect(screen.getByText("Position token")).toBeTruthy();
  expect(!!trigger("left").querySelector(".ew-resize")).toBe(isDraggableSize(f.head.value));
  await act(async () => { await f.studio.changeUnsafe(() => { f.head.name = "Renamed position"; f.head.value = "18px"; f.exp.set("right", "21px"); }); });
  expect(screen.getByText("Renamed position")).toBeTruthy(); expect(trigger("right").textContent).toBe("21px");
  expect(!!trigger("left").querySelector(".ew-resize")).toBe(true);
  mounted.unmount();
});

it("samples the current DOM at mouse start, retains that start during real drag and undoes the original transaction", async () => {
  const f = await setup();
  const before = document.createElement("div"), current = document.createElement("div");
  document.body.append(before, current); doms.add(before); doms.add(current);
  for (const [element, top] of [[before, 10], [current, 40]] as const) {
    vi.spyOn(element, "offsetWidth", "get").mockReturnValue(100);
    vi.spyOn(element, "offsetHeight", "get").mockReturnValue(50);
    vi.spyOn(element, "offsetTop", "get").mockReturnValue(top);
    vi.spyOn(element, "offsetLeft", "get").mockReturnValue(0);
  }
  let actualDom = before;
  const provider: ExpsProvider = f.provider;
  const forDom = vi.spyOn(provider, "forDom").mockImplementation(() => $(actualDom));
  const mounted = render(f.wrap(<PosControls2 expsProvider={f.provider} />));
  expect(forDom).not.toHaveBeenCalled();
  actualDom = current;
  const target = ensure(trigger("top").querySelector(".ns-resize"), "Top drag target");
  fireEvent.mouseDown(target, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { buttons: 1, clientX: 0, clientY: 5 });
  await waitFor(() => expect(f.exp.get("top")).toBe("40px"));
  // The current target changes after the original start was captured. Drag
  // deltas must still use initValRef's 40px, rather than remeasure at 10px.
  actualDom = before;
  fireEvent.mouseMove(document, { buttons: 1, clientX: 0, clientY: 10 });
  await waitFor(() => expect(f.exp.get("top")).toBe("50px"));
  fireEvent.mouseUp(document, { button: 0, clientX: 0, clientY: 10 });
  expect(f.studio.saveState.store.getState().isUnlogged).toBe(false);
  expect(f.studio.canUndo()).toBe(true);
  await act(async () => { await f.studio.undo(); });
  expect(f.exp.get("top")).toBe("auto");
  mounted.unmount();
});

it("keeps the real background panel's plain position adapter and its original model writes", async () => {
  const f = await setup(), helper = new VariantedStylesHelper(f.site);
  await f.studio.changeUnsafe(() => f.exp.set("background", `${mkImageAssetRef(f.image)} 20px 30px`));
  const mounted = render(f.wrap(<BackgroundSection expsProvider={f.provider} vsh={helper} />));
  fireEvent.click(screen.getByText("Position picture"));
  await waitFor(() => expect(trigger("left").textContent).toBe("20px"));
  fireEvent.click(trigger("left"));
  const dialog = await screen.findByRole("dialog", { name: "Left" });
  const input = ensure(dialog.querySelector<HTMLInputElement>('input[data-test-id="Spacing-input"]'), "Actual dimension input");
  fireEvent.change(input, { target: { value: "35px" } }); fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => {
    const layer = parseCss(f.exp.get("background"), { startRule: "background" }).layers[0];
    expect(parseBgPos(ensure(layer.position, "Updated background position")).left).toBe("35px");
  });
  expect(f.exp.get("left")).toBe("auto"); expect(f.exp.get("width")).toBe("100px");
  mounted.unmount();
});

it("releases an actual open position dialog before model replacement and binds a fresh provider", async () => {
  const f = await setup(); await f.studio.changeUnsafe(() => f.exp.set("left", "10px"));
  const content = () => f.wrap(<PosControls2 expsProvider={f.provider} />), mounted = render(content());
  fireEvent.click(trigger("left"));
  expect(await screen.findByRole("dialog", { name: "Left" })).toBeTruthy();
  const release = mock<PkgVersionInfoMeta>({ id: "position-world", pkgId: "position-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "position-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(screen.queryByRole("dialog", { name: "Left" })).toBeNull();
  const declared = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  mounted.rerender(content()); expect(declared).not.toHaveBeenCalled();
  const rs = ensure(f.studio.site.activeTheme, "Next position theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  const provider = new SingleRsExpsProvider(rs, exp, f.studio, [], { kind: "ruleSet", rs, forTag: "div" });
  mounted.rerender(f.wrap(<StyleTargetContext.Provider value={new StyleTarget({ expsProvider: provider })}><PosControls2 expsProvider={provider} /></StyleTargetContext.Provider>));
  expect(trigger("left").textContent).toBe("10px");
  expect(declared.mock.calls.some(([model]) => model === f.head || model === f.image)).toBe(false);
  mounted.unmount();
});
