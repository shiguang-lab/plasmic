import {
  RenderElementProps,
  VirtualTree,
  useTreeData,
} from "@/wab/client/components/grouping/VirtualTree";
import { NavigationDropdownContext } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import {
  NavigationArenaRow,
  NavigationHeaderRow,
} from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationRows";
import { Matcher } from "@/wab/client/components/view-common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ studioCtx: {} as any }));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => fixture.studioCtx,
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/ArenaContextMenu",
  () => ({ ArenaContextMenu: () => null }),
);
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown",
  async () => {
    const { createContext } = await import("react");
    return { NavigationDropdownContext: createContext(undefined) };
  },
);
vi.mock("@/wab/client/components/widgets/ListStack", () => ({
  ListSpace: ({
    children,
  }: {
    children: (size: { height: number }) => React.ReactNode;
  }) => children({ height: 300 }),
}));
vi.mock("@/wab/client/components/widgets/VirtualListScrollbar", async () => {
  const { forwardRef } = await import("react");
  return {
    VirtualListScrollbar: forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >((props, ref) => <div {...props} ref={ref} />),
  };
});
afterEach(cleanup);

it("opens another page's settings without invoking row navigation or changing the current arena", () => {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const currentPage = mgr.addComponent({
    name: "Page1",
    type: ComponentType.Page,
  });
  const targetPage = mgr.addComponent({
    name: "Page2",
    type: ComponentType.Page,
  });
  const currentArena = ensure(
    site.pageArenas.find((a) => a.component === currentPage),
    "Current page arena",
  );
  const targetArena = ensure(
    site.pageArenas.find((a) => a.component === targetPage),
    "Target page arena",
  );
  const navigate = vi.fn();
  fixture.studioCtx = {
    currentArena,
    commentsCtx: {
      computedData: () => ({ commentStatsByComponent: new Map() }),
    },
    changeUnsafe: (fn: () => void) => fn(),
  };
  render(
    <NavigationDropdownContext.Provider value={{ onClose: vi.fn() }}>
      <NavigationArenaRow
        arena={targetArena}
        matcher={new Matcher("")}
        indentMultiplier={0}
        onClick={navigate}
      />
    </NavigationDropdownContext.Provider>,
  );
  fireEvent.mouseEnter(screen.getByText("Page2"));
  fireEvent.click(screen.getByRole("button", { name: "Page settings" }));
  expect(fixture.studioCtx.pageSettingsPage).toBe(targetPage);
  expect(fixture.studioCtx.pageSettingsOpen).toBe(true);
  expect(fixture.studioCtx.currentArena).toBe(currentArena);
  expect(navigate).not.toHaveBeenCalled();
});

interface TestNode {
  key: string;
  name: string;
  children: TestNode[];
}
const testNodes: TestNode[] = [
  {
    key: "pages",
    name: "Pages",
    children: [{ key: "customers", name: "Customers", children: [] }],
  },
];
const onAdd = vi.fn(async () => undefined);
function TestRow({ value, treeState }: RenderElementProps<TestNode>) {
  return value.key === "pages" ? (
    <NavigationHeaderRow
      onAdd={onAdd}
      groupSize={1}
      isOpen={treeState.isOpen}
      toggleExpand={treeState.toggleExpand}
    >
      {value.name}
    </NavigationHeaderRow>
  ) : (
    <span>{value.name}</span>
  );
}
function DirectoryTree() {
  const tree = useTreeData<TestNode>({
    nodes: testNodes,
    query: "",
    renderElement: TestRow,
    getNodeKey: (node) => node.key,
    getNodeChildren: (node) => node.children,
    getNodeSearchText: (node) => node.name,
    getNodeHeight: () => 30,
    defaultOpenKeys: ["pages"],
  });
  return (
    <VirtualTree {...tree} rootNodes={testNodes} renderElement={TestRow} />
  );
}

it("expands and collapses the real directory tree once per click on the label or chevron", () => {
  render(<DirectoryTree />);
  for (let attempt = 0; attempt < 3; attempt++) {
    fireEvent.click(screen.getByText("Pages"));
    expect(screen.queryByText("Customers")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Pages 1" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    const toggle = screen.getByRole("button", { name: "Pages 1" });
    fireEvent.click(ensure(toggle.querySelector("svg"), "Category chevron"));
    expect(screen.getByText("Customers")).toBeDefined();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  }
});

it("adds within an open group without bubbling into the tree's collapse action", async () => {
  onAdd.mockClear();
  render(<DirectoryTree />);
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  expect(onAdd).toHaveBeenCalledOnce();
  expect(screen.getByText("Customers")).toBeDefined();
});
