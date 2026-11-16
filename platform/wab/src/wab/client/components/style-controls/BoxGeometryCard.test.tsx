import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { BoxGeometrySection } from "@/wab/client/components/sidebar-tabs/BoxGeometrySection";
import {
  getMultiSelectionBoxGeometryState,
  getMultiSelectionProviders,
  setMultiSelectionBoxProps,
} from "@/wab/client/components/sidebar-tabs/multi-selection";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { ensureVariantSetting } from "@/wab/shared/Variants";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import {
  BoxGeometryCard,
  resolveBoxGeometryCapabilities,
} from "@/wab/client/components/style-controls/BoxGeometryCard";
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
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkParam } from "@/wab/shared/core/lang";
import {
  mkSlot,
  mkTplComponent,
  mkTplTagSimple,
  trackComponentRoot,
  trackComponentSite,
} from "@/wab/shared/core/tpls";
import { $$$ } from "@/wab/shared/TplQuery";
import {
  ensureKnownTplTag,
  type TplComponent,
  type TplNode,
  type TplSlot,
  type TplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const studios = new Set<StudioCtx>();

beforeEach(() => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});

afterEach(async () => {
  cleanup();
  for (const studio of studios) {
    await studio.awaitEval();
    studio.dispose();
  }
  studios.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setupStudioWithComponent() {
  const site = createSite();
  const manager = new TplMgr({ site });
  const component = manager.addComponent({
    name: "BoxCardComponent",
    type: ComponentType.Plain,
  });
  const root = ensureKnownTplTag(component.tplTree);
  const child = mkTplTagSimple("div");
  $$$(root).append(child);

  const frame = mkArenaFrame({
    site,
    component,
    name: "BoxCardFrame",
    width: 400,
    height: 300,
  });
  site.arenas.push(mkMixedArena("BoxCardArena", [frame]));

  const f = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=BoxCardArena",
  });
  studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));

  const viewCtx = ensure(
    f.studioCtx.tryGetViewCtxForFrame(frame),
    "ViewCtx for BoxCardFrame",
  );
  f.studioCtx.setStudioFocusOnViewCtxContent(viewCtx);

  const wrapWithProvider = (
    expsProvider: TplExpsProvider | SingleRsExpsProvider,
    node: React.ReactNode,
  ) => {
    const sc = new StyleTarget({ expsProvider });
    return (
      <AppContext.Provider value={f.studioCtx.app}>
        <AppCtxContext.Provider value={f.appCtx}>
          <StudioCtxContext.Provider value={f.studioCtx}>
            <StyleTargetContext.Provider value={sc}>
              <SidebarModalProvider>{node}</SidebarModalProvider>
            </StyleTargetContext.Provider>
          </StudioCtxContext.Provider>
        </AppCtxContext.Provider>
      </AppContext.Provider>
    );
  };

  return {
    ...f,
    site,
    manager,
    component,
    root,
    child,
    viewCtx,
    wrapWithProvider,
  };
}

async function focusTpl(
  f: Awaited<ReturnType<typeof setupStudioWithComponent>>,
  tpl: TplTag | TplComponent | TplSlot,
) {
  f.viewCtx.setStudioFocusByTpl(tpl);
  await waitFor(() => expect(f.studioCtx.isSelectionPending).toBe(false));
  return new TplExpsProvider(f.viewCtx, tpl);
}

describe("BoxGeometryCard", () => {
  it("supports inline click-to-edit (with link), drag-to-scrub (unlinked), negative/auto margin, radius edit & Mix, and DOM ResizeObserver size updates", async () => {
    const f = await setupStudioWithComponent();
    const child = f.child;
    const expsProvider = await focusTpl(f, child);

    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        const exp = expsProvider.mergedExp();
        exp.set("margin-top", "12px");
        exp.set("margin-right", "12px");
        exp.set("margin-bottom", "12px");
        exp.set("margin-left", "12px");
        exp.set("padding-top", "16px");
        exp.set("padding-right", "16px");
        exp.set("padding-bottom", "16px");
        exp.set("padding-left", "16px");
        exp.set("border-top-left-radius", "12px");
        exp.set("border-top-right-radius", "12px");
        exp.set("border-bottom-right-radius", "12px");
        exp.set("border-bottom-left-radius", "12px");
      });
    });

    // Mock live DOM bounding box + capture ResizeObserver callbacks
    let measuredRect = { width: 300, height: 172 };
    const resizeCallbacks: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallbacks.push(cb);
        }
        observe() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      },
    );
    const fakeEl = document.createElement("div");
    vi.spyOn(fakeEl, "getBoundingClientRect").mockImplementation(() => ({
      ...measuredRect,
      top: 0,
      left: 0,
      right: measuredRect.width,
      bottom: measuredRect.height,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }));
    vi.spyOn(expsProvider, "forDom").mockReturnValue([fakeEl] as unknown as JQuery);

    render(
      f.wrapWithProvider(
        expsProvider,
        <BoxGeometryCard expsProvider={expsProvider} />,
      ),
    );

    // 1. Live DOM rendered WxH and ResizeObserver sync
    expect(screen.getByTestId("box-core-size").textContent).toBe("300×172");
    act(() => {
      measuredRect = { width: 300, height: 236 };
      resizeCallbacks.forEach((cb) => cb());
    });
    expect(screen.getByTestId("box-core-size").textContent).toBe("300×236");

    // 2. Click-to-edit padding-top while linked updates top & bottom together
    const padTop = screen.getByTestId("box-edge-padding-top");
    fireEvent.mouseDown(padTop, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });

    const padInput = await screen.findByLabelText("padding-top input");
    fireEvent.change(padInput, { target: { value: "24" } });
    fireEvent.keyDown(padInput, { key: "Enter" });

    await waitFor(() => {
      expect(expsProvider.mergedExp().get("padding-top")).toBe("24px");
      expect(expsProvider.mergedExp().get("padding-bottom")).toBe("24px");
    });

    // 3. Padding clamps negative input to 0px
    fireEvent.mouseDown(screen.getByTestId("box-edge-padding-right"), {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    const padRightInput = await screen.findByLabelText("padding-right input");
    fireEvent.change(padRightInput, { target: { value: "-10" } });
    fireEvent.keyDown(padRightInput, { key: "Enter" });
    await waitFor(() => {
      expect(expsProvider.mergedExp().get("padding-right")).toBe("0px");
    });

    // 4. Unlink and horizontal drag-to-scrub margin-left into negative value, plus "auto"
    fireEvent.click(screen.getByTestId("box-link-toggle"));
    const marginLeft = screen.getByTestId("box-edge-margin-left");
    fireEvent.mouseDown(marginLeft, { button: 0, clientX: 100, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 10 }); // dx=-60 => round(-30)=-30 => 12 - 30 = -18px
    fireEvent.mouseUp(window, { button: 0, clientX: 40, clientY: 10 });

    await waitFor(() => {
      expect(expsProvider.mergedExp().get("margin-left")).toBe("-18px");
      expect(expsProvider.mergedExp().get("margin-right")).toBe("12px");
    });

    fireEvent.mouseDown(screen.getByTestId("box-edge-margin-top"), {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    const marginTopInput = await screen.findByLabelText("margin-top input");
    fireEvent.change(marginTopInput, { target: { value: "auto" } });
    fireEvent.keyDown(marginTopInput, { key: "Enter" });
    await waitFor(() => {
      expect(expsProvider.mergedExp().get("margin-top")).toBe("auto");
    });

    // 5. Corner radius uniform edit + Mix display when corners differ
    const radiusPill = screen.getByTestId("box-radius-pill");
    expect(radiusPill.textContent).toContain("12");
    fireEvent.click(radiusPill);
    const radiusInput = await screen.findByLabelText("border-radius input");
    fireEvent.change(radiusInput, { target: { value: "20" } });
    fireEvent.keyDown(radiusInput, { key: "Enter" });
    await waitFor(() => {
      expect(expsProvider.mergedExp().get("border-top-left-radius")).toBe("20px");
      expect(expsProvider.mergedExp().get("border-bottom-right-radius")).toBe("20px");
    });

    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        expsProvider.mergedExp().set("border-top-right-radius", "4px");
      });
    });
    expect(screen.getByTestId("box-radius-pill").textContent).toContain("Mix");
  });

  it("enforces partial read-only controls for img, ComponentRoot, TplComponent, and selective CodeComponent styleSections", async () => {
    const f = await setupStudioWithComponent();

    // Case A: <img> disables padding while keeping margin and radius editable
    const imgTpl = mkTplTagSimple("img");
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        $$$(f.root).append(imgTpl);
      });
    });
    const imgExps = await focusTpl(f, imgTpl);
    const imgCaps = resolveBoxGeometryCapabilities({ expsProvider: imgExps });
    expect(imgCaps.visible).toBe(true);
    expect(imgCaps.readOnly).toBe(false);
    expect(imgCaps.padding.editable).toBe(false);
    expect(imgCaps.margin.editable).toBe(true);
    expect(imgCaps.radius.editable).toBe(true);

    const mountedImg = render(
      f.wrapWithProvider(
        imgExps,
        <BoxGeometryCard expsProvider={imgExps} capabilities={imgCaps} />,
      ),
    );
    const imgPadTop = screen.getByTestId("box-edge-padding-top");
    expect(imgPadTop.getAttribute("aria-readonly")).toBe("true");
    fireEvent.mouseDown(imgPadTop, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseUp(window, { button: 0, clientX: 0, clientY: 0 });
    expect(screen.queryByLabelText("padding-top input")).toBeNull();
    mountedImg.unmount();

    // Case B: ComponentRoot disables margin while keeping padding editable
    const rootExps = await focusTpl(f, f.root);
    const rootCaps = resolveBoxGeometryCapabilities({ expsProvider: rootExps });
    expect(rootCaps.visible).toBe(true);
    expect(rootCaps.margin.editable).toBe(false);
    expect(rootCaps.padding.editable).toBe(true);

    // Case C: Standard (non-code) TplComponent instance disables padding & radius, allows margin
    const subInst = await act(async () => {
      let created!: ReturnType<typeof mkTplComponent>;
      await f.studioCtx.changeUnsafe(() => {
        const subComp = f.manager.addComponent({
          name: "SubCard",
          type: ComponentType.Plain,
        });
        created = mkTplComponent(subComp, f.component.variants[0]);
        $$$(f.root).append(created);
      });
      return created;
    });
    const instExps = await focusTpl(f, subInst);
    const instCaps = resolveBoxGeometryCapabilities({ expsProvider: instExps });
    expect(instCaps.visible).toBe(true);
    expect(instCaps.margin.editable).toBe(true);
    expect(instCaps.padding.editable).toBe(false);
    expect(instCaps.radius.editable).toBe(false);

    // Case D: CodeComponent restricting styleSections to [Sizing] only disables radius
    const sizedCC = mkCodeComponent(
      "SizedBox",
      {
        name: "SizedBox",
        importPath: "test",
        props: {},
        styleSections: [PublicStyleSection.Sizing],
      },
      {},
    );
    const ccInst = mkTplComponent(sizedCC, f.component.variants[0]);
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        trackComponentRoot(sizedCC);
        trackComponentSite(sizedCC, f.site);
        f.site.components.push(sizedCC);
        $$$(f.root).append(ccInst);
      });
    });
    const ccExps = await focusTpl(f, ccInst);
    const ccCaps = resolveBoxGeometryCapabilities({
      expsProvider: ccExps,
      enabledStyleSections: [PublicStyleSection.Sizing],
    });
    expect(ccCaps.visible).toBe(true);
    expect(ccCaps.radius.editable).toBe(false);
    expect(ccCaps.size.editable).toBe(true);
  });

  it("switches the entire Box to full read-only mode when readOnly or canEdit() is false", async () => {
    const f = await setupStudioWithComponent();
    const rs = ensure(f.site.activeTheme, "activeTheme").defaultStyle.rs;
    const exp = new RuleSetHelpers(rs, "div");
    exp.set("padding-top", "20px");
    const provider = new SingleRsExpsProvider(rs, exp, f.studioCtx, [], {
      kind: "ruleSet",
      rs,
      forTag: "div",
    });

    const mountedReadOnlyProp = render(
      f.wrapWithProvider(
        provider,
        <BoxGeometryCard expsProvider={provider} readOnly />,
      ),
    );
    expect(screen.getByTestId("box-geometry-card").getAttribute("data-readonly")).toBe("true");
    expect(screen.getByTestId("box-readonly-badge")).toBeTruthy();
    expect(screen.queryByTestId("box-link-toggle")).toBeNull();
    expect((screen.getByTestId("box-radius-pill") as HTMLButtonElement).disabled).toBe(true);

    // Attempt click + drag on padding-top must not open input or mutate exp
    const padTop = screen.getByTestId("box-edge-padding-top");
    fireEvent.mouseDown(padTop, { button: 0, clientX: 50, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 90, clientY: 10 });
    fireEvent.mouseUp(window, { button: 0, clientX: 90, clientY: 10 });
    expect(screen.queryByLabelText("padding-top input")).toBeNull();
    expect(exp.get("padding-top")).toBe("20px");
    mountedReadOnlyProp.unmount();

    // TplExpsProvider with canEdit() === false also forces full read-only
    const childExps = await focusTpl(f, f.child);
    vi.spyOn(childExps, "canEdit").mockReturnValue(false);
    const caps = resolveBoxGeometryCapabilities({ expsProvider: childExps });
    expect(caps.visible).toBe(true);
    expect(caps.readOnly).toBe(true);
    expect(caps.margin.editable).toBe(false);
    expect(caps.padding.editable).toBe(false);
    expect(caps.radius.editable).toBe(false);
  });

  it("hides Box completely when styles cannot be resolved or are disabled (TplSlot, styleSections: false, missingPositionClass, hidden UiConfig)", async () => {
    const f = await setupStudioWithComponent();

    // Case 1: TplSlot -> not shown
    const slotParam = mkParam({
      name: "children",
      type: typeFactory.renderable(),
      paramType: "slot",
    });
    const slotNode = mkSlot(slotParam);
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        f.component.params.push(slotParam);
        $$$(f.root).append(slotNode);
      });
    });
    const slotExps = new TplExpsProvider(f.viewCtx, slotNode as unknown as TplNode);
    expect(resolveBoxGeometryCapabilities({ expsProvider: slotExps }).visible).toBe(false);
    const slotRender = render(
      f.wrapWithProvider(
        slotExps,
        <BoxGeometrySection expsProvider={slotExps} />,
      ),
    );
    expect(screen.queryByTestId("box-geometry-card")).toBeNull();
    slotRender.unmount();

    // Case 2: Unstyleable code component (styleSections: false):
    // - without a real DOM node (e.g. Table.ExpandColumn / virtual node) -> hidden
    // - with a projected canvas part wrapper (data-plasmic-canvas-part="column") -> hidden
    // - with a real DOM node (e.g. AppShell / Tabs) -> shown in read-only mode with live size & computed styles
    const unstyleableMeta = {
      name: "OpaqueWidget",
      importPath: "test",
      props: {},
      styleSections: false as const,
    };
    const unstyleableCC = mkCodeComponent(
      "OpaqueWidget",
      unstyleableMeta,
      {},
    );
    const opaqueInst = mkTplComponent(unstyleableCC, f.component.variants[0]);
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        trackComponentRoot(unstyleableCC);
        trackComponentSite(unstyleableCC, f.site);
        f.site.components.push(unstyleableCC);
        $$$(f.root).append(opaqueInst);
      });
    });
    const getCcMapSpy = vi
      .spyOn(f.studioCtx.codeComponentsRegistry, "getRegisteredCodeComponentsMap")
      .mockReturnValue(
        new Map([
          [
            "OpaqueWidget",
            {
              meta: unstyleableMeta,
            } as ReturnType<
              typeof f.studioCtx.codeComponentsRegistry.getRegisteredCodeComponentsMap
            > extends Map<string, infer V>
              ? V
              : never,
          ],
        ]),
      );
    const opaqueExps = await focusTpl(f, opaqueInst);
    expect(resolveBoxGeometryCapabilities({ expsProvider: opaqueExps }).visible).toBe(false);
    const opaqueRender = render(
      f.wrapWithProvider(
        opaqueExps,
        <BoxGeometryCard expsProvider={opaqueExps} />,
      ),
    );
    expect(screen.queryByTestId("box-geometry-card")).toBeNull();
    opaqueRender.unmount();

    const partEl = document.createElement("th");
    partEl.setAttribute("data-plasmic-canvas-part", "column");
    const partSpy = vi
      .spyOn(opaqueExps, "forDom")
      .mockReturnValue([partEl] as unknown as JQuery);
    expect(resolveBoxGeometryCapabilities({ expsProvider: opaqueExps }).visible).toBe(false);
    partSpy.mockRestore();

    const realOpaqueEl = document.createElement("div");
    Object.defineProperty(realOpaqueEl, "offsetWidth", { value: 420, configurable: true });
    Object.defineProperty(realOpaqueEl, "offsetHeight", { value: 180, configurable: true });
    realOpaqueEl.style.paddingTop = "16px";
    realOpaqueEl.style.marginBottom = "12px";
    realOpaqueEl.style.borderTopLeftRadius = "8px";
    realOpaqueEl.style.borderTopRightRadius = "8px";
    realOpaqueEl.style.borderBottomRightRadius = "8px";
    realOpaqueEl.style.borderBottomLeftRadius = "8px";
    const domSpy = vi
      .spyOn(opaqueExps, "forDom")
      .mockReturnValue([realOpaqueEl] as unknown as JQuery);
    const opaqueCapsWithDom = resolveBoxGeometryCapabilities({ expsProvider: opaqueExps });
    expect(opaqueCapsWithDom.visible).toBe(true);
    expect(opaqueCapsWithDom.readOnly).toBe(true);
    expect(opaqueCapsWithDom.readFromComputedStyle).toBe(true);

    const opaqueWithDomRender = render(
      f.wrapWithProvider(
        opaqueExps,
        <BoxGeometrySection expsProvider={opaqueExps} />,
      ),
    );
    expect(screen.getByTestId("box-geometry-card").getAttribute("data-readonly")).toBe("true");
    expect(screen.getByTestId("box-readonly-badge")).toBeTruthy();
    expect(screen.getByTestId("box-core-size").textContent).toBe("420×180");
    expect(screen.getByTestId("box-edge-padding-top").textContent).toBe("16");
    expect(screen.getByTestId("box-edge-margin-bottom").textContent).toBe("12");
    expect(screen.getByTestId("box-radius-pill").textContent).toContain("8");
    opaqueWithDomRender.unmount();
    domSpy.mockRestore();
    getCcMapSpy.mockRestore();

    // Case 3: Code component missing forwarded className (and not styleSections: true):
    // hidden without real DOM, shown read-only when a real DOM node exists
    const normalCC = mkCodeComponent(
      "ForwardedWidget",
      { name: "ForwardedWidget", importPath: "test", props: {} },
      {},
    );
    const normalCCInst = mkTplComponent(normalCC, f.component.variants[0]);
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        trackComponentRoot(normalCC);
        trackComponentSite(normalCC, f.site);
        f.site.components.push(normalCC);
        $$$(f.root).append(normalCCInst);
      });
    });
    const missingClassExps = await focusTpl(f, normalCCInst);
    expect(
      resolveBoxGeometryCapabilities({
        expsProvider: missingClassExps,
        missingPositionClass: true,
      }).visible,
    ).toBe(false);

    const realMissingClassEl = document.createElement("div");
    Object.defineProperty(realMissingClassEl, "offsetWidth", { value: 260, configurable: true });
    Object.defineProperty(realMissingClassEl, "offsetHeight", { value: 96, configurable: true });
    const missingClassDomSpy = vi
      .spyOn(missingClassExps, "forDom")
      .mockReturnValue([realMissingClassEl] as unknown as JQuery);
    const missingClassCapsWithDom = resolveBoxGeometryCapabilities({
      expsProvider: missingClassExps,
      missingPositionClass: true,
    });
    expect(missingClassCapsWithDom.visible).toBe(true);
    expect(missingClassCapsWithDom.readOnly).toBe(true);
    const missingClassRender = render(
      f.wrapWithProvider(
        missingClassExps,
        <BoxGeometryCard expsProvider={missingClassExps} capabilities={missingClassCapsWithDom} />,
      ),
    );
    expect(screen.getByTestId("box-geometry-card").getAttribute("data-readonly")).toBe("true");
    expect(screen.getByTestId("box-core-size").textContent).toBe("260×96");
    missingClassRender.unmount();
    missingClassDomSpy.mockRestore();

    // Case 4: UiConfig disables all Box sections -> not shown
    const hiddenConfig: UiConfig = {
      styleSectionVisibilities: {
        [PublicStyleSection.Sizing]: false,
        [PublicStyleSection.Spacing]: false,
        [PublicStyleSection.Border]: false,
      },
    };
    const childExps = await focusTpl(f, f.child);
    expect(
      resolveBoxGeometryCapabilities({
        expsProvider: childExps,
        uiConfig: hiddenConfig,
      }).visible,
    ).toBe(false);

    // Partial UiConfig in contentEditorMode enables only configured Box sections
    const partialEditorCaps = resolveBoxGeometryCapabilities({
      expsProvider: childExps,
      contentEditorMode: true,
      uiConfig: {
        styleSectionVisibilities: {
          [PublicStyleSection.Sizing]: false,
          [PublicStyleSection.Spacing]: true,
          [PublicStyleSection.Border]: false,
        },
      },
    });
    expect(partialEditorCaps.visible).toBe(true);
    expect(partialEditorCaps.margin.editable).toBe(true);
    expect(partialEditorCaps.padding.editable).toBe(true);
    expect(partialEditorCaps.radius.editable).toBe(false);
    expect(partialEditorCaps.size.editable).toBe(false);
  });

  it("aligns SingleRsExpsProvider section filters, lock/branch permissions, and variant blocking", async () => {
    const f = await setupStudioWithComponent();
    const rs = ensure(f.site.activeTheme, "activeTheme").defaultStyle.rs;
    const exp = new RuleSetHelpers(rs, "div");
    const singleProvider = new SingleRsExpsProvider(rs, exp, f.studioCtx, [], {
      kind: "ruleSet",
      rs,
      forTag: "div",
    });

    // Typography-only DefaultStylesPanel mode (enabledStyleSections: false) hides Box
    expect(
      resolveBoxGeometryCapabilities({
        expsProvider: singleProvider,
        enabledStyleSections: false,
      }).visible,
    ).toBe(false);

    // ThemeInitialStylesPanel mode ([Sizing, Spacing]) enables margin/padding/size, disables radius
    const initCaps = resolveBoxGeometryCapabilities({
      expsProvider: singleProvider,
      enabledStyleSections: [PublicStyleSection.Sizing, PublicStyleSection.Spacing],
    });
    expect(initCaps.visible).toBe(true);
    expect(initCaps.margin.editable).toBe(true);
    expect(initCaps.padding.editable).toBe(true);
    expect(initCaps.size.editable).toBe(true);
    expect(initCaps.radius.editable).toBe(false);

    // Locked element & read-only project/branch align to full read-only
    const childExps = await focusTpl(f, f.child);
    const lockedCaps = resolveBoxGeometryCapabilities({
      expsProvider: childExps,
      locked: true,
    });
    expect(lockedCaps.readOnly).toBe(true);
    expect(lockedCaps.readOnlyReason).toBe("Element is locked");

    const branchSpy = vi.spyOn(f.studioCtx, "canEditBranch").mockReturnValue(false);
    expect(
      resolveBoxGeometryCapabilities({ expsProvider: childExps }).readOnly,
    ).toBe(true);
    branchSpy.mockRestore();

    // Real variant blocking: active non-targeted variant sets padding-top while Base is targeted
    const vc = ensure(
      makeVariantsController(f.studioCtx, f.viewCtx),
      "VariantsController",
    );
    let hoverVariant!: ReturnType<typeof f.studioCtx.tplMgr> extends {
      createPrivateStyleVariant: (...args: never[]) => infer R;
    }
      ? R
      : never;
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        hoverVariant = f.studioCtx
          .tplMgr()
          .createPrivateStyleVariant(f.component, f.child, [":hover"]);
        const hoverVs = ensureVariantSetting(f.child, [hoverVariant]);
        new RuleSetHelpers(hoverVs.rs, "div").set("padding-top", "44px");
        vc.onClickVariant(hoverVariant);
        vc.onTargetVariant(hoverVariant, false);
      });
    });

    const activeChildExps = await focusTpl(f, f.child);
    render(
      f.wrapWithProvider(
        activeChildExps,
        <BoxGeometryCard expsProvider={activeChildExps} />,
      ),
    );
    const padTop = screen.getByTestId("box-edge-padding-top");
    expect(padTop.getAttribute("aria-readonly")).toBe("true");
    expect(padTop.textContent).toBe("44");
    fireEvent.mouseDown(padTop, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    expect(screen.queryByLabelText("padding-top input")).toBeNull();

    // Unblocked padding-bottom edits cleanly without overwriting blocked padding-top
    const padBottom = screen.getByTestId("box-edge-padding-bottom");
    expect(padBottom.getAttribute("aria-readonly")).toBe("false");
    fireEvent.mouseDown(padBottom, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    const botInput = screen.getByLabelText("padding-bottom input") as HTMLInputElement;
    fireEvent.change(botInput, { target: { value: "28" } });
    fireEvent.keyDown(botInput, { key: "Enter" });
    await waitFor(() => {
      expect(activeChildExps.mergedExp().get("padding-bottom")).toBe("28px");
    });
    expect(activeChildExps.mergedExp().get("padding-top")).toBe("44px");
  });

  it("aligns multi-selection Mix states, partial component capability intersections, and batch edits", async () => {
    const f = await setupStudioWithComponent();
    const second = mkTplTagSimple("div");
    const subComp = f.studioCtx.tplMgr().addComponent({
      name: "SubCard",
      type: ComponentType.Plain,
    });
    const inst = mkTplComponent(subComp, f.component.variants[0]);
    const baseCombo = [f.component.variants[0]];
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        $$$(f.root).append(second);
        $$$(f.root).append(inst);
        const childVs = ensureVariantSetting(f.child, baseCombo);
        const secondVs = ensureVariantSetting(second, baseCombo);
        new RuleSetHelpers(childVs.rs, "div").set("padding-top", "12px");
        new RuleSetHelpers(childVs.rs, "div").set("margin-left", "8px");
        new RuleSetHelpers(secondVs.rs, "div").set("padding-top", "24px");
        new RuleSetHelpers(secondVs.rs, "div").set("margin-left", "8px");
      });
    });

    const valStateSpy = vi
      .spyOn(f.viewCtx.valState(), "maybeValUserRoot")
      .mockReturnValue(undefined);
    const selectablesSpy = vi
      .spyOn(f.viewCtx, "focusedSelectables")
      .mockReturnValue([
        { tpl: f.child } as never,
        { tpl: second } as never,
      ]);
    f.viewCtx.selection.setTpls([f.child, second]);

    const providers = getMultiSelectionProviders(f.viewCtx);
    const multiState = getMultiSelectionBoxGeometryState(f.viewCtx, providers, {
      canEditProject: true,
      canEditBranch: true,
    });
    expect(multiState.capabilities.visible).toBe(true);
    expect(multiState.capabilities.padding.editable).toBe(true);
    expect(multiState.values["padding-top"].mixed).toBe(true);
    expect(multiState.values["margin-left"].mixed).toBe(false);
    expect(multiState.values["margin-left"].value).toBe("8px");

    const rendered = render(
      f.wrapWithProvider(
        providers[0],
        <BoxGeometryCard
          expsProvider={providers[0]}
          multiTarget={{
            ...multiState,
            measuredSize: { w: 420, h: 160 },
            onCommitProps: (entries) => {
              void setMultiSelectionBoxProps(f.viewCtx, entries);
            },
          }}
        />,
      ),
    );
    expect(screen.getByTestId("box-core-size").textContent).toBe("420×160");
    expect(screen.getByTestId("box-edge-padding-top").textContent).toBe("Mix");
    expect(screen.getByTestId("box-edge-margin-left").textContent).toBe("8");

    // Batch edit padding-top applies to both selected nodes
    const padTop = screen.getByTestId("box-edge-padding-top");
    fireEvent.mouseDown(padTop, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    const input = screen.getByLabelText("padding-top input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "18" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(f.child.vsettings[0].rs.values["padding-top"]).toBe("18px");
      expect(second.vsettings[0].rs.values["padding-top"]).toBe("18px");
    });
    rendered.unmount();

    // Selecting div + non-code TplComponent intersects capabilities: margin editable, padding/radius read-only
    selectablesSpy.mockReturnValue([
      { tpl: f.child } as never,
      { tpl: inst } as never,
    ]);
    f.viewCtx.selection.setTpls([f.child, inst]);
    const mixedCompState = getMultiSelectionBoxGeometryState(
      f.viewCtx,
      getMultiSelectionProviders(f.viewCtx),
      { canEditProject: true, canEditBranch: true },
    );
    expect(mixedCompState.capabilities.visible).toBe(true);
    expect(mixedCompState.capabilities.margin.editable).toBe(true);
    expect(mixedCompState.capabilities.padding.editable).toBe(false);
    expect(mixedCompState.capabilities.radius.editable).toBe(false);

    valStateSpy.mockRestore();
    selectablesSpy.mockRestore();
  });

  it("measures cross-frame DOM elements, shows concrete size labels, and jumps to size section", async () => {
    const f = await setupStudioWithComponent();
    const expsProvider = await focusTpl(f, f.child);
    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        expsProvider.mergedExp().set("width", "100%");
        expsProvider.mergedExp().set("height", "default");
      });
    });

    // 1. Unmeasured fallback includes concrete style dimensions in aria-label
    const unmeasured = render(
      f.wrapWithProvider(
        expsProvider,
        <div className="style-tab">
          <BoxGeometryCard expsProvider={expsProvider} />
          <div data-test-id="size-section">Size controls</div>
        </div>,
      ),
    );
    const sizeBtn = screen.getByTestId("box-core-size");
    expect(sizeBtn.textContent).toBe("100%×auto");
    expect(sizeBtn.getAttribute("aria-label")).toContain("100% × auto");

    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        expsProvider.mergedExp().set("width", "stretch");
        expsProvider.mergedExp().set("height", "wrap");
      });
    });
    expect(screen.getByTestId("box-core-size").textContent).toBe("100%×auto");
    expect(screen.getByTestId("box-core-size").getAttribute("aria-label")).toContain(
      "100% × auto",
    );

    const sizeSection = unmeasured.container.querySelector(
      '[data-test-id="size-section"]',
    ) as HTMLElement;
    const scrollIntoViewMock = vi.fn();
    sizeSection.scrollIntoView = scrollIntoViewMock;
    fireEvent.click(sizeBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    unmeasured.unmount();

    // 2. Cross-frame canvas element (not instanceof host HTMLElement) still measures pixels
    const foreignElement = {
      nodeType: 1,
      offsetWidth: 344,
      offsetHeight: 218,
      getBoundingClientRect: () => ({ width: 172, height: 109 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    vi.spyOn(expsProvider, "forDom").mockReturnValue([
      foreignElement,
    ] as unknown as JQuery);

    const measured = render(
      f.wrapWithProvider(
        expsProvider,
        <BoxGeometryCard expsProvider={expsProvider} />,
      ),
    );
    expect(screen.getByTestId("box-core-size").textContent).toBe("344×218");
    expect(screen.getByTestId("box-core-size").getAttribute("aria-label")).toContain(
      "344 × 218 px",
    );
    measured.unmount();
  });
});
