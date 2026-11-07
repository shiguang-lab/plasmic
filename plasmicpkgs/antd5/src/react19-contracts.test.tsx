// @vitest-environment jsdom
import "../../antd6/tests/setup";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, it, vi } from "vitest";
import { AntdDropdown } from "./registerDropdown";
import { AntdDatePicker } from "./registerDatePicker";
import { AntdModal } from "./registerModal";
import { AntdDrawer } from "./registerDrawer";

it("keeps dropdown JSON action keys after migrating overlay to popupRender", async () => {
  const action = vi.fn();
  render(<AntdDropdown open onAction={action} menuItemsJson={[{ key: "saved-action", label: "Save item" }]}><button>Actions</button></AntdDropdown>);
  fireEvent.click(await screen.findByText("Save item"));
  expect(action).toHaveBeenCalledExactlyOnceWith("saved-action");
});

it("keeps single-date defaults and emits null on clearing", () => {
  const changed = vi.fn();
  const { container } = render(<AntdDatePicker defaultValue="2026-03-14T12:00:00.000Z" onChange={changed} />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("2026-03-14");
  const clear = container.querySelector(".ant-picker-clear");
  expect(clear).toBeTruthy();
  fireEvent.mouseDown(clear!);
  fireEvent.click(clear!);
  expect(changed).toHaveBeenCalledExactlyOnceWith(null);
});

it("keeps Modal cancellation and registered open-state updates", async () => {
  const cancel = vi.fn(), open = vi.fn();
  render(<AntdModal open modalScopeClassName="saved-modal" wrapClassName="" onOpenChange={open} onCancel={cancel}>Modal content</AntdModal>);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(open).toHaveBeenCalledExactlyOnceWith(false);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(cancel.mock.calls[0][0].type).toBe("click");
});

it("keeps Drawer closing and registered open-state updates", async () => {
  const close = vi.fn(), open = vi.fn();
  render(<AntdDrawer open onOpenChange={open} onClose={close}>Drawer content</AntdDrawer>);
  fireEvent.click(await screen.findByRole("button", { name: "Close" }));
  expect(open).toHaveBeenCalledExactlyOnceWith(false);
  expect(close).toHaveBeenCalledTimes(1);
  expect(close.mock.calls[0][0].type).toBe("click");
});
