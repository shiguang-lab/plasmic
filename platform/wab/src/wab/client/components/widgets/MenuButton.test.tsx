import MenuButton from "@/wab/client/components/widgets/MenuButton";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Menu } from "antd";
import React from "react";

afterEach(cleanup);

describe("MenuButton", () => {
  it("cancels the click, so an enclosing link does not navigate", async () => {
    render(
      <a href="/projects/foo">
        <MenuButton
          menu={<Menu items={[{ key: "configure", label: "Configure" }]} />}
        />
      </a>,
    );
    // fireEvent returns false when the event was canceled; antd's click
    // trigger no longer calls preventDefault itself.
    expect(fireEvent.click(screen.getByRole("button"))).toBe(false);
    expect(await screen.findByText("Configure")).toBeTruthy();
  });

  it("opens a node menu without selecting its row and runs the chosen action", async () => {
    const selectRow = vi.fn();
    const rename = vi.fn();
    const visibility = vi.fn();
    render(
      <div onClick={selectRow}>
        <MenuButton
          aria-label="Layer menu"
          onVisibleChange={visibility}
          menu={() => (
            <Menu
              items={[
                { key: "rename", label: "Rename layer", onClick: rename },
              ]}
            />
          )}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Layer menu" }));
    expect(
      await screen.findByRole("menuitem", { name: "Rename layer" }),
    ).toBeTruthy();
    expect(selectRow).not.toHaveBeenCalled();
    expect(visibility).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename layer" }));
    expect(rename).toHaveBeenCalledTimes(1);
    expect(selectRow).not.toHaveBeenCalled();
    await waitFor(() => expect(visibility).toHaveBeenLastCalledWith(false));
  });

  it("calls a supplied context menu handler without bubbling to its row", () => {
    const selectRow = vi.fn();
    const contextMenu = vi.fn();
    render(
      <div onClick={selectRow}>
        <MenuButton onContextMenu={contextMenu} />
      </div>,
    );
    expect(fireEvent.click(screen.getByRole("button"))).toBe(false);
    expect(contextMenu).toHaveBeenCalledTimes(1);
    expect(selectRow).not.toHaveBeenCalled();
  });
});
