import ViewButton from "@/wab/client/components/top-bar/ViewButton";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Menu } from "antd";
import React from "react";

const { getStudioCtx } = vi.hoisted(() => ({ getStudioCtx: vi.fn() }));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => getStudioCtx(),
}));
vi.mock("@/wab/shared/Arenas", () => ({ isDedicatedArena: () => true }));
vi.mock("@/wab/shared/devflags", () => ({
  DEVFLAGS: { contentEditorMode: false },
}));
vi.mock("@/wab/client/shortcuts/studio/studio-shortcuts", () => ({
  getComboForAction: () => "",
}));
vi.mock("@/wab/client/components/widgets", () => ({
  IFrameAwareDropdownMenu: (props: {
    menu: () => React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {props.children}
      {props.menu()}
    </div>
  ),
}));
vi.mock("@/wab/client/components/menu-builder", () => ({
  MenuBuilder: class {
    items: React.ReactNode[] = [];
    genSection(
      _name: unknown,
      callback: (push: (item: React.ReactNode) => void) => void,
    ) {
      callback((item) => this.items.push(item));
    }
    build() {
      return <Menu>{this.items}</Menu>;
    }
  },
  TextAndShortcut: (props: { children: React.ReactNode }) => (
    <>{props.children}</>
  ),
}));
vi.mock("@/wab/client/components/widgets/Icon", () => ({ Icon: () => null }));
vi.mock("@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicViewButton", () => ({
  PlasmicViewButton: (props: {
    root: { props: React.ComponentProps<"button"> };
  }) => (
    <button aria-label={props.root.props["aria-label"]}>
      {props.root.props["aria-label"]}
    </button>
  ),
}));

function context(shown: boolean) {
  return {
    focusedViewCtx: () => ({
      canvasCtx: { isOutlineMode: () => shown, setOutlineMode: vi.fn() },
    }),
    showSlotPlaceholder: () => shown,
    showContainerPlaceholder: () => shown,
    showMultiplayerSelections: () => shown,
    showAncestorsHoverBoxes: () => shown,
    focusedMode: shown,
    currentArena: {},
    isAutoOpenMode: shown,
    showComments: () => true,
    showCommentsOverlay: shown,
    isContentEditor: () => false,
    contentEditorMode: shown,
    toggleShowSlotPlaceholder: vi.fn(),
    toggleShowContainerPlaceholder: vi.fn(),
    toggleShowMultiplayerSelections: vi.fn(),
    toggleShowAncestorsHoverBoxes: vi.fn(),
    toggleFocusedMode: vi.fn(),
    toggleAutoOpenMode: vi.fn(),
    toggleShowCommentsOverlay: vi.fn(),
    toggleContentEditorMode: vi.fn(),
    change: vi.fn((fn: () => unknown) => fn()),
    changeUnsafe: vi.fn((fn: () => unknown) => fn()),
    refreshFetchedDataFromPlasmicQuery: vi.fn(),
    refreshAppUserProperties: vi.fn(),
  };
}

const showMessages = [
  "Show placeholders for empty slots",
  "Show placeholders for empty containers",
  "Show cursors and selections from other users",
  "Show container outlines when hovering",
  "Show outline mode",
  "Turn off design mode",
  "Turn on auto-open mode",
  "Show comments overlay",
  "Turn on content creator mode",
  "Refresh data",
] as const;
const hideMessages = [
  "Hide placeholders for empty slots",
  "Hide placeholders for empty containers",
  "Hide cursors and selections from other users",
  "Hide container outlines when hovering",
  "Hide outline mode",
  "Turn on design mode",
  "Turn off auto-open mode",
  "Hide comments overlay",
  "Turn off content creator mode",
] as const;

afterEach(() => {
  cleanup();
  act(() => setLanguagePreference("en"));
});
it.each(languageOptions)(
  "renders both states of every View action in $label",
  ({ value }) => {
    act(() => setLanguagePreference(value));
    getStudioCtx.mockReturnValue(context(false));
    const view = render(<ViewButton />);
    expect(
      screen.getByRole("button", { name: translate(value, "View") }),
    ).toBeTruthy();
    for (const message of showMessages) {
      expect(screen.getByText(translate(value, message))).toBeTruthy();
    }
    getStudioCtx.mockReturnValue(context(true));
    view.rerender(<ViewButton mode="live" />);
    for (const message of hideMessages) {
      expect(screen.getByText(translate(value, message))).toBeTruthy();
    }
  },
);
it("updates an already mounted menu and preserves its actions", async () => {
  const studio = context(true);
  getStudioCtx.mockReturnValue(studio);
  render(<ViewButton />);
  act(() => setLanguagePreference("zh-CN"));
  expect(screen.queryByText("Hide placeholders for empty slots")).toBeNull();
  fireEvent.click(screen.getByText("隐藏空插槽占位符"));
  expect(studio.toggleShowSlotPlaceholder).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("关闭自动展开模式"));
  expect(studio.toggleAutoOpenMode).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("关闭内容编辑模式"));
  expect(studio.toggleContentEditorMode).toHaveBeenCalledOnce();
  await act(async () => fireEvent.click(screen.getByText("刷新数据")));
  expect(studio.refreshFetchedDataFromPlasmicQuery).toHaveBeenCalledOnce();
  expect(studio.refreshAppUserProperties).toHaveBeenCalledOnce();
});
