import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import * as imageAssetControls from "@/wab/client/components/sidebar/image-asset-controls";
import { BackgroundSection } from "@/wab/client/components/sidebar-tabs/background-section";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { useBackgroundInputs } from "@/wab/client/studio-ctx/background-inputs";
import { createImageAssetListInputs } from "@/wab/client/studio-ctx/image-asset-inputs";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { TplMgr } from "@/wab/shared/TplMgr";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset, mkImageAssetRef } from "@/wab/shared/core/image-assets";
import { createSite } from "@/wab/shared/core/sites";
import { parseCss } from "@/wab/shared/css";
import { ImageAsset, StyleToken } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.removeProperty("--background-native-color"); });
async function setup(nonbase = false) {
  const site = createSite();
  const first = mkImageAsset({ name: "First image", type: ImageAssetType.Picture, dataUri: "first.png" });
  const other = mkImageAsset({ name: "Other image", type: ImageAssetType.Picture, dataUri: "other.png" });
  const end = new StyleToken({ uuid: "background-native-registered", name: "End", type: "Color", value: "var(--background-native-color)", variantedValues: [], isRegistered: true, regKey: "background-native-color" });
  const head = mkStyleToken({ name: "Paint token", type: "Color", value: mkTokenRef(end) });
  site.imageAssets.push(first, other); site.styleTokens.push(head, end);
  const rs = ensure(site.activeTheme, "Theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  exp.set("background", `${mkImageAssetRef(first)}, linear-gradient(${mkTokenRef(head)}, ${mkTokenRef(head)})`);
  const manager = new TplMgr({ site });
  const group = nonbase ? manager.createGlobalVariantGroup("Background mode") : undefined;
  const active = group ? manager.createGlobalVariant(group, "Dark") : undefined;
  const fixture = fakeStudioCtx({ site });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const studio = fixture.studioCtx, helper = new VariantedStylesHelper(site, active ? [active] : undefined);
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const sc = new StyleTarget({ expsProvider: provider });
  function Probe() {
    const [cell] = useStyleCells(provider, ["background"]);
    const bg = parseCss(cell?.raw ?? "", { startRule: "background" });
    const input = useBackgroundInputs(studio, bg.layers, helper);
    return <output data-testid="background-projection" data-css={JSON.stringify(input.thumbnails)}>{input.labels.join(" | ")}</output>;
  }
  const wrap = (content: React.ReactNode) => <AppContext.Provider value={studio.app}><AppCtxContext.Provider value={fixture.appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}><SidebarModalProvider containerSelector="#background-test-sidebar"><div id="background-test-sidebar" />{content}</SidebarModalProvider></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>;
  const section = () => wrap(<><BackgroundSection expsProvider={provider} vsh={helper} /><Probe /></>);
  return { ...fixture, studio, site, first, other, head, end, exp, helper, active, group, provider, section, wrap, Probe };
}

it("renders committed image/token fields and keeps original image selection and background edit commands", async () => {
  vi.stubGlobal("__PlasmicTokenRegistry", [{ name: "background-native-color", type: "color", value: "var(--background-native-color)" }]);
  document.documentElement.style.setProperty("--background-native-color", "#ABCDEF");
  const f = await setup(), mounted = render(f.section());
  try {
    expect(screen.getByText("First image")).toBeTruthy(); expect(screen.getByText("Paint token")).toBeTruthy();
    expect([...mounted.container.querySelectorAll(".img-thumb")].some((element) => element.getAttribute("style")?.includes("first.png"))).toBe(true);
    // jsdom does not support linear-gradient in CSSStyleDeclaration; assert
    // the real native hook output while keeping the actual UI/commands mounted.
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("#ABCDEF");
    await act(async () => { await f.studio.changeUnsafe(() => { f.first.name = "Renamed image"; f.first.dataUri = "updated.png"; f.head.name = "Renamed paint"; f.end.value = "#654321"; }); });
    expect(screen.getByText("Renamed image")).toBeTruthy(); expect(screen.getByText("Renamed paint")).toBeTruthy();
    expect([...mounted.container.querySelectorAll(".img-thumb")].some((element) => element.getAttribute("style")?.includes("updated.png"))).toBe(true);
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("#654321");
    fireEvent.click(screen.getByText("Renamed image")); await waitFor(() => expect(document.querySelector('[data-test-id="image-picker"]')).not.toBeNull());
    fireEvent.click(screen.getByText("Replace image..."));
    const imagePicker = ensure(document.querySelector<HTMLElement>('[data-test-id="image-picker"]'), "Actual image picker");
    fireEvent.mouseDown(within(imagePicker).getByRole("combobox"));
    fireEvent.click(ensure((await screen.findByText("Other image")).closest(".ant-select-item-option"), "Original image choice"));
    await waitFor(() => expect(f.exp.get("background")).toContain(mkImageAssetRef(f.other)));
    expect(f.exp.get("background")).not.toContain("other.png");
    fireEvent.click(ensure(document.querySelector('[data-test-id="close-sidebar-modal"]'), "Close original image panel"));
    await waitFor(() => expect(document.querySelector('[data-test-id="image-picker"]')).toBeNull());
    const before = parseCss(f.exp.get("background"), { startRule: "background" }).layers.length;
    fireEvent.click(screen.getByRole("button", { name: "Add background color" }));
    await waitFor(() => expect(parseCss(f.exp.get("background"), { startRule: "background" }).layers).toHaveLength(before + 1));
    expect(f.exp.get("background")).toContain(mkTokenRef(f.head));
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("preserves first image labels and last dictionary thumbnail semantics without cloning asset/token catalogs", async () => {
  const f = await setup();
  const duplicate = new ImageAsset({ uuid: f.first.uuid, name: "Later image", type: ImageAssetType.Picture, dataUri: "last.png", width: null, height: null, aspectRatio: null });
  const early = new StyleToken({ uuid: "background-dictionary", name: "Early", type: "Spacing", value: "#111111", variantedValues: [], isRegistered: false, regKey: null });
  const late = new StyleToken({ uuid: early.uuid, name: "Late", type: "Spacing", value: "#222222", variantedValues: [], isRegistered: false, regKey: null });
  await f.studio.changeUnsafe(() => { f.site.imageAssets.push(duplicate); f.site.styleTokens.push(early, late); f.exp.set("background", `${mkImageAssetRef(f.first)}, linear-gradient(${mkTokenRef(early)}, ${mkTokenRef(early)})`); });
  const mounted = render(f.wrap(<f.Probe />));
  try {
    expect(screen.getByTestId("background-projection").textContent).toBe("First image | Color token");
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("last.png");
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("#222222");
    await act(async () => { await f.studio.changeUnsafe(() => { late.value = "#333333"; f.site.imageAssets.splice(f.site.imageAssets.indexOf(duplicate), 1); }); });
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("#333333");
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("first.png");
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("closes the actual image panel and command-ref roster before a real model owner replacement", async () => {
  const popup = vi.spyOn(imageAssetControls, "ImageAssetSidebarPopup");
  const f = await setup(true), collection = createImageAssetListInputs(f.studio), laterCollection = createImageAssetListInputs(f.studio);
  const original = ensure(collection.getSnapshot()[0], "Original collection ref"), terminal = vi.fn(() => { if (!collection.getSnapshot().length) {
    expect(laterCollection.getSnapshot()).toEqual([]);
    expect(() => collection.resolve(original.ref)).toThrow("closed model owner");
  } });
  const stop = collection.subscribe(terminal), laterChanged = vi.fn(), stopLater = laterCollection.subscribe(laterChanged), mounted = render(f.section());
  try {
    fireEvent.click(screen.getByText("First image")); await waitFor(() => expect(document.querySelector('[data-test-id="image-picker"]')).not.toBeNull());
    fireEvent.click(ensure(screen.getAllByText("First image").find((element) => element.closest("a,button")), "Selected asset editor"));
    await screen.findByPlaceholderText("(unnamed asset)");
    const release = mock<PkgVersionInfoMeta>({ id: "background-world", pkgId: "background-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "background-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    expect(terminal).toHaveBeenCalled(); expect(laterChanged).toHaveBeenCalledOnce(); expect(collection.getSnapshot()).toEqual([]);
    const nextAsset = ensure(f.studio.site.imageAssets.find((asset) => asset.uuid === f.first.uuid), "New-world asset");
    expect(nextAsset).not.toBe(f.first);
    expect(popup.mock.calls.some(([props]) => props.asset === nextAsset)).toBe(false);
    // SidebarModal may retain an inert DOM clone for its 180ms leave animation;
    // it must not retain or replay the React/model-backed editor session.
    expect(screen.queryAllByPlaceholderText("(unnamed asset)").every((input) => !!input.closest("[inert]"))).toBe(true);
    await waitFor(() => expect(screen.queryByPlaceholderText("(unnamed asset)")).toBeNull());
    const nextField = vi.spyOn(f.studio.modelSnapshots, "declaredField");
    mounted.rerender(f.section());
    expect(nextField.mock.calls.some(([model]) => model === f.first || model === f.head || model === f.end || model === f.active || model === f.group)).toBe(false);
  } finally { stop(); stopLater(); mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
