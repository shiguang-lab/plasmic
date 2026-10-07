import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdTabItem, AntdTabs, registerTabs } from "../src/registerTabs";
import { AntdCollapse, AntdCollapsePanel, registerCollapse } from "../src/registerCollapse";
import { AntdTree, registerTree, registerDirectoryTree } from "../src/registerTree";
import { AntdDatePicker, registerDatePicker } from "../src/registerDatePicker";
import { AntdDateRangePicker, registerDateRangePicker } from "../src/registerDateRangePicker";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({ registerComponent: (_component, meta) => metas.set(meta.name, meta) } as Registerable);
  return metas;
}
function Canvas({ children, interactive = false }: { children: React.ReactNode; interactive?: boolean }) {
  return <PlasmicCanvasContext.Provider value={{ componentName: "test", globalVariants: {}, interactive }}>{children}</PlasmicCanvasContext.Provider>;
}
const tabs = (selected: boolean) => <>
  <AntdTabItem key="first" label="First">First content</AntdTabItem>
  <AntdTabItem key="second" label="Second" {...{ __plasmic_selection_prop__: { isSelected: selected } }}>Second content</AntdTabItem>
</>;

test("inactive tab selection reveals content only in editing, without business events", () => {
  const onChange = vi.fn();
  const props = { activeKey: "first", items: tabs(true), onChange };
  const view = render(<Canvas><AntdTabs {...props as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  expect(onChange).not.toHaveBeenCalled();
  expect(props.activeKey).toBe("first");
  view.rerender(<Canvas><AntdTabs {...props as any} items={tabs(false)} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(<Canvas interactive><AntdTabs {...props as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("First content");
  view.rerender(<Canvas><AntdTabs {...props as any} items={tabs(false)} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("First content");
});

test("canvas observer slot callbacks execute within their observer", () => {
  function Observer({ children }: { children: () => React.ReactNode }) { return <>{children()}</>; }
  render(<Canvas><AntdTabs {...{ items: <Observer>{() => tabs(true)}</Observer> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
});

test("editing tab clicks survive observer updates without invoking business callbacks", () => {
  function Observer({ children }: { children: () => React.ReactNode }) { return <>{children()}</>; }
  const onChange = vi.fn(), onTabClick = vi.fn();
  const props = { defaultActiveKey: "first", onChange, onTabClick };
  const items = () => <Observer>{() => tabs(false)}</Observer>;
  const view = render(<Canvas><AntdTabs {...{ ...props, items: items() } as any} /></Canvas>);
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  view.rerender(<Canvas><AntdTabs {...{ ...props, items: items() } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  expect(onChange).not.toHaveBeenCalled();
  expect(onTabClick).not.toHaveBeenCalled();
  expect(props.defaultActiveKey).toBe("first");
  view.rerender(<Canvas interactive><AntdTabs {...{ ...props, items: items() } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("First content");
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  expect(onChange).toHaveBeenCalledWith("second");
  expect(onTabClick).toHaveBeenCalledTimes(1);
});

test("retained editing tab yields to configured key changes and removal", () => {
  const third = <AntdTabItem key="third" label="Third">Third content</AntdTabItem>;
  const view = render(<Canvas><AntdTabs {...{ defaultActiveKey: "first", items: <>{tabs(true)}{third}</> } as any} /></Canvas>);
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "first", items: <>{tabs(false)}{third}</> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "third", items: <>{tabs(false)}{third}</> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Third content");
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "first", items: <>{tabs(false)}{third}</> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("First content");
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "third", items: <>{tabs(true)}{third}</> } as any} /></Canvas>);
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "third", items: third } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Third content");
});

test("each Tabs instance retains its own editing tab", () => {
  const instances = (selected: boolean) => <Canvas>
    <section data-testid="selected-tabs"><AntdTabs {...{ defaultActiveKey: "first", items: tabs(selected) } as any} /></section>
    <section data-testid="other-tabs"><AntdTabs {...{ defaultActiveKey: "first", items: tabs(false) } as any} /></section>
  </Canvas>;
  const view = render(instances(true));
  view.rerender(instances(false));
  expect(within(screen.getByTestId("selected-tabs")).getByRole("tabpanel").textContent).toBe("Second content");
  expect(within(screen.getByTestId("other-tabs")).getByRole("tabpanel").textContent).toBe("First content");
});

test.each([undefined, "second"])("delete uses native default active key %s", (defaultActiveKey) => {
  const meta = metadata(registerTabs).get("plasmic-antd6-tabs");
  const remove = vi.fn(), update = vi.fn();
  meta.actions.find((action: any) => action.label === "Delete current tab").onClick({
    componentProps: { items: tabs(false), defaultActiveKey }, studioOps: { removeFromSlotAt: remove, updateProps: update },
  });
  expect(remove).toHaveBeenCalledWith(defaultActiveKey ? 1 : 0, "items");
  expect(update).toHaveBeenCalledWith({ activeKey: defaultActiveKey ? "first" : "second" });
});

test("deleting final tab clears the active key", () => {
  const meta = metadata(registerTabs).get("plasmic-antd6-tabs");
  const update = vi.fn();
  meta.actions.find((action: any) => action.label === "Delete current tab").onClick({
    componentProps: { items: <AntdTabItem key="last" label="Last" />, activeKey: "last" },
    studioOps: { removeFromSlotAt: vi.fn(), updateProps: update },
  });
  expect(update).toHaveBeenCalledWith({ activeKey: undefined });
});

test("Collapse rich slots render without competing default items; explicit native items retain precedence", () => {
  const meta = metadata(registerCollapse).get("plasmic-antd6-collapse");
  expect(meta.props.items.defaultValue).toBeUndefined();
  expect(meta.props.children.defaultValue).toHaveLength(2);
  expect(meta.props.children.hidden({ items: [{ key: "native" }] })).toBe(true);
  const children = <AntdCollapsePanel key="rich" header={<strong>Rich header</strong>}><button>Embedded action</button></AntdCollapsePanel>;
  const view = render(<AntdCollapse defaultActiveKey="rich">{children}</AntdCollapse>);
  expect(screen.getByRole("button", { name: "Embedded action" })).toBeTruthy();
  view.rerender(<AntdCollapse activeKey="native" items={[{ key: "native", label: "Native", children: <input aria-label="Native field" /> }]}>{children}</AntdCollapse>);
  expect(screen.queryByRole("button", { name: "Embedded action" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "Native field" })).toBeTruthy();
});

test("Tree callback metadata describes the real native info object", () => {
  const metas = metadata(registerTree);
  for (const [name, meta] of metadata(registerDirectoryTree)) metas.set(name, meta);
  for (const name of ["tree", "directory-tree"]) {
    expect(metas.get(`plasmic-antd6-${name}`).props.onSelect.argTypes[1]).toEqual({ name: "info", type: { type: "object" } });
  }
  const onSelect = vi.fn();
  render(<AntdTree treeData={[{ key: "leaf", title: "Leaf" }]} onSelect={onSelect} {...{} as any} />);
  fireEvent.click(screen.getByText("Leaf"));
  expect(onSelect).toHaveBeenCalledWith(["leaf"], expect.objectContaining({ selectedNodes: expect.any(Array), selected: true }));
});

for (const [name, Picker, register] of [
  ["date-picker", AntdDatePicker, registerDatePicker],
  ["date-range-picker", AntdDateRangePicker, registerDateRangePicker],
] as const) {
  test(`${name} exposes editing-only calendar preview and preserves runtime open`, async () => {
    const meta = metadata(register).get(`plasmic-antd6-${name}`);
    expect(meta.props.previewOpen.editOnly).toBe(true);
    expect(meta.props.previewOpen.uncontrolledProp).toBeUndefined();
    expect(meta.canvasOverlay).toEqual({});
    const onChange = vi.fn(), onCalendarChange = vi.fn();
    const props = { open: false, onChange, onCalendarChange, __plasmic_selection_prop__: { isSelected: true } };
    const view = render(<Canvas><Picker {...props as any} /></Canvas>);
    await waitFor(() => expect(document.querySelector(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)")).toBeTruthy());
    fireEvent.click(document.querySelector(".ant-picker-cell-in-view .ant-picker-cell-inner")!);
    expect(onChange).not.toHaveBeenCalled();
    expect(onCalendarChange).not.toHaveBeenCalled();
    expect(props.open).toBe(false);
    view.rerender(<Canvas interactive><Picker {...props as any} /></Canvas>);
    await waitFor(() => expect(document.querySelector(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)")).toBeNull());
    expect(screen.getAllByRole("textbox").every((input) => !(input as HTMLInputElement).value)).toBe(true);
  });
}
