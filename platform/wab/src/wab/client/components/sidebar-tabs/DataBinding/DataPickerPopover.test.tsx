import { DataPickerPopover } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerPopover";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

const captured = vi.hoisted(() => ({
  props: undefined as Record<string, unknown> | undefined,
}));

vi.mock("antd", async (original) => ({
  ...(await original<typeof import("antd")>()),
  Popover: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div>{props.children as React.ReactNode}</div>;
  },
}));

afterEach(() => {
  cleanup();
  captured.props = undefined;
  document
    .querySelectorAll("[data-data-picker-popover-host]")
    .forEach((node) => node.remove());
});

it("defaults placement to left and mounts popups into a reusable fixed host", () => {
  render(
    <DataPickerPopover content={<span>Picker</span>} open={false}>
      <button type="button">Edit binding</button>
    </DataPickerPopover>,
  );
  const trigger = screen.getByRole("button", { name: "Edit binding" });
  expect(captured.props?.placement).toBe("left");
  expect(captured.props?.arrow).toBe(false);
  expect(captured.props?.destroyOnHidden).toBe(true);
  expect(captured.props?.overlayClassName).toBe("data-picker-popover-overlay");

  const getPopupContainer = captured.props?.getPopupContainer as
    | ((el: HTMLElement) => HTMLElement)
    | undefined;
  const hostA = getPopupContainer?.(trigger);
  const hostB = getPopupContainer?.(trigger);
  expect(hostA).toBeTruthy();
  expect(hostA).toBe(hostB);
  expect(hostA?.className).toBe("data-picker-popover-host");
  expect(hostA?.parentElement).toBe(document.body);
});

it("allows overriding placement, getPopupContainer, and merging overlayClassName", () => {
  const customContainer = document.createElement("div");
  render(
    <DataPickerPopover
      content={<span>Picker</span>}
      placement="bottomLeft"
      getPopupContainer={() => customContainer}
      overlayClassName="custom-picker"
      open={false}
    >
      <button type="button">Trigger</button>
    </DataPickerPopover>,
  );
  expect(captured.props?.placement).toBe("bottomLeft");
  expect(captured.props?.overlayClassName).toBe(
    "data-picker-popover-overlay custom-picker",
  );
  const getPopupContainer = captured.props?.getPopupContainer as
    | ((el: HTMLElement) => HTMLElement)
    | undefined;
  expect(getPopupContainer?.(document.body)).toBe(customContainer);
});
