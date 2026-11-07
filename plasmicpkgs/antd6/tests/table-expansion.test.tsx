import { fireEvent, render, screen } from "@testing-library/react";
import { Table } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdColumn, AntdExpandColumn, AntdTable, registerTable } from "../src/registerTable";
import type { Registerable } from "../src/utils";
import { createSessionCanvas } from "./canvas-session";
import { CanvasSessionState } from "../../../platform/wab/src/wab/client/components/canvas/canvas-session-state";

const Canvas = createSessionCanvas([registerTable]);

type Props = React.ComponentProps<typeof AntdTable>;
const data = { data: [{ id: "a", name: "Alpha", detail: "First detail" }, { id: "b", name: "Beta", detail: "Second detail" }, { id: "c", name: "Gamma" }] };
const detail: NonNullable<Props["expandedRowRender"]> = (row, index, indent, expanded) => <div data-testid={`detail-${row.id}`}>{row.detail}:{index}:{indent}:{String(expanded)}</div>;
const eligible = (row: any) => !!row.detail;
const visibleDetails = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>(".ant-table-expanded-row"))
  .filter((row) => row.style.display !== "none").map((row) => row.textContent);
function table(props: Partial<Props> = {}, mode: "runtime" | "canvas" | "interactive" = "runtime", session?: CanvasSessionState) {
  const element = <AntdTable key="table" data={data} rowKey="id" pagination={false} expandedRowRender={detail} {...props}>
    {props.children ?? <><AntdColumn title="Name" dataIndex="name" /><AntdExpandColumn /></>}
  </AntdTable>;
  return mode === "runtime" ? element : <Canvas session={session} interactive={mode === "interactive"}>{element}</Canvas>;
}

test("registration exposes the native expandable fields, typed events, editable row scope and position marker", () => {
  const metas = new Map<string, any>();
  registerTable({ registerComponent: (_component, meta) => metas.set(meta.name, meta) } as Registerable);
  const meta = metas.get("plasmic-antd6-table");
  expect(meta.props.expandedRowRender.renderPropParams).toEqual(["row", "index", "indent", "expanded"]);
  expect(meta.props.expandedRowRender.type).toBe("slot");
  const fields = meta.props.expandable.fields;
  for (const name of ["showExpandColumn", "expandRowByClick", "columnTitle", "columnWidth", "fixed", "rowExpandable", "defaultExpandAllRows", "defaultExpandedRowKeys", "expandedRowKeys"]) {expect(fields[name]).toBeDefined();}
  expect(meta.props.onExpand.argTypes).toEqual([{ name: "expanded", type: "boolean" }, { name: "row", type: "object" }]);
  expect(meta.props.onExpandedRowsChange.argTypes).toEqual([{ name: "expandedKeys", type: "object" }]);
  expect(meta.props.rowKey.hidden).toBeUndefined();
  expect(meta.props).not.toHaveProperty("canvasExpandedRowKeys");
  expect(meta.props.children.allowedComponents).toContain("plasmic-antd6-table-expand-column");
  expect(metas.get("plasmic-antd6-table-expand-column")).toMatchObject({ parentComponentName: "plasmic-antd6-table", importName: "AntdExpandColumn" });
  expect(metas.get("plasmic-antd6-table-column-group").props.children.allowedComponents).not.toContain("plasmic-antd6-table-expand-column");
});

test("native uncontrolled expansion renders each record scope and emits both events; eligibility disables individual rows", () => {
  const onExpand = vi.fn(), onExpandedRowsChange = vi.fn();
  const { container } = render(table({ onExpand, onExpandedRowsChange, expandable: { rowExpandable: eligible } }));
  expect(visibleDetails(container)).toEqual([]);
  const buttons = screen.getAllByRole("button", { name: "Expand row" });
  expect(buttons).toHaveLength(2);
  fireEvent.click(buttons[0]);
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  expect(onExpand).toHaveBeenLastCalledWith(true, data.data[0]);
  expect(onExpandedRowsChange).toHaveBeenLastCalledWith(["a"]);
  fireEvent.click(screen.getByRole("button", { name: "Expand row" }));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true", "Second detail:1:1:true"]);
  fireEvent.click(screen.getAllByRole("button", { name: "Collapse row" })[0]);
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
  expect(onExpand).toHaveBeenLastCalledWith(false, data.data[0]);
  expect(onExpandedRowsChange).toHaveBeenLastCalledWith(["b"]);
});

test("hidden explicit expansion column still permits row click expansion", () => {
  const { container, rerender } = render(table({ expandable: { showExpandColumn: false, expandRowByClick: true, rowExpandable: eligible } }));
  expect(screen.getAllByRole("columnheader")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Expand row" })).toBeNull();
  fireEvent.click(screen.getByText("Alpha"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  fireEvent.click(screen.getByText("Gamma"));
  expect(visibleDetails(container)).toHaveLength(1);
  rerender(table({ expandable: { showExpandColumn: true, columnTitle: "Details", columnWidth: 64, fixed: "right" } }));
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name", "Details"]);
  expect(screen.getByRole("columnheader", { name: "Details" }).className).toContain("fix");
  expect(Array.from(container.querySelectorAll("col")).map((col) => col.style.width)).toContain("64px");
});

test("marker position survives content editing and works with native selection and explicit columns", () => {
  const { rerender } = render(table({ isSelectable: "multiple", expandable: { columnTitle: "Details", fixed: "right" }, __canvas: { editing: true } }, "canvas"));
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["", "Name", "Details"]);
  expect(screen.getByRole("columnheader", { name: "Details" }).className).not.toContain("cell-fix");
  rerender(table({ columns: [Table.EXPAND_COLUMN, { title: "Name", dataIndex: "name" }], isSelectable: "multiple", expandable: { columnTitle: "Details" }, __canvas: { editing: true } }, "canvas"));
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Details", "", "Name"]);
});

test("controlled keys require an external update, including explicit empty keys", () => {
  const onExpandedRowsChange = vi.fn();
  const { container, rerender } = render(table({ expandable: { expandedRowKeys: [], defaultExpandAllRows: true, onExpandedRowsChange } }));
  expect(visibleDetails(container)).toEqual([]);
  fireEvent.click(screen.getAllByRole("button", { name: "Expand row" })[0]);
  expect(onExpandedRowsChange).toHaveBeenLastCalledWith(["a"]);
  expect(visibleDetails(container)).toEqual([]);
  rerender(table({ expandable: { expandedRowKeys: ["b"], onExpandedRowsChange } }));
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
  rerender(table({ expandable: { expandedRowKeys: [], onExpandedRowsChange } }));
  expect(visibleDetails(container)).toEqual([]);
});

test("uncontrolled defaults initialize once and allow user changes", () => {
  const { container, rerender } = render(table({ expandable: { defaultExpandedRowKeys: ["b"], defaultExpandAllRows: true } }));
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
  fireEvent.click(screen.getByRole("button", { name: "Collapse row" }));
  expect(visibleDetails(container)).toEqual([]);
  rerender(table({ expandable: { defaultExpandedRowKeys: ["a"] } }));
  expect(visibleDetails(container)).toEqual([]);
});

test.each([{ selected: true, slot: "expandedRowRender" }, { editing: true }])("canvas reveals editable row content without callbacks or changing saved state: %j", (selection) => {
  const onExpand = vi.fn(), onExpandedRowsChange = vi.fn();
  const expandable = Object.freeze({ expandedRowKeys: Object.freeze([]), rowExpandable: eligible, onExpand, onExpandedRowsChange });
  const { container, rerender } = render(table({ expandable, onExpand, onExpandedRowsChange, __canvas: selection }, "canvas"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true", "Second detail:1:1:true"]);
  fireEvent.click(screen.getAllByRole("button", { name: "Collapse row" })[0]);
  expect(visibleDetails(container)).toHaveLength(2);
  expect(onExpand).not.toHaveBeenCalled();
  expect(onExpandedRowsChange).not.toHaveBeenCalled();
  rerender(table({ expandable, onExpand, onExpandedRowsChange, __canvas: { selected: false } }, "canvas"));
  expect(visibleDetails(container)).toEqual([]);
  rerender(table({ expandable, onExpand, onExpandedRowsChange, __canvas: selection }, "interactive"));
  expect(visibleDetails(container)).toEqual([]);
  expect(expandable.expandedRowKeys).toEqual([]);
});

test("canvas default edits refresh immediately, ordinary selection does not reveal, and switching to Preview restores native defaults", () => {
  const { container, rerender } = render(table({ expandable: { defaultExpandedRowKeys: ["a"] } }, "canvas"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  rerender(table({ expandable: { defaultExpandedRowKeys: ["b"] } }, "canvas"));
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
  for (const slot of [undefined, "children", "title"]) {
    rerender(table({ __canvas: { selected: true, slot } }, "canvas"));
    expect(visibleDetails(container)).toEqual([]);
  }
  rerender(table({ expandable: { expandedRowKeys: ["a"] }, __canvas: { selected: true } }, "canvas"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  rerender(table({ expandable: { defaultExpandAllRows: true, rowExpandable: eligible } }, "canvas"));
  expect(visibleDetails(container)).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Collapse row" })[0]);
  rerender(table({ expandable: { defaultExpandedRowKeys: ["a"] } }, "interactive"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
});

test("native renderer passthrough and top-level slot precedence remain explicit", () => {
  const native = () => <div>Native detail</div>;
  const { container, rerender } = render(table({ expandedRowRender: undefined, expandable: { expandedRowRender: native, defaultExpandedRowKeys: ["a"] } }));
  expect(visibleDetails(container)).toEqual(["Native detail"]);
  rerender(table({ expandable: { expandedRowRender: native, expandedRowKeys: ["b"] } }));
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
});

test("editing row choices live only in the canvas session and are absent after reopening", () => {
  const session = new CanvasSessionState();
  const onExpand = vi.fn(), onExpandedRowsChange = vi.fn();
  const expandable = Object.freeze({ expandedRowKeys: Object.freeze([]), rowExpandable: eligible });
  const ps = Object.freeze({ expandable, onExpand, onExpandedRowsChange });
  const view = render(table(ps, "canvas", session));
  expect(document.querySelector("[__canvas]")).toBeNull();
  expect(visibleDetails(view.container)).toEqual([]);
  session.set("root/table", "expandable.expandedRowKeys", ["a", "b"], true);
  view.rerender(table(ps, "canvas", session));
  expect(visibleDetails(view.container)).toEqual(["First detail:0:1:true", "Second detail:1:1:true"]);
  view.rerender(table(ps, "interactive", session));
  expect(visibleDetails(view.container)).toEqual([]);
  view.rerender(table(ps, "canvas", session));
  expect(visibleDetails(view.container)).toHaveLength(2);
  expect(expandable.expandedRowKeys).toEqual([]);
  expect(ps).not.toHaveProperty("canvasExpandedRowKeys");
  expect(onExpand).not.toHaveBeenCalled();
  expect(onExpandedRowsChange).not.toHaveBeenCalled();
  view.unmount();
  const reopened = render(table(ps, "canvas", new CanvasSessionState()));
  expect(visibleDetails(reopened.container)).toEqual([]);
  reopened.unmount();
  expect(visibleDetails(render(table(ps)).container)).toEqual([]);
});

test("session row choices preserve key types without replacing native runtime defaults", () => {
  const session = new CanvasSessionState();
  const numeric = { data: data.data.map((row, index) => ({ ...row, id: index + 1 })) };
  const ps = { data: numeric, expandable: { defaultExpandedRowKeys: [2], rowExpandable: eligible } };
  const view = render(table(ps, "canvas", session));
  session.set("root/table", "expandable.expandedRowKeys", [1, "2", 3, "missing"], true);
  view.rerender(table(ps, "canvas", session));
  expect(visibleDetails(view.container)).toEqual(["First detail:0:1:true"]);
  session.set("root/table", "expandable.expandedRowKeys", [], true);
  view.rerender(table(ps, "canvas", session));
  expect(visibleDetails(view.container)).toEqual([]);
  view.rerender(table(ps));
  expect(visibleDetails(view.container)).toEqual(["Second detail:1:1:true"]);
});

test("native canvas expansion survives mode changes and resets on source edits or standalone Preview", () => {
  const onExpand = vi.fn(), onExpandedRowsChange = vi.fn();
  const expandable = Object.freeze({ expandedRowKeys: Object.freeze([]), rowExpandable: eligible });
  const ps = { expandable, onExpand, onExpandedRowsChange };
  const { container, rerender } = render(table(ps, "canvas"));
  // The shared canvas event policy admits the platform's modifier-click.
  // Table only receives the native event; it has no modifier-key special case.
  fireEvent.click(screen.getAllByRole("button", { name: "Expand row" })[0]);
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  rerender(table({ ...ps, __canvas: { selected: true } }, "canvas"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  fireEvent.click(screen.getByRole("button", { name: "Expand row" }));
  expect(visibleDetails(container)).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Collapse row" })[0]);
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
  rerender(table({ ...ps, __canvas: { selected: true, slot: "expandedRowRender" } }, "canvas"));
  expect(visibleDetails(container)).toHaveLength(2);
  rerender(table(ps, "canvas"));
  expect(visibleDetails(container)).toEqual(["Second detail:1:1:true"]);
  rerender(table({ ...ps, expandable: { expandedRowKeys: ["a"], rowExpandable: eligible } }, "canvas"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  rerender(table(ps, "canvas"));
  expect(visibleDetails(container)).toEqual([]);
  fireEvent.click(screen.getAllByRole("button", { name: "Expand row" })[0]);
  rerender(table(ps, "interactive"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  rerender(table(ps, "canvas"));
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  expect(expandable.expandedRowKeys).toEqual([]);
  expect(onExpand).not.toHaveBeenCalled();
  expect(onExpandedRowsChange).not.toHaveBeenCalled();
});

test("registered top-level events override native callbacks and can update controlled expansion", () => {
  const nested = vi.fn();
  const onExpand = vi.fn();
  function Controlled() {
    const [keys, setKeys] = React.useState<readonly React.Key[]>([]);
    return table({ onExpand, onExpandedRowsChange: setKeys, expandable: {
      expandedRowKeys: keys, onExpand: nested, onExpandedRowsChange: nested,
    } });
  }
  const { container } = render(<Controlled />);
  fireEvent.click(screen.getAllByRole("button", { name: "Expand row" })[0]);
  expect(visibleDetails(container)).toEqual(["First detail:0:1:true"]);
  expect(onExpand).toHaveBeenLastCalledWith(true, data.data[0]);
  expect(nested).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Collapse row" }));
  expect(visibleDetails(container)).toEqual([]);
});
