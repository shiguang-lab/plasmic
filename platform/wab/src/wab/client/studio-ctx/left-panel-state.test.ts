import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

it("keeps left panel changes in the current session and ignores old stored state on reentry", async () => {
  const { studioCtx, dbCtx, api } = fakeStudioCtx();
  let reopened: StudioCtx | undefined;
  const revision = dbCtx.revisionNum;
  try {
    expect(studioCtx.leftTabKey).toBeUndefined();
    api.addStorageItem.mockClear();
    api.removeStorageItem.mockClear();

    studioCtx.switchLeftTab("components");
    expect(studioCtx.leftTabKey).toBe("components");
    studioCtx.switchLeftTab(undefined);
    expect(studioCtx.leftTabKey).toBeUndefined();
    studioCtx.restoreLastLeftTab();
    expect(studioCtx.leftTabKey).toBe("components");
    expect(api.addStorageItem).not.toHaveBeenCalled();
    expect(api.removeStorageItem).not.toHaveBeenCalled();
    expect(dbCtx.revisionNum).toBe(revision);

    studioCtx.dispose();
    api.getStorageItem.mockImplementation(async (key) =>
      key === `plasmic.leftTabKey.${studioCtx.siteInfo.id}` ? "outline" : null
    );
    api.getStorageItem.mockClear();
    reopened = new StudioCtx({ dbCtx, autoSave: false });
    await Promise.resolve();
    expect(reopened.leftTabKey).toBeUndefined();
    expect(api.getStorageItem).not.toHaveBeenCalledWith(
      `plasmic.leftTabKey.${studioCtx.siteInfo.id}`
    );
  } finally {
    reopened?.dispose();
    studioCtx.dispose();
  }
});
