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
  fireEvent.click(screen.getByRole("checkbox", { name: "Show size changer" }));
  expect(p.updateValue).toHaveBeenLastCalledWith({
    ...p.value,
    showSizeChanger: true,
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Show pagination" }));
  expect(p.updateValue).toHaveBeenLastCalledWith(false);
  rerender(<TablePaginationControl {...p} value={false} />);
  expect(screen.queryByRole("spinbutton", { name: "Page size" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show pagination" }));
  expect(p.updateValue).toHaveBeenLastCalledWith({});
});
test("scroll controls retain the other dimension and accept CSS widths", () => {
  const p = props({
    x: "max-content",
    y: 400,
    scrollToFirstRowOnChange: false,
  });
  render(<TableScrollControl {...p} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Horizontal scroll width" }), {
    target: { value: "1200" },
  });
  expect(p.updateValue).toHaveBeenLastCalledWith({ ...p.value, x: 1200 });
  fireEvent.change(screen.getByRole("textbox", { name: "Horizontal scroll width" }), {
    target: { value: "100%" },
  });
  expect(p.updateValue).toHaveBeenLastCalledWith({ ...p.value, x: "100%" });
});

test("page size edits preserve uncontrolled configuration and reject invalid sizes", () => {
  const p = props({ defaultPageSize: 10, position: ["bottomLeft"] });
  render(<TablePaginationControl {...p} />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Page size" }), {
    target: { value: "2" },
  });
  expect(p.updateValue).toHaveBeenLastCalledWith({
    ...p.value,
    defaultPageSize: 2,
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Page size" }), {
    target: { value: "0" },
  });
  expect(p.updateValue).toHaveBeenCalledOnce();
});
