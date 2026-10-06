import type { CustomControlProps } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import {
  TablePaginationControl,
  TableScrollControl,
} from "../src/table-controls";

function props(value: unknown) {
  return { value, updateValue: vi.fn() } as unknown as CustomControlProps<any>;
}
test("pagination controls toggle the actual prop and preserve existing configuration", () => {
  const p = props({
    pageSize: 20,
    current: 3,
    position: ["bottomLeft"],
    showSizeChanger: false,
  });
  const { rerender } = render(<TablePaginationControl {...p} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "可切换每页条数" }));
  expect(p.updateValue).toHaveBeenLastCalledWith({
    ...p.value,
    showSizeChanger: true,
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "显示分页" }));
  expect(p.updateValue).toHaveBeenLastCalledWith(false);
  rerender(<TablePaginationControl {...p} value={false} />);
  expect(screen.queryByRole("spinbutton", { name: "每页条数" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "显示分页" }));
  expect(p.updateValue).toHaveBeenLastCalledWith({});
});
test("scroll controls retain the other dimension and accept CSS widths", () => {
  const p = props({
    x: "max-content",
    y: 400,
    scrollToFirstRowOnChange: false,
  });
  render(<TableScrollControl {...p} />);
  fireEvent.change(screen.getByRole("textbox", { name: "水平滚动宽度" }), {
    target: { value: "1200" },
  });
  expect(p.updateValue).toHaveBeenLastCalledWith({ ...p.value, x: 1200 });
  fireEvent.change(screen.getByRole("textbox", { name: "水平滚动宽度" }), {
    target: { value: "100%" },
  });
  expect(p.updateValue).toHaveBeenLastCalledWith({ ...p.value, x: "100%" });
});

test("page size edits preserve uncontrolled configuration and reject invalid sizes", () => {
  const p = props({ defaultPageSize: 10, position: ["bottomLeft"] });
  render(<TablePaginationControl {...p} />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "每页条数" }), {
    target: { value: "2" },
  });
  expect(p.updateValue).toHaveBeenLastCalledWith({
    ...p.value,
    defaultPageSize: 2,
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "每页条数" }), {
    target: { value: "0" },
  });
  expect(p.updateValue).toHaveBeenCalledOnce();
});
