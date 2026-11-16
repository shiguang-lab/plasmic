import "@testing-library/jest-dom/vitest";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { MixinsSection } from "@/wab/client/components/sidebar-tabs/MixinsSection";
import sectionStyles from "@/wab/client/components/sidebar/SidebarSection.module.scss";
import { StyleTabContext } from "@/wab/client/components/sidebar-tabs/style-tab";
import { getOrderedSectionRender, Section } from "@/wab/client/components/sidebar-tabs/Sections";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
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

describe("MixinsSection & Sections tab routing", () => {
  it("renders a zero-noise single-row header when empty and opens picker on + click", async () => {
    vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
    vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);

    const site = createSite();
    const manager = new TplMgr({ site });
    const component = manager.addComponent({
      name: "Preset Host",
      type: ComponentType.Plain,
    });
    const root = ensureKnownTplTag(component.tplTree);
    manager.addMixin("CardSurface");
    const frame = mkArenaFrame({
      site,
      component,
      name: "Preset Host",
      width: 400,
      height: 200,
    });
    site.arenas.push(mkMixedArena("Preset Host", [frame]));

    const { studioCtx, appCtx } = fakeStudioCtx({
      site,
      initialUrl: "/projects/test?arena_type=custom&arena=Preset%20Host",
    });
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const viewCtx = ensure(studioCtx.tryGetViewCtxForFrame(frame), "viewCtx");
    studioCtx.setStudioFocusOnViewCtxContent(viewCtx);
    viewCtx.setStudioFocusByTpl(root);

    const mounted = render(
      <AppCtxContext.Provider value={appCtx}>
        <StudioCtxContext.Provider value={studioCtx}>
          <StyleTabContext.Provider value="design">
            <MixinsSection tpl={root} viewCtx={viewCtx} />
          </StyleTabContext.Provider>
        </StudioCtxContext.Provider>
      </AppCtxContext.Provider>,
    );

    try {
      const addButton = await waitFor(() => {
        const el = mounted.container.querySelector<HTMLButtonElement>(
          '[data-test-id="add-mixin-button"]',
        );
        expect(el).not.toBeNull();
        return ensure(el, "add-mixin-button");
      });
      expect(screen.queryByRole("textbox")).toBeNull();

      const header = ensure(mounted.container.querySelector(`.${sectionStyles.headerRoot}`), "Style presets header");
      fireEvent.click(header);
      fireEvent.click(ensure(header.querySelector(`.${sectionStyles.headerTitle}`), "Style presets title"));
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByText("CardSurface")).toBeNull();

      await act(async () => {
        fireEvent.click(addButton);
      });
      await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
      expect(screen.getByText("CardSurface")).toBeInTheDocument();
    } finally {
      mounted.unmount();
      await studioCtx.awaitEval();
      studioCtx.dispose();
    }
  });

  it("includes Section.Mixins in Design even when renderOpts does not pre-open it, and splits props into Props tab", async () => {
    vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
    vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);

    const site = createSite();
    const manager = new TplMgr({ site });
    const component = manager.addComponent({
      name: "Section Router Host",
      type: ComponentType.Plain,
    });
    const root = ensureKnownTplTag(component.tplTree);
    const frame = mkArenaFrame({
      site,
      component,
      name: "Section Router Host",
      width: 400,
      height: 200,
    });
    site.arenas.push(mkMixedArena("Section Router Host", [frame]));

    const { studioCtx } = fakeStudioCtx({
      site,
      initialUrl: "/projects/test?arena_type=custom&arena=Section%20Router%20Host",
    });
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const viewCtx = ensure(studioCtx.tryGetViewCtxForFrame(frame), "viewCtx");

    try {
      const designRenders = getOrderedSectionRender(
        root,
        viewCtx,
        new Map([
          [Section.Mixins, false],
          [Section.PrivateStyleVariants, false],
        ]),
        "design",
        false,
      );
      const designElements = designRenders
        .map((r) => r())
        .filter(Boolean) as React.ReactElement[];
      expect(designElements.some((el) => el.key?.toString().includes("mixins"))).toBe(
        true,
      );
      expect(
        designElements.some((el) =>
          el.key?.toString().includes("private-variants"),
        ),
      ).toBe(true);
      expect(designElements.some((el) => el.key?.toString().includes("tag"))).toBe(
        false,
      );

      const propsRenders = getOrderedSectionRender(
        root,
        viewCtx,
        new Map(),
        "props",
        false,
      );
      const propsElements = propsRenders
        .map((r) => r())
        .filter(Boolean) as React.ReactElement[];
      expect(propsElements.some((el) => el.key?.toString().includes("tag"))).toBe(
        true,
      );
      expect(propsElements.some((el) => el.key?.toString().includes("mixins"))).toBe(
        false,
      );
    } finally {
      await studioCtx.awaitEval();
      studioCtx.dispose();
    }
  });
});
