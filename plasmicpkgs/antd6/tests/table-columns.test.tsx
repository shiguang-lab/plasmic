import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdTag } from "../src/registerAdditional";
import {
  AntdColumn,
  AntdColumnGroup,
  AntdTable,
  registerTable,
} from "../src/registerTable";
import { asArray } from "../src/utils";
import type { Registerable } from "../src/utils";

const tagRender = (cell: unknown) => <AntdTag>{String(cell)}</AntdTag>;

const data = {
  data: [
    { id: "1", name: "Alice", status: "pending" },
    { id: "2", name: "Bob", status: "done" },
    { id: "3", name: "Chris", status: "pending" },
  ],
};

test("tables keep native scrolling: none unless scroll is set explicitly", () => {
  const { container, rerender } = render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn title="Name" dataIndex="name" width={400} />
      <AntdColumn title="Status" dataIndex="status" width={400} />
    </AntdTable>,
  );
  expect(
    container.querySelector<HTMLElement>(".ant-table-content")?.style.overflowX,
  ).toBe("");
  expect(container.querySelector<HTMLElement>("table")?.style.minWidth).toBe(
    "",
  );
  rerender(
    <AntdTable data={data} rowKey="id" pagination={false} scroll={{ x: 640 }}>
      <AntdColumn title="Name" dataIndex="name" width={400} />
      <AntdColumn title="Status" dataIndex="status" width={400} />
    </AntdTable>,
  );
  expect(container.querySelector<HTMLElement>("table")?.style.width).toBe(
    "640px",
  );
});

function Canvas({
  children,
  interactive = false,
}: {
  children: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <PlasmicCanvasContext.Provider
      value={{ componentName: "Table test", globalVariants: {}, interactive }}
    >
      {children}
    </PlasmicCanvasContext.Provider>
  );
}

// Studio walks the DOM's React Fiber ancestors to find the authored node.
function authoredKey(element: Element) {
  const key = Object.keys(element).find(
    (property) =>
      property.startsWith("__reactFiber$") ||
      property.startsWith("__reactInternalInstance$"),
  );
  let fiber = key ? (element as any)[key] : undefined;
  while (fiber) {
    if (fiber.memoizedProps?.["data-plasmic-valkey"]) {
      return fiber.memoizedProps["data-plasmic-valkey"];
    }
    fiber = fiber.return;
  }
  return undefined;
}

test("headers, cell contents and empty cell space resolve to the original column", () => {
  const status = React.createElement(AntdColumn, {
    title: "Status",
    dataIndex: "status",
    render: tagRender,
    "data-plasmic-valkey": "table.status",
  } as React.ComponentProps<typeof AntdColumn>);
  const name = React.createElement(AntdColumn, {
    title: "Name",
    dataIndex: "name",
    "data-plasmic-valkey": "table.name",
  } as React.ComponentProps<typeof AntdColumn>);
  const { container } = render(
    <Canvas>
      <AntdTable data={data} rowKey="id" pagination={false}>
        {name}
        {status}
      </AntdTable>
    </Canvas>,
  );
  expect(
    authoredKey(screen.getByRole("columnheader", { name: "Status" })),
  ).toBe("table.status");
  for (const cell of screen.getAllByRole("cell", { name: "pending" })) {
    expect(authoredKey(cell)).toBe("table.status");
    expect(authoredKey(cell.querySelector(".ant-tag")!)).toBe("table.status");
  }
  expect(authoredKey(screen.getByRole("cell", { name: "Alice" }))).toBe(
    "table.name",
  );
  // The authored column renders the actual table cells, without invalid divs around them.
  expect(container.querySelector("tr > div")).toBeNull();
  expect(
    screen
      .getByRole("columnheader", { name: "Status" })
      .closest("[data-plasmic-canvas-part-scope]"),
  ).not.toBeNull();
  expect(
    container.querySelectorAll("[data-plasmic-canvas-part=column]"),
  ).toHaveLength(8);
});

test.each([false, true])(
  "column selection highlights only the design canvas (interactive=%s)",
  (interactive) => {
    const { container } = render(
      <Canvas interactive={interactive}>
        <AntdTable data={data} rowKey="id" pagination={false}>
          <AntdColumn title="Name" dataIndex="name" />
          <AntdColumn
            title="Status"
            dataIndex="status"
            __plasmic_selection_prop__={{ isSelected: true }}
          />
        </AntdTable>
      </Canvas>,
    );
    expect(
      container.querySelectorAll("[data-plasmic-table-column-selected]"),
    ).toHaveLength(interactive ? 0 : 4);
    expect(screen.getByRole("cell", { name: "Alice" }).style.background).toBe(
      "",
    );
    expect(
      screen.getByRole("columnheader", { name: "Status" }).style.background,
    ).toBe("");
    expect(
      container.querySelectorAll("style[data-plasmic-editor-style]"),
    ).toHaveLength(interactive ? 0 : 1);
  },
);

test("grouped columns and nested field paths keep cell selection and formatting", () => {
  const { container } = render(
    <Canvas>
      <AntdTable
        data={{ data: [{ id: "1", user: { status: "done", name: "Alice" } }] }}
        rowKey="id"
        pagination={false}
      >
        <>
          <AntdColumnGroup title="User">
            <AntdColumn
              title="Status"
              dataIndex={["user", "status"]}
              render={tagRender}
            />
            <AntdColumn title="Name" dataIndex={["user", "name"]} />
          </AntdColumnGroup>
        </>
      </AntdTable>
    </Canvas>,
  );
  expect(
    screen.getByRole("columnheader", { name: "User" }).getAttribute("colspan"),
  ).toBe("2");
  expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
  expect(container.querySelectorAll(".ant-tag")).toHaveLength(1);
  expect(
    container.querySelectorAll("[data-plasmic-canvas-part=column]"),
  ).toHaveLength(5);
});

test("custom cell nodes remain selectable and retain row bindings and actions", () => {
  const action = vi.fn();
  const renderer = vi.fn((value, row, index) =>
    React.createElement(
      "button",
      {
        "data-plasmic-valkey": "table.status.action",
        onClick: () => action(row.id),
      },
      `${value}:${row.name}:${index}`,
    ),
  );
  const column = React.createElement(AntdColumn, {
    title: "Action",
    dataIndex: "status",
    render: renderer,
    "data-plasmic-valkey": "table.status",
  } as React.ComponentProps<typeof AntdColumn>);
  render(
    <Canvas interactive>
      <AntdTable data={data} rowKey="id" pagination={false}>
        {column}
      </AntdTable>
    </Canvas>,
  );
  const button = screen.getByRole("button", { name: "done:Bob:1" });
  expect(authoredKey(button)).toBe("table.status.action");
  expect(authoredKey(button.closest("td")!)).toBe("table.status");
  fireEvent.click(button);
  expect(action).toHaveBeenCalledWith("2");
});

test("native column callbacks, cell spans and row selection remain functional", () => {
  const select = vi.fn();
  const click = vi.fn();
  render(
    <AntdTable
      data={data}
      rowKey="id"
      pagination={false}
      isSelectable="multiple"
      onSelectedRowKeysChange={select}
    >
      <AntdColumn
        title="Status"
        dataIndex="status"
        onCell={() => ({ onClick: click, style: { color: "red" } })}
        render={(value, _row, index) => ({
          children: value,
          props: { rowSpan: index === 0 ? 2 : index === 1 ? 0 : 1 },
        })}
      />
    </AntdTable>,
  );
  const cells = screen.getAllByRole("cell", { name: "pending" });
  expect(cells[0].getAttribute("rowspan")).toBe("2");
  expect(cells[0].style.color).toBe("red");
  fireEvent.click(cells[0]);
  expect(click).toHaveBeenCalledOnce();
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  expect(select).toHaveBeenCalledWith(["1"]);
});

test("column slots inside a canvas observer evaluate within their data context", () => {
  const Context = React.createContext("pending");
  function Observer({
    children,
  }: {
    children: (value: string) => React.ReactNode;
  }) {
    return <>{children(React.useContext(Context))}</>;
  }
  const slot = (
    <Observer>
      {(value) => (
        <>
          <AntdColumn
            title="Status"
            dataIndex="status"
            render={() => value}
          />
        </>
      )}
    </Observer>
  );
  const { rerender } = render(
    <Context.Provider value="First">
      <AntdTable data={data} rowKey="id" pagination={false}>
        {slot}
      </AntdTable>
    </Context.Provider>,
  );
  expect(screen.getAllByRole("cell", { name: "First" })).toHaveLength(3);
  rerender(
    <Context.Provider value="Second">
      <AntdTable data={data} rowKey="id" pagination={false}>
        {slot}
      </AntdTable>
    </Context.Provider>,
  );
  expect(screen.getAllByRole("cell", { name: "Second" })).toHaveLength(3);
});

test("column controls expose formatting and show only the relevant settings", () => {
  const metas = new Map<string, any>();
  registerTable({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  const meta = metas.get("plasmic-antd6-table-column");
  const props = meta.props;
  expect(meta.isRenderless).not.toBe(true);
  for (const removed of [
    "displayType",
    "tagOptions",
    "tagColor",
    "templateType",
    "displayLabel",
    "contentSize",
    "openInNewTab",
  ]) {
    expect(props[removed]).toBeUndefined();
  }
  expect(meta.actions).toBeUndefined();
  expect(props.render.hidden).toBeUndefined();
  expect(props.onCellClick.hidden({})).toBe(true);
  expect(props.onCellClick.hidden({ render: () => null })).toBe(false);
  expect(props.render.renderPropParams).toEqual(["cell", "row", "index"]);
  expect(meta.styleSections).toBe(false);
});

test("retired column presets render native field text", () => {
  const { container } = render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Status"
        dataIndex="status"
        {...({
          displayType: "tag",
          tagOptions: [{ value: "pending", label: "待处理", color: "orange" }],
        } as any)}
      />
    </AntdTable>,
  );
  expect(container.querySelectorAll(".ant-tag")).toHaveLength(0);
  expect(screen.getAllByRole("cell", { name: "pending" })).toHaveLength(2);
  expect(screen.queryByText("待处理")).toBeNull();
});

test("custom render receives exactly cell, row and index", () => {
  const renderer = vi.fn((cell: unknown) => String(cell));
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Status"
        dataIndex="status"
        render={renderer}
      />
    </AntdTable>,
  );
  expect(renderer.mock.calls[0]).toHaveLength(3);
  expect(renderer.mock.calls[0]).toEqual(["pending", data.data[0], 0]);
});

test("columns without a render slot show native field values", () => {
  render(
    <AntdTable
      data={{ data: [{ id: "1", count: 0 }, { id: "2", count: 12 }, { id: "3", count: null }] }}
      rowKey="id"
      pagination={false}
    >
      <AntdColumn title="Count" dataIndex="count" />
    </AntdTable>,
  );
  const cells = screen.getAllByRole("cell");
  expect(cells.map((cell) => cell.textContent)).toEqual(["0", "12", ""]);
});

test("onCellClick applies to a column with a render slot", () => {
  const onCellClick = vi.fn();
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Actions"
        dataIndex="name"
        onCellClick={onCellClick}
        render={(cell) => <button>{cell}</button>}
      />
    </AntdTable>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Bob" }));
  expect(onCellClick).toHaveBeenCalledExactlyOnceWith("Bob", data.data[1], 1);
});

test("onCellClick is ignored for columns without a render slot", () => {
  const onCellClick = vi.fn();
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn title="Name" dataIndex="name" onCellClick={onCellClick} />
    </AntdTable>,
  );
  fireEvent.click(screen.getByRole("cell", { name: "Bob" }));
  expect(onCellClick).not.toHaveBeenCalled();
});

test("render slots compose native Tags for single and array values", () => {
  const options: Record<string, { label: string; color: string }> = {
    pending: { label: "待处理", color: "orange" },
    done: { label: "已完成", color: "green" },
  };
  const { container } = render(
    <AntdTable
      data={{
        data: [
          { id: "1", tags: "pending" },
          { id: "2", tags: ["pending", "done"] },
          { id: "3", tags: null },
        ],
      }}
      rowKey="id"
      pagination={false}
    >
      <AntdColumn
        title="Tags"
        dataIndex="tags"
        render={(cell) =>
          asArray(cell)
            .filter((value) => value != null)
            .map((value, index) => (
              <AntdTag key={index} color={options[String(value)].color}>
                {options[String(value)].label}
              </AntdTag>
            ))
        }
      />
    </AntdTable>,
  );
  const rows = container.querySelectorAll("tr[data-row-key]");
  expect(rows[0].querySelectorAll(".ant-tag")).toHaveLength(1);
  expect(rows[1].querySelectorAll(".ant-tag")).toHaveLength(2);
  expect(rows[2].querySelectorAll(".ant-tag")).toHaveLength(0);
  expect(screen.getAllByText("待处理")).toHaveLength(2);
  expect(screen.getByText("已完成").className).toContain("ant-tag-green");
});

test.each([false, true])(
  "button events receive the row and index only in preview (interactive=%s)",
  (interactive) => {
    const onCellClick = vi.fn();
    render(
      <Canvas interactive={interactive}>
        <AntdTable data={data} rowKey="id" pagination={false}>
          <AntdColumn
            title="Actions"
            dataIndex="name"
            render={() => <button>Edit</button>}
            onCellClick={onCellClick}
          />
        </AntdTable>
      </Canvas>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    if (interactive) {
      expect(onCellClick).toHaveBeenCalledExactlyOnceWith(
        "Bob",
        data.data[1],
        1,
      );
    } else {
      expect(onCellClick).not.toHaveBeenCalled();
    }
  },
);

test("custom content buttons trigger the column action with the cell, row and index", () => {
  const onCellClick = vi.fn();
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Actions"
        dataIndex="name"
        onCellClick={onCellClick}
        render={(cell) => <button>{cell}</button>}
      />
    </AntdTable>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Bob" }));
  expect(onCellClick).toHaveBeenCalledExactlyOnceWith("Bob", data.data[1], 1);
});

test("custom column actions keep empty cell space inert and respect disabled buttons", () => {
  const action = vi.fn();
  const nativeClick = vi.fn();
  const onCell = vi.fn(() => ({ onClick: nativeClick }));
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Actions"
        dataIndex="name"
        onCellClick={action}
        onCell={onCell}
        render={(cell) => (
          <>
            <button disabled={cell === "Bob"}>
              <span>{cell}</span>
            </button>
          </>
        )}
      />
    </AntdTable>,
  );
  onCell.mockClear();
  fireEvent.click(screen.getByRole("cell", { name: "Alice" }));
  expect(action).not.toHaveBeenCalled();
  expect(nativeClick).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", { name: "Bob" }).querySelector("span")!,
  );
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Alice" }).querySelector("span")!,
  );
  expect(action).toHaveBeenCalledExactlyOnceWith("Alice", data.data[0], 0);
  expect(onCell).not.toHaveBeenCalled();
});

test("custom column actions work when canvas nodes belong to another iframe document", () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const container = frame.contentDocument!.createElement("div");
  frame.contentDocument!.body.append(container);
  const action = vi.fn();
  const view = render(
    <Canvas interactive>
      <AntdTable data={data} rowKey="id" pagination={false}>
        <AntdColumn
          title="Action"
          dataIndex="name"
          onCellClick={action}
          render={(cell) => (
            <button>
              <span>{cell}</span>
            </button>
          )}
        />
      </AntdTable>
    </Canvas>,
    { container },
  );
  try {
    const span = container.querySelector("button span")!;
    expect(span instanceof Element).toBe(false);
    fireEvent.click(span);
    expect(action).toHaveBeenCalledExactlyOnceWith("Alice", data.data[0], 0);
  } finally {
    view.unmount();
    frame.remove();
  }
});

test("authoring immediately previews changes to the uncontrolled default page size", () => {
  const table = (pageSize: number) => (
    <Canvas>
      <AntdTable
        data={data}
        rowKey="id"
        pagination={{ defaultPageSize: pageSize }}
      >
        <AntdColumn title="Name" dataIndex="name" />
      </AntdTable>
    </Canvas>
  );
  const { container, rerender } = render(table(3));
  expect(container.querySelectorAll("tr[data-row-key]")).toHaveLength(3);
  rerender(table(2));
  expect(container.querySelectorAll("tr[data-row-key]")).toHaveLength(2);
});
