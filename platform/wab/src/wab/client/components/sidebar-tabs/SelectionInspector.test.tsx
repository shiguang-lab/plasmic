import { SelectionInspector } from "@/wab/client/components/sidebar-tabs/SelectionInspector";
import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { createPortal } from "react-dom";

it("removes pending controls and mounts only the latest target", () => {
  const edit = vi.fn();
  const mounted = vi.fn();
  function Controls({ target }: { target: string }) {
    React.useEffect(() => {
      mounted(target);
    }, []);
    return createPortal(
      <button onClick={() => edit(target)}>{target}</button>,
      document.body,
    );
  }
  const panel = (pending: boolean, target: string) => (
    <SelectionInspector pending={pending}>
      <Controls key={target} target={target} />
    </SelectionInspector>
  );
  const { rerender } = render(panel(false, "first"));
  const first = screen.getByRole("button", { name: "first" });
  rerender(panel(true, "second"));
  expect(screen.queryByRole("button", { name: "first" })).toBeNull();
  fireEvent.click(first);
  expect(edit).not.toHaveBeenCalled();
  rerender(panel(true, "latest"));
  expect(mounted).toHaveBeenCalledExactlyOnceWith("first");
  rerender(panel(false, "latest"));
  fireEvent.click(screen.getByRole("button", { name: "latest" }));
  expect(edit).toHaveBeenCalledExactlyOnceWith("latest");
  expect(screen.queryByRole("button", { name: "second" })).toBeNull();
});

it("keeps sidebar portal siblings inert and restores the shell after unmount", () => {
  const { container, unmount } = render(
    <div className="style-tab">
      <div>Sidebar popup</div>
      <SelectionInspector pending>
        <button>Not ready</button>
      </SelectionInspector>
    </div>,
  );
  const root = container.querySelector<HTMLElement>(".style-tab");
  expect(root?.inert).toBe(true);
  expect(screen.queryByRole("button")).toBeNull();
  unmount();
  expect(root?.inert).toBe(false);
});
