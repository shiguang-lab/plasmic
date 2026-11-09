import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createSite } from "@/wab/shared/core/sites";
import { captureLeftTabPermissions } from "@/wab/client/studio-ctx/studio-ui-permissions";
import { getLeftTabPermission, type UiConfig } from "@/wab/shared/ui-config-utils";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import LeftTabStrip from "@/wab/client/components/studio/LeftTabStrip";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { StudioLeftPanelState } from "@/wab/client/studio-ctx/left-panel-state";
const mocks = vi.hoisted(() => ({
  ctx: undefined as any,
  toggleAi: vi.fn().mockResolvedValue(undefined),
  getUiConfig: vi.fn(),
  importFigmaFile: vi.fn().mockResolvedValue(undefined),
  importPenFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => mocks.ctx,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ toggleCopilotChat: mocks.toggleAi }),
}));
vi.mock("@/wab/client/figma-importer/import-file", () => ({
  importFigmaFile: mocks.importFigmaFile,
}));
vi.mock("@/wab/client/pen-importer/import-file", () => ({
  importPenFile: mocks.importPenFile,
}));
vi.mock("@/wab/client/components/widgets", () => ({}));
vi.mock("@/wab/client/components/ui/layout-styles", () => ({
  useEditorPopupStyles: () => ({ styles: { root: "popup" } }),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftTabStrip",
  () => ({ PlasmicLeftTabStrip: ({ buttons }: any) => <div>{buttons}</div> }),
);
vi.mock("@/wab/client/components/studio/LeftTabButton", () => ({
  default: ({
    label,
    onClick,
    expanded,
    disabled,
    isSelected,
    ...props
  }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-current={isSelected ? "true" : undefined}
      data-test-tabkey={props["data-test-tabkey"]}
    >
      {label}
    </button>
  ),
}));
beforeEach(() => {
  mocks.toggleAi.mockClear();
  mocks.getUiConfig.mockClear().mockImplementation(() => mocks.ctx.config);
  mocks.importFigmaFile.mockClear();
  mocks.importPenFile.mockClear();
  const tools = createStore<"select" | "pan">(() => "select");
  const tabs = createStore<"store" | "imports">(() => "imports");
  const leftPanelState = new StudioLeftPanelState();
  leftPanelState.setPanel({ type: "insert", inline: false });
  const environment = createStudioUiEnvironmentFixture({ hasUserInfo: true });
  const appUiListeners = new Set<() => void>();
  let config: UiConfig = {};
  mocks.ctx = ({
      ...environment,
      appCtx: {
        selfInfo: {},
        subscribeUiEnvironmentInputs: (listener: () => void) => { appUiListeners.add(listener); return () => { appUiListeners.delete(listener); }; },
        publishUiEnvironmentInputs: () => appUiListeners.forEach((listener) => listener()),
      },
      site: createSite(),
      modelSnapshots: new ModelSnapshots(),
      fontManager: { store: createStore(() => ({ missingUsedFonts: [] })) },
      contentEditorMode: false,
      leftPanelState,
      get leftTabKey() {
        return leftPanelState.leftTabKey;
      },
      set leftTabKey(tab: string | undefined) {
        leftPanelState.setPanel(
          tab ? { type: "tab", tab: tab as any } : undefined,
        );
      },
      libraryTabStore: tabs,
      get libraryTab() {
        return tabs.getState();
      },
      setLibraryTab(tab: "store" | "imports") {
        tabs.setState(tab, true);
      },
      get leftTabGroup() {
        return leftPanelState.leftTabGroup;
      },
      set leftTabGroup(group: string | undefined) {
        leftPanelState.setLeftTabGroup(group);
      },
      setLeftTabGroup(group: string | undefined) {
        leftPanelState.setLeftTabGroup(group);
      },
      get panelsHidden() {
        return leftPanelState.panelsHidden;
      },
      set panelsHidden(hidden: boolean) {
        leftPanelState.setPanelsHidden(hidden);
      },
      get drawer() {
        return leftPanelState.showAddDrawer();
      },
      set drawer(show: boolean) {
        if (show) {
          leftPanelState.setPanel({ type: "insert", inline: false });
        } else if (leftPanelState.showAddDrawer()) {
          leftPanelState.setPanel(undefined);
        }
      },
      canvasToolStore: tools,
      setCanvasTool(tool: "select" | "pan") {
        tools.setState(tool, true);
      },
      get isCopilotChatOpen() {
        return leftPanelState.isCopilotChatOpen;
      },
      set isCopilotChatOpen(open: boolean) {
        if (open) {
          leftPanelState.setPanel({ type: "ai" });
        } else if (leftPanelState.isCopilotChatOpen) {
          leftPanelState.setPanel(undefined);
        }
      },
      get config() { return config; },
      set config(value: UiConfig) {
        config = value;
        environment.uiEnvironment.store.setState({ leftTabPermissions: captureLeftTabPermissions((key) => getLeftTabPermission(value, key, { isContentCreator: false })) });
      },
      getCurrentUiConfig: mocks.getUiConfig,
      showAddDrawer() {
        return leftPanelState.showAddDrawer();
      },
      setShowAddDrawer(show: boolean) {
        if (show) {
          leftPanelState.setPanel({ type: "insert", inline: false });
        } else if (leftPanelState.showAddDrawer()) {
          leftPanelState.setPanel(undefined);
        }
      },
      changeUnsafe: async (fn: () => any) => fn(),
      switchLeftTab(tab: string | undefined) {
        if (tab) {
          leftPanelState.setPanel({ type: "tab", tab: tab as any });
        } else if (leftPanelState.leftTabKey) {
          leftPanelState.setPanel(undefined);
        }
      },
      togglePanels() {
        leftPanelState.togglePanels();
      },
      toggleCopilotChat: mocks.toggleAi,
      chatCopilotEnabled: () => false,
    });
});
afterEach(() => { cleanup(); mocks.ctx.modelSnapshots.dispose(); });
it.each([false, true])(
  "places Pen import immediately after Figma in web and Desktop (Desktop: %s)",
  async (desktop) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      desktop ? "PlasmicDesktop/darwin" : "Mozilla/5.0",
    );
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const pen = await screen.findByRole("button", { name: "Import from Pen" });
    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.indexOf("Import from Pen")).toBe(
      labels.indexOf("Import from Figma") + 1,
    );
    fireEvent.click(pen);
    await waitFor(() =>
      expect(mocks.importPenFile).toHaveBeenCalledExactlyOnceWith(mocks.ctx),
    );
    vi.restoreAllMocks();
  },
);
it.each([false, true])(
  "imports .fig from the existing Figma entry in web and Desktop (Desktop: %s)",
  async (desktop) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      desktop ? "PlasmicDesktop/darwin" : "Mozilla/5.0",
    );
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const input = screen.getByLabelText("Import from Figma", {
      selector: "input",
    });
    const click = vi.spyOn(input, "click");
    fireEvent.click(
      await screen.findByRole("button", { name: "Import from Figma" }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".fig");
    const file = new File(["fig-kiwi"], "Design.fig");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(mocks.importFigmaFile).toHaveBeenCalledWith(mocks.ctx, file),
    );
    expect(input).toHaveValue("");
    vi.restoreAllMocks();
  },
);

it("does nothing when the Figma file chooser is cancelled", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.change(
    screen.getByLabelText("Import from Figma", { selector: "input" }),
    { target: { files: [] } },
  );
  expect(mocks.importFigmaFile).not.toHaveBeenCalled();
});
it.each([false, true])(
  "shows web import only in Desktop and before More (Desktop: %s)",
  (desktop) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      desktop
        ? "PlasmicDesktop/darwin"
        : "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36",
    );
    try {
      render(<LeftTabStrip useVersionsCTA={false} />);
      const entry = screen.queryByRole("button", {
        name: "Import from the web",
      });
      if (desktop) {
        const labels = screen
          .getAllByRole("button")
          .map((button) => button.textContent);
        expect(entry).toBeTruthy();
        expect(labels.indexOf("More")).toBe(
          labels.indexOf("Import from the web") + 1,
        );
      } else {
        expect(entry).toBeNull();
      }
    } finally {
      vi.restoreAllMocks();
    }
  },
);

it("opens Project settings from More when global contexts are available", async () => {
  mocks.ctx.site.globalContexts.push({});
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.queryByRole("button", { name: "Project settings" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Project settings" }),
  );
  expect(mocks.ctx.leftTabKey).toBe("settings");
  expect(mocks.ctx.drawer).toBe(false);
  expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
it.each([false, true])(
  "hides Project settings when unavailable (hidden permission: %s)",
  async (hidden) => {
    if (hidden) {
      mocks.ctx.site.globalContexts.push({});
      mocks.ctx.config = { leftTabs: { settings: "hidden" } };
    }
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    await screen.findByRole("button", { name: "Expressions" });
    expect(
      screen.queryByRole("button", { name: "Project settings" }),
    ).toBeNull();
  },
);
it("places Libraries after Assets and opens its two secondary choices", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  const labels = screen
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(labels.indexOf("Libraries")).toBe(labels.indexOf("Assets") + 1);
  const entry = screen.getByRole("button", { name: "Libraries" });
  expect(entry).not.toHaveAttribute("aria-current");
  fireEvent.click(entry);
  expect(mocks.ctx.leftTabKey).toBeUndefined();
  expect(mocks.ctx.leftTabGroup).toBe("libraries");
  expect(mocks.ctx.drawer).toBe(true);
  expect(entry.getAttribute("aria-expanded")).toBe("true");
  expect(entry).toHaveAttribute("aria-current", "true");
  expect(
    await screen.findByRole("button", { name: "Component store" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Imported projects" }),
  ).toBeTruthy();
  fireEvent.click(entry);
  expect(mocks.ctx.leftTabGroup).toBeUndefined();
  expect(entry).not.toHaveAttribute("aria-current");
});
it("does not highlight Libraries when its panel is hidden or covered by the tour Insert panel", () => {
  mocks.ctx.leftPanelState.setPanel({ type: "tab", tab: "libraries" });
  mocks.ctx.panelsHidden = true;
  const { unmount } = render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.getByRole("button", { name: "Libraries" })).not.toHaveAttribute(
    "aria-current",
  );
  unmount();
  mocks.ctx.panelsHidden = false;
  mocks.ctx.leftPanelState.setOnboardingTourState({
    run: true,
    stepIndex: 0,
    tour: "",
    triggers: [],
    flags: { forceAddDrawerOpen: true },
  });
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.getByRole("button", { name: "Libraries" })).not.toHaveAttribute(
    "aria-current",
  );
});
it("restores hidden panels when choosing a Library destination and honors hidden entry permission", async () => {
  mocks.ctx.panelsHidden = true;
  const { unmount } = render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Component store" }),
  );
  expect(mocks.ctx.panelsHidden).toBe(false);
  expect(mocks.ctx.leftTabKey).toBe("libraries");
  unmount();
  mocks.ctx.config = { leftTabs: { libraries: "hidden" } };
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.queryByRole("button", { name: "Libraries" })).toBeNull();
});

it.each(["Component store", "Imported projects"])(
  "opens %s from the Library submenu and keeps the Library tool selected",
  async (label) => {
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(mocks.ctx.libraryTab).toBe(
      label === "Component store" ? "store" : "imports",
    );
    expect(mocks.ctx.leftTabKey).toBe("libraries");
    expect(mocks.ctx.leftTabGroup).toBeUndefined();
    expect(mocks.ctx.drawer).toBe(false);
    expect(screen.getByRole("button", { name: "Libraries" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Libraries" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  },
);

it.each(["hidden", "anonymous"])(
  "hides imported projects in the Library submenu for %s access",
  async (access) => {
    if (access === "hidden") {
      mocks.ctx.config = { leftTabs: { imports: "hidden" } };
      const state = mocks.ctx.uiEnvironment.store.getState();
      mocks.ctx.uiEnvironment.store.setState({ leftTabPermissions: Object.freeze({ ...state.leftTabPermissions, imports: "hidden" }) });
    } else {
      mocks.ctx.appCtx.selfInfo = null;
      mocks.ctx.uiEnvironment.store.setState({ hasUserInfo: false });
    }
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
    expect(
      await screen.findByRole("button", { name: "Component store" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Imported projects" }),
    ).toBeNull();
  },
);

it("Escape closes the Library submenu and restores focus to its tool", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  const entry = screen.getByRole("button", { name: "Libraries" });
  fireEvent.click(entry);
  const store = await screen.findByRole("button", { name: "Component store" });
  store.focus();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(entry).toHaveFocus());
  expect(mocks.ctx.leftTabGroup).toBeUndefined();
});

it("opening More preserves AI and clicking AI closes More", async () => {
  mocks.ctx.isCopilotChatOpen = true;
  mocks.ctx.chatCopilotEnabled = () => true;
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  await screen.findByRole("button", { name: "Expressions" });
  expect(mocks.ctx.isCopilotChatOpen).toBe(true);
  expect(mocks.ctx.leftTabGroup).toBe("more");
  fireEvent.click(screen.getByRole("button", { name: "AI" }));
  expect(mocks.toggleAi).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it.each([
  ["store", "Component store", "Imported projects"],
  ["imports", "Imported projects", "Component store"],
])(
  "highlights only %s when Libraries is open with that active tab",
  async (tab, activeLabel, inactiveLabel) => {
    mocks.ctx.leftTabKey = "libraries";
    mocks.ctx.setLibraryTab(tab);
    mocks.ctx.drawer = false;
    mocks.ctx.leftTabGroup = "libraries";
    render(<LeftTabStrip useVersionsCTA={false} />);
    const activeBtn = await screen.findByRole("button", { name: activeLabel });
    const inactiveBtn = screen.getByRole("button", { name: inactiveLabel });
    expect(activeBtn).toHaveAttribute("aria-current", "true");
    expect(inactiveBtn).not.toHaveAttribute("aria-current");
  },
);

it("switches library destination without closing panel when another choice is selected", async () => {
  mocks.ctx.leftTabKey = "libraries";
  mocks.ctx.setLibraryTab("store");
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "libraries";
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Imported projects" }),
  );
  expect(mocks.ctx.libraryTab).toBe("imports");
  expect(mocks.ctx.leftTabKey).toBe("libraries");
});

it("tracks a library tab command while the menu remains open and every legacy field is unchanged", async () => {
  mocks.ctx.leftTabKey = "libraries";
  mocks.ctx.setLibraryTab("imports");
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "libraries";
  render(<LeftTabStrip useVersionsCTA={false} />);
  const imported = await screen.findByRole("button", { name: "Imported projects" });
  const store = screen.getByRole("button", { name: "Component store" });
  expect(imported).toHaveAttribute("aria-current", "true");
  act(() => { mocks.ctx.setLibraryTab("store"); });
  expect(store).toHaveAttribute("aria-current", "true");
  expect(imported).not.toHaveAttribute("aria-current");
  act(() => { mocks.ctx.uiEnvironment.store.setState({ hasUserInfo: false }); });
  expect(screen.queryByRole("button", { name: "Imported projects" })).toBeNull();
  expect(store).toHaveAttribute("aria-current", "true");
});

it("keeps panel open when currently active library choice is clicked again", async () => {
  mocks.ctx.leftTabKey = "libraries";
  mocks.ctx.setLibraryTab("store");
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "libraries";
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Component store" }),
  );
  expect(mocks.ctx.leftTabKey).toBe("libraries");
  expect(mocks.ctx.libraryTab).toBe("store");
});

it("switches destination in Assets menu and clicking active item keeps panel open", async () => {
  mocks.ctx.leftTabKey = "tokens";
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "assets";
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(await screen.findByRole("button", { name: "Components" }));
  expect(mocks.ctx.leftTabKey).toBe("components");

  mocks.ctx.leftTabGroup = "assets";
  fireEvent.click(await screen.findByRole("button", { name: "Components" }));
  expect(mocks.ctx.leftTabKey).toBe("components");
});

it("toggles panel closed only when rail button is clicked directly", async () => {
  mocks.ctx.leftTabKey = "lint";
  mocks.ctx.drawer = false;
  mocks.ctx.panelsHidden = false;
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Issues" }));
  expect(mocks.ctx.leftTabKey).toBeUndefined();
});

it("updates the native tool buttons without recomputing the menu rail", () => {
  const getMenuAccess = vi.fn(() => false);
  mocks.ctx.chatCopilotEnabled = getMenuAccess;
  render(<LeftTabStrip useVersionsCTA={false} />);
  const count = getMenuAccess.mock.calls.length;
  const select = screen.getByRole("button", { name: "Select" });
  const pan = screen.getByRole("button", { name: "Pan" });
  expect(select.getAttribute("aria-current")).toBe("true");
  fireEvent.click(pan);
  expect(pan.getAttribute("aria-current")).toBe("true");
  expect(select.getAttribute("aria-current")).toBeNull();
  // Closing the initially-open Insert drawer is an existing menu update.
  const afterDrawer = getMenuAccess.mock.calls.length;
  expect(afterDrawer).toBeGreaterThanOrEqual(count);
  fireEvent.click(select);
  expect(select.getAttribute("aria-current")).toBe("true");
  expect(pan.getAttribute("aria-current")).toBeNull();
  expect(getMenuAccess).toHaveBeenCalledTimes(afterDrawer);
});


it("updates open navigation permissions and login from their published environment", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(await screen.findByRole("button", { name: "Split content" })).toBeTruthy();
  act(() => { mocks.ctx.uiEnvironment.store.setState({ hasUserInfo: false }); });
  expect(screen.queryByRole("button", { name: "Split content" })).toBeNull();
  expect(screen.getByRole("button", { name: "Expressions" })).toBeTruthy();
  act(() => { mocks.ctx.config = { leftTabs: { expressions: "hidden" } }; });
  expect(screen.queryByRole("button", { name: "Expressions" })).toBeNull();
});

it("updates Project settings while More remains open after a committed global-context change", async () => {
  const site = mocks.ctx.site;
  const manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Context", type: ComponentType.Plain });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  await screen.findByRole("button", { name: "Expressions" });
  expect(screen.queryByRole("button", { name: "Project settings" })).toBeNull();
  try {
    act(() => {
      const changes = recorder.withRecording(() => { site.globalContexts.push(mkTplComponent(component, component.variants[0])); });
      mocks.ctx.modelSnapshots.sync(changes.changes);
    });
    expect(await screen.findByRole("button", { name: "Project settings" })).toBeTruthy();
    act(() => {
      const changes = recorder.withRecording(() => { site.globalContexts.splice(0); });
      mocks.ctx.modelSnapshots.sync(changes.changes);
    });
    expect(screen.queryByRole("button", { name: "Project settings" })).toBeNull();
  } finally { recorder.dispose(); }
});

it("updates AI availability from app configuration and project access publications", () => {
  let enabled = false;
  mocks.ctx.chatCopilotEnabled = () => enabled && mocks.ctx.uiEnvironment.store.getState().canEditProject;
  render(<LeftTabStrip useVersionsCTA={false} />);
  const button = screen.getByRole("button", { name: "AI" });
  expect(button).toBeDisabled();
  act(() => { enabled = true; mocks.ctx.appCtx.publishUiEnvironmentInputs(); });
  expect(button).not.toBeDisabled();
  act(() => { mocks.ctx.uiEnvironment.store.setState({ canEditProject: false }); });
  expect(button).toBeDisabled();
});
