import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mock } from "vitest-mock-extended";

const leftPanels: Record<string, (ctx: StudioCtx) => void> = {
  structure: (ctx) => ctx.switchLeftTab("outline"),
  library: (ctx) => ctx.openLibraries("imports"),
  insert: (ctx) => ctx.setShowAddDrawer(true),
  "inline insert": (ctx) => ctx.setShowInlineAddDrawer(true),
  menu: (ctx) => ctx.setLeftTabGroup("more"),
  AI: (ctx) => ctx.setCopilotChatOpen(true),
};

const leftPanelState = (ctx: StudioCtx) => ({
  tab: ctx.leftTabKey,
  group: ctx.leftTabGroup,
  insert: ctx.showAddDrawer(),
  inlineInsert: ctx.showInlineAddDrawer(),
  ai: ctx.isCopilotChatOpen,
});

it.each(Object.entries(leftPanels))(
  "opens and closes comments without changing the %s panel",
  async (_panel, openLeftPanel) => {
    const { studioCtx, dbCtx, history } = fakeStudioCtx();
    try {
      await Promise.resolve();
      const revision = dbCtx.revisionNum;
      const location = history.location;
      openLeftPanel(studioCtx);
      const left = leftPanelState(studioCtx);
      studioCtx.togglePanels();
      expect(studioCtx.panelsHidden).toBe(true);
      expect(studioCtx.focusedOrFirstViewCtx()).toBeUndefined();

      studioCtx.toggleCommentsPanel();
      expect(studioCtx.showCommentsPanel).toBe(true);
      expect(studioCtx.panelsHidden).toBe(false);
      expect(leftPanelState(studioCtx)).toEqual(left);
      expect(studioCtx.focusedOrFirstViewCtx()).toBeUndefined();
      expect(dbCtx.revisionNum).toBe(revision);
      expect(history.location).toBe(location);

      studioCtx.toggleCommentsPanel();
      expect(studioCtx.showCommentsPanel).toBe(false);
      expect(studioCtx.panelsHidden).toBe(false);
      expect(leftPanelState(studioCtx)).toEqual(left);
    } finally {
      studioCtx.dispose();
    }
  },
);

it.each(Object.entries(leftPanels))(
  "opens the %s panel without changing comments or the inspector tab",
  async (_panel, openLeftPanel) => {
    const { studioCtx, dbCtx, history } = fakeStudioCtx();
    try {
      await Promise.resolve();
      const revision = dbCtx.revisionNum;
      const location = history.location;
      studioCtx.switchRightTab(RightTabKey.style);
      studioCtx.toggleCommentsPanel();
      openLeftPanel(studioCtx);
      expect(studioCtx.showCommentsPanel).toBe(true);
      expect(studioCtx.rightTabKey).toBe(RightTabKey.style);
      studioCtx.switchLeftTab(undefined);
      studioCtx.setLeftTabGroup(undefined);
      studioCtx.setShowAddDrawer(false);
      studioCtx.setCopilotChatOpen(false);
      expect(studioCtx.showCommentsPanel).toBe(true);
      expect(studioCtx.rightTabKey).toBe(RightTabKey.style);
      expect(dbCtx.revisionNum).toBe(revision);
      expect(history.location).toBe(location);
    } finally {
      studioCtx.dispose();
    }
  },
);

it.each(["tab", "insert", "inline insert"])(
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

const exclusivePanels = Object.entries(leftPanels).filter(
  ([name]) => name !== "menu",
);
it.each(
  exclusivePanels.flatMap((first) =>
    exclusivePanels.map(
      (second) => [first[0], second[0], first[1], second[1]] as const,
    ),
  ),
)(
  "replaces %s with %s in one canonical left panel state",
  async (_first, secondName, first, second) => {
    const { studioCtx, dbCtx, history } = fakeStudioCtx();
    try {
      await Promise.resolve();
      const location = history.location;
      const revision = dbCtx.revisionNum;
      first(studioCtx);
      second(studioCtx);
      expect(
        Number(!!studioCtx.leftTabKey) +
          Number(studioCtx.showAddDrawer()) +
          Number(studioCtx.isCopilotChatOpen),
      ).toBe(1);
      expect(studioCtx.leftPanel?.type).toBe(
        secondName === "AI"
          ? "ai"
          : secondName.includes("insert")
            ? "insert"
            : "tab",
      );
      expect(dbCtx.revisionNum).toBe(revision);
      expect(history.location).toBe(location);
    } finally {
      studioCtx.dispose();
    }
  },
);
it.each(exclusivePanels)(
  "keeps %s mounted while opening, changing and dismissing submenus",
  async (_name, open) => {
    const { studioCtx } = fakeStudioCtx();
    try {
      await Promise.resolve();
      open(studioCtx);
      const panel = studioCtx.leftPanel;
      for (const menu of ["assets", "libraries", "more", undefined]) {
        studioCtx.setLeftTabGroup(menu);
        expect(studioCtx.leftPanel).toBe(panel);
      }
    } finally {
      studioCtx.dispose();
    }
  },
);
it("clears AI open options on close and on a different panel selection", () => {
  const { studioCtx } = fakeStudioCtx();
  try {
    studioCtx.openCopilotChat({ prompt: "Edit this page", mode: "starter" });
    expect(studioCtx.copilotChatOpenOpts?.prompt).toBe("Edit this page");
    studioCtx.switchLeftTab("outline");
    expect(studioCtx.copilotChatOpenOpts).toBeUndefined();
    studioCtx.toggleCopilotChat();
    expect(studioCtx.isCopilotChatOpen).toBe(true);
    expect(studioCtx.copilotChatOpenOpts).toBeUndefined();
    studioCtx.toggleCopilotChat();
    expect(studioCtx.leftPanel).toBeUndefined();
  } finally {
    studioCtx.dispose();
  }
});

it("opens the assistant without creating a deferred request or changing the design", () => {
  const {studioCtx, dbCtx, history} = fakeStudioCtx();
  try {
    const revision = dbCtx.revisionNum;
    const location = history.location;
    studioCtx.openCopilotChat();
    expect(studioCtx.isCopilotChatOpen).toBe(true);
    expect(studioCtx.copilotChatOpenOpts).toBeUndefined();
    expect(dbCtx.revisionNum).toBe(revision);
    expect(history.location).toBe(location);
  } finally {studioCtx.dispose();}
});
