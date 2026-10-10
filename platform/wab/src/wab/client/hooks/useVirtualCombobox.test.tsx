import { useVirtualCombobox } from "@/wab/client/hooks/useVirtualCombobox";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { VariableSizeList } from "react-window";

afterEach(cleanup);
it("dispatches repeated keyboard selections when used as an action menu", () => {
  const selected = vi.fn();
  const item = { key: "page-template-project-Page" };
  function Menu() {
    const ref = React.useRef<VariableSizeList>(null);
    const menu = useVirtualCombobox({
      listRef: ref,
      buildItems: () => ({
        items: [item],
        virtualItems: [{ item, itemIndex: 0 }],
      }),
      selectedItem: null,
      alwaysHighlight: true,
      onSelect: selected,
      itemToString: (value) => value?.key ?? "",
    });
    return (
      <div {...menu.getComboboxProps()}>
        <input {...menu.getInputProps({ "aria-label": "Resource search" })} />
        <ul {...menu.getMenuProps()}>
          <li {...menu.getItemProps({ item, index: 0 })}>Template</li>
        </ul>
      </div>
    );
  }
  render(<Menu />);
  const input = screen.getByRole("textbox", { name: "Resource search" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(selected).toHaveBeenCalledWith(item);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(selected).toHaveBeenCalledTimes(2);
});
