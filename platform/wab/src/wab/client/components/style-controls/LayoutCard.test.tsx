import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  LayoutCard,
  resolveLayoutCapabilities,
} from "@/wab/client/components/style-controls/LayoutCard";
import {
  SingleRsExpsProvider,
  StyleTarget,
  StyleTargetContext,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { AppContext } from "@/wab/client/components/top-view";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RSH, RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import {
  TplTagType,
  mkTplTagX,
  trackComponentRoot,
  trackComponentSite,
} from "@/wab/shared/core/tpls";
import { ContainerLayoutType } from "@/wab/shared/layoututils";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const studios = new Set<StudioCtx>();

beforeEach(() => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
});

afterEach(async () => {
  cleanup();
  for (const studio of studios) {
    await studio.awaitEval();
    studio.dispose();
  }
  studios.clear();
  vi.restoreAllMocks();
});

async function setupHarness(opts?: {
  parentStyles?: Record<string, string>;
  childStyles?: Record<string, string>;
  childType?: TplTagType;
  childTag?: string;
}) {
  const site = createSite();
  const manager = new TplMgr({ site });
  const component = manager.addComponent({
    name: "Layout card suite",
    type: ComponentType.Plain,
  });
  const root = ensureKnownTplTag(component.tplTree);
  const base = component.variants[0];
  const parent = mkTplTagX("div", {
    baseVariant: base,
    styles: opts?.parentStyles ?? {
      display: "flex",
      "flex-direction": "row",
    },
  });
  const child = mkTplTagX(opts?.childTag ?? "div", {
    type: opts?.childType ?? TplTagType.Other,
    baseVariant: base,
    styles: opts?.childStyles ?? {
      display: "flex",
      "flex-direction": "column",
      width: "300px",
      height: "150px",
      "row-gap": "10px",
    },
  });
  $$$(root).append(parent);
  $$$(parent).append(child);
  trackComponentRoot(component);
  trackComponentSite(component, site);

  const frame = mkArenaFrame({
    site,
    component,
    name: "Layout card suite",
    width: 600,
    height: 400,
  });
  site.arenas.push(mkMixedArena("Layout card suite", [frame]));

  const { studioCtx, appCtx } = fakeStudioCtx({
    site,
    initialUrl:
      "/projects/test?arena_type=custom&arena=Layout%20card%20suite",
  });
  studios.add(studioCtx);
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));

  const viewCtx = ensure(
    studioCtx.tryGetViewCtxForFrame(frame),
    "Layout viewCtx",
  );
  studioCtx.setStudioFocusOnViewCtxContent(viewCtx);
  viewCtx.setStudioFocusByTpl(child);
  await waitFor(() => expect(studioCtx.isSelectionPending).toBe(false));

  const provider = new TplExpsProvider(viewCtx, child);
  const styling = new StyleTarget({ expsProvider: provider });
  const wrap = (node: React.ReactNode) => (
    <AppContext.Provider value={studioCtx.app}>
      <AppCtxContext.Provider value={appCtx}>
        <StudioCtxContext.Provider value={studioCtx}>
          <StyleTargetContext.Provider value={styling}>
            {node}
          </StyleTargetContext.Provider>
        </StudioCtxContext.Provider>
      </AppCtxContext.Provider>
    </AppContext.Provider>
  );

  return {
    site,
    component,
    root,
    parent,
    child,
    studioCtx,
    viewCtx,
    provider,
    wrap,
  };
}

describe("LayoutCard", () => {
  it("always shows padding and margin without setting any styles", async () => {
    const { child, provider, wrap } = await setupHarness();
    const exp = RSH(ensureBaseVariantSetting(child).rs, child);
    const mounted = render(wrap(<LayoutCard expsProvider={provider} />));
    expect(screen.getByRole("group", { name: "Padding" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Margin" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Margin" })).toBeNull();
    expect(mounted.container.querySelectorAll('[data-test-id="Spacing-input"]')).toHaveLength(4);
    expect(exp.has("margin-top")).toBe(false);
    expect(exp.has("padding-top")).toBe(false);
  });

  it("opens the margin value menu from the arrow and applies auto to the paired sides", async () => {
    const { child, provider, wrap } = await setupHarness();
    const exp = RSH(ensureBaseVariantSetting(child).rs, child);
    render(wrap(<LayoutCard expsProvider={provider} />));
    const group = screen.getByRole("group", { name: "Margin" });
    const arrow = ensure(group.querySelector('[role="combobox"] button'), "Margin dropdown arrow");
    fireEvent.click(arrow);
    await waitFor(() => expect(screen.getByRole("listbox").hasAttribute("hidden")).toBe(false));
    await act(async () => { fireEvent.click(screen.getByRole("option", { name: "auto" })); });
    expect(exp.get("margin-top")).toBe("auto");
    expect(exp.get("margin-bottom")).toBe("auto");
    expect(exp.has("margin-left")).toBe(false);
    fireEvent.click(arrow);
    await act(async () => { fireEvent.click(await screen.findByRole("option", { name: "Unset" })); });
    expect(exp.has("margin-top")).toBe(false);
    expect(exp.has("margin-bottom")).toBe(false);
    expect(group.querySelectorAll('[data-test-id="Spacing-input"]')).toHaveLength(2);
  });

  it.each(["padding", "margin"] as const)("edits paired and independent %s without changing values when switching modes", async (kind) => {
    const { child, provider, wrap } = await setupHarness();
    const exp = RSH(ensureBaseVariantSetting(child).rs, child);
    const mounted = render(wrap(<LayoutCard expsProvider={provider} />));
    const inputFor = (side: string) => ensure(mounted.container.querySelector<HTMLInputElement>(`[data-plasmic-prop="${kind}-${side}"]`), "Spacing input");
    const edit = async (side: string, value: string) => {
      await act(async () => {
        const input = inputFor(side);
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value } });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.blur(input);
      });
    };
    const value = kind === "margin" ? "-12px" : "24px";
    await edit("top", value);
    expect(exp.get(`${kind}-top`)).toBe(value);
    expect(exp.get(`${kind}-bottom`)).toBe(value);
    expect(exp.has(`${kind}-left`)).toBe(false);
    const toggle = screen.getByRole("button", { name: `${kind === "padding" ? "Padding" : "Margin"}: Independent edges` });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(inputFor("bottom").value).toBe(value);
    expect(exp.has(`${kind}-left`)).toBe(false);
    await edit("top", "32px");
    expect(exp.get(`${kind}-top`)).toBe("32px");
    expect(exp.get(`${kind}-bottom`)).toBe(value);
    fireEvent.click(toggle);
    expect(inputFor("top").placeholder).toBe("Mixed");
    expect(exp.get(`${kind}-bottom`)).toBe(value);
    await edit("left", kind === "margin" ? "auto" : "10%");
    expect(exp.get(`${kind}-left`)).toBe(kind === "margin" ? "auto" : "10%");
    expect(exp.get(`${kind}-right`)).toBe(kind === "margin" ? "auto" : "10%");
  });

  it.each(["0px", "auto", "-12px"])("shows existing margin %s immediately and reacts to clearing it", async (margin) => {
    const { child, provider, studioCtx, wrap } = await setupHarness({
      childStyles: { "margin-top": margin },
    });
    const exp = RSH(ensureBaseVariantSetting(child).rs, child);
    const mounted = render(wrap(<LayoutCard expsProvider={provider} />));
    const inputs = () => mounted.container.querySelectorAll<HTMLInputElement>('[data-test-id="Spacing-input"]');
    expect(inputs()).toHaveLength(margin === "0px" ? 4 : 6);
    expect(screen.queryByRole("button", { name: "Margin" })).toBeNull();
    await act(async () => { await studioCtx.changeUnsafe(() => exp.clear("margin-top")); });
    expect(inputs()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Margin" })).toBeNull();
    await act(async () => { await studioCtx.changeUnsafe(() => exp.set("margin-left", margin)); });
    expect(inputs()).toHaveLength(margin === "0px" ? 4 : 6);
  });

  it("keeps spacing-only layouts visible and respects read-only and unsupported padding", async () => {
    const { provider, wrap } = await setupHarness({ childTag: "img", childType: TplTagType.Image });
    const capabilities = resolveLayoutCapabilities({
      expsProvider: provider,
      enabledStyleSections: [PublicStyleSection.Spacing],
      readOnly: true,
    });
    expect(capabilities.visible).toBe(true);
    expect(capabilities.sizeVisible).toBe(false);
    expect(capabilities.containerVisible).toBe(false);
    expect(capabilities.paddingVisible).toBe(false);
    expect(capabilities.marginVisible).toBe(true);
    const mounted = render(wrap(<LayoutCard expsProvider={provider} capabilities={capabilities} />));
    const input = ensure(mounted.container.querySelector<HTMLInputElement>('[data-test-id="Spacing-input"]'), "Margin input");
    expect(input.disabled).toBe(true);
    expect(screen.queryByText("Padding")).toBeNull();
  });

  it("supports inline W/H resizing modes, animated proportion lock, and 2x2 Min/Max constraints with None placeholder", async () => {
    const { child, provider, wrap } = await setupHarness();
    const exp = RSH(ensureBaseVariantSetting(child).rs, child);

    render(wrap(<LayoutCard expsProvider={provider} />));

    const widthInput = screen.getByLabelText("Width") as HTMLInputElement;
    const heightInput = screen.getByLabelText("Height") as HTMLInputElement;
    expect(widthInput.value).toBe("300");
    expect(heightInput.value).toBe("150");

    // Lock proportions (300 / 150 = 2.0) and change width to 400 -> height updates to 200px
    const lockBtn = screen.getByRole("button", { name: "Constrain proportions" });
    await act(async () => {
      fireEvent.click(lockBtn);
    });
    expect(lockBtn.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      fireEvent.focus(widthInput);
      fireEvent.change(widthInput, { target: { value: "400" } });
      fireEvent.blur(widthInput);
    });
    expect(exp.get("width")).toBe("400px");
    expect(exp.get("height")).toBe("200px");

    // Inline resize menu switches Width to Hug ("wrap")
    const widthModeBtn = screen.getByRole("button", { name: "Width mode" });
    await act(async () => {
      fireEvent.click(widthModeBtn);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Hug content/i }));
    });
    expect(exp.get("width")).toBe("wrap");

    // Symmetrical 2x2 Min/Max constraints share "None" placeholder & round-trip cleanly
    const minWInput = screen.getByLabelText("Min Width") as HTMLInputElement;
    const maxHInput = screen.getByLabelText("Max Height") as HTMLInputElement;
    expect(minWInput.placeholder).toBe("None");
    expect(maxHInput.placeholder).toBe("None");

    await act(async () => {
      fireEvent.focus(minWInput);
      fireEvent.change(minWInput, { target: { value: "120" } });
      fireEvent.blur(minWInput);
      fireEvent.focus(maxHInput);
      fireEvent.change(maxHInput, { target: { value: "640" } });
      fireEvent.blur(maxHInput);
    });
    expect(exp.get("min-width")).toBe("120px");
    expect(exp.get("max-height")).toBe("640px");

    // Clearing restores unset state
    await act(async () => {
      fireEvent.focus(minWInput);
      fireEvent.change(minWInput, { target: { value: "" } });
      fireEvent.blur(minWInput);
    });
    expect(exp.has("min-width")).toBe(false);
  });

  it("supports container flow switching, 3x3 alignment matrix, always-visible dual gaps, Between, Wrap, Wrap Reverse, and Reverse Items", async () => {
    const { child, provider, wrap } = await setupHarness();
    const exp = RSH(ensureBaseVariantSetting(child).rs, child);
    const dirSpy = vi
      .spyOn(provider, "onContainerTypeChange")
      .mockImplementation((type) => {
        if (type === ContainerLayoutType.flexRow) {
          provider.mergedExp().set("display", "flex");
          provider.mergedExp().set("flex-direction", "row");
        } else if (type === ContainerLayoutType.flexColumn) {
          provider.mergedExp().set("display", "flex");
          provider.mergedExp().set("flex-direction", "column");
        } else if (type === ContainerLayoutType.free) {
          provider.mergedExp().set("display", "block");
        }
      });

    const rendered = render(wrap(<LayoutCard expsProvider={provider} />));

    // Both col-gap and row-gap are directly visible even when Wrap is OFF
    const colGapInput = screen.getByLabelText(/Column gap/) as HTMLInputElement;
    const rowGapInput = screen.getByLabelText(/Row gap/) as HTMLInputElement;
    expect(rowGapInput.value).toBe("10");

    await act(async () => {
      fireEvent.focus(colGapInput);
      fireEvent.change(colGapInput, { target: { value: "16" } });
      fireEvent.blur(colGapInput);
    });
    expect(exp.get("column-gap")).toBe("16px");

    // 3x3 matrix sets center/end alignment
    const centerCell = screen.getByRole("button", { name: "Align center center" });
    await act(async () => {
      fireEvent.click(centerCell);
    });
    expect(exp.get("justify-content")).toBe("center");
    expect(exp.get("align-items")).toBe("center");

    // Space Between toggle
    const betweenBtn = screen.getByRole("button", { name: /Between/i });
    await act(async () => {
      fireEvent.click(betweenBtn);
    });
    expect(exp.get("justify-content")).toBe("space-between");

    // Wrap Reverse auto-enables wrap-reverse even when wrap was OFF
    const wrapRevBtn = screen.getByRole("button", { name: "Wrap reverse" });
    await act(async () => {
      fireEvent.click(wrapRevBtn);
    });
    expect(exp.get("flex-wrap")).toBe("wrap-reverse");

    // Clicking Wrap turns wrap off cleanly
    const wrapBtn = screen.getByRole("button", { name: "Wrap" });
    await act(async () => {
      fireEvent.click(wrapBtn);
    });
    expect(exp.get("flex-wrap")).toBe("nowrap");

    // Reverse Items
    const revBtn = screen.getByRole("button", { name: "Reverse items" });
    await act(async () => {
      fireEvent.click(revBtn);
    });
    expect(exp.get("flex-direction")).toBe("column-reverse");

    // Flow switching calls container converter
    await act(async () => {
      fireEvent.click(
        ensure(
          rendered.container.querySelector('[data-test-id="layout-hstack"]'),
          "Horizontal flow button",
        ),
      );
    });
    expect(dirSpy).toHaveBeenCalledWith(ContainerLayoutType.flexRow);
    expect(exp.get("flex-direction")).toBe("row");

    // Flex child controls are visible because parent is flex-row
    const growInput = screen.getByLabelText(
      "Grow to fill available space",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.focus(growInput);
      fireEvent.change(growInput, { target: { value: "2" } });
      fireEvent.blur(growInput);
    });
    expect(exp.get("flex-grow")).toBe("2");
  });

  it("supports Grid controls on standalone Grid ruleSets and hides container controls on Text leaves", async () => {
    const textHarness = await setupHarness({
      childType: TplTagType.Text,
      childTag: "p",
      childStyles: { width: "180px", height: "40px" },
    });
    const textCaps = resolveLayoutCapabilities({
      expsProvider: textHarness.provider,
    });
    expect(textCaps.sizeVisible).toBe(true);
    expect(textCaps.containerVisible).toBe(false);

    render(textHarness.wrap(<LayoutCard expsProvider={textHarness.provider} />));
    expect(screen.queryByTestId("layout-flex-controls")).toBeNull();
    cleanup();

    const site = createSite();
    const rs = ensure(site.activeTheme, "Theme").defaultStyle.rs;
    const exp = new RuleSetHelpers(rs, "div");
    exp.set("display", "grid");
    exp.set("grid-template-columns", "repeat(3, minmax(0, 1fr))");
    exp.set("grid-auto-rows", "auto");
    exp.set("grid-row-gap", "12px");
    const { studioCtx, appCtx } = fakeStudioCtx({ site });
    studios.add(studioCtx);
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));

    const provider = new SingleRsExpsProvider(rs, exp, studioCtx, [], {
      kind: "ruleSet",
      rs,
      forTag: "div",
    });
    const styling = new StyleTarget({ expsProvider: provider });

    render(
      <AppContext.Provider value={studioCtx.app}>
        <AppCtxContext.Provider value={appCtx}>
          <StudioCtxContext.Provider value={studioCtx}>
            <StyleTargetContext.Provider value={styling}>
              <LayoutCard expsProvider={provider} />
            </StyleTargetContext.Provider>
          </StudioCtxContext.Provider>
        </AppCtxContext.Provider>
      </AppContext.Provider>,
    );

    expect(screen.getByTestId("layout-grid-controls")).toBeTruthy();
    const rowHeightCell = screen
      .getByLabelText("Row Height")
      .closest("div") as HTMLElement;
    expect(rowHeightCell.querySelector('[class*="setDot"]')).toBeNull();
    const colsInput = screen.getByLabelText("Columns") as HTMLInputElement;
    expect(colsInput.value).toBe("3");

    await act(async () => {
      fireEvent.focus(colsInput);
      fireEvent.change(colsInput, { target: { value: "" } });
    });
    expect(colsInput.value).toBe("");
    await act(async () => {
      fireEvent.change(colsInput, { target: { value: "4" } });
      fireEvent.blur(colsInput);
    });
    expect(exp.get("grid-template-columns")).toBe("repeat(4, minmax(0, 1fr))");

    const caps = resolveLayoutCapabilities({
      expsProvider: provider,
      enabledStyleSections: [PublicStyleSection.Sizing],
    });
    expect(caps.sizeVisible).toBe(true);
    expect(caps.containerVisible).toBe(false);
  });
});
