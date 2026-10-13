import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mock } from "vitest-mock-extended";

it.each(["tab", "insert", "inline insert", "group"])(
  "keeps AI mutually exclusive with %s",
  async (panel) => {
    const { studioCtx, history } = fakeStudioCtx();
    try {
      await Promise.resolve();
      studioCtx.switchLeftTab("components");
      studioCtx.setShowAddDrawer(true);
      const location = history.location;
      studioCtx.setCopilotChatOpen(true);
      expect(studioCtx.isCopilotChatOpen).toBe(true);
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
      expect(history.location).toBe(location);
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

it("closes toolbar groups when AI is opened or another panel is opened", async () => {
  const { studioCtx } = fakeStudioCtx();
  try {
    await Promise.resolve();
    studioCtx.setLeftTabGroup("more");
    studioCtx.setCopilotChatOpen(true);
    expect(studioCtx.isCopilotChatOpen).toBe(true);
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

it("does not restore the AI panel on reentry, even with an old URL flag", async () => {
  const { studioCtx, dbCtx, history, api } = fakeStudioCtx();
  let reopened: StudioCtx | undefined;
  try {
    await Promise.resolve();
    const location = history.location;
    api.addStorageItem.mockClear();
    studioCtx.setCopilotChatOpen(true);
    expect(history.location).toBe(location);
    expect(api.addStorageItem).not.toHaveBeenCalled();
    studioCtx.dispose();
    history.replace({
      pathname: `/projects/${studioCtx.siteInfo.id}`,
      search: "?copilot_chat=true",
    });
    reopened = new StudioCtx({ dbCtx, autoSave: false });
    await Promise.resolve();
    expect(reopened.isCopilotChatOpen).toBe(false);
  } finally {
    reopened?.dispose();
    studioCtx.dispose();
  }
});

it.each(["ai", "tab", "insert", "inline insert", "group", "comments"])(
  "closes the %s panel when entering preview and keeps it closed on return",
  async (panel) => {
    const { studioCtx, history } = fakeStudioCtx();
    const preview = new PreviewCtx(
      {
        history,
        topFrameApi: mock<HostFrameCtx["topFrameApi"]>(),
        onHostFrameApiReady: vi.fn(),
      },
      studioCtx,
    );
    try {
      await Promise.resolve();
      if (panel === "ai") {
        studioCtx.setCopilotChatOpen(true);
      }
      if (panel === "tab") {
        studioCtx.switchLeftTab("components");
      }
      if (panel === "insert") {
        studioCtx.setShowAddDrawer(true);
      }
      if (panel === "inline insert") {
        studioCtx.setShowInlineAddDrawer(true);
      }
      if (panel === "group") {
        studioCtx.setLeftTabGroup("more");
      }
      if (panel === "comments") {
        studioCtx.toggleCommentsPanel();
      }
      history.push(`/projects/${studioCtx.siteInfo.id}/preview/example`);
      expect(preview.isLive).toBe(true);
      expect(studioCtx.isCopilotChatOpen).toBe(false);
      expect(studioCtx.leftTabKey).toBeUndefined();
      expect(studioCtx.leftTabGroup).toBeUndefined();
      expect(studioCtx.showAddDrawer()).toBe(false);
      expect(studioCtx.showInlineAddDrawer()).toBe(false);
      expect(studioCtx.showCommentsPanel).toBe(false);
      history.push(`/projects/${studioCtx.siteInfo.id}`);
      expect(preview.isLive).toBe(false);
      expect(studioCtx.isCopilotChatOpen).toBe(false);
      expect(studioCtx.leftTabKey).toBeUndefined();
    } finally {
      preview.dispose();
      studioCtx.dispose();
    }
  },
);
