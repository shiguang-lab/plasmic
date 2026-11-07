import { fireEvent, render, screen } from "@testing-library/react";

import { expect, test, vi } from "vitest";
import { AntdSelect, registerSelect } from "../src/registerSelect";
import type { Registerable } from "../src/utils";

const values = ["1", "2", "3", "4", "5"];
const options = values.map((value) => ({ value, label: `${value} 星` }));

test("tag limits preserve native values, including zero, without changing selection", () => {
  let meta: any;
  registerSelect({
    registerComponent: (_component, registration) => {
      if (registration.name === "plasmic-antd6-select") meta = registration;
    },
  } as Registerable);
  expect(meta.props.maxTagCount.defaultValue).toBeUndefined();
  expect(meta.props.maxTagCount.hidden({ mode: "multiple" })).toBe(false);
  expect(meta.props.maxTagCount.hidden({ mode: "tags" })).toBe(false);
  expect(meta.props.maxTagCount.hidden({})).toBe(true);

  const onChange = vi.fn();
  const element = (maxTagCount?: number | "responsive") => (
    <AntdSelect
      mode="multiple"
      options={options}
      value={values}
      maxTagCount={maxTagCount}
      onChange={onChange}
    />
  );
  const { container, rerender } = render(element());
  expect(container.querySelectorAll(".ant-select-selection-item")).toHaveLength(5);
  rerender(element(0));
  expect(container.querySelectorAll(".ant-select-selection-item")).toHaveLength(1);
  expect(container.textContent).toContain("+ 5");
  rerender(element(2));
  expect(container.querySelectorAll(".ant-select-selection-item")).toHaveLength(3);
  expect(container.textContent).toContain("+ 3");
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByLabelText("close")[0]);
  expect(onChange.mock.calls[0][0]).toEqual(["2", "3", "4", "5"]);
});
