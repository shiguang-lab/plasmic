import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { setFocusedFrame } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { createStore } from "zustand/vanilla";
import ViewButton from "@/wab/client/components/top-bar/ViewButton";
import { createStudioSelectionFixture } from "@/wab/client/__testonly__/studio-selection";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mock } from "vitest-mock-extended";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Menu } from "antd";
import React from "react";

const { getStudioCtx } = vi.hoisted(() => ({ getStudioCtx: vi.fn() }));
vi.mock("@/wab/client/contexts/StudioContexts", async (original) => ({
  ...await original<typeof import("@/wab/client/contexts/StudioContexts")>(),
  useStudioCtx: () => getStudioCtx(),
}));
vi.mock("@/wab/shared/devflags", async (original) => {
  const actual = await original<typeof import("@/wab/shared/devflags")>();
  return {
    ...actual,
    DEVFLAGS: { ...actual.DEVFLAGS, contentEditorMode: false },
  };
});
vi.mock("@/wab/client/shortcuts/studio/studio-shortcuts", async (original) => ({
  ...await original<typeof import("@/wab/client/shortcuts/studio/studio-shortcuts")>(),
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

// The header shell is outside these action tests; keep the real action buttons.
vi.mock("@/wab/client/components/BrandLink", () => ({ BrandLink: () => null }));
vi.mock("@/wab/client/components/studio/Avatar", () => ({
  AnonymousAvatar: () => null,
  AvatarGallery: () => null,
}));
vi.mock("@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar", () => ({
  default: () => null,
}));

const contextDisposals: (() => void)[] = [];
function context(shown: boolean) {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Action canvas", type: ComponentType.Plain });
  const arena = ensure(getDedicatedArena(site, component), "Dedicated action canvas");
  if (shown) { setFocusedFrame(site, arena); }
  const modelSnapshots = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots });
  arenaState.setCurrent(arena);
  const draggingObjectStore = createStore<boolean>(() => false);
  const renderPolicy = new StudioRenderPolicy({
    isLive: () => false,
    isDragging: () => draggingObjectStore.getState(),
  });
  if (!shown) {
    renderPolicy.toggleSlotPlaceholder();
    renderPolicy.toggleContainerPlaceholder();
  }
  renderPolicy.autoOpen = shown;
  renderPolicy.installStoredFullPageHeight(shown);
  renderPolicy.prepareInputs();
  renderPolicy.publishCommit();
  contextDisposals.push(() => { renderPolicy.dispose(); arenaState.dispose(); modelSnapshots.dispose(); });
  const overlayState = new StudioOverlayState();
  overlayState.multiplayerSelections = shown; overlayState.ancestorsHoverBoxes = shown; overlayState.commentsOverlay = shown;
  contextDisposals.push(() => overlayState.dispose());
  const view = mock<ViewCtx>();
  Object.defineProperty(view, "canvasCtx", { value: mock<CanvasCtx>({ isOutlineMode: () => shown, setOutlineMode: vi.fn() }) });
  return {
    ...createStudioSelectionFixture(view),
    ...createStudioUiEnvironmentFixture({ contentEditorMode: shown }),
    draggingObjectStore,
    renderPolicy,
    overlayState,
    arenaState,
    modelSnapshots,
    focusedViewCtx: () => view,
    showSlotPlaceholder: () => renderPolicy.showSlotPlaceholder,
    showContainerPlaceholder: () => renderPolicy.showContainerPlaceholder,
    showMultiplayerSelections: () => overlayState.multiplayerSelections,
    showAncestorsHoverBoxes: () => overlayState.ancestorsHoverBoxes,
    focusedMode: shown,
    currentArena: arena,
    get isAutoOpenMode() { return renderPolicy.autoOpen; },
    showComments: () => true,
    get showCommentsOverlay() { return overlayState.commentsOverlay; },
    isContentEditor: () => false,
    get fullPageHeight() { return renderPolicy.fullPageHeight; },
    toggleFullPageHeight: vi.fn(),
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
  "Show full page height",
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
  "Fit to viewport height",
  "Turn on design mode",
  "Turn off auto-open mode",
  "Hide comments overlay",
  "Turn off content creator mode",
] as const;

afterEach(async () => {
  cleanup();
  act(() => contextDisposals.splice(0).forEach((dispose) => dispose()));
  await act(async () => await setLanguagePreference("en"));
});
it.each(languageOptions)(
  "renders both states of every View action in $label",
  async ({ value }) => {
    await act(async () => await setLanguagePreference(value));
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
  await act(async () => await setLanguagePreference("zh-CN"));
  expect(screen.queryByText("Hide placeholders for empty slots")).toBeNull();
  fireEvent.click(screen.getByText("隐藏空插槽占位符"));
  expect(studio.toggleShowSlotPlaceholder).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText(translate("zh-CN", "Fit to viewport height")));
  expect(studio.toggleFullPageHeight).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("关闭自动展开模式"));
  expect(studio.toggleAutoOpenMode).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("关闭内容编辑模式"));
  expect(studio.toggleContentEditorMode).toHaveBeenCalledOnce();
  await act(async () => fireEvent.click(screen.getByText("刷新数据")));
  expect(studio.refreshFetchedDataFromPlasmicQuery).toHaveBeenCalledOnce();
  expect(studio.refreshAppUserProperties).toHaveBeenCalledOnce();
});

it("follows native dragging in the existing auto-open menu read without another prop change", async () => {
  await setLanguagePreference("en");
  const { studioCtx: studio } = fakeStudioCtx({ devFlagOverrides: { ccStubs: true } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  getStudioCtx.mockReturnValue(studio);
  const view = render(<ViewButton />);
  try {
    expect(screen.getByText("Turn off auto-open mode")).toBeTruthy();
    act(() => studio.setIsDraggingObject(true));
    expect(screen.getByText("Turn on auto-open mode")).toBeTruthy();
    act(() => studio.setIsDraggingObject(false));
    expect(screen.getByText("Turn off auto-open mode")).toBeTruthy();
  } finally {
    view.unmount();
    await studio.awaitEval();
    studio.dispose();
  }
});


it("updates an already mounted View menu from all three actual overlay commands", async () => {
  await setLanguagePreference("en");
  const { studioCtx: studio } = fakeStudioCtx({ devFlagOverrides: { ccStubs: true } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  vi.spyOn(studio, "showComments").mockReturnValue(true);
  getStudioCtx.mockReturnValue(studio);
  const mounted = render(<ViewButton />);
  try {
    expect(screen.getByText("Hide cursors and selections from other users")).toBeTruthy();
    expect(screen.getByText("Hide container outlines when hovering")).toBeTruthy();
    expect(screen.getByText("Hide comments overlay")).toBeTruthy();
    act(() => { studio.toggleShowMultiplayerSelections(); studio.toggleShowAncestorsHoverBoxes(); studio.toggleShowCommentsOverlay(); });
    expect(screen.getByText("Show cursors and selections from other users")).toBeTruthy();
    expect(screen.getByText("Show container outlines when hovering")).toBeTruthy();
    expect(screen.getByText("Show comments overlay")).toBeTruthy();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
