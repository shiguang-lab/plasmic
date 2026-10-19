import { RightPane } from "@/wab/client/components/studio/RightPane";
import { SIDE_PANEL_TRANSITION_MS } from "@/wab/client/components/studio/SidePanelShell";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  RightTabKey: {
    style: "style",
    interactions: "interactions",
    component: "component",
  },
}));
vi.mock("@/wab/client/components/comments/CommentsTab", () => ({
  default: () => <div>Comments content</div>,
}));
vi.mock("@/wab/client/components/dev", () => ({
  DevContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/wab/client/components/sidebar-tabs/FrameSelectionPanel", () => ({
  FrameSelectionPanel: () => <div>Artboard selection</div>,
}));
vi.mock("@/wab/client/components/sidebar-tabs/MultiSelectionPanel", () => ({
  MultiSelectionPanel: () => <div>Layer selection</div>,
}));
vi.mock("@/wab/client/components/sidebar-tabs/style-tab", async () => {
  const { createContext } = await import("react");
  return {
    StyleTabContext: createContext("design"),
    StyleTab: () => <div>Style content</div>,
    ComponentOrPageTab: () => <div>Data content</div>,
  };
});
vi.mock("@/wab/client/components/style-controls/StyleComponent", () => ({
  providesSidebarPopupSetting: () => (children: React.ReactNode) => children,
}));
vi.mock("@/wab/client/components/widgets", () => ({
  Tab: class {
    constructor(props: object) {
      Object.assign(this, props);
    }
  },
}));
vi.mock("@/wab/client/i18n/UiText", () => ({
  UiText: ({ message }: { message: string }) => <>{message}</>,
}));
vi.mock("@/wab/shared/core/tpls", () => ({
  isTplComponent: () => false,
  summarizeTpl: () => "Element",
}));
vi.mock("@/wab/shared/model/classes", () => ({ isKnownTplTag: () => false }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  const ctx = mock<StudioCtx>();
  const view = mock<ViewCtx>();
  const state = observable({
    hidden: false,
    comments: false,
    controls: true,
    tab: "style",
    focused: true,
    layers: 0,
    frames: 0,
    pending: false,
  });
  Object.defineProperties(ctx, {
    panelsHidden: { get: () => state.hidden },
    showDevControls: { get: () => state.controls },
    showCommentsPanel: { get: () => state.comments },
    rightTabKey: { get: () => state.tab },
    isSelectionPending: { get: () => state.pending },
  });
  Object.defineProperty(view, "component", { value: { name: "Page" } });
  ctx.focusedViewCtx.mockImplementation(() =>
    state.focused ? view : undefined,
  );
  ctx.focusedOrFirstViewCtx.mockImplementation(() =>
    state.focused ? view : undefined,
  );
  ctx.focusedFrames.mockImplementation(() =>
    Array.from({ length: state.frames }, () => mock()),
  );
  view.focusedSelectables.mockImplementation(() =>
    Array.from({ length: state.layers }, () => mock()),
  );
  ctx.showComments.mockReturnValue(true);
  return { ctx, view, state };
}

it("keeps the same shell for design, interactions, data, comments and both selection panels", () => {
  const { ctx, state } = setup();
  const mounted = render(<RightPane studioCtx={ctx} canvasLoading={false} />);
  const shell = mounted.container.querySelector(
    '[data-test-id="right-panel-shell"]',
  );
  const refresh = () => {
    mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
    expect(
      mounted.container.querySelectorAll(".canvas-editor__right-pane"),
    ).toHaveLength(1);
    expect(
      mounted.container.querySelector('[data-test-id="right-panel-shell"]'),
    ).toBe(shell);
    expect(shell).toHaveAttribute("data-open", "true");
  };
  expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  act(() => {
    state.tab = "interactions";
  });
  refresh();
  expect(screen.getByRole("tab", { name: "Interactions" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  act(() => {
    state.tab = "component";
  });
  refresh();
  expect(screen.getByText("Data content")).toBeVisible();
  act(() => {
    state.comments = true;
  });
  refresh();
  expect(screen.getByText("Comments content")).toBeVisible();
  expect(screen.queryByRole("tab")).toBeNull();
  act(() => {
    state.comments = false;
  });
  refresh();
  expect(screen.queryByText("Comments content")).toBeNull();
  act(() => {
    state.layers = 2;
  });
  refresh();
  expect(screen.getByText("Layer selection")).toBeVisible();
  act(() => {
    state.frames = 2;
  });
  refresh();
  expect(screen.getByText("Artboard selection")).toBeVisible();
});

it("animates empty selections, global hiding and loading through one noninteractive shell, including rapid reopen", async () => {
  vi.useFakeTimers();
  const { ctx, state } = setup();
  const mounted = render(<RightPane studioCtx={ctx} canvasLoading={false} />);
  const shell = mounted.container.querySelector(
    '[data-test-id="right-panel-shell"]',
  );
  act(() => {
    state.comments = true;
  });
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
  act(() => {
    state.hidden = true;
  });
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
  expect(shell).toHaveAttribute("data-open", "false");
  expect(shell).toHaveAttribute("inert");
  expect(shell).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("Comments content")).toBeInTheDocument();
  act(() => {
    state.hidden = false;
  });
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
  await act(() => vi.advanceTimersByTime(SIDE_PANEL_TRANSITION_MS));
  expect(shell).toHaveAttribute("data-open", "true");
  expect(shell).not.toHaveAttribute("inert");
  expect(screen.getByText("Comments content")).toBeInTheDocument();
  act(() => {
    state.comments = false;
  });
  act(() => {
    state.focused = false;
  });
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
  expect(shell).toHaveAttribute("data-open", "false");
  await act(() => vi.advanceTimersByTime(SIDE_PANEL_TRANSITION_MS));
  expect(shell?.children).toHaveLength(0);
  act(() => {
    state.comments = true;
  });
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
  expect(shell).toHaveAttribute("data-open", "true");
  expect(screen.getByText("Comments content")).toBeInTheDocument();
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading />);
  expect(shell).toHaveAttribute("data-open", "false");
  act(() => {
    state.controls = false;
  });
  act(() => {
    state.focused = true;
  });
  mounted.rerender(<RightPane studioCtx={ctx} canvasLoading={false} />);
  expect(shell).toHaveAttribute("data-open", "false");
  expect(
    mounted.container.querySelectorAll(".canvas-editor__right-pane"),
  ).toHaveLength(1);
});


it("removes stale controls until the latest selection is ready, while retaining the shell and title", () => {
  const { ctx, state } = setup();
  state.tab = "component";
  const mounted = render(<RightPane studioCtx={ctx} canvasLoading={false} />);
  const shell = mounted.container.querySelector('[data-test-id="right-panel-shell"]');
  expect(screen.getByText("Data content")).toBeVisible();
  act(() => { state.pending = true; });
  expect(screen.queryByText("Data content")).toBeNull();
  expect(screen.getByText("Page")).toBeVisible();
  act(() => { state.tab = "component"; state.pending = false; });
  expect(screen.getByText("Data content")).toBeVisible();
  expect(mounted.container.querySelector('[data-test-id="right-panel-shell"]')).toBe(shell);
});
