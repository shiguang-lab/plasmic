import { waitFor } from "@testing-library/react";
import { LEFT_PANE_INIT_WIDTH } from "@/wab/client/ClientConstants";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioLeftPanelState } from "@/wab/client/studio-ctx/left-panel-state";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import type { LeftTabKey } from "@/wab/shared/ui-config-utils";
import { runInAction } from "mobx";
import { mock } from "vitest-mock-extended";

async function readyStudioCtx() {
  const fixture = fakeStudioCtx();
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  return fixture;
}

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
    const { studioCtx, dbCtx, history } = await readyStudioCtx();
    try {
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
    const { studioCtx, dbCtx, history } = await readyStudioCtx();
    try {
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
    const { studioCtx, history } = await readyStudioCtx();
    try {
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
  const { studioCtx, dbCtx, api } = await readyStudioCtx();
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
    const reopenedStudio = reopened;
    await waitFor(() => expect(reopenedStudio.initialRouteReady).toBe(true));
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
  const { studioCtx } = await readyStudioCtx();
  try {
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
  const { studioCtx, dbCtx, history, api } = await readyStudioCtx();
  let reopened: StudioCtx | undefined;
  try {
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
    const reopenedStudio = reopened;
    await waitFor(() => expect(reopenedStudio.initialRouteReady).toBe(true));
    expect(reopened.isCopilotChatOpen).toBe(false);
  } finally {
    reopened?.dispose();
    studioCtx.dispose();
  }
});

it.each(["ai", "tab", "insert", "inline insert", "group", "comments"])(
  "closes the %s panel when entering preview and keeps it closed on return",
  async (panel) => {
    const { studioCtx, history } = await readyStudioCtx();
    const preview = new PreviewCtx(
      {
        history,
        topFrameApi: mock<HostFrameCtx["topFrameApi"]>(),
        onHostFrameApiReady: vi.fn(),
        revealStudio: vi.fn().mockResolvedValue(undefined),
      },
      studioCtx,
    );
    try {
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
      history.push(`${APP_ROUTES.projectPreview.fill({ projectId: studioCtx.siteInfo.id })}#/example`);
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
it.each(exclusivePanels)(
  "does not publish a new state when the %s panel is already open",
  async (_name, open) => {
    const { studioCtx } = await readyStudioCtx();
    runInAction(() => open(studioCtx));
    const panel = studioCtx.leftPanel;
    const update = vi.fn();
    const stop = studioCtx.leftPanelState.store.subscribe(update);
    try {
      update.mockClear();
      runInAction(() => open(studioCtx));
      runInAction(() => open(studioCtx));
      expect(studioCtx.leftPanel).toBe(panel);
      expect(update).not.toHaveBeenCalled();
    } finally {
      stop();
      studioCtx.dispose();
    }
  },
);

it("reveals and highlights an already open tab without replacing its panel state", async () => {
  const { studioCtx } = await readyStudioCtx();
  const highlight = vi.fn();
  studioCtx.leftPanelHighlightingRequested.add(highlight);
  try {
    studioCtx.switchLeftTab("outline");
    const panel = studioCtx.leftPanel;
    studioCtx.togglePanels();
    studioCtx.setLeftTabGroup("more");
    studioCtx.switchLeftTab("outline", { highlight: true });
    expect(studioCtx.leftPanel).toBe(panel);
    expect(studioCtx.panelsHidden).toBe(false);
    expect(studioCtx.leftTabGroup).toBeUndefined();
    expect(highlight).toHaveBeenCalledTimes(1);
    studioCtx.switchLeftTab(undefined);
    expect(studioCtx.leftPanel).toBeUndefined();
  } finally {
    studioCtx.dispose();
  }
});

it("publishes final panel, last tab, group and visibility to the first switch subscriber", async () => {
  const { studioCtx } = await readyStudioCtx();
  try {
    studioCtx.switchLeftTab("outline");
    studioCtx.setLeftTabGroup("more");
    studioCtx.togglePanels();
    expect(studioCtx.panelsHidden).toBe(true);

    const seen: Array<{
      panel: unknown;
      last: LeftTabKey;
      group: string | undefined;
      hidden: boolean;
    }> = [];
    const stop = studioCtx.leftPanelState.store.subscribe(() => {
      const snapshot = studioCtx.leftPanelState.store.getState();
      seen.push({
        panel: snapshot.panel,
        last: snapshot.lastLeftTabKey,
        group: snapshot.leftTabGroup,
        hidden: studioCtx.panelsHidden,
      });
    });
    studioCtx.switchLeftTab("components");
    stop();

    expect(seen).toEqual([
      {
        panel: { type: "tab", tab: "components" },
        last: "components",
        group: undefined,
        hidden: false,
      },
    ]);
  } finally {
    studioCtx.dispose();
  }
});

it("publishes final panel, group and visibility to the first setLeftPanel subscriber", async () => {
  const { studioCtx } = await readyStudioCtx();
  const options = { prompt: "Edit this page", mode: "starter" as const };
  try {
    studioCtx.switchLeftTab("outline");
    studioCtx.setLeftTabGroup("more");
    studioCtx.togglePanels();

    const seen: Array<{
      panel: unknown;
      last: LeftTabKey;
      group: string | undefined;
      hidden: boolean;
    }> = [];
    const stop = studioCtx.leftPanelState.store.subscribe(() => {
      const snapshot = studioCtx.leftPanelState.store.getState();
      seen.push({
        panel: snapshot.panel,
        last: snapshot.lastLeftTabKey,
        group: snapshot.leftTabGroup,
        hidden: studioCtx.panelsHidden,
      });
    });
    studioCtx.openCopilotChat(options);
    stop();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      panel: { type: "ai", opts: options },
      last: "outline",
      group: undefined,
      hidden: false,
    });
  } finally {
    studioCtx.dispose();
  }
});

it("keeps caller panel and tour objects from mutating the published snapshot", async () => {
  const { studioCtx } = await readyStudioCtx();
  try {
    const panel: { type: "tab"; tab: LeftTabKey } = {
      type: "tab",
      tab: "components",
    };
    studioCtx.leftPanelState.setPanel(panel);
    const publishedPanel = studioCtx.leftPanel;
    panel.tab = "outline";
    expect(studioCtx.leftTabKey).toBe("components");
    expect(publishedPanel).toEqual({ type: "tab", tab: "components" });
    expect(Object.isFrozen(publishedPanel)).toBe(true);

    const tour = {
      run: true,
      stepIndex: 2,
      tour: "onboarding",
      flags: { forceAddDrawerOpen: true },
      triggers: [TutorialEventsType.AddButtonClicked],
    };
    studioCtx.setOnboardingTourState(tour);
    tour.flags.forceAddDrawerOpen = false;
    tour.triggers.push(TutorialEventsType.TplInserted);
    expect(studioCtx.onboardingTourState.flags.forceAddDrawerOpen).toBe(true);
    expect(studioCtx.onboardingTourState.triggers).toEqual([
      TutorialEventsType.AddButtonClicked,
    ]);
    expect(Object.isFrozen(studioCtx.onboardingTourState)).toBe(true);
    expect(Object.isFrozen(studioCtx.onboardingTourState.flags)).toBe(true);
    expect(Object.isFrozen(studioCtx.onboardingTourState.triggers)).toBe(true);
  } finally {
    studioCtx.dispose();
  }
});

it("flushes one final snapshot after nested commands and rethrows without dropping writes", () => {
  const nestedPanelState = new StudioLeftPanelState();
  const update = vi.fn();
  const stop = nestedPanelState.store.subscribe(update);
  try {
    expect(() =>
      nestedPanelState.deferPublication(() => {
        nestedPanelState.setLastLeftTab("components");
        nestedPanelState.deferPublication(() => {
          nestedPanelState.setLeftTabGroup("more");
          throw new Error("nested command failed");
        });
      }),
    ).toThrow("nested command failed");
    expect(update).toHaveBeenCalledTimes(1);
    expect(nestedPanelState.store.getState()).toMatchObject({
      lastLeftTabKey: "components",
      leftTabGroup: "more",
    });
  } finally {
    stop();
  }
});

it("keeps the tour's forced Insert panel derived from the same snapshot without copying its flag", async () => {
  const { studioCtx } = await readyStudioCtx();
  try {
    studioCtx.switchLeftTab("components");
    studioCtx.setLeftTabGroup("more");
    const panel = studioCtx.leftPanel;
    const base = studioCtx.leftPanelState.store.getState();

    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      flags: { forceAddDrawerOpen: true },
    });

    expect(studioCtx.showAddDrawer()).toBe(true);
    expect(studioCtx.showInlineAddDrawer()).toBe(false);
    expect(studioCtx.leftTabKey).toBeUndefined();
    expect(studioCtx.leftPanelState.store.getState().panel).toBe(panel);
    expect(studioCtx.leftPanelState.store.getState().leftTabGroup).toBe("more");
    expect(base.panel).toBe(panel);

    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      flags: {},
    });

    expect(studioCtx.leftPanel).toBe(panel);
    expect(studioCtx.leftTabKey).toBe("components");
    expect(studioCtx.leftTabGroup).toBe("more");
  } finally {
    studioCtx.dispose();
  }
});

it("preserves the original insert-close command while the tour force is active", async () => {
  const { studioCtx } = await readyStudioCtx();
  try {
    studioCtx.switchLeftTab("components");
    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      flags: { forceAddDrawerOpen: true },
    });

    studioCtx.setShowAddDrawer(false);

    expect(studioCtx.showAddDrawer()).toBe(true);
    expect(studioCtx.leftPanelState.store.getState().panel).toBeUndefined();
    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      flags: {},
    });
    expect(studioCtx.leftPanel).toBeUndefined();
  } finally {
    studioCtx.dispose();
  }
});

it("preserves AI options across a tour override and releases the same panel", async () => {
  const { studioCtx } = await readyStudioCtx();
  const options = { prompt: "Edit this page", mode: "starter" as const };
  try {
    studioCtx.openCopilotChat(options);
    const panel = studioCtx.leftPanel;
    expect(studioCtx.copilotChatOpenOpts).toBe(options);

    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      flags: { forceAddDrawerOpen: true },
    });
    expect(studioCtx.isCopilotChatOpen).toBe(false);
    expect(studioCtx.copilotChatOpenOpts).toBeUndefined();
    expect(studioCtx.leftPanelState.store.getState().panel).toBe(panel);

    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      flags: {},
    });
    expect(studioCtx.leftPanel).toBe(panel);
    expect(studioCtx.copilotChatOpenOpts).toBe(options);
  } finally {
    studioCtx.dispose();
  }
});

it("publishes a new AI request even if its prompt and mode repeat", async () => {
  const { studioCtx } = await readyStudioCtx();
  const options = { prompt: "Edit this page", mode: "starter" as const };
  try {
    studioCtx.openCopilotChat(options);
    const panel = studioCtx.leftPanel;
    studioCtx.openCopilotChat(options);
    expect(studioCtx.leftPanel).toBe(panel);
    const next = { ...options };
    studioCtx.openCopilotChat(next);
    expect(studioCtx.leftPanel).not.toBe(panel);
    expect(studioCtx.copilotChatOpenOpts).toBe(next);
  } finally {
    studioCtx.dispose();
  }
});

it.each(
  exclusivePanels.flatMap((first) =>
    exclusivePanels.map(
      (second) => [first[0], second[0], first[1], second[1]] as const,
    ),
  ),
)(
  "replaces %s with %s in one canonical left panel state",
  async (_first, secondName, first, second) => {
    const { studioCtx, dbCtx, history } = await readyStudioCtx();
    try {
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
    const { studioCtx } = await readyStudioCtx();
    try {
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
it("clears AI open options on close and on a different panel selection", async () => {
  const { studioCtx } = await readyStudioCtx();
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

it("opens the assistant without creating a deferred request or changing the design", async () => {
  const {studioCtx, dbCtx, history} = await readyStudioCtx();
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

it("owns the original panel visibility and width with no-op-stable writes", () => {
  const nestedPanelState = new StudioLeftPanelState();
  const seen: Array<{ hidden: boolean; width: number }> = [];
  const stop = nestedPanelState.store.subscribe((snapshot) => {
    seen.push({
      hidden: snapshot.panelsHidden,
      width: snapshot.leftPaneWidth,
    });
  });
  try {
    expect(nestedPanelState.panelsHidden).toBe(false);
    expect(nestedPanelState.leftPaneWidth).toBe(LEFT_PANE_INIT_WIDTH);

    nestedPanelState.deferPublication(() => {
      nestedPanelState.setPanelsHidden(true);
      nestedPanelState.setLeftPaneWidth(420);
      nestedPanelState.setPanelsHidden(true);
      nestedPanelState.setLeftPaneWidth(420);
    });
    expect(seen).toEqual([{ hidden: true, width: 420 }]);

    nestedPanelState.togglePanels();
    expect(nestedPanelState.panelsHidden).toBe(false);
    expect(seen).toEqual([
      { hidden: true, width: 420 },
      { hidden: false, width: 420 },
    ]);

    // observable.box compares with Object.is: NaN is a no-op, but -0 differs from 0.
    nestedPanelState.setLeftPaneWidth(Number.NaN);
    expect(Number.isNaN(nestedPanelState.leftPaneWidth)).toBe(true);
    expect(seen).toHaveLength(3);
    nestedPanelState.setLeftPaneWidth(Number.NaN);
    expect(seen).toHaveLength(3);

    nestedPanelState.setLeftPaneWidth(0);
    nestedPanelState.setLeftPaneWidth(-0);
    expect(seen).toHaveLength(5);
    expect(Object.is(seen[3].width, 0)).toBe(true);
    expect(Object.is(seen[4].width, -0)).toBe(true);
    expect(Object.is(nestedPanelState.leftPaneWidth, -0)).toBe(true);
  } finally {
    stop();
  }
});
