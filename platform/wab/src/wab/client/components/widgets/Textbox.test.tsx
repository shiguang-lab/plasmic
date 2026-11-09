import Textbox from "@/wab/client/components/widgets/Textbox";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("still focuses and selects a delayed-autofocus input while it is mounted", async () => {
  render(<Textbox autoFocus isDelayedFocus selectAllOnFocus defaultValue="Customers" />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  input.blur();
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Customers".length]);
});

it("cancels delayed autofocus when its prompt closes before the timer fires", async () => {
  const { unmount } = render(<Textbox autoFocus isDelayedFocus defaultValue="Retired prompt" />);
  unmount();
  render(<input aria-label="Current input" autoFocus />);
  const current = screen.getByRole("textbox", { name: "Current input" });
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(document.activeElement).toBe(current);
});
