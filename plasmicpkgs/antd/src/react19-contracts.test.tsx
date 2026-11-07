// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { expect, it, vi } from "vitest";
import { Dropdown, DropdownButton, dropdownMeta, dropdownButtonMeta } from "./registerDropdown";
import { Tabs, TabPane } from "./registerTabs";
import { Collapse, CollapsePanel } from "./registerCollapse";
import { Slider } from "./registerSlider";
import { Select } from "./registerSelect";
import { Option } from "./registerOption";
import { Menu } from "./registerMenu";

it.each([Dropdown, DropdownButton])("renders dropdown content through the native popupRender and open props: %s", async (Component) => {
  const action = vi.fn();
  render(<Component open popupRender={() => <Menu items={[{ key: "save", label: "Save item" }]} onClick={(event) => action(event.key)} />}><span>Actions</span></Component>);
  expect(screen.getByText("Actions")).toBeTruthy();
  fireEvent.click(await screen.findByText("Save item"));
  expect(action).toHaveBeenCalledExactlyOnceWith("save");
});

it.each([Dropdown, DropdownButton])("passes the native open-change event once with its source: %s", async (Component) => {
  const changed = vi.fn();
  const { container } = render(<Component trigger={["click"]} onOpenChange={changed} menu={{ items: [{ key: "save", label: "Save item" }] }}><span>Actions</span></Component>);
  const trigger = container.querySelector(".ant-dropdown-trigger");
  expect(trigger).not.toBeNull();
  fireEvent.click(trigger as Element);
  await waitFor(() => expect(changed).toHaveBeenCalledExactlyOnceWith(true, { source: "trigger" }));
});

it.each([dropdownMeta, dropdownButtonMeta])("registers the native dropdown prop names and render slot: $name", (meta) => {
  expect(meta.props).not.toHaveProperty("overlay");
  expect(meta.props).not.toHaveProperty("visible");
  expect(meta.props).not.toHaveProperty("onVisibleChange");
  expect(meta.props.popupRender).toMatchObject({ type: "slot", renderPropParams: ["menus"] });
  expect(meta.props.open).toMatchObject({ type: "boolean", editOnly: true });
  expect(meta.props.onOpenChange).toMatchObject({ type: "eventHandler", argTypes: [{ name: "open", type: "boolean" }, { name: "info", type: "object" }] });
  expect(meta.props.trigger).toMatchObject({ type: "choice", multiSelect: true });
});

it("keeps TabPane keys, content and change arguments", async () => {
  const changed = vi.fn();
  render(<Tabs defaultActiveKey="first" onChange={changed}><TabPane key="first" tab="First">First content</TabPane><TabPane key="saved-second" tab="Second">Second content</TabPane></Tabs>);
  expect(screen.getByText("First content")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  expect(await screen.findByText("Second content")).toBeTruthy();
  expect(changed).toHaveBeenCalledExactlyOnceWith("saved-second");
});

it("keeps CollapsePanel keys and expanded-state arguments", async () => {
  const changed = vi.fn();
  render(<Collapse defaultActiveKey={["first"]} onChange={changed}><CollapsePanel key="first" header="First panel">First content</CollapsePanel><CollapsePanel key="saved-second" header="Second panel">Second content</CollapsePanel></Collapse>);
  fireEvent.click(screen.getByText("Second panel"));
  expect(await screen.findByText("Second content")).toBeTruthy();
  expect(changed).toHaveBeenCalledExactlyOnceWith(["first", "saved-second"]);
});

it("keeps both range values, separate callbacks and the native focus ref", async () => {
  const first = vi.fn(), second = vi.fn();
  const ref = React.createRef<React.ComponentRef<typeof Slider>>();
  render(<Slider ref={ref} range value={10} value2={20} onChange={first} onChange2={second} />);
  const handles = screen.getAllByRole("slider");
  expect(handles.map((handle) => handle.getAttribute("aria-valuenow"))).toEqual(["10", "20"]);
  ref.current?.focus();
  expect(document.activeElement).toBe(handles[0]);
  fireEvent.keyDown(handles[0], { key: "ArrowRight", code: "ArrowRight", keyCode: 39 });
  await waitFor(() => expect(first).toHaveBeenCalledWith(11));
  expect(second).toHaveBeenCalledWith(20);
});

it("keeps registered Select.Option values and selection callbacks", async () => {
  const changed = vi.fn();
  render(<Select defaultValue="first" onChange={changed}><Option value="first">First choice</Option><Option value="saved-second">Second choice</Option></Select>);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByText("Second choice"));
  expect(changed).toHaveBeenCalledWith("saved-second", expect.objectContaining({ value: "saved-second" }));
});
