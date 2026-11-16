import CardPickerModal from "@/wab/client/components/sidebar-tabs/ComponentProps/CardPickerModal";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps card search controlled, forwards Enter, and clears on Escape", () => {
  const onKeyDown = vi.fn();
  const onChange = vi.fn();
  function Picker() {
    const [query, setQuery] = React.useState("");
    return <CardPickerModal showInput searchValue={query}
      onKeyDown={onKeyDown}
      onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); }} />;
  }
  render(<Picker />);
  const input = screen.getByRole("textbox", { name: "Search..." });
  fireEvent.change(input, { target: { value: "Card" } });
  expect(input).toHaveProperty("value", "Card");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onKeyDown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "Enter" }));
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveProperty("value", "");
  expect(onChange).toHaveBeenLastCalledWith("");
});
