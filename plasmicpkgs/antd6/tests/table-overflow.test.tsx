import { fireEvent, render, waitFor } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { expect, test } from "vitest";
import { AntdColumn, AntdTable } from "../src/registerTable";
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

test("Column ellipsis uses native Ant Design truncation and the native title", () => {
  const { container } = render(
    <AntdTable
      data={{
        data: [
          { id: 1, key: long },
          { id: 2, key: 0 },
          { id: 3, key: null },
        ],
      }}
      rowKey="id"
      pagination={false}
    >
      <AntdColumn title="Key" dataIndex="key" ellipsis width={112} />
    </AntdTable>,
  );
  const cells = [...container.querySelectorAll("tr.ant-table-row td")];
  expect(cells.map((cell) => cell.textContent)).toEqual([long, "0", ""]);
  expect(cells.every((cell) => cell.classList.contains("ant-table-cell-ellipsis"))).toBe(true);
  expect(cells[0].getAttribute("title")).toBe(long);
  expect(container.querySelector(".ant-tooltip-open, [data-plasmic-overflow-tooltip]")).toBeNull();
});

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
          ellipsis
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
});

test("Tooltip registration exposes only native Tooltip behavior", () => {
  const registrations: any[] = [];
  registerTooltip({
    registerComponent: (_component, meta) => registrations.push(meta),
  } as Registerable);
  expect(registrations[0].props.onlyWhenOverflow).toBeUndefined();
});
