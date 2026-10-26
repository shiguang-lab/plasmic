// @vitest-environment jsdom
import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { AntdDrawer, registerDrawer } from "../src/registerDrawer";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  return metas;
}

test("Drawer registration accepts native preset, numeric and CSS sizes", () => {
  const props = metadata(registerDrawer).get("plasmic-antd6-drawer").props;
  expect(props.width).toBeUndefined();
  expect(props.size.type).toBe("object");
  expect(props.size.fields).toBeUndefined();
  expect(props.size.defaultValue).toBeUndefined();
});

test.each([
  ["default", "right", "width", "378px"],
  ["large", "right", "width", "736px"],
  [640, "right", "width", "640px"],
  ["50vw", "right", "width", "50vw"],
  [320, "bottom", "height", "320px"],
] as const)("Drawer size %s sets the native %s panel dimension", (size, placement, dimension, expected) => {
  render(<AntdDrawer open size={size} placement={placement}>Content</AntdDrawer>);
  const panel = document.querySelector<HTMLElement>(".ant-drawer-content-wrapper");
  expect(panel?.style[dimension]).toBe(expected);
});
