import { fireEvent, render, waitFor } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { expect, test } from "vitest";
import { AntdColumn, AntdTable, registerTable } from "../src/registerTable";
import { AntdTooltip, registerTooltip } from "../src/registerTooltip";
import type { Registerable } from "../src/utils";

const visibleTooltip = () =>
  document.querySelector(".ant-tooltip:not(.ant-tooltip-hidden)");
function Motionless({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      {children}
    </ConfigProvider>
  );
}
const long = "GRP_REGULAR_MX_CREDIT_20261003_1001";

test.each([true, false, { showTitle: true }, { showTitle: false }])(
  "registered Column ellipsis passes native configuration through: %j",
  (ellipsis) => {
    const registrations: any[] = [];
    registerTable({
      registerComponent: (_component, meta) => registrations.push(meta),
    } as Registerable);
    const column = registrations.find(
      (meta) => meta.name === "plasmic-antd6-table-column",
    );
    expect(column.props.ellipsis.type).toBe("exprEditor");

    const { container } = render(
      <AntdTable
        data={{ data: [{ id: 1, key: long }, { id: 2, key: 0 }, { id: 3, key: null }] }}
        rowKey="id"
        pagination={false}
      >
        <AntdColumn title="Key" dataIndex="key" width={112} ellipsis={ellipsis} />
      </AntdTable>,
    );
    const cells = [...container.querySelectorAll("tr.ant-table-row td")];
    expect(cells.map((cell) => cell.textContent)).toEqual([long, "0", ""]);
    expect(cells.every((cell) => cell.classList.contains("ant-table-cell-ellipsis"))).toBe(!!ellipsis);
    const showTitle = ellipsis === true || (typeof ellipsis === "object" && ellipsis.showTitle);
    expect(cells.map((cell) => cell.getAttribute("title"))).toEqual(
      showTitle ? [long, "0", null] : [null, null, null],
    );
    // showTitle controls the body cell title; native header titles remain available.
    expect(container.querySelector("th")?.getAttribute("title")).toBe(ellipsis ? "Key" : null);
    expect(container.querySelector(".ant-tooltip-open")).toBeNull();
  },
);

test("a Tooltip composed in Custom render owns the styled popup", async () => {
  const { container } = render(
    <Motionless>
      <AntdTable
        data={{ data: [{ id: 1, key: long }] }}
        rowKey="id"
        pagination={false}
      >
        <AntdColumn
          title="Key"
          dataIndex="key"
          ellipsis={{ showTitle: false }}
          render={(cell, row) => (
            <AntdTooltip title={<strong>{row.id}: {cell}</strong>}>
              <span>{cell}</span>
            </AntdTooltip>
          )}
        />
      </AntdTable>
    </Motionless>,
  );
  fireEvent.mouseEnter(container.querySelector("tr.ant-table-row td span")!);
  await waitFor(() => expect(visibleTooltip()?.textContent).toBe(`1: ${long}`));
  expect(
    document.querySelectorAll(".ant-tooltip:not(.ant-tooltip-hidden)"),
  ).toHaveLength(1);
  expect(container.querySelector("tr.ant-table-row td")?.hasAttribute("title")).toBe(false);
});

test("Tooltip registration exposes only native Tooltip behavior", () => {
  const registrations: any[] = [];
  registerTooltip({
    registerComponent: (_component, meta) => registrations.push(meta),
  } as Registerable);
  expect(registrations[0].props.onlyWhenOverflow).toBeUndefined();
});
