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
    expect(mounted.container.querySelectorAll('[data-rfd-drag-handle-draggable-id] [data-test-id="drag-handle"]:not([data-disabled])')).toHaveLength(2);
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
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Edit fill" }), { key: "Escape" });
    await waitFor(() => expect(document.querySelector('[data-test-id="image-picker"]')).toBeNull());
    const before = parseCss(f.exp.get("background"), { startRule: "background" }).layers.length;
    expect(screen.queryByRole("spinbutton", { name: "Opacity" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add fill" }));
    await waitFor(() => expect(parseCss(f.exp.get("background"), { startRule: "background" }).layers).toHaveLength(before + 1));
    const fillTrigger = screen.getByRole("button", { name: "Edit fill: #ffffff" });
    expect(fillTrigger.getAttribute("aria-expanded")).toBe("true");
    const colorDialog = await screen.findByRole("dialog", { name: "Fill color" });
    const opacity = within(colorDialog).getByRole("textbox", { name: "Opacity" });
    fireEvent.change(opacity, { target: { value: "50" } });
    fireEvent.blur(opacity);
    await waitFor(() => expect(f.exp.get("background").toLowerCase()).toContain("#ffffff80"));
    expect(f.exp.get("background")).toContain(mkTokenRef(f.head));
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("edits solid fill colors and theme variables in the anchored popover", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => {
    f.end.value = "#654321";
    f.exp.set("background", "#ffffff");
  });
  const mounted = render(f.section());
  try {
    const trigger = screen.getByRole("button", { name: "Edit fill: #ffffff" });
    expect(mounted.container.querySelectorAll('[data-test-id="drag-handle"][data-disabled="true"]')).toHaveLength(1);
    fireEvent.click(trigger);
    const picker = await screen.findByRole("dialog", { name: "Fill color" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[data-test-id="close-sidebar-modal"]')).toBeNull();

    const hex = ensure(picker.querySelector('[data-test-id="Color-input"]'), "Fill color Hex input");
    fireEvent.change(hex, { target: { value: "263a70" } });
    fireEvent.blur(hex);
    await waitFor(() => expect(f.exp.get("background").toLowerCase()).toContain("#263a70"));
    expect(screen.getByTestId("background-projection").getAttribute("data-css")?.toLowerCase()).toContain("#263a70");

    expect(within(picker).queryByRole("button", { name: "Theme variables" })).toBeNull();
    fireEvent.click(await within(picker).findByRole("button", { name: /Paint token.*#654321/i }));
    await waitFor(() => expect(f.exp.get("background")).toContain(mkTokenRef(f.head)));
    expect(screen.getByTestId("background-projection").getAttribute("data-css")).toContain("#654321");

    fireEvent.keyDown(picker, { key: "Escape" });
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
    expect(document.activeElement).toBe(trigger);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("selects exclusive None in fill types, replaces it on add, and clears the last configuration on removal", async () => {
  const f = await setup();
  const mounted = render(f.section());
  try {
    expect(screen.queryByRole("button", { name: "Fill: Custom" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit fill: First image" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Edit fill" })).getByRole("button", { name: "None" }));
    await waitFor(() => expect(f.exp.getRaw("background")).toBe("none"));
    expect(screen.getByRole("button", { name: "Edit fill: None" })).toBeTruthy();
    expect(mounted.container.querySelectorAll(".list-box-item")).toHaveLength(1);
    const noneDialog = screen.getByRole("dialog", { name: "Edit fill" });
    expect(noneDialog.querySelector('[data-test-id="image-picker"]')).toBeNull();
    expect(within(noneDialog).queryByText("More settings")).toBeNull();
    expect(screen.getByRole("button", { name: "Add fill" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Add fill" }));
    await screen.findByRole("button", { name: "Edit fill: #ffffff" });
    expect(screen.queryByRole("button", { name: "Edit fill: None" })).toBeNull();
    expect(parseCss(f.exp.get("background"), { startRule: "background" }).layers).toHaveLength(1);
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Fill color" })).getByRole("button", { name: "None" }));
    await waitFor(() => expect(f.exp.getRaw("background")).toBe("none"));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Edit fill" })).getByRole("button", { name: "Solid" }));
    await screen.findByRole("button", { name: "Edit fill: #ffffff" });
    fireEvent.click(screen.getByRole("button", { name: "Remove fill" }));
    await waitFor(() => expect(f.exp.has("background")).toBe(false));
    expect(screen.queryByRole("button", { name: "Edit fill: None" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit fill: #ffffff" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add fill" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Fill color" })).getByRole("button", { name: "None" }));
    await screen.findByRole("button", { name: "Edit fill: None" });
    fireEvent.click(screen.getByRole("button", { name: "Remove None override" }));
    await waitFor(() => expect(f.exp.has("background")).toBe(false));
    expect(screen.queryByRole("button", { name: "Edit fill: None" })).toBeNull();
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
    const fill = screen.getByRole("dialog", { name: "Edit fill" });
    fireEvent.click(ensure(within(fill).getByText("First image").closest("a,button"), "Selected asset editor"));
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


it("switches between all fill modes and restores edited values within the popup", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => f.exp.set("background", "#12345680"));
  const mounted = render(f.section());
  try {
    const trigger = screen.getByRole("button", { name: "Edit fill: #123456" });
    fireEvent.click(within(trigger).getByText("50 %"));
    const dialog = await screen.findByRole("dialog", { name: "Fill color" });
    const switchMode = (name: string) => fireEvent.click(within(dialog).getByRole("button", { name }));
    switchMode("Linear gradient");
    await waitFor(() => expect(f.exp.get("background")).toContain("linear-gradient(0deg"));
    expect(dialog.querySelector(".compact-color-picker")).toBeTruthy();
    const hex = ensure(dialog.querySelector('[data-test-id="Color-input"]'), "Gradient stop color");
    fireEvent.change(hex, { target: { value: "112233" } });
    fireEvent.blur(hex);
    await waitFor(() => expect(f.exp.get("background").toLowerCase()).toContain("#112233"));
    const linear = f.exp.get("background");
    switchMode("Radial gradient");
    await waitFor(() => expect(f.exp.get("background")).toContain("radial-gradient"));
    expect(dialog.querySelector(".ellipse-control")).toBeTruthy();
    switchMode("Image");
    await waitFor(() => expect(dialog.querySelector('[data-test-id="image-picker"]')).toBeTruthy());
    expect(f.exp.get("background")).toContain("url(");
    switchMode("Solid");
    await waitFor(() => expect(f.exp.get("background").toLowerCase()).toContain("#12345680"));
    switchMode("Linear gradient");
    await waitFor(() => expect(f.exp.get("background")).toBe(linear));
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});


it("edits advanced fill settings and restores them when the popup reopens", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => f.exp.set("background", "linear-gradient(0deg, #112233 0%, #445566 100%) left 25% top 50% / 80px 60px no-repeat"));
  const mounted = render(f.section());
  try {
    fireEvent.click(screen.getByRole("button", { name: "Edit fill: Linear gradient" }));
    let dialog = await screen.findByRole("dialog", { name: "Edit fill" });
    fireEvent.click(within(dialog).getByText("More settings"));
    const layer = () => parseCss(f.exp.get("background"), { startRule: "background" }).layers[0];
    const edit = async (name: string, value: string) => {
      const input = within(dialog).getByRole("textbox", { name });
      act(() => input.focus());
      fireEvent.change(input, { target: { value } });
      act(() => input.blur());
    };
    const select = async (name: string, option: string) => {
      const input = within(dialog).getByRole("combobox", { name });
      fireEvent.mouseDown(input);
      const optionNode = await waitFor(() => {
        const visibleOptions = screen.getAllByText(option, { selector: ".ant-select-item-option-content" })
          .filter((node) => !node.closest(".ant-select-dropdown-hidden"));
        expect(visibleOptions).toHaveLength(1);
        return visibleOptions[0];
      });
      fireEvent.mouseUp(optionNode);
      fireEvent.click(optionNode);
    };
    fireEvent.click(within(dialog).getByRole("radio", { name: "Cover" }));
    await waitFor(() => expect(layer().size).toBe("cover"));
    expect(within(dialog).queryByRole("textbox", { name: "Width" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Contain" }));
    await waitFor(() => expect(layer().size).toBe("contain"));
    fireEvent.click(within(dialog).getByRole("radio", { name: "Custom" }));
    await waitFor(() => expect(layer().size).toBe("80px 60px"));
    await edit("Width", "120px");
    await waitFor(() => expect(layer().size).toBe("120px 60px"));
    await select("Horizontal Position", "Right");
    await waitFor(() => expect(layer().position).toContain("right 25%"));
    await select("Vertical Position", "Bottom");
    await waitFor(() => expect(layer().position).toContain("bottom 50%"));
    await edit("Horizontal", "12px");
    await waitFor(() => expect(layer().position).toContain("right 12px"));
    await edit("Vertical", "20%");
    await waitFor(() => {
      expect(layer().position).toContain("right 12px");
      expect(layer().position).toContain("bottom 20%");
      expect(layer().position).not.toMatch(/left|top|auto/);
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Horizontal" }));
    await select("Clipping", "Within content");
    await select("Scrolling", "Fixed to page");
    await select("Origin", "Within border");
    await waitFor(() => {
      expect(layer().repeat).toBe("repeat-x");
      expect(layer().clip).toBe("content-box");
      expect(layer().attachment).toBe("fixed");
      expect(layer().origin).toBe("border-box");
    });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Edit fill: Linear gradient" }));
    dialog = await screen.findByRole("dialog", { name: "Edit fill" });
    fireEvent.click(within(dialog).getByText("More settings"));
    expect((within(dialog).getByRole("textbox", { name: "Width" }) as HTMLInputElement).value).toBe("120px");
    expect((within(dialog).getByRole("textbox", { name: "Horizontal" }) as HTMLInputElement).value).toBe("12px");
    expect(within(dialog).getByText("Fixed to page")).toBeTruthy();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
