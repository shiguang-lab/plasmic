import { PlasmicCanvasContext } from "@plasmicapp/host";
import { render, screen } from "@testing-library/react";
import { Descriptions } from "antd";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  AntdDescriptions,
  AntdDescriptionsItem,
  registerAdditional,
} from "../src/registerAdditional";
import type { Registerable } from "../src/utils";

test("Descriptions registers editable Item slots as the default composition", () => {
  const metas = new Map<string, any>();
  registerAdditional({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  const descriptions = metas.get("plasmic-antd6-descriptions");
  const item = metas.get("plasmic-antd6-descriptions-item");
  expect(item.displayName).toBe("Descriptions.Item");
  expect(item.parentComponentName).toBe(descriptions.name);
  expect(item.props.label.type).toBe("slot");
  expect(item.props.children.type).toBe("slot");
  expect(item.props.span.defaultValueHint).toBe(1);
  expect(descriptions.props.children.allowedComponents).toEqual([item.name]);
  expect(descriptions.props.items.defaultValue).toBeUndefined();
  expect(descriptions.props.items.advanced).toBe(true);
  for (const props of [descriptions.props.items.itemType.fields, item.props]) {
    expect(props.style.type).toBe("object");
    expect(props.style.description).toContain('width: "25%"');
    expect(props.className.type).toBe("string");
    expect(props.styles.fields.label.type).toBe("object");
    expect(props.styles.fields.content.type).toBe("object");
    expect(props.classNames.fields).toEqual({ label: "string", content: "string" });
  }
  expect(descriptions.props.children.hidden({ items: [] })).toBe(true);
  expect(descriptions.props.children.hidden({})).toBe(false);
  const defaultItem = descriptions.props.children.defaultValue[0];
  expect(defaultItem.props.label).toEqual([{ type: "text", value: "Name" }]);
  expect(defaultItem.props.children).toEqual([
    { type: "text", value: "Example" },
  ]);
});

test.each(["items", "slots"])("%s passes native cell width and semantic appearance to separate DOM targets", (source) => {
  const fields = [
    {
      key: "uid",
      label: "UID",
      children: "123",
      style: { width: "25%" },
      className: "identity-cell",
      styles: { label: { color: "red" }, content: { fontWeight: 600 } },
      classNames: { label: "identity-label", content: "identity-value" },
    },
    { key: "name", label: "Name", children: "Example", style: { width: "25%" } },
    { key: "phone", label: "Phone", children: "123456", style: { width: "25%" } },
    { key: "status", label: "Status", children: "Active", style: { width: "25%" } },
  ];
  const { container } = render(
    <AntdDescriptions
      column={4}
      layout="horizontal"
      bordered={false}
      styles={{ label: { color: "blue" } }}
      items={source === "items" ? fields : undefined}
    >
      {source === "slots" && fields.map(({ key, ...props }) => (
        <AntdDescriptionsItem key={key} {...props} />
      ))}
    </AntdDescriptions>,
  );
  const cells = Array.from(container.querySelectorAll<HTMLTableCellElement>("td"));
  expect(cells.map((cell) => cell.style.width)).toEqual(["25%", "25%", "25%", "25%"]);
  expect(cells.map((cell) => cell.colSpan)).toEqual([1, 1, 1, 1]);
  expect(cells[0].classList.contains("identity-cell")).toBe(true);
  const label = cells[0].querySelector<HTMLElement>(".identity-label");
  const value = cells[0].querySelector<HTMLElement>(".identity-value");
  expect(label?.textContent).toBe("UID");
  expect(label?.style.color).toBe("red");
  expect(value?.textContent).toBe("123");
  expect(value?.style.fontWeight).toBe("600");
  expect(label?.style.width).toBe("");
  expect(value?.style.width).toBe("");
});

test("rich Item slots, spans and cell classes render identically to official items", () => {
  const label = <strong>Audience</strong>;
  const children = <a href="/groups/1">View group</a>;
  const fields = [
    {
      key: "group",
      label,
      children,
      span: 2,
      className: "studio-item",
      styles: { label: { color: "red" } },
    },
    { key: "count", label: "Count", children: 0 },
  ];
  const props = { bordered: true, column: 3, title: "Summary" };
  const actual = renderToStaticMarkup(
    <AntdDescriptions {...props}>
      <>
        <AntdDescriptionsItem
          key="group"
          label={label}
          span={2}
          className="studio-item"
          styles={fields[0].styles}
        >
          {children}
        </AntdDescriptionsItem>
        <AntdDescriptionsItem key="count" label="Count">
          {0}
        </AntdDescriptionsItem>
      </>
    </AntdDescriptions>,
  );
  expect(actual).toBe(
    renderToStaticMarkup(<Descriptions {...props} items={fields} />),
  );
});

test("SDK render-prop observers preserve Item selection classes and live slot changes", () => {
  function CanvasObserver({ children }: { children: () => React.ReactNode }) {
    return <>{children()}</>;
  }
  const content = (value: string) => (
    <PlasmicCanvasContext.Provider
      value={{
        componentName: "Descriptions test",
        globalVariants: {},
        interactive: false,
      }}
    >
      <AntdDescriptions column={2}>
        <CanvasObserver>
          {() => (
            <AntdDescriptionsItem
              key="owner"
              className="selected-item"
              label={<span>Owner</span>}
            >
              <span contentEditable suppressContentEditableWarning>
                {value}
              </span>
            </AntdDescriptionsItem>
          )}
        </CanvasObserver>
      </AntdDescriptions>
    </PlasmicCanvasContext.Provider>
  );
  const view = render(content("Operations"));
  expect(
    screen
      .getByText("Operations")
      .closest("td")
      ?.classList.contains("selected-item"),
  ).toBe(true);
  view.rerender(content("Analytics"));
  expect(screen.getByText("Analytics")).toBeTruthy();
  expect(screen.queryByText("Operations")).toBeNull();
});

test("native items override slots, including an explicitly empty array", () => {
  const child = (
    <AntdDescriptionsItem label="Slot label">Slot value</AntdDescriptionsItem>
  );
  const view = render(
    <AntdDescriptions
      items={[
        { key: "native", label: "Native label", children: "Native value" },
      ]}
    >
      {child}
    </AntdDescriptions>,
  );
  expect(screen.getByText("Native value")).toBeTruthy();
  expect(screen.queryByText("Slot value")).toBeNull();
  view.rerender(<AntdDescriptions items={[]}>{child}</AntdDescriptions>);
  expect(screen.queryByText("Native value")).toBeNull();
  expect(screen.queryByText("Slot value")).toBeNull();
  view.rerender(<AntdDescriptions>{child}</AntdDescriptions>);
  expect(screen.getByText("Slot value")).toBeTruthy();
});

test("Descriptions retains its native ref for both editing slots and data-bound items", () => {
  const ref = React.createRef<React.ComponentRef<typeof Descriptions>>();
  const view = render(
    <AntdDescriptions ref={ref}>
      <AntdDescriptionsItem label="Owner">Operations</AntdDescriptionsItem>
    </AntdDescriptions>,
  );
  expect(ref.current?.nativeElement).toBe(view.container.firstElementChild);
  view.rerender(
    <AntdDescriptions
      ref={ref}
      items={[{ key: "owner", label: "Owner", children: "Operations" }]}
    />,
  );
  expect(ref.current?.nativeElement).toBe(view.container.firstElementChild);
});
