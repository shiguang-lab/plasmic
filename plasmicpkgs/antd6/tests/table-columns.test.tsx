import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdImage, AntdTag } from "../src/registerAdditional";
import {
  AntdColumn,
  AntdColumnGroup,
  AntdTable,
  registerTable,
} from "../src/registerTable";
import { columnTemplateHtml } from "../src/table-column-template";
import type { Registerable } from "../src/utils";

const data = {
  data: [
    { id: "1", name: "Alice", status: "pending" },
    { id: "2", name: "Bob", status: "done" },
    { id: "3", name: "Chris", status: "pending" },
  ],
};

test("wide tables own horizontal scrolling and respect an explicit scroll override", () => {
  const { container, rerender } = render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn title="Name" dataIndex="name" width={400} />
      <AntdColumn title="Status" dataIndex="status" width={400} />
    </AntdTable>,
  );
  expect(
    container.querySelector<HTMLElement>(".ant-table-content")?.style.overflowX,
  ).toBe("auto");
  expect(container.querySelector<HTMLElement>("table")?.style.minWidth).toBe(
    "100%",
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
  expect(props.render.renderPropParams).toEqual([
    "cell",
    "row",
    "index",
    "column",
  ]);
  expect(meta.styleSections).toBe(false);
  expect(
    props.tagOptions.hidden({ displayType: "custom", templateType: "tag" }),
  ).toBe(false);
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

test("custom column actions keep empty cell space inert and respect disabled buttons", () => {
  const action = vi.fn();
  const nativeClick = vi.fn();
  const onCell = vi.fn(() => ({ onClick: nativeClick }));
  render(
    <AntdTable data={data} rowKey="id" pagination={false}>
      <AntdColumn
        title="Actions"
        dataIndex="name"
        displayType="custom"
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

test("Image template conversion preserves the image crop and explicit style overrides", () => {
  const html = document.createElement("div");
  html.innerHTML = columnTemplateHtml({
    displayType: "image",
    contentSize: 48,
  });
  const props = JSON.parse(
    html.querySelector("plasmic-component")!.getAttribute("data-props")!,
  );
  expect(props.width).toBe("{{ column.size }}");
  expect(props.height).toBe("{{ column.size }}");
  const { container, rerender } = render(
    <AntdImage
      {...props}
      width={48}
      height={48}
      src="https://example.com/wide.png"
      alt="Photo"
    />,
  );
  const image = container.querySelector("img")!;
  expect(image.style.objectFit).toBe("cover");
  expect(image.getAttribute("width")).toBe("48");
  expect(image.getAttribute("height")).toBe("48");
  rerender(
    <AntdImage
      src="https://example.com/wide.png"
      style={{ objectFit: "contain" }}
    />,
  );
  expect(container.querySelector("img")!.style.objectFit).toBe("contain");
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
          displayType="custom"
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

test("converted Tag templates keep live mapping bindings and meaningful node names", () => {
  const root = document.createElement("div");
  root.innerHTML = columnTemplateHtml({
    displayType: "tag",
    dataIndex: 'status"<&',
    tagOptions: [{ value: "pending", label: "初始", color: "orange" }],
  });
  const tag = root.querySelector("plasmic-component")!;
  const props = JSON.parse(tag.getAttribute("data-props")!);
  expect(props).toEqual({
    value: "{{ tagValue }}",
    options: "{{ column.tagOptions }}",
    defaultColor: "{{ column.tagColor }}",
    automaticColor: true,
  });
  expect(tag.getAttribute("data-repeat")).toBe("{{ column.values }}");
  expect(tag.getAttribute("data-plasmic-name")).toBe('status"<& · tag模板');
  expect(root.querySelector("script")).toBeNull();
  const renderTemplate = (
    _cell: unknown,
    _row: unknown,
    _index: number,
    column: any,
  ) =>
    column.values.map((value: unknown, index: number) => (
      <AntdTag
        key={index}
        value={String(value)}
        options={column.tagOptions}
        defaultColor={column.tagColor}
        automaticColor
      />
    ));
  const Table = ({ label, color }: { label: string; color: string }) => (
    <AntdTable data={data} rowKey="id" pagination={false}>
      {React.createElement(AntdColumn, {
        title: "Status",
        dataIndex: "status",
        displayType: "custom",
        templateType: "tag",
        tagOptions: [{ value: "pending", label, color }],
        render: renderTemplate,
      } as any)}
    </AntdTable>
  );
  const { rerender } = render(<Table label="待处理" color="orange" />);
  expect(screen.getAllByText("待处理")).toHaveLength(2);
  rerender(<Table label="待审核" color="purple" />);
  expect(screen.queryByText("待处理")).toBeNull();
  expect(screen.getAllByText("待审核")[0].className).toContain(
    "ant-tag-purple",
  );
});

test("preset conversion is an explicit component action and updates content and props together", async () => {
  const registrations: any[] = [];
  registerTable({
    registerComponent: (_component: unknown, meta: unknown) =>
      registrations.push(meta),
  } as Registerable);
  const column = registrations.find(
    (meta) => meta.name === "plasmic-antd6-table-column",
  );
  const action = column.actions.find(
    (candidate: any) => candidate.label === "转为可编辑模板",
  );
  const componentProps = { displayType: "tag", tagColor: "green" };
  const replaceSlotContent = vi.fn().mockResolvedValue(undefined);
  await action.onClick({ componentProps, studioOps: { replaceSlotContent } });
  expect(componentProps).toEqual({ displayType: "tag", tagColor: "green" });
  expect(replaceSlotContent).toHaveBeenCalledWith({
    slotName: "render",
    html: expect.stringContaining("plasmic-antd6-tag"),
    props: { displayType: "custom", templateType: "tag" },
  });
  expect(action.hidden({ displayType: "custom" })).toBe(true);
  expect(action.hidden({ displayType: "tag", render: () => null })).toBe(true);
  replaceSlotContent.mockClear();
  await action.onClick({
    componentProps: { displayType: "tag", render: () => "edited" },
    studioOps: { replaceSlotContent },
  });
  expect(replaceSlotContent).not.toHaveBeenCalled();
});

test.each([1, true, [1, true, null], null])(
  "Tag presets and raw-value editable templates match for %j",
  (value) => {
    const options = [
      { value: "1", label: "数字标签", color: "orange" },
      { value: "true", label: "布尔标签", color: "purple" },
    ];
    const props = {
      data: { data: [{ id: 1, status: value }] },
      rowKey: "id",
      pagination: false as const,
    };
    const { container, rerender } = render(
      <AntdTable {...props}>
        <AntdColumn dataIndex="status" displayType="tag" tagOptions={options} />
      </AntdTable>,
    );
    const tags = () =>
      [...container.querySelectorAll(".ant-tag")].map((node) => ({
        text: node.textContent,
        color: node.className.match(/ant-tag-(orange|purple|blue|green)/)?.[0],
      }));
    const before = tags();
    rerender(
      <AntdTable {...props}>
        <AntdColumn
          dataIndex="status"
          displayType="custom"
          templateType="tag"
          tagOptions={options}
          render={(_value, _row, _index, column: any) =>
            column.values.map((item: any, index: number) => (
              <AntdTag
                key={index}
                value={item}
                options={column.tagOptions}
                automaticColor
              />
            ))
          }
        />
      </AntdTable>,
    );
    expect(tags()).toEqual(before);
    if (value !== null) expect(before.length).toBeGreaterThan(0);
  },
);
