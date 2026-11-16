import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import { ListBox, ListBoxItem, Tab, Tabs } from "@/wab/client/components/widgets";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

it("switches native uncontrolled tabs and reports controlled selections", () => {
  const tabs = [
    new Tab({ key: "first", name: "First", contents: () => <span>First content</span> }),
    new Tab({ key: "second", name: "Second", contents: () => <span>Second content</span> }),
  ];
  const onSwitch = vi.fn();
  const mounted = render(<Tabs tabs={tabs} defaultTabKey="first" onSwitch={onSwitch} />);
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  expect(screen.getByText("Second content")).toBeTruthy();
  expect(screen.queryByText("First content")).toBeNull();
  expect(onSwitch).toHaveBeenLastCalledWith("second");
  mounted.rerender(<Tabs tabs={tabs} tabKey="first" onSwitch={onSwitch} />);
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  expect(screen.getByText("First content")).toBeTruthy();
  expect(screen.queryByText("Second content")).toBeNull();
  mounted.unmount();
});

it("preserves a forced tab's native state while it is hidden", () => {
  function Counter() {
    const [value, setValue] = React.useState(0);
    return <button onClick={() => setValue((before) => before + 1)}>Count {value}</button>;
  }
  const tabs = [
    new Tab({ key: "first", name: "First", contents: () => <Counter /> }),
    new Tab({ key: "second", name: "Second", contents: () => <span>Second content</span> }),
  ];
  const mounted = render(<Tabs tabs={tabs} defaultTabKey="first" forceRender />);
  const counter = screen.getByRole("button", { name: "Count 0" });
  fireEvent.click(counter);
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  fireEvent.click(screen.getByRole("tab", { name: "First" }));
  expect(screen.getByRole("button", { name: "Count 1" })).toBe(counter);
  mounted.unmount();
});

it("keeps the native draggable row identity while its visible content updates", () => {
  const onClick = vi.fn();
  const contents = (caption: string) => <React.StrictMode><ListBox><ListBoxItem index={0} mainContent={caption} onClick={onClick} showDelete={false} /></ListBox></React.StrictMode>;
  const mounted = render(contents("First"));
  const row = mounted.container.querySelector("[data-rfd-draggable-id]");
  expect(row).not.toBeNull();
  const identity = row?.getAttribute("data-rfd-draggable-id");
  mounted.rerender(contents("Updated"));
  expect(mounted.container.querySelector("[data-rfd-draggable-id]")).toBe(row);
  expect(row?.getAttribute("data-rfd-draggable-id")).toBe(identity);
  fireEvent.click(screen.getByText("Updated"));
  expect(onClick).toHaveBeenCalledOnce();
  mounted.unmount();
});

it("uses the minus action to remove a list item independently of its edit action", () => {
  const onClick = vi.fn();
  const onRemove = vi.fn();
  const mounted = render(
    <ListBox>
      <ListBoxItem index={0} mainContent="Item" onClick={onClick} onRemove={onRemove} />
    </ListBox>,
  );
  const remove = screen.getByRole("button", { name: "Remove" });
  const icon = render(<MinusIcon />);
  expect(remove.querySelector("path")?.getAttribute("d")).toBe(
    icon.container.querySelector("path")?.getAttribute("d"),
  );
  fireEvent.keyDown(remove, { key: "Enter" });
  fireEvent.click(remove);
  expect(onRemove).toHaveBeenCalledOnce();
  expect(onClick).not.toHaveBeenCalled();
  icon.unmount();
  mounted.unmount();
});


it("shows the grip for a single item and reorders multiple items", async () => {
  const onReorder = vi.fn();
  const list = (labels: string[]) => (
    <ListBox onReorder={onReorder}>
      {labels.map((label, index) => (
        <ListBoxItem
          key={label}
          index={index}
          mainContent={label}
          isDragDisabled={labels.length < 2}
          showDelete={false}
        />
      ))}
    </ListBox>
  );
  const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.textContent === "Second" ? 30 : 0;
    const height = this.classList.contains("list-box") ? 60 : 30;
    return new DOMRect(0, top, 200, height);
  });
  const mounted = render(list(["First"]));
  try {
    const handleSelector = '[data-test-id="drag-handle"]';
    const grip = mounted.container.querySelector(handleSelector);
    expect(grip?.getAttribute("data-disabled")).toBe("true");
    expect(grip?.closest("[data-rfd-drag-handle-draggable-id]")).toBeNull();

    mounted.rerender(list(["First", "Second"]));
    expect(mounted.container.querySelectorAll(handleSelector)).toHaveLength(2);
    const handle = screen.getAllByRole("button")[0];
    expect(handle.contains(grip)).toBe(true);
    expect(grip?.hasAttribute("data-disabled")).toBe(false);
    handle.focus();
    const space = { key: " ", code: "Space", keyCode: 32 };
    fireEvent.keyDown(handle, space);
    await waitFor(() => expect(document.querySelector('[aria-live="assertive"]')?.textContent).toContain("lifted"));
    fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    fireEvent.keyDown(window, space);

    const draggableId = handle.getAttribute("data-rfd-draggable-id");
    const dragging = document.querySelector(`[data-rfd-draggable-id="${draggableId}"]`);
    if (dragging) {
      const end = new Event("transitionend", { bubbles: true });
      Object.defineProperty(end, "propertyName", { value: "transform" });
      fireEvent(dragging, end);
    }
    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(0, 1));
  } finally {
    mounted.unmount();
    bounds.mockRestore();
  }
});
