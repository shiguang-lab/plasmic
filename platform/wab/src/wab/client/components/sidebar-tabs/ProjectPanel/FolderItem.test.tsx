import FolderItem from "@/wab/client/components/sidebar-tabs/ProjectPanel/FolderItem";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

function renderFolderItem(
  props: Partial<React.ComponentPropsWithRef<typeof FolderItem>> = {},
) {
  return render(
    <FolderItem
      name="Folder"
      cleanName="Old name"
      style={{}}
      onRename={vi.fn()}
      isSelected={false}
      renaming={false}
      menu={vi.fn(() => <div />)}
      tooltipActions={null}
      {...props}
    />,
  );
}

it("forwards the root ref, invokes rename from the controlled editor, and leaves the menu lazy", async () => {
  const ref = React.createRef<HTMLLIElement>();
  const onRename = vi.fn();
  const menu = vi.fn(() => <div />);
  const { container, rerender } = renderFolderItem({ ref, onRename, menu });

  expect(ref.current).toBe(container.firstElementChild);
  expect(menu).not.toHaveBeenCalled();

  rerender(
    <FolderItem
      ref={ref}
      name="Folder"
      cleanName="Old name"
      style={{}}
      onRename={onRename}
      isSelected={false}
      renaming
      menu={menu}
      tooltipActions={null}
    />,
  );
  const input = await screen.findByDisplayValue("Old name");
  fireEvent.change(input, { target: { value: "New name" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onRename).toHaveBeenCalledWith("New name");
  expect(menu).not.toHaveBeenCalled();
});
