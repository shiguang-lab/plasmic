import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdColumn, AntdColumnGroup, AntdTable, registerTable } from "../src/registerTable";
import type { AntdColumnProps } from "../src/registerTable";
import type { Registerable } from "../src/utils";

const data = { data: [{ id: "a", amount: 20 }, { id: "b", amount: 3 }, { id: "c", amount: 10 }] };
const compare = (a: { amount: number }, b: { amount: number }) => a.amount - b.amount;
const amounts = () => screen.getAllByRole("cell").map((cell) => cell.textContent);

function table(column: AntdColumnProps, interactive = true, onChange = vi.fn()) {
  return (
    <PlasmicCanvasContext.Provider value={{ componentName: "Sorting test", globalVariants: {}, interactive }}>
      <AntdTable data={data} rowKey="id" pagination={false} onChange={onChange}>
        <AntdColumnGroup title="Metrics">
          <AntdColumn title="Amount" dataIndex="amount" {...column} />
        </AntdColumnGroup>
      </AntdTable>
    </PlasmicCanvasContext.Provider>
  );
}

test("registered sorting props drive header sorting and report native change arguments", () => {
  const metas = new Map<string, any>();
  registerTable({ registerComponent: (_component, meta) => metas.set(meta.name, meta) } as Registerable);
  const props = metas.get("plasmic-antd6-table-column").props;
  expect(props.sorter.type).toBe("exprEditor");
  expect(props.sortOrder.options.map((option: any) => option.value)).toEqual(["ascend", "descend"]);
  expect(props.defaultSortOrder.options).toEqual(props.sortOrder.options);
  expect(props.sortDirections.type).toBe("exprEditor");
  expect(metas.get("plasmic-antd6-table").props.onChange.argTypes.map((arg: any) => arg.name)).toEqual(["pagination", "filters", "sorter", "extra"]);

  const onChange = vi.fn();
  render(table({ sorter: compare }, true, onChange));
  expect(amounts()).toEqual(["20", "3", "10"]);
  const header = screen.getByRole("columnheader", { name: /Amount/ });
  fireEvent.click(header);
  expect(amounts()).toEqual(["3", "10", "20"]);
  expect(onChange.mock.lastCall?.[2]).toMatchObject({ field: "amount", order: "ascend" });
  expect(onChange.mock.lastCall?.[3]).toMatchObject({ action: "sort", currentDataSource: [data.data[1], data.data[2], data.data[0]] });
  fireEvent.click(header);
  expect(amounts()).toEqual(["20", "10", "3"]);
  fireEvent.click(header);
  expect(amounts()).toEqual(["20", "3", "10"]);
  expect(onChange.mock.lastCall?.[2].order).toBeUndefined();
});

test("default sorting edits update the canvas without mutating props or firing change", () => {
  const onChange = vi.fn();
  const column = Object.freeze({ sorter: compare, defaultSortOrder: "ascend" as const });
  const { rerender } = render(table(column, false, onChange));
  expect(amounts()).toEqual(["3", "10", "20"]);
  rerender(table({ ...column, defaultSortOrder: "descend" }, false, onChange));
  expect(amounts()).toEqual(["20", "10", "3"]);
  fireEvent.click(screen.getByRole("columnheader", { name: /Amount/ }));
  expect(amounts()).toEqual(["20", "10", "3"]);
  rerender(table({ sorter: compare }, false, onChange));
  expect(amounts()).toEqual(["20", "3", "10"]);
  expect(onChange).not.toHaveBeenCalled();
  expect(column).not.toHaveProperty("sortOrder");
});

test("runtime default sorting remains uncontrolled and respects the direction cycle", () => {
  const { rerender } = render(table({ sorter: compare, defaultSortOrder: "descend", sortDirections: ["descend", "ascend", "descend"] }));
  expect(amounts()).toEqual(["20", "10", "3"]);
  fireEvent.click(screen.getByRole("columnheader", { name: /Amount/ }));
  expect(amounts()).toEqual(["3", "10", "20"]);
  rerender(table({ sorter: compare, defaultSortOrder: "descend", sortDirections: ["descend", "ascend", "descend"] }));
  expect(amounts()).toEqual(["3", "10", "20"]);
  fireEvent.click(screen.getByRole("columnheader", { name: /Amount/ }));
  expect(amounts()).toEqual(["20", "10", "3"]);
});

test("server sorting emits requests without locally reordering rows", () => {
  const onChange = vi.fn();
  render(table({ sorter: true }, true, onChange));
  fireEvent.click(screen.getByRole("columnheader", { name: /Amount/ }));
  expect(amounts()).toEqual(["20", "3", "10"]);
  expect(onChange.mock.lastCall?.[2]).toMatchObject({ field: "amount", order: "ascend" });
});

test.each([false, true])("controlled sort order takes precedence, including explicit null (interactive=%s)", (interactive) => {
  const onChange = vi.fn();
  const { rerender } = render(table({ sorter: compare, defaultSortOrder: "descend", sortOrder: null }, interactive, onChange));
  expect(amounts()).toEqual(["20", "3", "10"]);
  if (interactive) {
    fireEvent.click(screen.getByRole("columnheader", { name: /Amount/ }));
    expect(onChange.mock.lastCall?.[2].order).toBe("ascend");
    expect(amounts()).toEqual(["20", "3", "10"]);
  }
  rerender(table({ sorter: compare, defaultSortOrder: "descend", sortOrder: "ascend" }, interactive, onChange));
  expect(amounts()).toEqual(["3", "10", "20"]);
});
