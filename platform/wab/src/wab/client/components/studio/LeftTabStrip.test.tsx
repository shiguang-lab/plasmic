import LeftTabStrip from "@/wab/client/components/studio/LeftTabStrip";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
const mocks = vi.hoisted(() => ({
  ctx: undefined as any,
  toggleAi: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => mocks.ctx,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ toggleCopilotChat: mocks.toggleAi }),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryInfo: vi.fn(),
}));
vi.mock("@/wab/client/components/studio/FigmaModalContent", () => ({
  FigmaModalContent: () => null,
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
  default: ({ label, onClick, expanded, disabled, isSelected }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-current={isSelected ? "true" : undefined}
    >
      {label}
    </button>
  ),
}));
beforeEach(() => {
  mocks.toggleAi.mockClear();
  mocks.ctx = observable({
    appCtx: { selfInfo: {} },
    site: { globalContexts: [] },
    fontManager: { missingUsedFonts: () => [] },
    contentEditorMode: false,
    leftTabKey: undefined as string | undefined,
    leftTabGroup: undefined as string | undefined,
    setLeftTabGroup(group: string | undefined) {
      this.leftTabGroup = group;
      if (group) {
        this.drawer = false;
        this.leftTabKey = undefined;
        this.isCopilotChatOpen = false;
      }
    },
    panelsHidden: false,
    drawer: true,
    canvasTool: "select",
    isCopilotChatOpen: false,
    config: {} as any,
    getCurrentUiConfig() {
      return this.config;
    },
    showAddDrawer() {
      return this.drawer;
    },
    setShowAddDrawer(show: boolean) {
      this.drawer = show;
    },
    changeUnsafe: async (fn: () => any) => fn(),
    switchLeftTab(tab: string | undefined) {
      this.leftTabKey = tab;
      if (tab) {
        this.leftTabGroup = undefined;
        this.isCopilotChatOpen = false;
      }
    },
    togglePanels() {
      this.panelsHidden = !this.panelsHidden;
    },
    chatCopilotEnabled: () => false,
  });
});
afterEach(cleanup);
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
it("places an independent Libraries entry after Assets and toggles its drawer", () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  const labels = screen
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(labels.indexOf("Libraries")).toBe(labels.indexOf("Assets") + 1);
  const entry = screen.getByRole("button", { name: "Libraries" });
  expect(entry).not.toHaveAttribute("aria-current");
  fireEvent.click(entry);
  expect(mocks.ctx.leftTabKey).toBe("libraries");
  expect(mocks.ctx.drawer).toBe(false);
  expect(entry.getAttribute("aria-expanded")).toBe("true");
  expect(entry).toHaveAttribute("aria-current", "true");
  fireEvent.click(entry);
  expect(mocks.ctx.leftTabKey).toBeUndefined();
  expect(entry).not.toHaveAttribute("aria-current");
});
it("does not highlight Libraries when its panel is hidden or covered by Insert", () => {
  mocks.ctx.leftTabKey = "libraries";
  const { unmount } = render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.getByRole("button", { name: "Libraries" })).not.toHaveAttribute(
    "aria-current",
  );
  unmount();
  mocks.ctx.drawer = false;
  mocks.ctx.panelsHidden = true;
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.getByRole("button", { name: "Libraries" })).not.toHaveAttribute(
    "aria-current",
  );
});
it("restores hidden panels when opening Libraries and honors hidden entry permission", () => {
  mocks.ctx.panelsHidden = true;
  const { unmount } = render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
  expect(mocks.ctx.panelsHidden).toBe(false);
  expect(mocks.ctx.leftTabKey).toBe("libraries");
  unmount();
  mocks.ctx.config = { leftTabs: { libraries: "hidden" } };
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.queryByRole("button", { name: "Libraries" })).toBeNull();
});

it("opening More closes AI and clicking AI closes More", async () => {
  mocks.ctx.isCopilotChatOpen = true;
  mocks.ctx.chatCopilotEnabled = () => true;
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  await screen.findByRole("button", { name: "Expressions" });
  expect(mocks.ctx.isCopilotChatOpen).toBe(false);
  expect(mocks.ctx.leftTabGroup).toBe("more");
  fireEvent.click(screen.getByRole("button", { name: "AI" }));
  expect(mocks.toggleAi).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
