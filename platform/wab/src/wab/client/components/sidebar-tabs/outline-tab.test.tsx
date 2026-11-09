import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { createOutlineStateStore, patchOutlineState } from "@/wab/client/components/sidebar-tabs/outline-state";
import { Matcher } from "@/wab/client/components/view-common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { createCanvasOverviewStore } from "@/wab/client/studio-ctx/canvas-overview-state";
import { Pt } from "@/wab/shared/geom";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { StudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { isMixedArena, type AnyArena } from "@/wab/shared/Arenas";
import { OutlineTab } from "@/wab/client/components/sidebar-tabs/outline-tab";
import { getArenaFrames, mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { Arena, ArenaFrame, ArenaFrameCell } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({
  ctx: undefined as any,
  collapseAll: vi.fn(),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock("@/wab/client/components/sidebar-tabs/OutlineCtx", () => ({
  OutlineCtx: class {
    viewCtx = () =>
      fixture.ctx.selectedFrame
        ? { arenaFrame: () => fixture.ctx.selectedFrame }
        : undefined;
    stateStore = createOutlineStateStore(new Matcher(""));
    isFrameExpanded = (frame: ArenaFrame, defaultExpanded = false) =>
      this.stateStore.getState().expandedFrames.get(frame) ?? defaultExpanded;
    setFrameExpanded = (frame: ArenaFrame, expanded: boolean) => {
      const frames = new Map(this.stateStore.getState().expandedFrames); frames.set(frame, expanded);
      patchOutlineState(this.stateStore, { expandedFrames: frames });
    };
    dispose = vi.fn();
    collapseAll = () => {
      fixture.collapseAll();
      patchOutlineState(this.stateStore, { expandedFrames: new Map() });
    };
  },
}));
vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", async () => {
  const ReactModule = await import("react");
  const { useStudioSelection } = await import("@/wab/client/studio-ctx/selection-state");
  const { useCanvasComponentValue } = await import("@/wab/client/components/canvas/canvas-view-inputs");
  return {
    TreeDndManager: class {},
    ArenaTree: ReactModule.forwardRef(function ArenaTree(_props: any, _ref) {
      const frame = useStudioSelection(fixture.ctx, (state) => state.frames[0] ? fixture.ctx.modelSnapshots.resolve(state.frames[0]) : undefined);
      const recipe = ReactModule.useCallback((field) => { if (frame) { field(frame, "name"); } }, [frame]);
      const read = ReactModule.useCallback(() => frame?.name, [frame]);
      const name = useCanvasComponentValue(fixture.ctx, frame ?? fixture.ctx.site, recipe, read);
      return <div>{name} layers</div>;
    }),
  };
});
beforeAll(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  ),
);
afterAll(() => vi.unstubAllGlobals());
const disposals: (() => void)[] = [];
afterEach(() => { cleanup(); disposals.splice(0).forEach((dispose) => dispose()); });

function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "Customers",
    type: ComponentType.Page,
  });
  const frames = ["List", "Details"].map((name) =>
    mkArenaFrame({ site, component, name, width: 1440, height: 960 }),
  );
  const arena = new Arena({ name: "Customer overview", children: frames });
  site.arenas.push(arena);
  const modelSnapshots = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots });
  arenaState.setCurrent(arena);
  const saveState = new StudioSaveState();
  const selection = new StudioSelection(() => modelSnapshots);
  const canvasOverviewStore = createCanvasOverviewStore();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  disposals.push(() => { arenaState.dispose(); selection.dispose(); modelSnapshots.dispose(); recorder.dispose(); });
  fixture.ctx = {
      site,
      modelSnapshots, arenaState, saveState, canvasOverviewStore, selectionStore: selection.store,
      ...createStudioUiEnvironmentFixture(),
      get currentArena() { return arenaState.currentArena(); },
      set currentArena(value: AnyArena | null) {
        if (isMixedArena(value) && !site.arenas.includes(value)) { site.arenas.push(value); }
        arenaState.setCurrent(value);
      },
      get selectedFrame() { return selection.frames()[0]; },
      set selectedFrame(frame: ArenaFrame | undefined) { selection.set(undefined, frame ? [frame] : []); },
      currentArenaEmpty: false,
      changeUnsafe: (fn: () => void) => fn(),
      setStudioFocusOnFrame: vi.fn(({ frame }) => {
        fixture.ctx.selectedFrame = frame;
      }),
      returnToCanvasOverview: vi.fn(() => {
        canvasOverviewStore.setState({ overview: undefined });
      }),
    };
  return { site, component, frames, arena, edit: (change: () => void) => modelSnapshots.sync(recorder.withRecording(change).changes) };
}

it("shows the arena scope and tree without a current-artboard dropdown", () => {
  setup();
  render(<OutlineTab />);
  expect(screen.getByText("Customer overview")).toBeDefined();
  expect(screen.getByText("Arena")).toBeDefined();
  expect(
    document.querySelector('[data-test-id="elements-panel--current-frame"]'),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Collapse all" })
      .hasAttribute("disabled"),
  ).toBe(false);
  expect(screen.getByText("Arena · 2 artboards")).toBeDefined();
});

it("retains the arena scope and overview action during artboard focus", () => {
  const { frames, arena } = setup();
  fixture.ctx.selectedFrame = frames[1];
  fixture.ctx.canvasOverviewStore.setState({ overview: {
    arena, viewport: { scroll: new Pt(0, 0), canvasPadding: new Pt(0, 0), scale: 1 },
  } });
  render(<OutlineTab />);
  expect(screen.getByText("Customer overview")).toBeDefined();
  expect(screen.getByText("Focused in arena · Details")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Return to overview" }));
  expect(screen.getByText("Arena · 2 artboards")).toBeDefined();
  expect(fixture.ctx.returnToCanvasOverview).toHaveBeenCalledOnce();
  expect(fixture.ctx.currentArena).toBe(arena);
});

it("switches real page sizes using the existing frame selection operation", () => {
  const { site, component } = setup();
  const arena = ensure(
    site.pageArenas.find((a) => a.component === component),
    "Page arena",
  );
  fixture.ctx.currentArena = arena;
  const frames = arena.matrix.rows.flatMap((row) =>
    row.cols.map((col) => col.frame),
  );
  const second = mkArenaFrame({
    site,
    component,
    name: "Mobile",
    width: 390,
    height: 844,
  });
  arena.matrix.rows[0].cols.push(
    new ArenaFrameCell({ frame: second, cellKey: null }),
  );
  fixture.ctx.selectedFrame = frames[0];
  render(<OutlineTab />);
  expect(
    document.querySelector('[data-test-id="elements-panel--current-frame"]'),
  ).toBeNull();
  expect(screen.queryByRole("menu")).toBeNull();
  const mobileButton = ensure(
    screen
      .getAllByRole("button", { name: "Mobile" })
      .find((button) => button.title.includes("390 × 844")),
    "Mobile artboard button",
  );
  fireEvent.click(mobileButton);
  expect(fixture.ctx.setStudioFocusOnFrame).toHaveBeenCalledWith({
    frame: second,
    autoZoom: true,
  });
  expect(screen.getByText("Page editing · Mobile")).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Customers · Mobile", expanded: true }),
  ).toBeDefined();
  expect(mobileButton.getAttribute("aria-pressed")).toBe("true");
});

it("uses the page title only to fold layers and reopens them through device buttons", () => {
  const { site, component } = setup();
  const arena = ensure(
    site.pageArenas.find((a) => a.component === component),
    "Page arena",
  );
  const frame = ensure(getArenaFrames(arena)[0], "Page frame");
  frame.width = 1440;
  frame.height = 1024;
  frame.name = "Desktop";
  fixture.ctx.currentArena = arena;
  fixture.ctx.selectedFrame = frame;
  render(<OutlineTab />);
  expect(screen.getByText("Desktop layers")).toBeDefined();
  fireEvent.click(
    screen.getByRole("button", { name: "Customers · Desktop", expanded: true }),
  );
  expect(screen.queryByText("Desktop layers")).toBeNull();
  expect(
    screen.getByRole("button", {
      name: "Customers · Desktop",
      expanded: false,
    }),
  ).toBeDefined();
  expect(fixture.ctx.setStudioFocusOnFrame).not.toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
  expect(screen.getByText("Desktop layers")).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Customers · Desktop", expanded: true }),
  ).toBeDefined();
});

it.each([
  [1440, 1024, "Desktop"],
  [1440, 960, "Tablet"],
  [1194, 834, "Tablet"],
  [390, 844, "Mobile"],
  [1366, 768, "Desktop"],
  [900, 700, "Tablet"],
  [600, 900, "Mobile"],
  [3840, 2160, "TVs"],
])("shows the device for a %s × %s page viewport", (width, height, device) => {
  const { site, component } = setup();
  const arena = ensure(
    site.pageArenas.find((a) => a.component === component),
    "Page arena",
  );
  const frame = ensure(getArenaFrames(arena)[0], "Page frame");
  frame.width = width;
  frame.height = height;
  fixture.ctx.currentArena = arena;
  fixture.ctx.selectedFrame = frame;
  render(<OutlineTab />);
  expect(screen.getByText(`Page editing · ${device}`)).toBeDefined();
  expect(screen.queryByText(`Page editing · ${width} × ${height}`)).toBeNull();
});

it("updates the arena footer count when artboards change", () => {
  const { arena, site, component } = setup();
  render(<OutlineTab />);
  act(() => {
      fixture.ctx.currentArena = new Arena({
        name: arena.name,
        children: [
          ...arena.children,
          mkArenaFrame({
            site,
            component,
            name: "New artboard",
            width: 390,
            height: 844,
          }),
        ],
      });
  });
  expect(screen.getByText("Arena · 3 artboards")).toBeDefined();
});

it("shows the current component editing device", () => {
  const { site } = setup();
  const component = new TplMgr({ site }).addComponent({
    name: "CustomerCard",
    type: ComponentType.Plain,
  });
  const arena = ensure(
    site.componentArenas.find((it) => it.component === component),
    "Component arena",
  );
  const frame = ensure(getArenaFrames(arena)[0], "Component frame");
  fixture.ctx.currentArena = arena;
  fixture.ctx.selectedFrame = frame;
  render(<OutlineTab />);
  expect(screen.getByText("Component editing · Desktop")).toBeDefined();
});

it("offers only collapse all without layer search or expand all", () => {
  const { frames } = setup();
  fixture.ctx.selectedFrame = frames[0];
  fixture.collapseAll.mockClear();
  render(<OutlineTab />);
  expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Expand all" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  expect(fixture.collapseAll).toHaveBeenCalledOnce();
});

it("updates page name, viewport size and device from committed native metadata", () => {
  const { site, component, edit } = setup();
  const arena = ensure(site.pageArenas.find((item) => item.component === component), "Page arena");
  const frame = ensure(getArenaFrames(arena)[0], "Page viewport");
  fixture.ctx.currentArena = arena; fixture.ctx.selectedFrame = frame;
  render(<OutlineTab />);
  act(() => edit(() => { component.name = "Accounts"; frame.width = 390; frame.height = 844; }));
  expect(screen.getByRole("button", { name: "Accounts · Mobile", expanded: true })).toBeDefined();
  const viewportButton = ensure(screen.getAllByRole("button", { name: "Mobile" }).find((button) => button.title === "Accounts · 390 × 844"), "Renamed 390 × 844 viewport button");
  expect(viewportButton.title).toBe("Accounts · 390 × 844");
  expect(viewportButton.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Page editing · Mobile")).toBeDefined();
});

it("updates a focused artboard label through native model publication", () => {
  const { arena, frames, edit } = setup();
  const frame = ensure(frames[1], "Focused artboard");
  fixture.ctx.selectedFrame = frame;
  fixture.ctx.canvasOverviewStore.setState({ overview: { arena, viewport: { scroll: new Pt(0, 0), canvasPadding: new Pt(0, 0), scale: 1 } } });
  render(<OutlineTab />);
  expect(screen.getByText("Focused in arena · Details")).toBeDefined();
  act(() => edit(() => { frame.name = "Invoices"; }));
  expect(screen.getByText("Focused in arena · Invoices")).toBeDefined();
  expect(screen.getByText("Invoices layers")).toBeDefined();
});
