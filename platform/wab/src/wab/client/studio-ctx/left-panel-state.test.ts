import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { SEARCH_PARAM_COPILOT_CHAT } from "@/wab/shared/route/app-routes";
import { waitFor } from "@testing-library/react";

it.each(["tab", "insert", "inline insert", "group"])(
  "keeps AI mutually exclusive with %s",
  async (panel) => {
    const { studioCtx, history } = fakeStudioCtx();
    try {
      await Promise.resolve();
      studioCtx.switchLeftTab("components");
      studioCtx.setShowAddDrawer(true);
      history.push({
        pathname: `/projects/${studioCtx.siteInfo.id}`,
        search: `?${SEARCH_PARAM_COPILOT_CHAT}=true`,
      });
      await waitFor(() => expect(studioCtx.isCopilotChatOpen).toBe(true));
      expect(studioCtx.leftTabKey).toBeUndefined();
      expect(studioCtx.showAddDrawer()).toBe(false);
      if (panel === "tab") {
        studioCtx.switchLeftTab("settings");
        expect(studioCtx.leftTabKey).toBe("settings");
      } else if (panel === "insert") {
        studioCtx.setShowAddDrawer(true);
        expect(studioCtx.showAddDrawer()).toBe(true);
      } else if (panel === "group") {
        studioCtx.setLeftTabGroup("more");
        expect(studioCtx.leftTabGroup).toBe("more");
      } else {
        studioCtx.setShowInlineAddDrawer(true);
        expect(studioCtx.showInlineAddDrawer()).toBe(true);
      }
      expect(studioCtx.isCopilotChatOpen).toBe(false);
      expect(
        new URLSearchParams(history.location.search).has(
          SEARCH_PARAM_COPILOT_CHAT,
        ),
      ).toBe(false);
    } finally {
      studioCtx.dispose();
    }
  },
);

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
      key === `plasmic.leftTabKey.${studioCtx.siteInfo.id}` ? "outline" : null,
    );
    api.getStorageItem.mockClear();
    reopened = new StudioCtx({ dbCtx, autoSave: false });
    await Promise.resolve();
    expect(reopened.leftTabKey).toBeUndefined();
    expect(api.getStorageItem).not.toHaveBeenCalledWith(
      `plasmic.leftTabKey.${studioCtx.siteInfo.id}`,
    );
  } finally {
    reopened?.dispose();
    studioCtx.dispose();
  }
});

it("closes toolbar groups when AI is opened from the route or another panel is opened", async () => {
  const { studioCtx, history } = fakeStudioCtx();
  try {
    await Promise.resolve();
    studioCtx.setLeftTabGroup("more");
    history.push({
      pathname: `/projects/${studioCtx.siteInfo.id}`,
      search: `?${SEARCH_PARAM_COPILOT_CHAT}=true`,
    });
    await waitFor(() => expect(studioCtx.isCopilotChatOpen).toBe(true));
    expect(studioCtx.leftTabGroup).toBeUndefined();
    studioCtx.setLeftTabGroup("assets");
    studioCtx.switchLeftTab("libraries");
    expect(studioCtx.leftTabGroup).toBeUndefined();
    studioCtx.setLeftTabGroup("more");
    studioCtx.setShowAddDrawer(true);
    expect(studioCtx.leftTabGroup).toBeUndefined();
    studioCtx.setLeftTabGroup("more");
    studioCtx.setShowInlineAddDrawer(true);
    expect(studioCtx.leftTabGroup).toBeUndefined();
  } finally {
    studioCtx.dispose();
  }
});
