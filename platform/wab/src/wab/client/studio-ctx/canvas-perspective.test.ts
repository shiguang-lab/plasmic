import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { ensurePageOverviewArena } from "@/wab/shared/page-overview";

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
