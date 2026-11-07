import { applyCanvasSessionState, CanvasSessionState, CanvasStateSpec } from "@/wab/client/components/canvas/canvas-session-state";
import { ensure } from "@/wab/shared/common";
import { act, fireEvent, render } from "@testing-library/react";
import { Tree, TreeProps } from "antd";
import React from "react";
import { AntdTree, registerTree } from "../../../../../../../plasmicpkgs/antd6/src/registerTree";
import { Registerable } from "../../../../../../../plasmicpkgs/antd6/src/utils";

it.each([false, true])("keeps published registered Tree arrays stable across native events (interactive: %s)", async (interactive) => {
  const registerComponent = vi.fn<Registerable["registerComponent"]>();
  registerTree({ registerComponent, registerGlobalContext: vi.fn(), registerToken: vi.fn() });
  const [component, meta] = ensure(registerComponent.mock.calls[0], "Tree must register its native contract");
  expect(component).toBe(AntdTree);
  const helpers = ensure(meta.componentHelpers, "Tree must register its state helpers").helpers.states;
  const specs: CanvasStateSpec[] = Object.entries(ensure(meta.states, "Tree must register its states"))
    .flatMap(([name, state]) => {
      if (state.type !== "writable") {
        return [];
      }
      const prop = meta.props[state.valueProp];
      return [{
        valueProp: state.valueProp,
        onChangeProp: state.onChangeProp,
        initialValueProp: typeof prop === "object" && "uncontrolledProp" in prop ? prop.uncontrolledProp : undefined,
        onChangeArgsToValue: helpers[name].onChangeArgsToValue,
        controlled: false,
      }];
    });
  expect(specs.map((spec) => spec.valueProp).sort()).toEqual(["checkedKeys", "expandedKeys", "selectedKeys"]);
  const session = new CanvasSessionState();
  const onSelect = vi.fn(), onExpand = vi.fn(), onCheck = vi.fn();
  const propsForRender = () => {
    const props: TreeProps = {
      checkable: true,
      selectable: true,
      virtual: false,
      motion: null,
      treeData: [{ title: "Parent", key: "parent", children: [
        { title: "First", key: "first" }, { title: "Second", key: "second" },
      ] }],
      defaultExpandedKeys: ["parent"], defaultSelectedKeys: [], defaultCheckedKeys: [],
      onSelect, onExpand, onCheck,
    };
    applyCanvasSessionState(session, "tree", props, specs, interactive, vi.fn());
    return props;
  };
  // The registration forwards every prop to Antd Tree. Render the host's real
  // Tree instance so the separate SDK package cannot load a second React.
  const initialProps = propsForRender();
  const registeredProps = AntdTree(initialProps).props;
  expect(registeredProps).toEqual(initialProps);
  for (const name of ["onSelect", "onExpand", "onCheck", "selectedKeys", "expandedKeys", "checkedKeys"] as const) {
    expect(registeredProps[name]).toBe(initialProps[name]);
  }
  const view = render(<Tree {...initialProps} />);
  const previous: { value: unknown; copy: unknown }[] = [];
  const retain = () => {
    for (const entry of Object.values(session.instanceStore("tree").getState())) {
      previous.push({ value: entry.value, copy: structuredClone(entry.value) });
    }
  };
  const assertPrevious = () => previous.forEach(({ value, copy }) => expect(value).toEqual(copy));
  const rerender = () => view.rerender(<Tree {...propsForRender()} />);
  retain();
  fireEvent.click(view.getByText("First"));
  expect(session.get("tree", "selectedKeys")).toEqual(["first"]);
  assertPrevious(); rerender(); retain();
  const second = ensure(view.getByText("Second").closest(".ant-tree-treenode"), "Second must be a native tree node");
  fireEvent.click(ensure(second.querySelector(".ant-tree-checkbox"), "Tree must render the registered checkbox"));
  expect(session.get("tree", "checkedKeys")).toEqual(["second"]);
  assertPrevious(); rerender(); retain();
  fireEvent.click(view.getByText("Second"));
  expect(session.get("tree", "selectedKeys")).toEqual(["second"]);
  assertPrevious(); rerender(); retain();
  const parentSwitcher = () => ensure(ensure(view.getByText("Parent").closest(".ant-tree-treenode"), "Parent must be a native tree node").querySelector(".ant-tree-switcher"), "Tree must render its parent switcher");
  fireEvent.click(parentSwitcher());
  expect(session.get("tree", "expandedKeys")).toEqual([]);
  assertPrevious(); rerender(); retain();
  // Tree releases its expand/collapse event guard in onListChangeEnd's task.
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  fireEvent.click(parentSwitcher());
  expect(session.get("tree", "expandedKeys")).toEqual(["parent"]);
  assertPrevious();
  expect(onSelect).toHaveBeenCalledTimes(interactive ? 2 : 0);
  expect(onExpand).toHaveBeenCalledTimes(interactive ? 2 : 0);
  expect(onCheck).toHaveBeenCalledTimes(interactive ? 1 : 0);
  view.unmount(); session.dispose();
});
