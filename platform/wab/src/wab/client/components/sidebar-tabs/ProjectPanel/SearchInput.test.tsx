import SearchInput from "@/wab/client/components/sidebar-tabs/ProjectPanel/SearchInput";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

it("clears Escape search without triggering canvas cancellation, then lets empty Escape reach navigation", () => {
  const onClear = vi.fn();
  const onCanvasKeyDown = vi.fn();
  const onNavigationKeyDown = vi.fn();
  render(
    <div onKeyDown={onCanvasKeyDown}>
      <SearchInput
        onClear={onClear}
        searchInput={{ onKeyDown: onNavigationKeyDown }}
      />
    </div>,
  );
  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Page2" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input.value).toBe("");
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(onNavigationKeyDown).toHaveBeenCalledTimes(1);
  expect(onCanvasKeyDown).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(onNavigationKeyDown).toHaveBeenCalledTimes(2);
  expect(onCanvasKeyDown).toHaveBeenCalledTimes(1);
});
