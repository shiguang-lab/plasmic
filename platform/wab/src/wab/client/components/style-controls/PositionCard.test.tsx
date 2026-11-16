import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PositioningPanelSection } from "@/wab/client/components/sidebar-tabs/PositioningSection";
import {
  PositionCard,
  resolvePositionCapabilities,
} from "@/wab/client/components/style-controls/PositionCard";
import {
  SingleRsExpsProvider,
  StyleTarget,
  StyleTargetContext,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
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
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import {
  mkSlot,
  mkTplComponent,
  mkTplTagX,
  trackComponentRoot,
  trackComponentSite,
} from "@/wab/shared/core/tpls";
import {
  ensureKnownTplTag,
  type TplNode,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { UiConfig } from "@/wab/shared/ui-config-utils";
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
}) {
  const site = createSite();
  const manager = new TplMgr({ site });
  const component = manager.addComponent({
    name: "Position card suite",
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
  const child = mkTplTagX("div", {
    baseVariant: base,
    styles: opts?.childStyles ?? {
      position: "relative",
    },
  });
  $$$(root).append(parent);
  $$$(parent).append(child);
  trackComponentRoot(component);
  trackComponentSite(component, site);

  const frame = mkArenaFrame({
    site,
    component,
    name: "Position card suite",
    width: 600,
    height: 400,
  });
  site.arenas.push(mkMixedArena("Position card suite", [frame]));

  const { studioCtx, appCtx } = fakeStudioCtx({
    site,
    initialUrl:
      "/projects/test?arena_type=custom&arena=Position%20card%20suite",
  });
  studios.add(studioCtx);
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));

  const viewCtx = ensure(
    studioCtx.tryGetViewCtxForFrame(frame),
    "Positioning viewCtx",
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

describe("PositionCard & PositioningPanelSection", () => {
  it("supports 4 positioning modes, unselected-is-auto 5-icon align-self strip, and always-visible Ord/Z with Auto placeholder", async () => {
    const { child, studioCtx, provider, wrap } = await setupHarness();
    const setPositionSpy = vi
      .spyOn(provider, "onPositionChange")
      .mockImplementation((value) => {
        provider.targetExp().set("position", value);
      });

    render(wrap(<PositioningPanelSection expsProvider={provider} />));

    // Auto mode initially: 5 align buttons, all unselected (= auto), no X auto button
    const alignButtons = screen
      .getByTestId("position-align-strip")
      .querySelectorAll("button");
    expect(alignButtons).toHaveLength(5);
    expect(
      screen.getByTestId("position-align-center").getAttribute("aria-pressed"),
    ).toBe("false");

    // Click Center -> sets align-self: center; click Center again -> resets to auto
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-align-center"));
    });
    expect(provider.mergedExp().get("align-self")).toBe("center");
    expect(
      screen.getByTestId("position-align-center").getAttribute("aria-pressed"),
    ).toBe("true");

    await act(async () => {
      fireEvent.click(screen.getByTestId("position-align-center"));
    });
    expect(provider.mergedExp().get("align-self")).toBe("auto");
    expect(
      screen.getByTestId("position-align-center").getAttribute("aria-pressed"),
    ).toBe("false");

    // Ord & Z inputs are directly visible (no "More" toggle) and show empty value + Auto placeholder
    const ordInput = screen.getByTestId(
      "position-order-input",
    ) as HTMLInputElement;
    const zInput = screen.getByTestId(
      "position-zindex-input",
    ) as HTMLInputElement;
    expect(ordInput.value).toBe("");
    expect(ordInput.placeholder).toBe("Auto");
    expect(zInput.value).toBe("");
    expect(zInput.placeholder).toBe("Auto");

    await act(async () => {
      fireEvent.focus(ordInput);
      fireEvent.change(ordInput, { target: { value: "3" } });
      fireEvent.blur(ordInput);
    });
    expect(provider.mergedExp().get("order")).toBe("3");

    await act(async () => {
      fireEvent.focus(ordInput);
      fireEvent.change(ordInput, { target: { value: "" } });
      fireEvent.blur(ordInput);
    });
    expect(child.vsettings[0].rs.values.order).toBeUndefined();

    // Switch mode via dropdown to Free -> Fixed -> Sticky
    fireEvent.click(screen.getByTestId("position-mode-trigger"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-mode-option-absolute"));
    });
    expect(setPositionSpy).toHaveBeenCalledWith("absolute");
    expect(
      screen.getByTestId("position-card").getAttribute("data-position-mode"),
    ).toBe("absolute");

    fireEvent.click(screen.getByTestId("position-mode-trigger"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-mode-option-sticky"));
    });
    expect(setPositionSpy).toHaveBeenCalledWith("sticky");
    // Sticky keeps the 5-icon align-self strip inside flex parent, omits cover button
    expect(screen.getByTestId("position-align-strip")).toBeTruthy();
    expect(screen.queryByTestId("position-pin-cover")).toBeNull();

    // Sticky z-index clamps min 1
    const stickyZ = screen.getByTestId(
      "position-zindex-input",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.focus(stickyZ);
      fireEvent.change(stickyZ, { target: { value: "0" } });
      fireEvent.blur(stickyZ);
    });
    expect(provider.mergedExp().get("z-index")).toBe("1");

    fireEvent.click(screen.getByTestId("position-mode-trigger"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-mode-option-fixed"));
    });
    expect(setPositionSpy).toHaveBeenCalledWith("fixed");
    expect(screen.getByTestId("position-pin-cover")).toBeTruthy();
    expect(studioCtx).toBeTruthy();
  });

  it("handles Free mode 62x62 anchor pin box (edge toggle, corner snap, cover) and inset inputs", async () => {
    const { provider, wrap } = await setupHarness({
      childStyles: {
        position: "absolute",
        top: "0px",
        left: "0px",
        right: "auto",
        bottom: "auto",
        width: "120px",
        height: "80px",
      },
    });

    render(wrap(<PositionCard expsProvider={provider} />));

    const leftInput = screen.getByTestId(
      "position-inset-left",
    ) as HTMLInputElement;
    const rightInput = screen.getByTestId(
      "position-inset-right",
    ) as HTMLInputElement;
    expect(leftInput.value).toBe("0");
    expect(rightInput.value).toBe("");
    expect(rightInput.placeholder).toBe("Auto");

    // Edit L inset directly and clear back to auto
    await act(async () => {
      fireEvent.focus(leftInput);
      fireEvent.change(leftInput, { target: { value: "24" } });
      fireEvent.blur(leftInput);
    });
    expect(provider.mergedExp().get("left")).toBe("24px");

    await act(async () => {
      fireEvent.focus(leftInput);
      fireEvent.change(leftInput, { target: { value: "" } });
      fireEvent.blur(leftInput);
    });
    expect(provider.mergedExp().get("left")).toBe("auto");

    // Toggle Right edge pin
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-pin-right"));
    });
    expect(provider.mergedExp().get("right")).toBe("0");

    // Quick corner snap Bottom-Right
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-pin-bottom-right"));
    });
    expect(provider.mergedExp().get("bottom")).toBe("0");
    expect(provider.mergedExp().get("right")).toBe("0");
    expect(provider.mergedExp().get("top")).toBe("auto");
    expect(provider.mergedExp().get("left")).toBe("auto");

    // Center Cover sets all 4 edges to 0 and clears fixed width/height to auto
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-pin-cover"));
    });
    expect(provider.mergedExp().get("top")).toBe("0");
    expect(provider.mergedExp().get("right")).toBe("0");
    expect(provider.mergedExp().get("bottom")).toBe("0");
    expect(provider.mergedExp().get("left")).toBe("0");
    expect(provider.mergedExp().get("width")).toBe("auto");
    expect(provider.mergedExp().get("height")).toBe("auto");

    // Clicking Cover again when all 4 edges pinned resets back to Top-Left
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-pin-cover"));
    });
    expect(provider.mergedExp().get("top")).toBe("0");
    expect(provider.mergedExp().get("left")).toBe("0");
    expect(provider.mergedExp().get("right")).toBe("auto");
    expect(provider.mergedExp().get("bottom")).toBe("auto");
  });

  it("updates 2D rotation and flip transforms without clobbering existing translate/skew transforms", async () => {
    const { provider, wrap } = await setupHarness({
      childStyles: {
        position: "relative",
        transform: "translate3d(12px, 8px, 0px)",
      },
    });

    render(wrap(<PositionCard expsProvider={provider} />));

    const rotateInput = screen.getByTestId(
      "position-rotate-input",
    ) as HTMLInputElement;
    expect(rotateInput.value).toBe("0");

    // Rotate 90° CW -> preserves translate3d and appends rotate3d
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-rotate-90"));
    });
    expect(provider.mergedExp().get("transform")).toContain(
      "translate3d(12px, 8px, 0px)",
    );
    expect(provider.mergedExp().get("transform")).toContain(
      "rotate3d(0, 0, 1, 90deg)",
    );
    expect(rotateInput.value).toBe("90");

    // Flip horizontal & vertical
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-flip-h"));
    });
    expect(provider.mergedExp().get("transform")).toContain(
      "scale3d(-1, 1, 1)",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("position-flip-v"));
    });
    expect(provider.mergedExp().get("transform")).toContain(
      "scale3d(-1, -1, 1)",
    );

    // Toggle both flips off + reset rotate to 0 -> translate3d remains intact
    await act(async () => {
      fireEvent.click(screen.getByTestId("position-flip-h"));
      fireEvent.click(screen.getByTestId("position-flip-v"));
      fireEvent.focus(rotateInput);
      fireEvent.change(rotateInput, { target: { value: "0" } });
      fireEvent.blur(rotateInput);
    });
    expect(provider.mergedExp().get("transform")).toBe(
      "translate3d(12px, 8px, 0px)",
    );
  });

  it("hides Position or Transform quick bar for non-applicable targets and shows read-only/variant-blocked states", async () => {
    const { site, component, root, child, studioCtx, viewCtx, provider, wrap } =
      await setupHarness({
        childStyles: { position: "relative" },
      });

    // 1. TplSlot -> hidden
    const slotParam = mkParam({
      name: "children",
      type: typeFactory.renderable(),
      paramType: "slot",
    });
    const slotTpl = mkSlot(slotParam);
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        component.params.push(slotParam);
        $$$(root).append(slotTpl);
      });
    });
    const slotExps = new TplExpsProvider(viewCtx, slotTpl as unknown as TplNode);
    const slotRender = render(wrap(<PositioningPanelSection expsProvider={slotExps} />));
    expect(screen.queryByTestId("position-card")).toBeNull();
    slotRender.unmount();

    // 2. Root element without `position` -> hidden; root element with `position` & showPositioning: false -> disabled root message
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        new RuleSetHelpers(root.vsettings[0].rs, "div").clear("position");
      });
    });
    const rootExps = new TplExpsProvider(viewCtx, root);
    expect(
      resolvePositionCapabilities({ expsProvider: rootExps }).visible,
    ).toBe(false);

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        new RuleSetHelpers(root.vsettings[0].rs, "div").set(
          "position",
          "relative",
        );
      });
    });
    viewCtx.setStudioFocusByTpl(root);
    await waitFor(() => expect(studioCtx.isSelectionPending).toBe(false));
    const rootDisabledRender = render(
      wrap(<PositioningPanelSection expsProvider={new TplExpsProvider(viewCtx, root)} />),
    );
    expect(
      screen.getByTestId("positioning-section-root-disabled"),
    ).toBeTruthy();
    rootDisabledRender.unmount();

    viewCtx.setStudioFocusByTpl(child);
    await waitFor(() => expect(studioCtx.isSelectionPending).toBe(false));

    // 4. UiConfig hiding Positioning -> card hidden; hiding Transform -> Transform quick bar hidden
    const hidePosConfig = {
      styleSectionVisibilities: {
        [PublicStyleSection.Positioning]: false,
      },
    } as UiConfig;
    expect(
      resolvePositionCapabilities({
        expsProvider: provider,
        uiConfig: hidePosConfig,
      }).visible,
    ).toBe(false);

    const hideTransformRender = render(
      wrap(
        <PositioningPanelSection
          expsProvider={provider}
          showTransformQuickBar={false}
        />,
      ),
    );
    expect(screen.getByTestId("position-card")).toBeTruthy();
    expect(screen.queryByTestId("position-transform-quickbar")).toBeNull();
    hideTransformRender.unmount();

    // 5. Missing position class on CodeComponent -> hidden
    const cc = mkCodeComponent(
      "NoClassBox",
      { name: "NoClassBox", importPath: "test", props: {} },
      {},
    );
    const ccTpl = mkTplComponent(cc, component.variants[0]);
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        trackComponentRoot(cc);
        trackComponentSite(cc, site);
        site.components.push(cc);
        $$$(root).append(ccTpl);
      });
    });
    const ccExps = new TplExpsProvider(viewCtx, ccTpl);
    expect(
      resolvePositionCapabilities({
        expsProvider: ccExps,
        missingPositionClass: true,
      }).visible,
    ).toBe(false);

    // 6. Locked / read-only mode -> read-only badge and disabled controls
    const lockedCaps = resolvePositionCapabilities({
      expsProvider: provider,
      locked: true,
    });
    expect(lockedCaps.visible).toBe(true);
    expect(lockedCaps.readOnly).toBe(true);
    expect(lockedCaps.readOnlyReason).toBe("Element is locked");
    const lockedRender = render(
      wrap(<PositionCard expsProvider={provider} capabilities={lockedCaps} />),
    );
    expect(screen.getByTestId("position-readonly-badge")).toBeTruthy();
    expect(
      (screen.getByTestId("position-mode-trigger") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("position-rotate-90") as HTMLButtonElement).disabled,
    ).toBe(true);
    lockedRender.unmount();

    // 7. SingleRsExpsProvider (MixinControls / StyleExprModal) with disabled sections -> hidden
    const rsHelper = new RuleSetHelpers(child.vsettings[0].rs, "div");
    const singleProvider = new SingleRsExpsProvider(
      child.vsettings[0].rs,
      rsHelper,
      studioCtx,
      [],
      { kind: "ruleSet", rs: child.vsettings[0].rs, forTag: "div" },
    );
    expect(
      resolvePositionCapabilities({
        expsProvider: singleProvider,
        enabledStyleSections: false,
      }).visible,
    ).toBe(false);

    // 8. Variant blocking check: override z-index in an active non-targeted style variant -> disables z-index when targeting base
    const vc = ensure(
      makeVariantsController(studioCtx, viewCtx),
      "VariantsController",
    );
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        const hoverVariant = studioCtx
          .tplMgr()
          .createPrivateStyleVariant(component, child, [":hover"]);
        const hoverVs = ensureVariantSetting(child, [hoverVariant]);
        new RuleSetHelpers(hoverVs.rs, "div").set("z-index", "99");
        vc.onClickVariant(hoverVariant);
        vc.onTargetVariant(hoverVariant, false);
      });
    });
    viewCtx.setStudioFocusByTpl(child);
    await waitFor(() => expect(studioCtx.isSelectionPending).toBe(false));
    const variantBlockedRender = render(
      wrap(<PositionCard expsProvider={new TplExpsProvider(viewCtx, child)} />),
    );
    expect(
      (screen.getByTestId("position-zindex-input") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("position-order-input") as HTMLInputElement).disabled,
    ).toBe(false);
    variantBlockedRender.unmount();
  });
});
