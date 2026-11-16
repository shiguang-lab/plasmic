import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { registerAll } from "../src";
import { AntdDropdown } from "../src/registerDropdown";
import { AntdMenuItem } from "../src/registerMenu";
import type { Registerable } from "../src/utils";

const components = new Map<
  string,
  { component: React.ComponentType<any>; meta: any }
>();
registerAll({
  registerComponent: (component, meta) =>
    components.set(meta.name, { component, meta }),
  registerGlobalContext() {},
  registerToken() {},
} as Registerable);

test("every registered styles/classNames pair uses the semantic editor", () => {
  const covered = [...components.values()].filter(({ meta }) =>
    ["styles", "classNames"].some((prop) => prop in meta.props),
  );
  expect(covered.length).toBeGreaterThan(0);
  for (const { meta } of covered) {
    for (const prop of ["styles", "classNames"]) {
      const registration = meta.props[prop];
      expect(registration, `${meta.name}.${prop}`).toMatchObject({
        type: "object",
        editor: "semantic",
      });
      expect(Object.keys(registration.fields).length).toBeGreaterThan(0);
    }
  }
});

const newlyCovered = [
  "anchor",
  "auto-complete",
  "badge-ribbon",
  "breadcrumb",
  "card-meta",
  "cascader",
  "checkbox-group",
  "color-picker",
  "divider",
  "dropdown",
  "empty",
  "float-button",
  "float-button-group",
  "back-top",
  "image",
  "image-preview-group",
  "layout-sider",
  "list-item",
  "listy",
  "masonry",
  "mentions",
  "menu",
  "popconfirm",
  "qr-code",
  "result",
  "skeleton",
  "skeleton-button",
  "skeleton-input",
  "skeleton-avatar",
  "skeleton-image",
  "skeleton-node",
  "space",
  "spin",
  "splitter",
  "statistic-timer",
  "timeline",
  "transfer",
  "tree",
  "directory-tree",
  "tree-select",
  "typography",
  "typography-text",
  "typography-title",
  "typography-paragraph",
  "typography-link",
  "input-otp",
  "input-search",
  "input-password",
  "input-number",
  "progress",
  "segmented",
  "slider",
  "table",
  "upload",
  "upload-dragger",
  "calendar",
  "time-picker",
  "time-range-picker",
  "tour",
];

test.each(newlyCovered)(
  "%s exposes serializable native semantic fields in the property panel",
  (name) => {
    const entry = components.get(`plasmic-antd6-${name}`);
    expect(entry, name).toBeDefined();
    const props = JSON.parse(
      JSON.stringify({
        styles: entry!.meta.props.styles,
        classNames: entry!.meta.props.classNames,
      }),
    );
    for (const prop of ["styles", "classNames"]) {
      expect(props[prop]).toMatchObject({ type: "object", editor: "semantic" });
      expect(props[prop].hidden).toBeUndefined();
      expect(props[prop].advanced).toBeUndefined();
      expect(Object.keys(props[prop].fields).length).toBeGreaterThan(0);
    }
  },
);

test.each([
  {
    name: "card",
    props: { children: "Card content" },
    path: ["body"],
    selector: ".ant-card-body",
  },
  {
    name: "input-number",
    props: { value: 5 },
    path: ["input"],
    selector: "input",
  },
  {
    name: "input-search",
    props: { enterButton: true },
    path: ["button", "root"],
    selector: "button",
  },
  {
    name: "table",
    props: {
      data: { data: [{ key: "1", name: "Alice" }] },
      columns: [{ title: "Name", dataIndex: "name" }],
      pagination: false,
    },
    path: ["body", "cell"],
    selector: "td",
  },
  {
    name: "tree",
    props: { treeData: [{ key: "one", title: "One" }] },
    path: ["itemTitle"],
    selector: ".ant-tree-title",
  },
  {
    name: "menu",
    props: { items: [{ key: "one", label: "One" }] },
    path: ["item"],
    selector: '[role="menuitem"]',
  },
  {
    name: "slider",
    props: { value: 25 },
    path: ["rail"],
    selector: ".ant-slider-rail",
  },
  {
    name: "timeline",
    props: { items: [{ title: "One", content: "Details" }] },
    path: ["itemTitle"],
    selector: ".ant-timeline-item-title",
  },
  {
    name: "list-item",
    props: { actions: "Action" },
    path: ["actions"],
    selector: ".ant-list-item-action",
  },
])(
  "$name applies saved styles and classNames to the native region",
  ({ name, props, path, selector }) => {
    const { component: Component, meta } = components.get(
      `plasmic-antd6-${name}`,
    )!;
    for (const prop of ["styles", "classNames"]) {
      let field = meta.props[prop];
      for (const key of path) {
        field = field.fields[key];
        expect(field, `${name}.${prop}.${key}`).toBeDefined();
      }
      expect(field.type).toBe(prop === "styles" ? "object" : "string");
    }
    const atPath = (value: unknown) =>
      path.reduceRight((result, key) => ({ [key]: result }), value);
    const saved = JSON.parse(
      JSON.stringify({
        ...props,
        styles: atPath({ color: "rgb(17, 34, 51)" }),
        classNames: atPath("configured-region"),
      }),
    );
    const view = render(<Component {...saved} />);
    const region = view.container.querySelector<HTMLElement>(selector);
    expect(region).toBeTruthy();
    expect(region!.classList.contains("configured-region")).toBe(true);
    expect(region!.style.color).toBe("rgb(17, 34, 51)");
  },
);

test.each([false, true])(
  "Dropdown preserves native menu semantics and actions (slots=%s)",
  async (useMenuItemsSlot) => {
    const action = vi.fn();
    const classes = vi.fn(() => ({
      menu: "configured-menu",
      item: "configured-item",
    }));
    const styles = vi.fn(() => ({
      menu: { padding: 19 },
      item: { color: "rgb(17, 34, 51)" },
    }));
    render(
      <AntdDropdown
        open
        useMenuItemsSlot={useMenuItemsSlot}
        menuItemsJson={[{ key: "one", label: "Action" }]}
        menuItems={() => <AntdMenuItem key="one">Action</AntdMenuItem>}
        dropdownMenuScopeClassName="studio-menu"
        classNames={classes}
        styles={styles}
        onAction={action}
      >
        <button>Open menu</button>
      </AntdDropdown>,
    );
    const item = await screen.findByRole("menuitem", { name: "Action" });
    const menu = screen.getByRole("menu");
    expect(menu.classList.contains("configured-menu")).toBe(true);
    expect(menu.classList.contains("studio-menu")).toBe(true);
    expect(menu.style.padding).toBe("19px");
    expect(item.classList.contains("configured-item")).toBe(true);
    expect(item.style.color).toBe("rgb(17, 34, 51)");
    expect(classes).toHaveBeenCalled();
    expect(styles).toHaveBeenCalled();
    fireEvent.click(item);
    expect(action).toHaveBeenCalledWith("one");
  },
);
