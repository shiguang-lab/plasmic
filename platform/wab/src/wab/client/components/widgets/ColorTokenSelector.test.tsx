import { ColorTokenSelector } from "@/wab/client/components/widgets/ColorTokenSelector";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

beforeEach(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders the complete palette and restores it after selecting a search result", () => {
  const onSelect = vi.fn();
  const rows = Array.from({ length: 100 }, (_, index) => ({
    id: String(index),
    name: `Color ${index}`,
    color: "#123456",
    selected: index === 90,
    onSelect: () => onSelect(index),
  }));
  render(
    <ColorTokenSelector rows={rows} onAddToken={() => undefined} maxRows={3} />,
  );
  expect(screen.getAllByRole("button", { name: /Color [0-9]/ })).toHaveLength(
    100,
  );
  expect(
    screen
      .getByRole("button", { name: "Color 90 (#123456)" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.change(screen.getByPlaceholderText("Search for token"), {
    target: { value: "Color 90" },
  });
  fireEvent.click(screen.getByRole("option", { name: /Color 90/ }));
  expect(onSelect).toHaveBeenCalledWith(90);
  expect(screen.getAllByRole("button", { name: /Color [0-9]/ })).toHaveLength(
    100,
  );
});


it("selects a filtered token with the keyboard and clears the shared search input", () => {
  const onSelect = vi.fn();
  render(<ColorTokenSelector rows={[
    { id: "red", name: "Red", color: "#ff0000", selected: false, onSelect },
    { id: "blue", name: "Blue", color: "#0000ff", selected: false, onSelect: () => undefined },
  ]} onAddToken={() => undefined} />);
  const input = screen.getByRole("textbox", { name: "Search for token" });
  fireEvent.change(input, { target: { value: "Red" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledOnce();
  expect((input as HTMLInputElement).value).toBe("");
  fireEvent.change(input, { target: { value: "Blue" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect((input as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "Red (#ff0000)" })).toBeTruthy();
});
