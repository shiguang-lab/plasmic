import FilterButton from "@/wab/client/components/widgets/FilterButton";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(() => vi.useRealTimers());

it("anchors the tooltip and dropdown on the generated button's native ref", async () => {
  vi.useFakeTimers();
  render(<FilterButton tooltip="Filter hint" popupRender={() => <button>Filter choice</button>} />);
  const button = screen.getByRole("button");
  const rect = vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(200, 300, 40, 24));
  fireEvent.mouseEnter(button);
  await act(async () => { vi.advanceTimersByTime(600); });
  expect(screen.queryByText("Filter hint")).not.toBeNull();
  expect(rect).toHaveBeenCalled();
  rect.mockClear();
  fireEvent.click(button);
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole("button", { name: "Filter choice" })).not.toBeNull();
  expect(rect).toHaveBeenCalled();
  fireEvent.mouseDown(button);
  fireEvent.pointerDown(button);
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole("button", { name: "Filter choice" })).not.toBeNull();
});
