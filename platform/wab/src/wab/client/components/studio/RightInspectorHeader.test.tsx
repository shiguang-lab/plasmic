import "@testing-library/jest-dom/vitest";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightInspectorHeader } from "@/wab/client/components/studio/RightInspectorHeader";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkSlot, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import {
  CodeComponentMeta,
  ensureKnownSlotParam,
  ensureKnownTplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

class FakeIntersectionObserver {
  observe() { return undefined; }
  disconnect() { return undefined; }
  unobserve() { return undefined; }
  takeRecords() { return []; }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RightInspectorHeader", () => {
  it("renders 2-row header with icon-only Create/Go-to component, Base state pill, and read-only description only when present", async () => {
    vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
    vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);

    const site = createSite();
    const manager = new TplMgr({ site });
    const comp = manager.addComponent({
      name: "Host Component",
      type: ComponentType.Plain,
    });
    const root = ensureKnownTplTag(comp.tplTree);
    const childTag = mkTplTagX("div", { name: "CardBox" });
    $$$(root).append(childTag);
    manager.ensureBaseVariantSetting(childTag);

    const ownedTarget = manager.addComponent({
      name: "Owned Button",
      type: ComponentType.Plain,
    });
    const ownedInst = mkTplComponent(ownedTarget, comp.variants[0]);
    $$$(root).append(ownedInst);

    const codeTarget = manager.addComponent({
      name: "AntdTag",
      type: ComponentType.Plain,
    });
    codeTarget.type = ComponentType.Code;
    codeTarget.codeComponentMeta = new CodeComponentMeta({
      importPath: "@shiguang-lab/plasmic-antd6",
      defaultExport: false,
      importName: "AntdTag",
      displayName: "AntdTag",
      description: "Compact semantic status label.\nSecond line details for popover.",
      section: null,
      thumbnailUrl: null,
      classNameProp: null,
      refProp: null,
      defaultStyles: null,
      defaultDisplay: null,
      isHostLess: false,
      isContext: false,
      isAttachment: false,
      providesData: false,
      hasRef: false,
      isRepeatable: false,
      subtreePrefetchingConfig: null,
      styleSections: null,
      helpers: null,
      defaultSlotContents: {},
      variants: {},
      refActions: [],
    });
    const codeInst = mkTplComponent(codeTarget, comp.variants[0]);
    $$$(root).append(codeInst);

    const slotParam = ensureKnownSlotParam(
      mkParam({
        name: "footer",
        paramType: "slot",
        type: typeFactory.renderable(),
        about: "Slot footer caption.\nSecond line details for popover.",
      }),
    );
    comp.params.push(slotParam);
    const slotNode = mkSlot(slotParam);
    $$$(root).append(slotNode);

    const frame = mkArenaFrame({
      site,
      component: comp,
      name: "Host Component",
      width: 400,
      height: 200,
    });
    site.arenas.push(mkMixedArena("Host Component", [frame]));

    const { studioCtx, appCtx } = fakeStudioCtx({
      site,
      initialUrl: "/projects/test?arena_type=custom&arena=Host%20Component",
    });
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const viewCtx = ensure(studioCtx.tryGetViewCtxForFrame(frame), "viewCtx");
    studioCtx.setStudioFocusOnFrameContents(frame);
    studioCtx.setStudioFocusOnViewCtxContent(viewCtx);
    viewCtx.setStudioFocusByTpl(childTag);

    const renderHeader = (selectedTpl: any) => (
      <AppCtxContext.Provider value={appCtx}>
        <StudioCtxContext.Provider value={studioCtx}>
          <RightInspectorHeader
            studioCtx={studioCtx}
            focusedViewCtx={viewCtx}
            selectedTpl={selectedTpl}
            focusedComponent={comp}
            isMultiSelection={false}
            isFrameSelection={false}
            selectionCount={1}
            inspectorTitle={selectedTpl.name ?? "Element"}
            rightTabKey={RightTabKey.style}
            contentOnly={false}
          />
        </StudioCtxContext.Provider>
      </AppCtxContext.Provider>
    );

    const mounted = render(renderHeader(childTag));
    const byTestId = (id: string) =>
      mounted.container.querySelector(`[data-test-id="${id}"]`);
    try {
      await waitFor(() =>
        expect(byTestId("inspector-element-name")).toHaveValue("CardBox"),
      );
      expect(byTestId("inspector-component-subtitle")).toBeNull();
      expect(byTestId("inspector-readonly-description")).toBeNull();
      expect(byTestId("inspector-more-menu-button")).toBeNull();
      const createBtn = ensure(
        byTestId("header-create-component-btn"),
        "header-create-component-btn",
      );
      expect(createBtn).toHaveAttribute("aria-label", "Create component");
      expect(createBtn.textContent?.trim()).toBe("");
      expect(byTestId("inspector-state-switcher")).toHaveTextContent("Base");

      // Targeting a private style variant updates the state switcher pill label
      await act(async () => {
        await studioCtx.changeUnsafe(() => {
          const hover = studioCtx
            .tplMgr()
            .createPrivateStyleVariant(comp, childTag, [":hover"]);
          makeVariantsController(studioCtx, viewCtx)?.onClickVariant(hover);
        });
      });
      await waitFor(() =>
        expect(byTestId("inspector-state-switcher")?.textContent).toMatch(
          /hover/i,
        ),
      );

      // Code component instance displays component name in row 2 and a compact info trigger for description
      await act(async () => {
        await studioCtx.changeUnsafe(() => makeVariantsController(studioCtx, viewCtx)?.onClearVariants());
      });
      mounted.rerender(renderHeader(codeInst));
      const codeSubtitle = await waitFor(() =>
        ensure(
          byTestId("inspector-component-subtitle"),
          "inspector-component-subtitle",
        ),
      );
      expect(codeSubtitle).toHaveTextContent("AntdTag");
      const infoTrigger = ensure(
        byTestId("inspector-readonly-description"),
        "inspector-readonly-description",
      );
      expect(infoTrigger).toHaveAttribute("aria-label", "Description");
      expect(mounted.container.textContent).not.toContain(
        "Compact semantic status label.",
      );
      expect(byTestId("header-create-component-btn")).toBeNull();
      expect(byTestId("header-go-to-component-btn")).toBeNull();
      expect(byTestId("inspector-state-switcher")).toBeNull();
      const baseLabel = ensure(byTestId("inspector-state-label"), "Static Base label");
      expect(baseLabel.tagName).toBe("SPAN");
      expect(baseLabel).toHaveTextContent("Base");
      expect(baseLabel).not.toHaveAttribute("tabindex");
      fireEvent.click(baseLabel);
      expect(screen.queryByRole("menu")).toBeNull();

      // Existing component states keep the switcher and its menu available.
      await act(async () => {
        await studioCtx.changeUnsafe(() => {
          studioCtx.tplMgr().createStyleVariant(comp, [":focus"]);
        });
      });
      mounted.rerender(renderHeader(codeInst));
      const stateButton = ensure(byTestId("inspector-state-switcher"), "State switcher with choices");
      expect(stateButton.tagName).toBe("BUTTON");
      fireEvent.click(stateButton);
      expect(await screen.findByRole("menuitem", { name: /focus/i })).toBeInTheDocument();
      fireEvent.click(stateButton);

      // Owned Plasmic component instance displays component name + icon-only Go to component button
      mounted.rerender(renderHeader(ownedInst));
      const gotoBtn = await waitFor(() =>
        ensure(
          byTestId("header-go-to-component-btn"),
          "header-go-to-component-btn",
        ),
      );
      expect(gotoBtn).toHaveAttribute("aria-label", "Go to component");
      expect(gotoBtn.textContent?.trim()).toBe("");
      expect(byTestId("inspector-component-subtitle")).toHaveTextContent(
        "Owned Button",
      );
      expect(byTestId("inspector-readonly-description")).toBeNull();

      // Slot with about text renders single-line overflow strip without .markdown-body
      mounted.rerender(renderHeader(slotNode));
      const slotDesc = await waitFor(() =>
        ensure(
          byTestId("inspector-readonly-description"),
          "inspector-readonly-description",
        ),
      );
      expect(slotDesc).toHaveTextContent(
        "Slot footer caption. Second line details for popover.",
      );
      expect(
        slotDesc.querySelector(".editor-panel-description__content"),
      ).not.toBeNull();
      expect(slotDesc.querySelector(".markdown-body")).toBeNull();
      expect(slotDesc.querySelector("p, br")).toBeNull();
    } finally {
      mounted.unmount();
      await studioCtx.awaitEval();
      studioCtx.dispose();
    }
  });

  it("renders a direct Page settings icon button (without More dropdown) on the Page panel header", async () => {
    vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
    vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);

    const site = createSite();
    const manager = new TplMgr({ site });
    const page = manager.addComponent({
      name: "Home",
      type: ComponentType.Page,
    });
    const frame = mkArenaFrame({
      site,
      component: page,
      name: "Home",
      width: 400,
      height: 200,
    });
    site.arenas.push(mkMixedArena("Home", [frame]));

    const { studioCtx, appCtx } = fakeStudioCtx({
      site,
      initialUrl: "/projects/test?arena_type=custom&arena=Home",
    });
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const viewCtx = ensure(studioCtx.tryGetViewCtxForFrame(frame), "viewCtx");

    const mounted = render(
      <AppCtxContext.Provider value={appCtx}>
        <StudioCtxContext.Provider value={studioCtx}>
          <RightInspectorHeader
            studioCtx={studioCtx}
            focusedViewCtx={viewCtx}
            selectedTpl={undefined}
            focusedComponent={page}
            isMultiSelection={false}
            isFrameSelection={false}
            selectionCount={0}
            inspectorTitle="Home"
            rightTabKey={RightTabKey.component}
            contentOnly={false}
          />
        </StudioCtxContext.Provider>
      </AppCtxContext.Provider>,
    );
    const byTestId = (id: string) =>
      mounted.container.querySelector(`[data-test-id="${id}"]`);
    try {
      const settingsBtn = await waitFor(() =>
        ensure(byTestId("page-settings-button"), "page-settings-button"),
      );
      expect(settingsBtn).toHaveAttribute("aria-label", "Page settings");
      expect(byTestId("inspector-more-menu-button")).toBeNull();

      await act(async () => {
        fireEvent.click(settingsBtn);
      });
      expect(studioCtx.pageSettingsPage).toBe(page);
      expect(studioCtx.pageSettingsOpen).toBe(true);

      const onOpenComponentSettings = vi.fn();
      const customComp = manager.addComponent({
        name: "ButtonCard",
        type: ComponentType.Plain,
      });
      mounted.rerender(
        <AppCtxContext.Provider value={appCtx}>
          <StudioCtxContext.Provider value={studioCtx}>
            <RightInspectorHeader
              studioCtx={studioCtx}
              focusedViewCtx={viewCtx}
              selectedTpl={undefined}
              focusedComponent={customComp}
              isMultiSelection={false}
              isFrameSelection={false}
              selectionCount={0}
              inspectorTitle="ButtonCard"
              rightTabKey={RightTabKey.component}
              contentOnly={false}
              onOpenComponentSettings={onOpenComponentSettings}
            />
          </StudioCtxContext.Provider>
        </AppCtxContext.Provider>,
      );
      const compSettingsBtn = await waitFor(() =>
        ensure(
          byTestId("component-settings-button"),
          "component-settings-button",
        ),
      );
      expect(compSettingsBtn).toHaveAttribute(
        "aria-label",
        "Component settings",
      );
      expect(byTestId("inspector-more-menu-button")).toBeNull();
      fireEvent.click(compSettingsBtn);
      expect(onOpenComponentSettings).toHaveBeenCalledTimes(1);
    } finally {
      mounted.unmount();
      await studioCtx.awaitEval();
      studioCtx.dispose();
    }
  });
});
