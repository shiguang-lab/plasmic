import { ListBox, ListBoxItem, Tab, Tabs } from "@/wab/client/components/widgets";
import { fireEvent, render, screen } from "@testing-library/react";
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
