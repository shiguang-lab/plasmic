import {
  OutlineCtx,
  OutlineNode,
  OutlineNodeData,
  makeNodeKey,
} from "@/wab/client/components/sidebar-tabs/OutlineCtx";
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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
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
vi.mock("@/wab/client/components/widgets/ListStack", () => ({
  ListSpace: ({ children }: any) => children({ height: 500 }),
}));
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
  const arena = new Arena({ name: "Overview", children: frames });
  const studio = mock<StudioCtx>();
  Object.assign(studio, { site, currentArena: arena });
  studio.changeUnsafe.mockImplementation((fn: any) => fn());
  const expanded = observable.map<ArenaFrame, boolean>();
  const outline = mock<OutlineCtx>();
  outline.isFrameExpanded.mockImplementation(
    (frame) => expanded.get(frame) ?? false,
  );
  outline.setFrameExpanded.mockImplementation((frame, value) =>
    runInAction(() => {
      expanded.set(frame, value);
    }),
  );
  outline.focusedNodeKeyPath.mockReturnValue([]);
  const children = frames.map(() => {
    const child = mock<OutlineCtx>();
    child.rootTreeNode.mockReturnValue(null);
    child.isVisible.mockReturnValue(true);
    child.isExpanded.mockReturnValue(true);
    return child;
  });
  outline.getFrameOutline.mockImplementation(
    (frame) => children[frames.indexOf(frame)],
  );
  return { site, frames, arena, studio, outline, children };
}

it("lists artboards directly and separates expanding, selecting and focusing", () => {
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
  fireEvent.click(screen.getByRole("button", { name: "Focus artboard: List" }));
  expect(f.studio.focusCanvasFrame).toHaveBeenCalledWith(f.frames[0]);
  expect(screen.queryByRole("menu")).toBeNull();
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
