import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AppearancePanelSection } from "@/wab/client/components/sidebar-tabs/AppearancePanelSection";
import {
  AppearanceCard,
  resolveAppearanceCapabilities,
} from "@/wab/client/components/style-controls/AppearanceCard";
import {
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
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensureVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import {
  TplTagType,
  mkTplTagX,
  trackComponentRoot,
  trackComponentSite,
} from "@/wab/shared/core/tpls";
import { getEffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { TplVisibility } from "@/wab/shared/visibility-utils";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/app-auth/app-auth-contexts", () => ({
  useAppRoles: () => ({ roles: [] }),
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor",
  () => ({
    DataPickerEditor: ({ value }: { value: unknown }) => (
      <output data-testid="visibility-expression">{JSON.stringify(value)}</output>
    ),
  }),
);
vi.mock(
  "@/wab/client/components/sidebar-tabs/ComponentProps/BoolPropEditor",
  () => ({
    BoolPropEditor: ({
      value,
      onChange,
    }: {
      value?: boolean;
      onChange: (value: boolean) => void;
    }) => (
      <input
        aria-label="Condition fallback"
        type="checkbox"
        checked={!!value}
        onChange={(event) => onChange(event.target.checked)}
      />
    ),
  }),
);

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
  childTag?: string;
  childType?: TplTagType;
  childStyles?: Record<string, string>;
  useImageChild?: boolean;
}) {
  const site = createSite();
  const manager = new TplMgr({ site });
  const component = manager.addComponent({
    name: "AppearanceTestComponent",
    type: ComponentType.Plain,
  });
  const root = ensureKnownTplTag(component.tplTree);
  const base = component.variants[0];
  const child = opts?.useImageChild
    ? mkTplTagX("img", {
        name: "ImageNode",
        type: TplTagType.Image,
        baseVariant: base,
      })
    : mkTplTagX(opts?.childTag ?? "div", {
        name: "TargetBox",
        type: opts?.childType ?? TplTagType.Other,
        baseVariant: base,
      });

  $$$(root).append(child);
  trackComponentRoot(component);
  trackComponentSite(component, site);

  const childVs = ensureVariantSetting(child, [base]);
  const childExp = new RuleSetHelpers(childVs.rs, child.tag);
  if (opts?.childStyles) {
    Object.entries(opts.childStyles).forEach(([k, v]) => childExp.set(k, v));
  }

  const frame = mkArenaFrame({
    site,
    component,
    name: "AppearanceTestFrame",
    width: 400,
    height: 300,
  });
  site.arenas.push(mkMixedArena("AppearanceTestArena", [frame]));

  const { studioCtx, appCtx } = fakeStudioCtx({
    site,
    initialUrl:
      "/projects/test?arena_type=custom&arena=AppearanceTestArena",
  });
  studios.add(studioCtx);
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));

  const viewCtx = ensure(
    studioCtx.tryGetViewCtxForFrame(frame),
    "Expected ViewCtx for arena frame",
  );
  studioCtx.observeComponents([component]);
  await studioCtx.changeUnsafe(() => {
    studioCtx.setStudioFocusOnViewCtxContent(viewCtx);
    viewCtx.setStudioFocusByTpl(child);
  });
  await waitFor(() => expect(studioCtx.isSelectionPending).toBe(false));

  const provider = new TplExpsProvider(viewCtx, child);
  const styling = new StyleTarget({ expsProvider: provider });

  const wrap = (node: React.ReactNode) => (
    <AppCtxContext.Provider value={appCtx}>
      <AppContext.Provider value={studioCtx.app}>
        <StudioCtxContext.Provider value={studioCtx}>
          <StyleTargetContext.Provider value={styling}>
            {node}
          </StyleTargetContext.Provider>
        </StudioCtxContext.Provider>
      </AppContext.Provider>
    </AppCtxContext.Provider>
  );

  return {
    studioCtx,
    viewCtx,
    child,
    childVs,
    provider,
    childExp: () => new RuleSetHelpers(ensureVariantSetting(child, [base]).rs, child.tag),
    wrap,
  };
}

describe("AppearanceCard", () => {
  it("supports opacity % editing, uniform & split 4-corner radius, and mixed corner auto-expand", async () => {
    const h = await setupHarness({
      childStyles: {
        opacity: "0.75",
        "border-top-left-radius": "12px",
        "border-top-right-radius": "12px",
        "border-bottom-left-radius": "12px",
        "border-bottom-right-radius": "12px",
      },
    });

    render(h.wrap(<AppearanceCard expsProvider={h.provider} />));

    const opacityInput = screen.getByLabelText("Opacity") as HTMLInputElement;
    expect(opacityInput.value).toBe("75");

    await act(async () => {
      fireEvent.focus(opacityInput);
      fireEvent.change(opacityInput, { target: { value: "40" } });
      fireEvent.blur(opacityInput);
    });
    expect(h.childExp().getRaw("opacity")).toBe("0.4");

    const radiusInput = screen.getByTestId(
      "appearance-radius-input",
    ) as HTMLInputElement;
    expect(radiusInput.value).toBe("12");
    expect(screen.queryByTestId("appearance-corners-grid")).toBeNull();

    await act(async () => {
      fireEvent.focus(radiusInput);
      fireEvent.change(radiusInput, { target: { value: "16" } });
      fireEvent.blur(radiusInput);
    });
    expect(h.childExp().getRaw("border-top-left-radius")).toBe("16px");
    expect(h.childExp().getRaw("border-bottom-right-radius")).toBe("16px");

    await act(async () => {
      fireEvent.click(screen.getByTestId("appearance-corners-toggle"));
    });
    expect(screen.getByTestId("appearance-corners-grid")).toBeTruthy();

    const tlInput = screen.getByLabelText("Top-left corner") as HTMLInputElement;
    await act(async () => {
      fireEvent.focus(tlInput);
      fireEvent.change(tlInput, { target: { value: "24" } });
      fireEvent.blur(tlInput);
    });
    expect(h.childExp().getRaw("border-top-left-radius")).toBe("24px");
    expect(h.childExp().getRaw("border-top-right-radius")).toBe("16px");
    expect(radiusInput.placeholder).toBe("Mixed");
  });

  it("supports unified and per-axis Overflow dropdowns, XY split toggle, and blend mode dropdown", async () => {
    const h = await setupHarness();

    render(h.wrap(<AppearanceCard expsProvider={h.provider} />));

    const chooseOverflow = async (name: string, value: string) => {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name }));
      });
      const option = await screen.findByRole("menuitem", { name: value });
      await act(async () => {
        fireEvent.click(option);
      });
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    };
    const overflowBtn = screen.getByRole("button", { name: "Overflow" });
    expect(overflowBtn.textContent).toBe("Visible");
    expect(overflowBtn.getAttribute("aria-haspopup")).toBe("menu");

    await chooseOverflow("Overflow", "Hidden");
    expect(h.childExp().getRaw("overflow")).toBe("hidden");
    expect(overflowBtn.textContent).toBe("Hidden");

    await chooseOverflow("Overflow", "Scroll");
    expect(h.childExp().getRaw("overflow")).toBe("auto");
    expect(overflowBtn.textContent).toBe("Scroll");

    const splitBtn = screen.getByTestId("appearance-overflow-split-btn");
    await act(async () => {
      fireEvent.click(splitBtn);
    });
    expect(screen.getByTestId("appearance-overflow-split")).toBeTruthy();
    expect(h.childExp().getRaw("overflow-x")).toBe("auto");
    expect(h.childExp().getRaw("overflow-y")).toBe("auto");
    expect(h.childExp().getRaw("overflow")).toBeUndefined();
    expect(overflowBtn.textContent).toBe("Scroll");

    await chooseOverflow("Overflow X", "Hidden");
    expect(h.childExp().getRaw("overflow-x")).toBe("hidden");
    expect(h.childExp().getRaw("overflow-y")).toBe("auto");
    expect(screen.getByLabelText("Overflow X").textContent).toBe("Hidden");
    expect(screen.getByLabelText("Overflow Y").textContent).toBe("Scroll");
    expect(overflowBtn.textContent).toBe("Mixed");

    await chooseOverflow("Overflow Y", "Visible");
    expect(h.childExp().getRaw("overflow-y")).toBe("visible");
    expect(h.childExp().getRaw("overflow-x")).toBe("hidden");

    await chooseOverflow("Overflow", "Scroll");
    expect(screen.queryByTestId("appearance-overflow-split")).toBeNull();
    expect(h.childExp().getRaw("overflow")).toBe("auto");
    expect(h.childExp().getRaw("overflow-x")).toBeUndefined();
    expect(h.childExp().getRaw("overflow-y")).toBeUndefined();

    await act(async () => {
      fireEvent.click(splitBtn);
    });
    await chooseOverflow("Overflow X", "Hidden");

    await act(async () => {
      fireEvent.click(splitBtn);
    });
    expect(screen.queryByTestId("appearance-overflow-split")).toBeNull();
    expect(h.childExp().getRaw("overflow")).toBe("hidden");
    expect(h.childExp().getRaw("overflow-x")).toBeUndefined();
    expect(h.childExp().getRaw("overflow-y")).toBeUndefined();

    const blendBtn = screen.getByRole("button", { name: "Blend mode" });
    await act(async () => {
      fireEvent.click(blendBtn);
    });
    expect(await screen.findByText("Basic")).toBeTruthy();
    expect(screen.getByText("Contrast")).toBeTruthy();
    const blendMenu = screen.getByRole("menu");
    expect(blendMenu.style.maxHeight).toBe("none");
    expect(blendMenu.style.overflow).toBe("visible");
    const blendPopup = ensure(blendMenu.closest(".ant-dropdown"), "Blend popup");
    const blendScrollbars = blendPopup.querySelectorAll(
      "[data-overlayscrollbars]",
    );
    expect(blendScrollbars).toHaveLength(1);
    expect(blendScrollbars[0].contains(blendMenu)).toBe(true);
    expect(blendScrollbars[0].contains(screen.getByText("Blend mode"))).toBe(
      false,
    );
    await act(async () => {
      fireEvent.click(await screen.findByText(/Multiply/));
    });
    expect(h.childExp().getRaw("mix-blend-mode")).toBe("multiply");
  });

  it("integrates Visibility quick toggle + menu/dynamic condition in AppearancePanelSection and filters non-container/restricted nodes", async () => {
    const h = await setupHarness();

    render(h.wrap(<AppearancePanelSection expsProvider={h.provider} />));

    const visToggle = document.querySelector<HTMLButtonElement>(
      '[data-test-id="visibility-quick-toggle"]',
    );
    expect(visToggle).toBeTruthy();
    expect(
      getEffectiveVariantSetting(h.child, h.childVs.variants).getVisibility(),
    ).toBe(TplVisibility.Visible);

    await act(async () => {
      fireEvent.click(ensure(visToggle, "Visibility toggle"));
    });
    expect(
      getEffectiveVariantSetting(h.child, h.childVs.variants).getVisibility(),
    ).toBe(TplVisibility.DisplayNone);

    const visMenuBtn = document.querySelector<HTMLButtonElement>(
      '[data-test-id="visibility-menu-btn"]',
    );
    await act(async () => {
      fireEvent.click(ensure(visMenuBtn, "Visibility menu button"));
    });
    await act(async () => {
      fireEvent.click(await screen.findByText("Use dynamic value"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("visibility-expression")).toBeTruthy(),
    );

    cleanup();

    const imgHarness = await setupHarness({ useImageChild: true });
    const imgCaps = resolveAppearanceCapabilities({
      expsProvider: imgHarness.provider,
      canToggleVisibility: true,
    });
    expect(imgCaps.overflowVisible).toBe(false);
    expect(imgCaps.radiusVisible).toBe(true);
    expect(imgCaps.opacityVisible).toBe(true);

    const partialCaps = resolveAppearanceCapabilities({
      expsProvider: imgHarness.provider,
      canToggleVisibility: true,
      enabledStyleSections: [PublicStyleSection.Border],
    });
    expect(partialCaps.radiusVisible).toBe(true);
    expect(partialCaps.opacityVisible).toBe(false);
    expect(partialCaps.visibilityVisible).toBe(false);
    expect(partialCaps.blendVisible).toBe(false);
  });
});
