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
import { observable, runInAction } from "mobx";
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
    expandedFrames = observable.map<ArenaFrame, boolean>();
    isFrameExpanded = (frame: ArenaFrame, defaultExpanded = false) =>
      this.expandedFrames.get(frame) ?? defaultExpanded;
    setFrameExpanded = (frame: ArenaFrame, expanded: boolean) =>
      runInAction(() => this.expandedFrames.set(frame, expanded));
    dispose = vi.fn();
    collapseAll = () => {
      fixture.collapseAll();
      runInAction(() => this.expandedFrames.clear());
    };
  },
}));
vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", async () => {
  const ReactModule = await import("react");
  return {
    TreeDndManager: class {},
    ArenaTree: ReactModule.forwardRef((_props: any, _ref) => (
      <div>{fixture.ctx.selectedFrame?.name} layers</div>
    )),
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
afterEach(cleanup);

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
  fixture.ctx = observable(
    {
      site,
      currentArena: arena,
      canvasFocusActive: false,
      selectedFrame: undefined as ArenaFrame | undefined,
      currentArenaEmpty: false,
      changeUnsafe: (fn: () => void) => fn(),
      setStudioFocusOnFrame: vi.fn(({ frame }) => {
        runInAction(() => {
          fixture.ctx.selectedFrame = frame;
        });
      }),
      returnToCanvasOverview: vi.fn(() =>
        runInAction(() => {
          fixture.ctx.canvasFocusActive = false;
        }),
      ),
    },
    {
      selectedFrame: observable.ref,
      site: false,
      currentArena: observable.ref,
      returnToCanvasOverview: false,
      setStudioFocusOnFrame: false,
      changeUnsafe: false,
    },
  );
  return { site, component, frames, arena };
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
  fixture.ctx.canvasFocusActive = true;
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
    runInAction(() => {
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
