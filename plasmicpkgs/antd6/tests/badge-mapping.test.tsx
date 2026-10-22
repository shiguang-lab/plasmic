import { render } from "@testing-library/react";
import * as Ant from "antd";
import React from "react";
import { expect, test } from "vitest";
import { AntdBadge, registerAdditional } from "../src/registerAdditional";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  return metas;
}

const options = [
  { value: "active", label: "启用", status: "success" as const },
  { value: "draft", label: "圈选中", status: "processing" as const },
  { value: "1", label: "数字", status: "warning" as const },
  { value: "true", label: "布尔", status: "error" as const },
];

test("a matched value renders the option status and label", () => {
  const { container } = render(<AntdBadge value="active" options={options} />);
  expect(container.querySelector(".ant-badge-status-success")).toBeTruthy();
  expect(container.textContent).toBe("启用");
});

test("an unmatched value shows the raw value with the default status", () => {
  const { container } = render(<AntdBadge value="archived" options={options} />);
  expect(container.querySelector(".ant-badge-status-default")).toBeTruthy();
  expect(container.textContent).toBe("archived");
});

test("explicit status and text take precedence over the matched option", () => {
  const { container } = render(
    <AntdBadge value="active" options={options} status="error" text="停用" />,
  );
  expect(container.querySelector(".ant-badge-status-error")).toBeTruthy();
  expect(container.querySelector(".ant-badge-status-success")).toBeNull();
  expect(container.textContent).toBe("停用");
});

test("without a value Badge passes through to the antd count badge", () => {
  const { container } = render(<AntdBadge count={5} />);
  const { container: expected } = render(<Ant.Badge count={5} />);
  expect(container.innerHTML).toBe(expected.innerHTML);
  expect(container.querySelector(".ant-badge-status-dot")).toBeNull();
});

test.each([
  [1, "数字", "warning"],
  [true, "布尔", "error"],
])("non-string value %j matches its string option", (value, label, status) => {
  const { container } = render(<AntdBadge value={value} options={options} />);
  expect(container.querySelector(`.ant-badge-status-${status}`)).toBeTruthy();
  expect(container.textContent).toBe(label);
});

test("an option with an invalid status falls back to default", () => {
  const { container } = render(
    <AntdBadge
      value="x"
      options={[{ value: "x", label: "未知", status: "blue" as any }]}
    />,
  );
  expect(container.querySelector(".ant-badge-status-default")).toBeTruthy();
  expect(container.textContent).toBe("未知");
});

test("non-array options do not crash and show the raw value", () => {
  const { container } = render(
    <AntdBadge
      value="active"
      options={{ active: { label: "启用", status: "success" } } as any}
    />,
  );
  expect(container.querySelector(".ant-badge-status-default")).toBeTruthy();
  expect(container.textContent).toBe("active");
});

test("Badge registration exposes value and status label mapping", () => {
  const props = metadata(registerAdditional).get("plasmic-antd6-badge").props;
  const presets = ["success", "processing", "default", "error", "warning"];
  expect(props.value.type).toBe("string");
  expect(props.options.type).toBe("array");
  const fields = props.options.itemType.fields;
  expect(Object.keys(fields)).toEqual(["value", "label", "status"]);
  expect(fields.status.type).toBe("choice");
  expect(fields.status.options).toEqual(presets);
  expect(props.status.options).toEqual(presets);
  expect(props.options.itemType.nameFunc({ value: "a", label: "A" })).toBe("A");
  expect(props.options.itemType.nameFunc({ value: "a" })).toBe("a");
  expect(props.count.defaultValue).toBeUndefined();
});
