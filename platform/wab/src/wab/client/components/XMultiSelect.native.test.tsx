import { XMultiSelect } from "@/wab/client/components/XMultiSelect";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/dom-utils", () => ({ useFocusOnDisplayed: vi.fn() }));
afterEach(cleanup);

it("keeps uncontrolled choices, fixed values and one shared popup viewport", async () => {
  const mounted = render(<XMultiSelect<string> options={["First", "Second"]} defaultSelectedItems={["First"]} fixedValues={["First"]} filterOptions={(options) => options} />);
  const input = screen.getByRole("textbox");
  fireEvent.focus(input);
  const second = await screen.findByText("Second");
  expect(second.closest(".xselect")).toBeTruthy();
  expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(1);
  fireEvent.click(second);
  await waitFor(() => expect(mounted.container.querySelectorAll('[data-test-id="multi-select-value"]')).toHaveLength(2));
  const pills = mounted.container.querySelectorAll('[data-test-id="multi-select-value"]');
  expect(pills[0].querySelector(".dropdown-pill__deleter")).toBeNull();
  fireEvent.mouseDown(pills[1].querySelector(".dropdown-pill__deleter")!);
  expect(mounted.container.querySelectorAll('[data-test-id="multi-select-value"]')).toHaveLength(1);
});

it("publishes controlled selections and reorders without mutating the caller's array", async () => {
  const select = vi.fn(() => true), reorder = vi.fn();
  const selectedItems = ["First", "Second"];
  const props = { selectedItems, options: ["Third"], onSelect: select, onReorder: reorder, filterOptions: (options: string[]) => options };
  const mounted = render(<XMultiSelect {...props} />);
  fireEvent.focus(screen.getByRole("textbox"));
  fireEvent.click(await screen.findByText("Third"));
  expect(select).toHaveBeenCalledWith("Third");
  expect(mounted.container.querySelectorAll('[data-test-id="multi-select-value"]')).toHaveLength(2);
  const pills = mounted.container.querySelectorAll('[data-test-id="multi-select-value"]');
  fireEvent.dragStart(pills[0]); fireEvent.dragEnter(pills[1]); fireEvent.dragEnd(pills[0]);
  expect(reorder).toHaveBeenCalledWith(0, 1);
  expect(selectedItems).toEqual(["First", "Second"]);
});
