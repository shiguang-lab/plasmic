import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { ConfigProvider } from "antd";
import { expect, test, vi } from "vitest";
import { AntdTabItem, AntdTabs, registerTabs } from "../src/registerTabs";
import { AntdCollapse, AntdCollapsePanel, registerCollapse } from "../src/registerCollapse";
import { AntdTree, registerTree, registerDirectoryTree } from "../src/registerTree";
import { AntdDatePicker, registerDatePicker } from "../src/registerDatePicker";
import { AntdDateRangePicker, registerDateRangePicker } from "../src/registerDateRangePicker";
import type { Registerable } from "../src/utils";
import { createSessionCanvas } from "./canvas-session";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({ registerComponent: (_component, meta) => metas.set(meta.name, meta) } as Registerable);
  return metas;
}
const Canvas = createSessionCanvas([registerTabs, registerCollapse, registerTree, registerDirectoryTree, registerDatePicker, registerDateRangePicker]);
const tabs = (selected: boolean) => <>
  <AntdTabItem key="first" label="First">First content</AntdTabItem>
  <AntdTabItem key="second" label="Second" {...{ __canvas: { selected: selected } }}>Second content</AntdTabItem>
</>;

test("Tabs exposes independent native controlled and initial keys", () => {
  const meta = metadata(registerTabs).get("plasmic-antd6-tabs");
  expect(meta.props.activeKey.editOnly).toBeUndefined();
  expect(meta.props.activeKey.uncontrolledProp).toBeUndefined();
  expect(meta.props.defaultActiveKey.type).toBe("choice");
  expect(meta.props.defaultActiveKey.options({ items: tabs(false) })).toEqual(["first", "second"]);
  expect(meta.states.activeKey).toMatchObject({ type: "writable", valueProp: "activeKey", onChangeProp: "onChange" });
});

test("controlled Tabs follows changed bindings and reports clicks without changing the value itself", () => {
  const onChange = vi.fn();
  const view = render(<Canvas interactive><AntdTabs {...{ activeKey: "first", defaultActiveKey: "second", items: tabs(false), onChange } as any} /></Canvas>);
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("First");
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  expect(onChange).toHaveBeenCalledWith("second");
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("First");
  view.rerender(<Canvas interactive><AntdTabs {...{ activeKey: "second", defaultActiveKey: "first", items: tabs(false), onChange } as any} /></Canvas>);
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Second");
});

test("uncontrolled Tabs uses the initial key once and keeps user switching", () => {
  const onChange = vi.fn();
  const view = render(<AntdTabs {...{ defaultActiveKey: "second", items: tabs(false), onChange } as any} />);
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Second");
  view.rerender(<AntdTabs {...{ defaultActiveKey: "first", items: tabs(false), onChange } as any} />);
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Second");
  fireEvent.click(screen.getByRole("tab", { name: "First" }));
  expect(onChange).toHaveBeenCalledWith("first");
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("First");
});

test("inactive tab selection reveals content in both canvas modes without business events", () => {
  const onChange = vi.fn();
  const props = { activeKey: "first", items: tabs(true), onChange };
  const view = render(<Canvas><AntdTabs {...props as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Second");
  expect(onChange).not.toHaveBeenCalled();
  expect(props.activeKey).toBe("first");
  view.rerender(<Canvas><AntdTabs {...props as any} items={tabs(false)} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(<Canvas interactive><AntdTabs {...props as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  view.rerender(<Canvas><AntdTabs {...props as any} items={tabs(false)} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
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
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "First" }));
  expect(onChange).toHaveBeenCalledWith("first");
  expect(onTabClick).toHaveBeenCalledTimes(1);
});

test("retained editing tab yields to configured key changes and removal", () => {
  const third = <AntdTabItem key="third" label="Third">Third content</AntdTabItem>;
  const view = render(<Canvas><AntdTabs {...{ defaultActiveKey: "first", items: <>{tabs(true)}{third}</> } as any} /></Canvas>);
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "first", items: <>{tabs(false)}{third}</> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "third", items: <>{tabs(false)}{third}</> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("Third content");
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Third");
  view.rerender(<Canvas><AntdTabs {...{ defaultActiveKey: "first", items: <>{tabs(false)}{third}</> } as any} /></Canvas>);
  expect(screen.getByRole("tabpanel").textContent).toBe("First content");
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("First");
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
  expect(update).toHaveBeenCalledWith({ defaultActiveKey: defaultActiveKey ? "first" : "second" });
});

test("deleting final tab clears the active key", () => {
  const meta = metadata(registerTabs).get("plasmic-antd6-tabs");
  const update = vi.fn();
  meta.actions.find((action: any) => action.label === "Delete current tab").onClick({
    componentProps: { items: <AntdTabItem key="last" label="Last" />, activeKey: "last" },
    studioOps: { removeFromSlotAt: vi.fn(), updateProps: update },
  });
  expect(update).toHaveBeenCalledWith({ defaultActiveKey: undefined });
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

test("Collapse registers every native semantic region, a color picker and a state-aware expand indicator", () => {
  const { props } = metadata(registerCollapse).get("plasmic-antd6-collapse");
  expect(props.styles.display).toBe("inline");
  expect(Object.keys(props.styles.fields)).toEqual(["root", "header", "title", "body", "icon"]);
  for (const field of Object.values(props.styles.fields)) {
    expect(field).toMatchObject({ type: "object" });
    expect(Object.keys((field as { fields: object }).fields).length).toBeGreaterThan(0);
  }
  expect(props.styles.fields.root.fields.maxWidth.type).toBe("number");
  expect(props.styles.fields.header.fields.paddingInline.type).toBe("number");
  expect(props.styles.fields.title.fields.fontWeight.type).toBe("number");
  expect(props.styles.fields.body.fields.backgroundColor.type).toBe("color");
  expect(props.styles.fields.icon.fields.color.type).toBe("color");
  expect(props.headerBackgroundColor.type).toBe("color");
  expect(props.expandIcon).toMatchObject({ type: "slot", renderPropParams: ["panelProps"] });
  expect(props.expandIconPlacement.options).toEqual(["start", "end"]);
  expect(props.expandText).toMatchObject({ type: "string" });
  expect(props.collapseText).toMatchObject({ type: "string" });
  expect(props.expandText.defaultValue).toBeUndefined();
  expect(props.collapseText.defaultValue).toBeUndefined();
});

test.each(["items", "panels"])("Collapse applies all semantic styles and restores the header color when the picker is cleared (%s)", (source) => {
  const styles = {
    root: { maxWidth: 400 },
    header: { backgroundColor: "pink", paddingInline: 20 },
    title: { fontWeight: 600 },
    body: { paddingBlock: 12 },
    icon: { color: "blue" },
  };
  const panels = source === "items"
    ? { items: [{ key: "details", label: "Details", children: "Content" }] }
    : { children: <AntdCollapsePanel key="details" header="Details">Content</AntdCollapsePanel> };
  const renderStyles = vi.fn(() => styles);
  const view = render(
    <AntdCollapse {...panels} defaultActiveKey="details" styles={renderStyles} headerBackgroundColor="white" />,
  );
  const header = screen.getByRole("button", { name: "Details" });
  expect(renderStyles).toHaveBeenCalledWith(expect.objectContaining({ props: expect.any(Object) }));
  expect(header.closest<HTMLElement>(".ant-collapse")?.style.maxWidth).toBe("400px");
  expect(header.style.backgroundColor).toBe("white");
  expect(header.style.paddingInline).toBe("20px");
  expect(screen.getByText("Details").style.fontWeight).toBe("600");
  expect(screen.getByText("Content").style.paddingBlock).toBe("12px");
  expect(header.querySelector<HTMLElement>(".ant-collapse-expand-icon")?.style.color).toBe("blue");

  view.rerender(<AntdCollapse {...panels} defaultActiveKey="details" styles={styles} />);
  expect(header.style.backgroundColor).toBe("pink");
  expect(header.style.paddingInline).toBe("20px");
});

test("Collapse styles the entire header and updates each text indicator through native toggles", () => {
  const onChange = vi.fn();
  const { container } = render(
    <AntdCollapse
      defaultActiveKey={["first"]}
      expandIconPlacement="end"
      expandText="展开"
      collapseText="收起"
      styles={{ header: { backgroundColor: "white" } }}
      onChange={onChange}
    >
      <AntdCollapsePanel key="first" header="First" extra="10:30">First details</AntdCollapsePanel>
      <AntdCollapsePanel key="second" header="Second">Second details</AntdCollapsePanel>
    </AntdCollapse>,
  );
  const first = screen.getByRole("button", { name: /First/ });
  const second = screen.getByRole("button", { name: /Second/ });
  expect(container.querySelector(".ant-collapse-icon-placement-end")).toBeTruthy();
  expect(first.style.backgroundColor).toBe("white");
  expect(second.style.backgroundColor).toBe("white");
  expect(within(first).getByText("收起")).toBeTruthy();
  expect(within(first).getByText("10:30")).toBeTruthy();
  expect(within(second).getByText("展开")).toBeTruthy();

  fireEvent.click(within(second).getByText("展开"));
  expect(first.getAttribute("aria-expanded")).toBe("true");
  expect(second.getAttribute("aria-expanded")).toBe("true");
  expect(onChange).toHaveBeenLastCalledWith(["first", "second"]);
  fireEvent.keyDown(first, { key: "Enter" });
  expect(first.getAttribute("aria-expanded")).toBe("false");
  expect(within(first).getByText("展开")).toBeTruthy();
  expect(first.style.backgroundColor).toBe("white");
  expect(within(second).getByText("收起")).toBeTruthy();
  expect(onChange).toHaveBeenLastCalledWith(["second"]);
  fireEvent.keyDown(first, { key: " " });
  expect(first.getAttribute("aria-expanded")).toBe("true");
  expect(onChange).toHaveBeenLastCalledWith(["second", "first"]);
});

test("Collapse native items retain the default arrow and allow a custom indicator to override text", () => {
  const items = [{ key: "panel", label: "Details", children: "Content" }];
  const view = render(<AntdCollapse items={items} />);
  expect(view.container.querySelector(".ant-collapse-expand-icon svg")).toBeTruthy();

  view.rerender(<AntdCollapse items={items} expandText="展开" />);
  fireEvent.click(screen.getByText("展开"));
  expect(screen.getByText("Collapse")).toBeTruthy();

  view.rerender(
    <AntdCollapse
      items={items}
      expandText="展开"
      collapseText="收起"
      expandIcon={({ isActive }) => <span>{isActive ? "Hide details" : "Show details"}</span>}
    />,
  );
  fireEvent.click(screen.getByText("Hide details"));
  expect(screen.getByText("Show details")).toBeTruthy();
});

test("Tree callback metadata describes the real native info object", () => {
  const metas = metadata(registerTree);
  for (const [name, meta] of metadata(registerDirectoryTree)) {metas.set(name, meta);}
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
  test(`${name} editing calendar selection does not emit business events`, async () => {
    const meta = metadata(register).get(`plasmic-antd6-${name}`);
    expect(meta.props).not.toHaveProperty("previewOpen");
    expect(meta.canvasOverlay).toEqual({});
    const onChange = vi.fn(), onCalendarChange = vi.fn();
    const props = { open: false, onChange, onCalendarChange, __canvas: { selected: true } };
    render(<Canvas><Picker {...props as any} /></Canvas>);
    await waitFor(() => expect(document.querySelector(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)")).toBeTruthy());
    fireEvent.click(document.querySelector(".ant-picker-cell-in-view .ant-picker-cell-inner")!);
    expect(onChange).not.toHaveBeenCalled();
    expect(onCalendarChange).not.toHaveBeenCalled();
    expect(props.open).toBe(false);
  });

  test(`${name} retains selected calendars during interaction while preserving configured values and input nodes`, async () => {
    const onChange = vi.fn(), onCalendarChange = vi.fn();
    const dates = name === "date-picker" ? { defaultValue: "2026-11-01" }
      : { defaultStartDate: "2026-11-01", defaultEndDate: "2026-11-05" };
    const props = { ...dates, open: false, onChange, onCalendarChange, __canvas: { selected: true } };
    const page = (interactive: boolean) => <Canvas interactive={interactive}>
      <ConfigProvider theme={{ token: { motion: false } }}><Picker {...props as any} /></ConfigProvider>
    </Canvas>;
    const view = render(page(false));
    await waitFor(() => expect(document.querySelector(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)")).toBeTruthy());
    const inputs = screen.getAllByRole("textbox");
    const draft = inputs.map((input) => (input as HTMLInputElement).value);
    view.rerender(page(true));
    await waitFor(() => expect(document.querySelector(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)")).toBeTruthy());
    expect(props.open).toBe(false);
    expect(screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value)).toEqual(draft);
    screen.getAllByRole("textbox").forEach((input, index) => expect(input).toBe(inputs[index]));
    expect(onChange).not.toHaveBeenCalled();
    expect(onCalendarChange).not.toHaveBeenCalled();
  });
}
