import { ComponentFolderRow, type ComponentFolder } from "@/wab/client/components/sidebar/ComponentFolderRow";
import type { RowGroupProps } from "@/wab/client/components/RowGroup";
import { Matcher } from "@/wab/client/components/view-common";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/RowGroup", () => ({ default: ({ style, children, menu, groupSize, isOpen }: RowGroupProps) => <section data-testid="folder" data-count={groupSize} data-open={String(isOpen)} style={style}>{typeof menu === "function" ? menu() : menu}{children}</section> }));
afterEach(cleanup);

function folder(name = "Controls"): ComponentFolder {
  return { type: "folder", name, key: "controls", count: 2, items: [], path: "Controls", actions: { onAddComponent: vi.fn().mockResolvedValue(undefined), onDeleteFolder: vi.fn().mockResolvedValue(undefined), onFolderRenamed: vi.fn().mockResolvedValue(undefined) } };
}

it("renders new folder DTOs and keeps add/delete commands on the current props", async () => {
  const initial = folder();
  const expand = vi.fn();
  const view = render(<ComponentFolderRow folder={initial} matcher={new Matcher("")} indentMultiplier={1} isOpen={false} toggleExpand={expand} />);
  expect(screen.getByText("Controls")).toBeTruthy();
  expect(screen.getByTestId("folder").getAttribute("data-count")).toBe("2");
  expect(screen.getByTestId("folder").style.paddingLeft).toBe("22px");
  fireEvent.click(screen.getByRole("menuitem", { name: "Add component" }));
  await waitFor(() => expect(initial.actions.onAddComponent).toHaveBeenCalledWith("Controls"));
  expect(expand).toHaveBeenCalledOnce();
  expand.mockClear();
  const next = { ...initial, name: "Fields", path: "Fields", count: 4 };
  view.rerender(<ComponentFolderRow folder={next} matcher={new Matcher("")} indentMultiplier={2} isOpen={true} toggleExpand={expand} />);
  expect(screen.getByText("Fields")).toBeTruthy();
  expect(screen.queryByText("Controls")).toBeNull();
  expect(screen.getByTestId("folder").getAttribute("data-count")).toBe("4");
  expect(screen.getByTestId("folder").style.paddingLeft).toBe("38px");
  fireEvent.click(screen.getByRole("menuitem", { name: "Add component" }));
  await waitFor(() => expect(initial.actions.onAddComponent).toHaveBeenLastCalledWith("Fields"));
  expect(expand).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete Folder" }));
  expect(initial.actions.onDeleteFolder).toHaveBeenCalledWith(next);
});

it("preserves the real editable-label rename command and displays the consuming parent's update", async () => {
  const value = folder();
  const expand = vi.fn();
  const view = render(<ComponentFolderRow folder={value} matcher={new Matcher("")} indentMultiplier={0} isOpen={false} toggleExpand={expand} />);
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename Folder" }));
  const input = await screen.findByRole("textbox");
  fireEvent.change(input, { target: { value: "Renamed folder" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(value.actions.onFolderRenamed).toHaveBeenCalledWith(value, "Renamed folder"));
  view.rerender(<ComponentFolderRow folder={{ ...value, name: "Renamed folder" }} matcher={new Matcher("")} indentMultiplier={0} isOpen={false} toggleExpand={expand} />);
  expect(await screen.findByText("Renamed folder")).toBeTruthy();
  expect(expand).not.toHaveBeenCalled();
});
