import { getDedicatedArena } from "@/wab/shared/core/sites";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { ComponentType } from "@/wab/shared/core/components";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { createSite } from "@/wab/shared/core/sites";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { createStore } from "zustand/vanilla";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { RightTabKey, type StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioLeftPanelState } from "@/wab/client/studio-ctx/left-panel-state";
import { createRightPanelStore } from "@/wab/client/studio-ctx/right-panel-state";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { TplMgr } from "@/wab/shared/TplMgr";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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
const arenaOwners = new Set<{ dispose(): void }>();
afterEach(() => { cleanup(); for (const owner of arenaOwners) { owner.dispose(); } arenaOwners.clear(); });

it("resets header geometry when available tabs change, retaining the active page editor", async () => {
  const rightPanelStore = createRightPanelStore();
  rightPanelStore.setState({ tabKey: RightTabKey.component });
  const models = new ModelSnapshots();
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ type: ComponentType.Plain, name: "Page" });
  const arena = ensure(getDedicatedArena(site, component), "Component arena fixture");
  const frame = getArenaFrames(arena)[0];
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  arenaState.setCurrent(arena);
  arenaOwners.add(arenaState);
  arenaOwners.add(models);
  const renderPolicy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
  arenaOwners.add(renderPolicy);
  const focus = new StudioSelection(() => models);
  const selection = new ViewSelection(() => models);
  const leftPanelState = new StudioLeftPanelState();
  const sc = mock<StudioCtx>();
  const vc = mock<ViewCtx>({ component });
  vc.focusedTpl.mockReturnValue(null);
  vc.focusedSelectables.mockReturnValue([]);
  focus.set(vc, []);
  Object.defineProperty(vc, "selectionStore", { value: selection.store });
  sc.focusedViewCtx.mockImplementation(() => focus.current().view);
  sc.focusedOrFirstViewCtx.mockReturnValue(vc);
  sc.focusedFrames.mockReturnValue([]);
  sc.showComments.mockReturnValue(false);
  Object.defineProperties(sc, {
    arenaState: { value: arenaState },
    modelSnapshots: { value: models },
    selectionStore: { value: focus.store },
    rightPanelStore: { value: rightPanelStore },
    showDevControls: { value: true },
    leftPanelState: { value: leftPanelState },
    overlayState: { value: new StudioOverlayState() },
    inspectorStore: { value: createStore(() => ({ selection: undefined, pending: false })) },
    renderPolicy: { value: renderPolicy },
  });
  sc.switchRightTab.mockImplementation((tab) => {
    rightPanelStore.setState({ tabKey: tab });
  });
  Object.defineProperties(vc, {
    studioCtx: { value: sc }, modelLifetime: { value: arenaState.lifetime() },
    isDisposed: { value: false }, initialRenderReadyStore: { value: createStore(() => true) },
  });
  vc.arenaFrame.mockReturnValue(frame);
  arenaState.viewRegistry.register(vc);
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
    (() => {
      focus.set(undefined, []);
    })(),
  );
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  const singleTabHeader = header();
  expect(singleTabHeader).not.toBe(threeTabsHeader);
  expect(screen.getByRole("textbox", { name: "Page title draft" })).toBe(
    editor,
  );
  expect(editor.value).toBe("Unsaved title");

  await act(() =>
    (() => {
      focus.set(vc, []);
    })(),
  );
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(header()).not.toBe(singleTabHeader);
  expect(screen.getByRole("textbox", { name: "Page title draft" })).toBe(
    editor,
  );
  expect(editor.value).toBe("Unsaved title");
  const stableHeader = header();
  await act(() =>
    (() => {
      rightPanelStore.setState({ tabKey: RightTabKey.style });
    })(),
  );
  expect(header()).toBe(stableHeader);
});
