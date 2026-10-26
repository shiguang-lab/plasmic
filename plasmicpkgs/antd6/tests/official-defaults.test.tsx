import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test } from "vitest";
import { registerAll } from "../src";
import { AntdButton } from "../src/registerButton";
import { FormWrapper } from "../src/form/Form";
import { AntdTabItem, AntdTabs } from "../src/registerTabs";

function registrations() {
  const metas = new Map<string, any>();
  registerAll({
    registerComponent: (_component: unknown, meta: any) => metas.set(meta.name, meta),
    registerGlobalContext() {},
    registerToken() {},
  } as any);
  return metas;
}

// Registration defaults are applied at runtime, so they must match Ant Design.
test("registrations keep Ant Design defaults for layout, spacing and behavior", () => {
  const metas = registrations();
  const prop = (name: string, key: string) => metas.get(`plasmic-antd6-${name}`).props[key];
  for (const [name, key] of [
    ["space", "size"], ["row", "gutter"], ["col", "span"], ["flex", "gap"],
    ["form", "layout"], ["form", "labelCol"], ["form", "wrapperCol"],
    ["form-item", "validateFirst"], ["listy", "height"], ["masonry", "columns"], ["masonry", "gutter"],
  ]) {
    expect(prop(name, key).defaultValue, `${name}.${key}`).toBeUndefined();
  }
  expect(prop("tree", "checkable").defaultValue).toBe(false);
  for (const name of ["form", "form-item", "radio-group", "splitter"]) {
    expect(metas.get(`plasmic-antd6-${name}`).defaultStyles, name).toBeUndefined();
  }
  expect(metas.get("plasmic-antd6-tabs").defaultStyles).toEqual({ width: "stretch" });
  expect(metas.get("plasmic-antd6-slider").defaultStyles).toEqual({ width: "stretch" });
  for (const [name, removed] of [
    ["tag", ["value", "options", "defaultColor", "automaticColor"]],
    ["image", ["objectFit"]],
    ["input-otp", ["onComplete"]],
    ["typography-title", ["strong"]],
    ["tabs", ["sticky", "stickyOffset", "tabBarBackground"]],
    ["tooltip", ["onlyWhenOverflow"]],
    ["table-column", ["displayType"]],
    ["avatar", ["href", "target"]],
  ] as const) {
    for (const key of removed) expect(prop(name, key), `${name}.${key}`).toBeUndefined();
  }
  expect(prop("input-otp", "onInput").type).toBe("eventHandler");
  expect(prop("avatar", "onClick").type).toBe("eventHandler");
});

test("Button renders its label without an extra wrapper", () => {
  render(<AntdButton>Save</AntdButton>);
  const button = screen.getByRole("button", { name: "Save" });
  expect(button.querySelector("div")).toBeNull();
});

test("Form does not inject global CSS", () => {
  const { container } = render(<FormWrapper><span>Field</span></FormWrapper>);
  expect(container.querySelector("style")).toBeNull();
  expect(container.querySelector("form")?.className).toContain("ant-form-horizontal");
});

test("Tabs without extra content render no extra-content containers", () => {
  const { container } = render(
    <AntdTabs
      {...({
        items: (
          <>
            <AntdTabItem key="a" label="A">First</AntdTabItem>
          </>
        ),
      } as any)}
    />,
  );
  expect(container.querySelector(".ant-tabs-extra-content")).toBeNull();
});
