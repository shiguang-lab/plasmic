import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { createStore } from "zustand/vanilla";
import * as outlineModelInputs from "@/wab/client/components/sidebar-tabs/outline-model-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  OutlineCtx,
  OutlineNode,
  OutlineNodeData,
  makeNodeKey,
} from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import { createOutlineStateStore } from "@/wab/client/components/sidebar-tabs/outline-state";
import { Matcher } from "@/wab/client/components/view-common";
import {
  ArenaTree,
  TreeDndManager,
  buildVisibleOutlineRows,
} from "@/wab/client/components/sidebar-tabs/tpl-tree";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { Arena, ArenaFrame } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("react-window", async () => {
  const ReactModule = await import("react");
  return {
    FixedSizeList: ReactModule.forwardRef((props: any, _ref) => (
      <div>
        {Array.from({ length: props.itemCount }, (_, index) =>
          ReactModule.createElement(props.children, {
            key: props.itemKey(index, props.itemData),
            index,
            data: props.itemData,
            style: {},
          }),
        )}
      </div>
    )),
  };
});
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "Customers",
    type: ComponentType.Page,
  });
  const frames = ["List", "Details"].map((name) =>
    mkArenaFrame({ site, component, name, width: 1440, height: 960 }),
  );
  const arena = new Arena({ name: "Overview", children: frames });
  const studio = mock<StudioCtx>();
  site.arenas.push(arena);
  const models = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  arenaState.setCurrent(arena);
  const focus = new StudioSelection(() => models);
  Object.assign(studio, { site, modelSnapshots: models, arenaState });
  Object.defineProperty(studio, "currentArena", { get: () => arenaState.currentArena() });
  Object.defineProperties(studio, {
    selectionStore: { value: focus.store },
    hoveredViewStore: { value: createStore(() => undefined) },
    renamingOnPanelStore: { value: createStore(() => false) },
  });
  studio.focusedViewCtx.mockImplementation(() => focus.current().view);
  studio.changeUnsafe.mockImplementation((fn: any) => fn());
  const expanded = new Map<ArenaFrame, boolean>();
  const outline = mock<OutlineCtx>();
  // The component subscribes to the outline state store; the mock needs a real one.
  Object.defineProperty(outline, "stateStore", { value: createOutlineStateStore(new Matcher("")) });
  outline.isFrameExpanded.mockImplementation(
    (frame) => expanded.get(frame) ?? false,
  );
  outline.setFrameExpanded.mockImplementation((frame, value) =>
    {
      expanded.set(frame, value);
      const store = outline.stateStore;
      store.setState({ expandedFrames: new Map(expanded), version: store.getState().version + 1 });
    },
  );
  outline.focusedNodeKeyPath.mockReturnValue([]);
  outline.viewCtx.mockReturnValue(undefined);
  const children = frames.map(() => {
    const child = mock<OutlineCtx>();
    Object.defineProperty(child, "stateStore", { value: createOutlineStateStore(new Matcher("")) });
    child.rootTreeNode.mockReturnValue(null);
    child.isVisible.mockReturnValue(true);
    child.isExpanded.mockReturnValue(true);
    return child;
  });
  outline.getFrameOutline.mockImplementation(
    (frame) => children[frames.indexOf(frame)],
  );
  return { site, frames, arena, arenaState, studio, outline, children };
}

it("lists artboards directly and separates expanding from selecting", () => {
  const f = setup();
  render(
    <ArenaTree
      studioCtx={f.studio}
      arena={f.arena}
      outlineCtx={f.outline}
      dndManager={mock<TreeDndManager>()}
    />,
  );
  const toggle = screen.getByRole("button", { name: "List", expanded: false });
  expect(
    screen.getByRole("button", { name: "Details", expanded: false }),
  ).toBeDefined();
  fireEvent.click(toggle);
  expect(
    screen.getByRole("button", { name: "List", expanded: true }),
  ).toBeDefined();
  expect(f.studio.setStudioFocusOnFrame).not.toHaveBeenCalled();
  const label = screen
    .getAllByRole("button", { name: "Details" })
    .find((button) => !button.hasAttribute("aria-expanded"));
  fireEvent.click(ensure(label, "Artboard label"));
  expect(f.studio.setStudioFocusOnFrame).toHaveBeenCalledWith({
    frame: f.frames[1],
    autoZoom: false,
  });
  expect(
    screen.getByRole("button", { name: "List", expanded: true }),
  ).toBeDefined();
});

it("leases model inputs only for expanded artboards and releases them on collapse", () => {
  const f = setup();
  const inputs = f.children.map(() => {
    const input = createStore<readonly unknown[]>(() => []);
    return { ...input, getTreeState: input.getState };
  });
  const releases = inputs.map(() => vi.fn());
  inputs.forEach((input, index) => {
    const subscribe = input.subscribe;
    vi.spyOn(input, "subscribe").mockImplementation((listener) => {
      const stop = subscribe(listener);
      return () => { releases[index](); stop(); };
    });
  });
  const views: ViewCtx[] = f.children.map((child) => {
    const view = mock<ViewCtx>();
    child.viewCtx.mockReturnValue(view);
    return view;
  });
  const readInput = vi.spyOn(outlineModelInputs, "getOutlineModelInput")
    .mockImplementation((view) => inputs[views.indexOf(ensure(view, "Frame view"))]);
  const mounted = render(<ArenaTree studioCtx={f.studio} arena={f.arena} outlineCtx={f.outline} dndManager={mock<TreeDndManager>()} />);
  expect(readInput).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "List", expanded: false }));
  expect(readInput).toHaveBeenCalledWith(views[0]);
  expect(readInput).not.toHaveBeenCalledWith(views[1]);
  expect(inputs[0].subscribe).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "List", expanded: true }));
  expect(releases[0]).toHaveBeenCalledOnce();
  readInput.mockClear();
  act(() => inputs[0].setState(["Changed while collapsed"], true));
  expect(readInput).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "List", expanded: false }));
  expect(inputs[0].subscribe).toHaveBeenCalledTimes(2);
  mounted.unmount();
  expect(releases[0]).toHaveBeenCalledTimes(2);
});

it("flattens expanded artboards into one list with independent contexts and unique repeated-node keys", () => {
  const f = setup();
  const root = mkTplTagX("div");
  const leaf = mkTplTagX("span");
  const tree: OutlineNode = {
    self: mock<OutlineNodeData>({
      key: makeNodeKey(root),
      item: root,
      indent: 0,
    }),
    children: [
      {
        self: mock<OutlineNodeData>({
          key: makeNodeKey(leaf),
          item: leaf,
          indent: 1,
        }),
        children: [],
      },
    ],
  };
  f.children.forEach((child) => child.rootTreeNode.mockReturnValue(tree));
  f.frames.forEach((frame) => f.outline.setFrameExpanded(frame, true));
  const rows = buildVisibleOutlineRows(f.arena, f.outline);
  expect(rows.map((row) => row.type)).toEqual([
    "artboard",
    "node",
    "node",
    "artboard",
    "node",
    "node",
  ]);
  expect(rows.map((row) => row.indent)).toEqual([0, 1, 2, 0, 1, 2]);
  expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  const layers = rows.filter((row) => row.type === "node");
  expect(layers.map((row) => row.outlineCtx)).toEqual([
    f.children[0],
    f.children[0],
    f.children[1],
    f.children[1],
  ]);
  f.outline.setFrameExpanded(f.frames[0], false);
  expect(
    buildVisibleOutlineRows(f.arena, f.outline).map((row) => row.type),
  ).toEqual(["artboard", "artboard", "node", "node"]);
});

it("retires inactive arena rows without recreating old frame inputs and reactivates A-B-A before commit", () => {
  const f = setup();
  const next = new Arena({ name: "Other", children: [] });
  f.site.arenas.push(next);
  const childStops: ReturnType<typeof vi.fn>[] = [];
  for (const child of f.children) {
    const subscribe = child.stateStore.subscribe;
    vi.spyOn(child.stateStore, "subscribe").mockImplementation((listener) => {
      const stop = vi.fn(subscribe(listener));
      childStops.push(stop);
      return stop;
    });
  }
  const mounted = render(<ArenaTree studioCtx={f.studio} arena={f.arena} outlineCtx={f.outline} dndManager={mock<TreeDndManager>()} />);
  expect(screen.getByRole("button", { name: "List", expanded: false })).toBeDefined();
  f.outline.getFrameOutline.mockClear();
  f.outline.refreshVariantSearch.mockClear();
  act(() => f.arenaState.setCurrent(next));
  expect(screen.queryAllByRole("button", { name: "List" })).toHaveLength(0);
  expect(f.outline.getFrameOutline).not.toHaveBeenCalled();
  expect(f.outline.refreshVariantSearch).not.toHaveBeenCalled();
  expect(childStops.length).toBeGreaterThan(0);
  expect(childStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  act(() => f.outline.setFrameExpanded(f.frames[0], true));
  expect(f.outline.getFrameOutline).not.toHaveBeenCalled();
  act(() => f.arenaState.setCurrent(f.arena));
  expect(screen.getByRole("button", { name: "List", expanded: true })).toBeDefined();
  act(() => { f.arenaState.setCurrent(next); f.arenaState.setCurrent(f.arena); });
  expect(screen.getByRole("button", { name: "List", expanded: true })).toBeDefined();
  act(() => f.outline.setFrameExpanded(f.frames[0], false));
  expect(screen.getByRole("button", { name: "List", expanded: false })).toBeDefined();
  mounted.unmount();
  f.outline.getFrameOutline.mockClear();
  f.outline.refreshVariantSearch.mockClear();
  act(() => { f.arenaState.setCurrent(next); f.arenaState.setCurrent(f.arena); f.outline.setFrameExpanded(f.frames[0], true); });
  expect(f.outline.getFrameOutline).not.toHaveBeenCalled();
  expect(f.outline.refreshVariantSearch).not.toHaveBeenCalled();
  expect(childStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
});
