import { PlasmicCanvasContext } from "@plasmicapp/host";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AntdColumn, AntdTable } from "../src/registerTable";
import { AntdTooltip, registerTooltip } from "../src/registerTooltip";
import { columnTemplateHtml } from "../src/table-column-template";
import type { Registerable } from "../src/utils";

let width: number;
let resize: (() => void)[];
let measurements: ReturnType<typeof vi.spyOn>[];
let originalResizeObserver: typeof ResizeObserver;
beforeEach(() => {
  width = 80;
  resize = [];
  measurements = [
    vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute("data-plasmic-overflow-tooltip") ? width : 0;
      }),
    vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return (this.textContent?.length ?? 0) * 8;
      }),
  ];
  originalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resize.push(() => callback([], this));
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  measurements.forEach((spy) => spy.mockRestore());
  window.ResizeObserver = originalResizeObserver;
});
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

test("ellipsis shows a real Tooltip only for overflowing cells, preserves full values and focus access", async () => {
  const { container } = render(
    <Motionless>
      <AntdTable
        data={{
          data: [
            { id: 1, key: long },
            { id: 2, key: "Short" },
            { id: 3, key: 0 },
            { id: 4, key: false },
            { id: 5, key: null },
          ],
        }}
        rowKey="id"
        pagination={false}
      >
        <AntdColumn title="Key" dataIndex="key" ellipsis width={112} />
      </AntdTable>
    </Motionless>,
  );
  const cells = [...container.querySelectorAll("tr.ant-table-row td")];
  expect(cells.map((cell) => cell.textContent)).toEqual([
    long,
    "Short",
    "0",
    "false",
    "",
  ]);
  expect(cells.every((cell) => !cell.hasAttribute("title"))).toBe(true);
  const triggers = cells.map((cell) =>
    cell.querySelector<HTMLElement>("[data-plasmic-overflow-tooltip]")!,
  );
  expect(triggers.map((trigger) => trigger.tabIndex)).toEqual([
    0, -1, -1, -1, -1,
  ]);
  fireEvent.mouseEnter(triggers[1]);
  await new Promise((resolve) => setTimeout(resolve, 160));
  expect(visibleTooltip()).toBeNull();
  fireEvent.mouseLeave(triggers[1]);
  fireEvent.focus(triggers[0]);
  await waitFor(() => expect(visibleTooltip()?.textContent).toBe(long));
});

test("resize and live content changes remeasure the overflow condition", async () => {
  const view = render(
    <Motionless>
      <AntdTooltip onlyWhenOverflow destroyOnHidden>
        {long}
      </AntdTooltip>
    </Motionless>,
  );
  const trigger = view.container.querySelector<HTMLElement>(
    "[data-plasmic-overflow-tooltip]",
  )!;
  fireEvent.mouseEnter(trigger);
  await waitFor(() => expect(visibleTooltip()?.textContent).toBe(long));
  width = 500;
  act(() => resize.forEach((measure) => measure()));
  await waitFor(() => expect(visibleTooltip()).toBeNull());
  width = 80;
  view.rerender(
    <Motionless>
      <AntdTooltip onlyWhenOverflow destroyOnHidden>
        Updated full long content
      </AntdTooltip>
    </Motionless>,
  );
  fireEvent.mouseLeave(trigger);
  fireEvent.mouseEnter(trigger);
  await waitFor(() =>
    expect(visibleTooltip()?.textContent).toBe("Updated full long content"),
  );
});

test("custom templates show complete rendered labels and keep native spans and actions", async () => {
  const action = vi.fn();
  const { container } = render(
    <Motionless>
      <AntdTable
        data={{ data: [{ id: 1, key: "raw" }] }}
        rowKey="id"
        pagination={false}
      >
        <AntdColumn
          title="Key"
          dataIndex="key"
          displayType="custom"
          ellipsis
          onCellClick={action}
          render={() => ({
            children: <a href="#detail">A complete human readable label</a>,
            props: { rowSpan: 2 },
          })}
        />
      </AntdTable>
    </Motionless>,
  );
  const cell = container.querySelector("tr.ant-table-row td")!;
  expect(cell.getAttribute("rowspan")).toBe("2");
  fireEvent.mouseEnter(cell.querySelector("[data-plasmic-overflow-tooltip]")!);
  await waitFor(() =>
    expect(visibleTooltip()?.textContent).toBe(
      "A complete human readable label",
    ),
  );
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link"));
  expect(action).toHaveBeenCalledExactlyOnceWith(
    "raw",
    { id: 1, key: "raw" },
    0,
  );
});

test("an editable Tooltip template owns its popup without a duplicate outer Tooltip", async () => {
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
          displayType="custom"
          render={(cell, row) => (
            <AntdTooltip
              onlyWhenOverflow
              title={
                <strong>
                  {row.id}: {cell}
                </strong>
              }
            >
              {cell}
            </AntdTooltip>
          )}
        />
      </AntdTable>
    </Motionless>,
  );
  const triggers = container.querySelectorAll(
    "tr.ant-table-row td [data-plasmic-overflow-tooltip]",
  );
  expect(triggers[0].getAttribute("tabindex")).toBeNull();
  expect(triggers[1].getAttribute("tabindex")).toBe("0");
  fireEvent.mouseEnter(triggers[1]);
  await waitFor(() => expect(visibleTooltip()?.textContent).toBe(`1: ${long}`));
  expect(
    document.querySelectorAll(".ant-tooltip:not(.ant-tooltip-hidden)"),
  ).toHaveLength(1);
});

test("short Tooltip templates reveal for selection only in the editing canvas", async () => {
  const props = {
    onlyWhenOverflow: true,
    title: <strong>Editable full content</strong>,
    __plasmic_selection_prop__: { isSelected: true, selectedSlotName: "title" },
  };
  const canvas = (interactive: boolean, selected = true) => (
    <Motionless>
      <PlasmicCanvasContext.Provider
        value={{ componentName: "Test", globalVariants: {}, interactive }}
      >
        <AntdTooltip
          {...props}
          __plasmic_selection_prop__={{
            ...props.__plasmic_selection_prop__,
            isSelected: selected,
          }}
        >
          Short
        </AntdTooltip>
      </PlasmicCanvasContext.Provider>
    </Motionless>
  );
  const view = render(canvas(false));
  await waitFor(() =>
    expect(visibleTooltip()?.textContent).toBe("Editable full content"),
  );
  view.rerender(canvas(true));
  await waitFor(() => expect(visibleTooltip()).toBeNull());
  view.rerender(canvas(false, false));
  expect(visibleTooltip()).toBeNull();
});

test.each(["", null])(
  "explicit empty Tooltip content disables the fallback (%s)",
  async (title) => {
    const { container } = render(
      <Motionless>
        <AntdTooltip onlyWhenOverflow title={title}>
          {long}
        </AntdTooltip>
      </Motionless>,
    );
    fireEvent.mouseEnter(
      container.querySelector("[data-plasmic-overflow-tooltip]")!,
    );
    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(visibleTooltip()).toBeNull();
  },
);

test("ellipsis conversion exposes actual Tooltip title and children slots with current-row bindings", () => {
  const root = document.createElement("div");
  root.innerHTML = columnTemplateHtml({ dataIndex: "key", ellipsis: true });
  const tooltip = root.querySelector("plasmic-component")!;
  expect(tooltip.getAttribute("data-plasmic-component")).toBe(
    "plasmic-antd6-tooltip",
  );
  expect(JSON.parse(tooltip.getAttribute("data-props")!)).toEqual({
    onlyWhenOverflow: true,
  });
  expect(tooltip.querySelector('slot[name="children"]')?.textContent).toBe(
    "{{ column.text }}",
  );
  expect(tooltip.querySelector('slot[name="title"]')?.textContent).toBe(
    "{{ column.text }}",
  );
  const registrations: any[] = [];
  registerTooltip({
    registerComponent: (_component, meta) => registrations.push(meta),
  } as Registerable);
  expect(registrations[0].props.onlyWhenOverflow.type).toBe("boolean");
  expect(registrations[0].props.onlyWhenOverflow.editOnly).toBeUndefined();
});
