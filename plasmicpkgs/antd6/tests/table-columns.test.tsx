import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import {
  AntdColumn,
  AntdColumnGroup,
  AntdTable,
  registerTable,
} from "../src/registerTable";
import type { Registerable } from "../src/utils";

const data = {
  data: [
    { id: "1", name: "Alice", status: "pending" },
    { id: "2", name: "Bob", status: "done" },
    { id: "3", name: "Chris", status: "pending" },
  ],
};

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

test("switching a field to Tag updates every row without a render binding", () => {
  function Table({ displayType }: { displayType: "text" | "tag" }) {
    return (
      <AntdTable data={data} rowKey="id" pagination={false}>
        <AntdColumn title="Name" dataIndex="name" />
        <AntdColumn
          title="Status"
          dataIndex="status"
          displayType={displayType}
          tagOptions={[
            { value: "pending", label: "待处理", color: "orange" },
            { value: "done", label: "已完成", color: "green" },
          ]}
        />
      </AntdTable>
    );
  }
  const { container, rerender } = render(<Table displayType="text" />);
  expect(container.querySelectorAll(".ant-tag")).toHaveLength(0);
  expect(screen.getAllByRole("cell", { name: "pending" })).toHaveLength(2);
  rerender(<Table displayType="tag" />);
  expect(container.querySelectorAll(".ant-tag")).toHaveLength(3);
  expect(screen.getAllByText("待处理")).toHaveLength(2);
  expect(screen.getByText("已完成").className).toContain("ant-tag-green");
  expect(screen.getByRole("cell", { name: "Alice" })).toBeTruthy();
  rerender(<Table displayType="text" />);
  expect(container.querySelectorAll(".ant-tag")).toHaveLength(0);
  expect(screen.getAllByRole("cell", { name: "pending" })).toHaveLength(2);
});

test("headers, cell contents and empty cell space resolve to the original column", () => {
  const status = React.createElement(AntdColumn, {
    title: "Status",
    dataIndex: "status",
    displayType: "tag",
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
    container.querySelectorAll("[data-plasmic-table-column]"),
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
      screen.getByRole("columnheader", { name: "Status" }).style.background !==
        "",
    ).toBe(!interactive);
  },
);

test("array fields produce tags, nulls stay empty, and colors stay stable across reordering", () => {
  const tagRows = [
    { id: "1", tags: ["pending", "done"] },
    { id: "2", tags: null },
    { id: "3", tags: [] },
    { id: "4", tags: 0 },
    { id: "5", tags: false },
  ];
  type Rows = typeof tagRows;
  function Table({ rows }: { rows: Rows }) {
    return (
      <AntdTable data={{ data: rows }} rowKey="id" pagination={false}>
        <AntdColumn title="Tags" dataIndex="tags" displayType="tag" />
      </AntdTable>
    );
  }
  const { container, rerender } = render(<Table rows={tagRows} />);
  expect(container.querySelectorAll(".ant-tag")).toHaveLength(4);
  expect(screen.getByRole("cell", { name: "0" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "false" })).toBeTruthy();
  const color = screen.getByText("pending").className;
  rerender(<Table rows={[...tagRows].reverse()} />);
  expect(screen.getByText("pending").className).toBe(color);
});

test("per-value tag colors override the column's default color", () => {
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Status"
        dataIndex="status"
        displayType="tag"
        tagColor="#123456"
        tagOptions={[{ value: "done", label: "Finished", color: "green" }]}
      />
    </AntdTable>,
  );
  expect(screen.getByText("Finished").className).toContain("ant-tag-green");
  expect(screen.getAllByText("pending")[0].style.color).toBe("rgb(18, 52, 86)");
});

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
              displayType="tag"
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
    container.querySelectorAll("[data-plasmic-table-column]"),
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
    displayType: "custom",
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
            displayType="custom"
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
  expect(props.displayType.options.map((option: any) => option.value)).toEqual([
    "text",
    "tag",
    "link",
    "avatar",
    "image",
    "button",
    "custom",
  ]);
  expect(props.tagOptions.hidden({ displayType: "tag" })).toBe(false);
  expect(props.tagOptions.hidden({ displayType: "text" })).toBe(true);
  expect(props.render.hidden({ displayType: "tag" })).toBe(true);
  expect(props.render.hidden({ displayType: "custom" })).toBe(false);
  expect(props.render.hidden({ render: () => null })).toBe(false);
  expect(props.render.renderPropParams).toEqual(["cell", "row", "index"]);
});

test("link, image and avatar presets bind field values and preserve labels and sizes", () => {
  const src = "https://example.com/photo.png";
  const { container } = render(
    <AntdTable
      data={{ data: [{ id: "1", url: src }] }}
      rowKey="id"
      pagination={false}
    >
      <AntdColumn
        title="Link"
        dataIndex="url"
        displayType="link"
        displayLabel="Profile"
        openInNewTab
      />
      <AntdColumn
        title="Avatar"
        dataIndex="url"
        displayType="avatar"
        contentSize={48}
      />
      <AntdColumn
        title="Image"
        dataIndex="url"
        displayType="image"
        contentSize={64}
        displayLabel="Photo"
      />
    </AntdTable>,
  );
  const link = screen.getByRole("link", { name: "Profile" });
  expect(link.getAttribute("href")).toBe(src);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getByAltText("Photo").getAttribute("src")).toBe(src);
  expect(container.querySelector<HTMLElement>(".ant-avatar")?.style.width).toBe(
    "48px",
  );
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
            displayType="button"
            displayLabel="Edit"
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

test("custom content keeps the column action after a button preset is converted to a template", () => {
  const onCellClick = vi.fn();
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Actions"
        dataIndex="name"
        displayType="custom"
        onCellClick={onCellClick}
        render={(cell) => <button>{cell}</button>}
      />
    </AntdTable>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Bob" }));
  expect(onCellClick).toHaveBeenCalledExactlyOnceWith("Bob", data.data[1], 1);
});
