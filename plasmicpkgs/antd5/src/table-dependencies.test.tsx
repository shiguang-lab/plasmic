// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AntdTable, TableRef } from "./registerTable";

const current = vi.hoisted(() => ({ selection: undefined as any }));
vi.mock("antd", () => ({ Table: Object.assign((props: any) => {
  current.selection = props.rowSelection;
  return null;
}, { Column: () => null, ColumnGroup: () => null }) }));
afterEach(cleanup);

it("uses the current controlled mode for imperative row selection", () => {
  const ref = React.createRef<TableRef>();
  const data = { data: [{ id: "a" }, { id: "b" }] };
  const onSelectedRowKeysChange = vi.fn();
  const field = (selectedRowKeys?: string[]) => <AntdTable ref={ref} data={data} rowKey="id" isSelectable="multiple" selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange} />;
  const view = render(field([]));
  act(() => ref.current?.selectRowByKey("a"));
  expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(["a"]);
  expect(current.selection.selectedRowKeys).toEqual([]);
  view.rerender(field());
  act(() => ref.current?.selectRowByKey("b"));
  expect(current.selection.selectedRowKeys).toEqual(["b"]);
  view.rerender(field(["a"]));
  act(() => ref.current?.clearSelection());
  expect(current.selection.selectedRowKeys).toEqual(["a"]);
});
