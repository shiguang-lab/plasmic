import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { FilterDropdownProps } from "antd/es/table/interface";
import { ConfigProvider } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdColumn, AntdColumnGroup, AntdTable, registerTable } from "../src/registerTable";
import type { AntdColumnProps } from "../src/registerTable";
import type { Registerable } from "../src/utils";

const data = { data: [
  { id: "a", name: "Alice", status: "pending", active: true, amount: 20 },
  { id: "b", name: "Bob", status: "done", active: false, amount: 3 },
  { id: "c", name: "Chris", status: "pending", active: false, amount: 10 },
  { id: "d", name: "Dana", status: "cancelled", active: true, amount: 7 },
] };
const filters = [
  { text: "Pending", value: "pending" },
  { text: "Done", value: "done" },
  { text: "Cancelled", value: "cancelled" },
];
const onFilter: NonNullable<AntdColumnProps["onFilter"]> = (value, row) => row.status === value;
const ids = () => Array.from(document.querySelectorAll("tbody tr[data-row-key]"), row => row.getAttribute("data-row-key"));
const trigger = (title = "Status") => within(screen.getByRole("columnheader", { name: new RegExp(title) })).getByRole("button");
const popup = () => Array.from(document.querySelectorAll<HTMLElement>(".ant-dropdown"))
  .find(element => !element.classList.contains("ant-dropdown-hidden") && element.style.display !== "none")
  ?.querySelector<HTMLElement>(".ant-table-filter-dropdown") ?? null;
async function open(title = "Status") {
  fireEvent.click(trigger(title));
  await waitFor(() => expect(popup()).toBeTruthy());
  return within(popup()!);
}
async function confirm() {
  fireEvent.click(within(popup()!).getByRole("button", { name: "OK" }));
  await waitFor(() => expect(popup()).toBeNull());
}
function table(column: AntdColumnProps = {}, options: {
  interactive?: boolean;
  onChange?: React.ComponentProps<typeof AntdTable>["onChange"];
  pagination?: React.ComponentProps<typeof AntdTable>["pagination"];
  extraColumn?: React.ReactNode;
} = {}) {
  return <PlasmicCanvasContext.Provider value={{ componentName: "Filtering test", globalVariants: {}, interactive: options.interactive ?? true }}>
    <ConfigProvider theme={{ token: { motion: false } }}>
    <AntdTable data={data} rowKey="id" pagination={options.pagination ?? false} onChange={options.onChange}>
      <AntdColumn title="Name" dataIndex="name" />
      <>
        <AntdColumnGroup title="Details">
          <AntdColumn title="Status" dataIndex="status" filters={filters} onFilter={onFilter} {...column} />
          {options.extraColumn}
        </AntdColumnGroup>
      </>
    </AntdTable>
    </ConfigProvider>
  </PlasmicCanvasContext.Provider>;
}

test("Studio registers native filtering props, typed options and render-slot arguments", () => {
  const metas = new Map<string, any>();
  registerTable({ registerComponent: (_component, meta) => metas.set(meta.name, meta) } as Registerable);
  const props = metas.get("plasmic-antd6-table-column").props;
  expect(props.key.type).toBe("string");
  expect(props.filters.type).toBe("array");
  expect(props.filters.itemType.fields.value.type).toBe("exprEditor");
  expect(props.filters.itemType.fields.children.type).toBe("exprEditor");
  for (const name of ["onFilter", "filterSearch", "defaultFilteredValue", "filteredValue", "filterDropdownProps"]) {
    expect(props[name].type).toBe("exprEditor");
  }
  expect(props.filterMode.options.map((option: any) => option.value)).toEqual(["menu", "tree"]);
  for (const [name, hint] of Object.entries({ filterMultiple: true, filterOnClose: true, filterResetToDefaultFilteredValue: false, filtered: false })) {
    expect(props[name]).toMatchObject({ type: "boolean", defaultValueHint: hint });
    expect(props[name]).not.toHaveProperty("defaultValue");
  }
  expect(props.filterDropdown).toMatchObject({ type: "slot", renderPropParams: ["filterProps"], hidePlaceholder: true });
  expect(props.filterIcon).toMatchObject({ type: "slot", renderPropParams: ["filtered"], hidePlaceholder: true });
  expect(metas.get("plasmic-antd6-table").props.onChange.argTypes.map((arg: any) => arg.name)).toEqual(["pagination", "filters", "sorter", "extra"]);
});

test("native multi-select filters grouped leaves, preserves field keys, and resets", async () => {
  const onChange = vi.fn();
  render(table({}, { onChange }));
  const menu = await open();
  fireEvent.click(menu.getByText("Pending"));
  fireEvent.click(menu.getByText("Done"));
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  await confirm();
  expect(ids()).toEqual(["a", "b", "c"]);
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: ["pending", "done"] });
  expect(onChange.mock.lastCall?.[3]).toMatchObject({ action: "filter", currentDataSource: data.data.slice(0, 3) });
  expect(trigger().classList.contains("active")).toBe(true);
  fireEvent.click((await open()).getByRole("button", { name: "Reset" }));
  await confirm();
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: null });
  expect(trigger().classList.contains("active")).toBe(false);
});

test("single selection replaces the previous selection", async () => {
  const onChange = vi.fn();
  render(table({ filterMultiple: false }, { onChange }));
  const menu = await open();
  fireEvent.click(menu.getByText("Pending"));
  fireEvent.click(menu.getByText("Done"));
  await confirm();
  expect(ids()).toEqual(["b"]);
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: ["done"] });
});

test.each([true, false])("closing the menu applies pending selection only with filterOnClose=%s", async (filterOnClose) => {
  const onChange = vi.fn();
  render(table({ filterOnClose }, { onChange }));
  fireEvent.click((await open()).getByText("Pending"));
  fireEvent.mouseDown(document.body);
  await waitFor(() => expect(popup()).toBeNull());
  expect(ids()).toEqual(filterOnClose ? ["a", "c"] : ["a", "b", "c", "d"]);
  expect(onChange).toHaveBeenCalledTimes(filterOnClose ? 1 : 0);
  if (!filterOnClose) {
    const menu = await open();
    expect(menu.getAllByRole("checkbox").every(input => !(input as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(menu.getByText("Pending"));
    await confirm();
    expect(ids()).toEqual(["a", "c"]);
  }
});

test.each([true, false])("reset respects filterResetToDefaultFilteredValue=%s", async (restoreDefault) => {
  render(table({ defaultFilteredValue: ["pending"], filterResetToDefaultFilteredValue: restoreDefault }));
  expect(ids()).toEqual(["a", "c"]);
  const menu = await open();
  fireEvent.click(menu.getByText("Pending"));
  fireEvent.click(menu.getByText("Done"));
  await confirm();
  expect(ids()).toEqual(["b"]);
  fireEvent.click((await open()).getByRole("button", { name: "Reset" }));
  await confirm();
  expect(ids()).toEqual(restoreDefault ? ["a", "c"] : ["a", "b", "c", "d"]);
});

test.each([{ cleared: null }, { cleared: [] }])("controlled values override defaults, emit requests, and accept a parent update (cleared=$cleared)", async ({ cleared }) => {
  const onChange = vi.fn();
  const { rerender } = render(table({ filteredValue: cleared, defaultFilteredValue: ["pending"] }, { onChange }));
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  fireEvent.click((await open()).getByText("Done"));
  await confirm();
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: ["done"] });
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  rerender(table({ filteredValue: ["done"], defaultFilteredValue: ["pending"] }, { onChange }));
  expect(ids()).toEqual(["b"]);
  rerender(table({ filteredValue: cleared, defaultFilteredValue: ["pending"] }, { onChange }));
  expect(ids()).toEqual(["a", "b", "c", "d"]);
});

test("canvas reflects default edits without mutation or callbacks; controlled values take precedence", () => {
  const onChange = vi.fn();
  const column = Object.freeze({ defaultFilteredValue: ["pending"] });
  const { rerender } = render(table(column, { interactive: false, onChange }));
  expect(ids()).toEqual(["a", "c"]);
  rerender(table({ defaultFilteredValue: ["done"] }, { interactive: false, onChange }));
  expect(ids()).toEqual(["b"]);
  rerender(table({ defaultFilteredValue: ["pending"], filteredValue: null }, { interactive: false, onChange }));
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  rerender(table({}, { interactive: false, onChange }));
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  expect(onChange).not.toHaveBeenCalled();
  expect(column).not.toHaveProperty("filteredValue");
});

test("runtime defaults initialize once and stay uncontrolled across rerenders", async () => {
  const { rerender } = render(table({ defaultFilteredValue: ["pending"] }));
  const menu = await open();
  fireEvent.click(menu.getByText("Pending"));
  fireEvent.click(menu.getByText("Done"));
  await confirm();
  rerender(table({ defaultFilteredValue: ["cancelled"] }));
  expect(ids()).toEqual(["b"]);
});

test.each([true, (input: string, item: { value: React.Key | boolean }) => String(item.value).startsWith(input)])("menu search limits options without filtering rows (%s)", async (filterSearch) => {
  render(table({ filterSearch }));
  const menu = await open();
  fireEvent.change(menu.getByRole("textbox"), { target: { value: "pend" } });
  expect(menu.queryByText("Done")).toBeNull();
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  fireEvent.click(menu.getByText("Pending"));
  await confirm();
  expect(ids()).toEqual(["a", "c"]);
});

test("nested tree search highlights options and parent selection includes descendants", async () => {
  const onChange = vi.fn();
  const filterSearch = vi.fn((input: string, item: { value: React.Key | boolean }) => String(item.value).startsWith(input));
  render(table({ filterMode: "tree", filterSearch, filters: [
    { text: "Open", value: "open", children: [filters[0]] },
    { text: "Closed", value: "closed", children: filters.slice(1) },
  ] }, { onChange }));
  const menu = await open();
  fireEvent.change(menu.getByRole("textbox"), { target: { value: "pend" } });
  expect(filterSearch).toHaveBeenCalledWith("pend", expect.objectContaining({ text: "Pending", value: "pending" }));
  const node = menu.getByText("Pending").closest(".ant-tree-treenode")!;
  expect(node.classList.contains("filter-node")).toBe(true);
  const closed = menu.getByText("Closed").closest(".ant-tree-treenode")!;
  fireEvent.click(closed.querySelector(".ant-tree-checkbox")!);
  await confirm();
  expect(ids()).toEqual(["b", "d"]);
  expect(onChange.mock.lastCall?.[1].status).toEqual(expect.arrayContaining(["done", "cancelled"]));
});

test("native submenus retain nested option values", async () => {
  render(table({ filters: [{ text: "Workflow", value: "workflow", children: filters }] }));
  const menu = await open();
  fireEvent.mouseEnter(menu.getByText("Workflow"));
  fireEvent.click(await screen.findByText("Pending"));
  await confirm();
  expect(ids()).toEqual(["a", "c"]);
});

test("multiple columns intersect typed values, preserve explicit keys, sort, and reset pagination", async () => {
  const onChange = vi.fn();
  render(table({ defaultFilteredValue: ["pending"], sorter: (a, b) => a.amount - b.amount, defaultSortOrder: "ascend" }, {
    onChange,
    pagination: { defaultPageSize: 1, defaultCurrent: 2, showSizeChanger: false },
    extraColumn: <AntdColumn key="activeFilter" title="Active" dataIndex="active" render={value => String(value)} filters={[{ text: "Yes", value: true }, { text: "No", value: false }]} onFilter={(value, row) => row.active === value} />,
  }));
  expect(ids()).toEqual(["a"]);
  fireEvent.click((await open("Active")).getByText("No"));
  await confirm();
  expect(ids()).toEqual(["c"]);
  expect(onChange.mock.lastCall?.[0]).toMatchObject({ current: 1, pageSize: 1 });
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: ["pending"], activeFilter: [false] });
  expect(onChange.mock.lastCall?.[3]).toMatchObject({ action: "filter", currentDataSource: [data.data[2]] });
});

test("numeric values and nested dataIndex use native types and field-path keys", async () => {
  const onChange = vi.fn();
  const predicate = vi.fn((value, row) => row.amount === value);
  render(table({ filters: [{ text: "Twenty", value: 20 }], dataIndex: ["amount"], onFilter: predicate }, { onChange }));
  fireEvent.click((await open()).getByText("Twenty"));
  await confirm();
  expect(ids()).toEqual(["a"]);
  expect(predicate).toHaveBeenCalledWith(20, expect.objectContaining({ id: "a" }));
  expect(onChange.mock.lastCall?.[1]).toEqual({ amount: [20] });
});

test("server filtering emits selected values without locally removing records", async () => {
  const onChange = vi.fn();
  render(table({ onFilter: undefined }, { onChange }));
  fireEvent.click((await open()).getByText("Done"));
  await confirm();
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: ["done"] });
  expect(onChange.mock.lastCall?.[3]).toMatchObject({ action: "filter", currentDataSource: data.data });
});

function CustomFilter({ selectedKeys, setSelectedKeys, confirm, clearFilters, close, visible, filters, prefixCls }: FilterDropdownProps) {
  return <div aria-label="Custom filter" data-visible={visible} data-prefix={prefixCls} data-options={filters?.length}>
    <input aria-label="Status query" value={String(selectedKeys[0] ?? "")} onChange={event => setSelectedKeys(event.target.value ? [event.target.value] : [])} />
    <button onClick={() => confirm({ closeDropdown: false })}>Apply</button>
    <button onClick={() => clearFilters?.({ confirm: true, closeDropdown: true })}>Clear and close</button>
    <button onClick={close}>Close only</button>
  </div>;
}

test("custom panel receives the native object and supports select, confirm, clear and close", async () => {
  const onChange = vi.fn();
  render(table({ filterDropdown: props => <CustomFilter {...props} />, filterIcon: filtered => <span>{filtered ? "Filtered status" : "Filter status"}</span> }, { onChange }));
  expect(screen.getByText("Filter status")).toBeTruthy();
  let menu = await open();
  expect(menu.getByLabelText("Custom filter").getAttribute("data-visible")).toBe("true");
  expect(menu.getByLabelText("Custom filter").getAttribute("data-options")).toBe("3");
  expect(menu.getByLabelText("Custom filter").getAttribute("data-prefix")).toBe("ant-dropdown-custom");
  fireEvent.change(menu.getByRole("textbox"), { target: { value: "pending" } });
  fireEvent.click(menu.getByRole("button", { name: "Apply" }));
  expect(ids()).toEqual(["a", "c"]);
  expect(popup()).toBeTruthy();
  expect(screen.getByText("Filtered status")).toBeTruthy();
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: ["pending"] });
  fireEvent.change(menu.getByRole("textbox"), { target: { value: "done" } });
  fireEvent.click(menu.getByRole("button", { name: "Close only" }));
  await waitFor(() => expect(popup()).toBeNull());
  expect(ids()).toEqual(["a", "c"]);
  expect(onChange).toHaveBeenCalledTimes(1);
  menu = await open();
  fireEvent.click(menu.getByRole("button", { name: "Clear and close" }));
  await waitFor(() => expect(popup()).toBeNull());
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  expect(onChange.mock.lastCall?.[1]).toEqual({ status: null });
});

test("Dropdown props support controlled visibility and native open-change callbacks", async () => {
  const onOpenChange = vi.fn();
  const { rerender } = render(table({ filterDropdownProps: { open: false, onOpenChange, placement: "bottomLeft" } }));
  fireEvent.click(trigger());
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));
  expect(popup()).toBeNull();
  rerender(table({ filterDropdownProps: { open: true, onOpenChange, placement: "bottomLeft" } }));
  await waitFor(() => expect(popup()).toBeTruthy());
  fireEvent.click(within(popup()!).getByText("Pending"));
  fireEvent.click(within(popup()!).getByRole("button", { name: "OK" }));
  expect(popup()).toBeTruthy();
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(ids()).toEqual(["a", "c"]);
  rerender(table({ filterDropdownProps: { open: false, onOpenChange } }));
  await waitFor(() => expect(popup()).toBeNull());
});

test("filtered forces only the native icon highlight, without filtering data", () => {
  render(table({ filtered: true }));
  expect(trigger().classList.contains("active")).toBe(true);
  expect(ids()).toEqual(["a", "b", "c", "d"]);
});

test("a filter with no matching records renders the native empty state", async () => {
  render(table({ filters: [{ text: "Archived", value: "archived" }] }));
  fireEvent.click((await open()).getByText("Archived"));
  await confirm();
  expect(ids()).toEqual([]);
  expect(screen.getByText("No data", { selector: ".ant-empty-description" })).toBeTruthy();
  fireEvent.click((await open()).getByRole("button", { name: "Reset" }));
  await confirm();
  expect(ids()).toEqual(["a", "b", "c", "d"]);
});

test("tree Check all selects all options and single tree selection replaces the previous value", async () => {
  const { rerender } = render(table({ filterMode: "tree" }));
  fireEvent.click((await open()).getByText("Select all items"));
  await confirm();
  expect(ids()).toEqual(["a", "b", "c", "d"]);
  expect(trigger().classList.contains("active")).toBe(true);
  rerender(table({ filterMode: "tree", filterMultiple: false }));
  const menu = await open();
  fireEvent.click(menu.getByText("Pending").closest(".ant-tree-treenode")!.querySelector(".ant-tree-checkbox")!);
  fireEvent.click(menu.getByText("Done").closest(".ant-tree-treenode")!.querySelector(".ant-tree-checkbox")!);
  await confirm();
  expect(ids()).toEqual(["b"]);
});
