import { RightPane } from "@/wab/client/components/studio/RightPane";
import { RightTabKey, type StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensureInstance } from "@/wab/shared/common";
import type { Component } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
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
  default: () => null,
}));
vi.mock("@/wab/client/components/sidebar-tabs/FrameSelectionPanel", () => ({
  FrameSelectionPanel: () => null,
}));
vi.mock("@/wab/client/components/sidebar-tabs/MultiSelectionPanel", () => ({
  MultiSelectionPanel: () => null,
}));
vi.mock("@/wab/client/components/sidebar-tabs/style-tab", async () => {
  const reactModule = await import("react");
  return {
    StyleTabContext: reactModule.createContext("design"),
    StyleTab: () => <div>Design controls</div>,
    ComponentOrPageTab: function DataPanel() {
      const [draft, setDraft] = reactModule.useState("");
      return (
        <input
          aria-label="Page title draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      );
    },
  };
});
vi.mock("@/wab/client/components/dev", () => ({
  DevContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/wab/client/components/studio/SidePanelShell", () => ({
  SidePanelShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/wab/client/components/style-controls/StyleComponent", () => ({
  providesSidebarPopupSetting: () => (children: React.ReactNode) => children,
}));
vi.mock("@/wab/client/components/widgets", () => ({
  Tab: class {
    constructor(
      public props: {
        key: string;
        name: React.ReactNode;
        contents: () => React.ReactNode;
      },
    ) {}
    get key() {
      return this.props.key;
    }
    get name() {
      return this.props.name;
    }
    get contents() {
      return this.props.contents;
    }
  },
}));
afterEach(cleanup);

it("resets header geometry when available tabs change, retaining the active page editor", async () => {
  const state = observable({ nodeSelected: true, tab: RightTabKey.component });
  const sc = mock<StudioCtx>();
  const vc = mock<ViewCtx>({ component: mock<Component>({ name: "Page" }) });
  vc.focusedTpl.mockReturnValue(null);
  vc.focusedSelectables.mockReturnValue([]);
  sc.focusedViewCtx.mockImplementation(() =>
    state.nodeSelected ? vc : undefined,
  );
  sc.focusedOrFirstViewCtx.mockReturnValue(vc);
  sc.focusedFrames.mockReturnValue([]);
  sc.showComments.mockReturnValue(false);
  Object.defineProperties(sc, {
    rightTabKey: { get: () => state.tab },
    showDevControls: { value: true },
    panelsHidden: { value: false },
    isSelectionPending: { value: false },
  });
  sc.switchRightTab.mockImplementation((tab) => {
    runInAction(() => {
      state.tab = tab;
    });
  });
  const { container } = render(
    <RightPane studioCtx={sc} canvasLoading={false} />,
  );
  const header = () => container.querySelector(".ant-tabs-nav");
  const threeTabsHeader = header();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  const editor = ensureInstance(
    screen.getByRole("textbox", {
      name: "Page title draft",
    }),
    HTMLInputElement,
  );
  fireEvent.change(editor, { target: { value: "Unsaved title" } });

  await act(() =>
    runInAction(() => {
      state.nodeSelected = false;
    }),
  );
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  const singleTabHeader = header();
  expect(singleTabHeader).not.toBe(threeTabsHeader);
  expect(screen.getByRole("textbox", { name: "Page title draft" })).toBe(
    editor,
  );
  expect(editor.value).toBe("Unsaved title");

  await act(() =>
    runInAction(() => {
      state.nodeSelected = true;
    }),
  );
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(header()).not.toBe(singleTabHeader);
  expect(screen.getByRole("textbox", { name: "Page title draft" })).toBe(
    editor,
  );
  expect(editor.value).toBe("Unsaved title");
  const stableHeader = header();
  await act(() =>
    runInAction(() => {
      state.tab = RightTabKey.style;
    }),
  );
  expect(header()).toBe(stableHeader);
});
