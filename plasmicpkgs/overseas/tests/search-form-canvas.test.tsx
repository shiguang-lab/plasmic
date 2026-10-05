import { PlasmicCanvasContext } from "@plasmicapp/host";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Input } from "antd";
import React from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { SearchForm, SearchFormItem } from "../src/SearchForm";
afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});
const fields = ["市场", "场景", "类型", "状态", "关键字"].map((label, i) => (
  <SearchFormItem key={i} name={`field${i}`} label={label}>
    <Input aria-label={label} />
  </SearchFormItem>
));
test("label width follows content unless configured and returns to content width when cleared", () => {
  const { container, rerender } = render(
    <SearchForm colSpan={6}>{fields}</SearchForm>,
  );
  const labels = [
    ...container.querySelectorAll<HTMLElement>(".ant-form-item-label"),
  ];
  expect(labels).toHaveLength(5);
  expect(labels.map((e) => e.style.flex)).toEqual(Array(5).fill(""));
  rerender(
    <SearchForm colSpan={6} labelWidth={100}>
      {fields}
    </SearchForm>,
  );
  expect(
    [...container.querySelectorAll<HTMLElement>(".ant-form-item-label")].map(
      (e) => e.style.flex,
    ),
  ).toEqual(Array(5).fill("0 0 100px"));
  rerender(<SearchForm colSpan={6}>{fields}</SearchForm>);
  expect(
    [...container.querySelectorAll<HTMLElement>(".ant-form-item-label")].map(
      (e) => e.style.flex,
    ),
  ).toEqual(Array(5).fill(""));
});
test("an explicit zero label width is preserved", () => {
  const { container } = render(
    <SearchForm labelWidth={0}>{fields}</SearchForm>,
  );
  expect(
    [...container.querySelectorAll<HTMLElement>(".ant-form-item-label")].map(
      (e) => e.style.flex,
    ),
  ).toEqual(Array(5).fill("0 0 0px"));
});
test("canvas shows all fields with expanded text/ARIA; preview and runtime can expand and collapse", async () => {
  const onCollapsedChange = vi.fn();
  const { container, rerender } = render(
    <PlasmicCanvasContext.Provider
      value={{ componentName: "Page", globalVariants: {}, interactive: false }}
    >
      <SearchForm colSpan={6} onCollapsedChange={onCollapsedChange}>
        {fields}
      </SearchForm>
    </PlasmicCanvasContext.Provider>,
  );
  expect(screen.getByText("收起").getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelectorAll('[style*="display: none"]')).toHaveLength(
    0,
  );
  rerender(
    <PlasmicCanvasContext.Provider
      value={{ componentName: "Page", globalVariants: {}, interactive: true }}
    >
      <SearchForm colSpan={6} onCollapsedChange={onCollapsedChange}>
        {fields}
      </SearchForm>
    </PlasmicCanvasContext.Provider>,
  );
  expect(screen.getByText("展开").getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelectorAll('[style*="display: none"]')).toHaveLength(
    2,
  );
  await act(async () => fireEvent.click(screen.getByText("展开")));
  expect(screen.getByText("收起").getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelectorAll('[style*="display: none"]')).toHaveLength(
    0,
  );
  await act(async () => fireEvent.click(screen.getByText("收起")));
  expect(screen.getByText("展开").getAttribute("aria-expanded")).toBe("false");
  expect(onCollapsedChange.mock.calls).toEqual([[false], [true]]);
});
