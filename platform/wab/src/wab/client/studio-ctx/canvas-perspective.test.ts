import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { Box, Pt } from "@/wab/shared/geom";
import { ensurePageOverviewArena } from "@/wab/shared/page-overview";
import { mock } from "vitest-mock-extended";

it("focuses existing artboards without replacing pages, and restores overview after resizing", async () => {
  const { studioCtx } = fakeStudioCtx();
  vi.spyOn(studioCtx, "tryZoomToFitArena").mockImplementation(() => undefined);
  try {
    const arena = await studioCtx.changeUnsafe(() => {
      const result = studioCtx.addArena("Pages");
      for (let index = 0; index < 4; index++) {
        const page = studioCtx.addComponent(`Page${index + 1}`, {
          type: ComponentType.Page,
          noSwitchArena: true,
        });
        studioCtx.tplMgr().addNewMixedArenaFrame(result, page.name, page, {
          width: 1440,
          height: 1024,
          insertPt: new Pt(index * 1520, 0),
        });
      }
      return result;
    });
    const frames = [...arena.children];
    const components = [...studioCtx.site.components];
    const dom = mock<DomActions>();
    const viewport = new ViewportCtx({
      dom,
      initialArena: arena,
      initialClipperBox: new Box(0, 0, 1440, 900),
      initialClipperScroll: new Pt(400, 200),
    });
    studioCtx.viewportCtx = viewport;
    viewport.scaleAtMidPt(0.25);
    const overview = studioCtx.getCurrentStudioViewportSnapshot();
    const zoom = vi
      .spyOn(studioCtx, "tryZoomToFitFrame")
      .mockImplementation(() => undefined);
    studioCtx.focusCanvasFrame(frames[0]);
    studioCtx.focusCanvasFrame(frames[2]);
    expect(zoom).toHaveBeenLastCalledWith(frames[2], 1);
    expect(studioCtx.canvasFocusActive).toBe(true);
    expect(arena.children).toEqual(frames);
    expect(studioCtx.site.components).toEqual(components);
    viewport.scaleAtMidPt(1);
    viewport.setClipperBox(new Box(0, 0, 1024, 768));
    studioCtx.returnToCanvasOverview();
    expect(studioCtx.canvasFocusActive).toBe(false);
    expect(viewport.scale()).toBe(overview.scale);
    expect(dom.scrollTo).toHaveBeenLastCalledWith(
      overview.scroll.plus(
        viewport.canvasPadding().sub(overview.canvasPadding),
      ),
      false,
    );
    expect(arena.children).toEqual(frames);
    viewport.dispose();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    studioCtx.dispose();
  }
});

it("edits shared page metadata through the normal undo and save flow", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  vi.spyOn(studioCtx, "tryZoomToFitArena").mockImplementation(() => undefined);
  try {
    const page = await studioCtx.changeUnsafe(() =>
      studioCtx.addComponent("Page1", {
        type: ComponentType.Page,
        noSwitchArena: true,
      }),
    );
    const arena = await studioCtx.changeUnsafe(() =>
      ensurePageOverviewArena(studioCtx.tplMgr()),
    );
    const frame = arena.children[0];
    const meta = ensure(page.pageMeta, "Expected page metadata");
    const originalTitle = meta.title;
    const bundle = studioCtx
      .bundler()
      .bundle(
        studioCtx.site,
        studioCtx.siteInfo.id,
        studioCtx.appCtx.lastBundleVersion,
      );
    studioCtx
      .bundler()
      .unbundleAndRecomputeParents(bundle, studioCtx.siteInfo.id);
    await studioCtx.changeUnsafe(() => {
      meta.title = "Edited from overview";
    });
    expect(frame.container.component.pageMeta?.title).toBe(
      "Edited from overview",
    );
    expect(
      ensure(
        getDedicatedArena(studioCtx.site, page),
        "Expected dedicated page arena",
      ).component,
    ).toBe(frame.container.component);
    await studioCtx.undo();
    expect(meta.title).toBe(originalTitle);
    await studioCtx.redo();
    expect(meta.title).toBe("Edited from overview");
    api.saveProjectRevChanges.mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof api.saveProjectRevChanges>>,
    );
    await studioCtx.save();
    expect(api.saveProjectRevChanges).toHaveBeenCalledTimes(1);
    expect(studioCtx.hasUnsavedChanges()).toBe(false);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    studioCtx.dispose();
  }
});

it("restores the last element inspector after viewing page data without editing the project", async () => {
  const { studioCtx } = fakeStudioCtx();
  try {
    const before = studioCtx
      .bundler()
      .bundle(
        studioCtx.site,
        studioCtx.siteInfo.id,
        studioCtx.appCtx.lastBundleVersion,
      );
    studioCtx.switchRightTab(RightTabKey.interactions);
    studioCtx.switchRightTab(RightTabKey.component);
    studioCtx.restoreLastElementTab();
    expect(studioCtx.rightTabKey).toBe(RightTabKey.interactions);
    studioCtx.switchToDesignTab();
    studioCtx.switchRightTab(RightTabKey.component);
    studioCtx.restoreLastElementTab();
    expect(studioCtx.rightTabKey).toBe(RightTabKey.style);
    expect(
      studioCtx
        .bundler()
        .bundle(
          studioCtx.site,
          studioCtx.siteInfo.id,
          studioCtx.appCtx.lastBundleVersion,
        ),
    ).toEqual(before);
  } finally {
    studioCtx.dispose();
  }
});
