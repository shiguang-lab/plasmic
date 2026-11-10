import {
  PopoverFrame,
  PopoverFrameProvider,
} from "@/wab/client/components/sidebar/PopoverFrame";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

afterEach(cleanup);

function NestedEditor() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit nested value</button>
      <PopoverFrame
        show={open}
        title="Nested editor"
        valuePath={["value", "nested"]}
        onClose={() => setOpen(false)}
      >
        <input aria-label="Nested value" defaultValue="false" />
      </PopoverFrame>
    </>
  );
}

function Editor(props: { children?: React.ReactNode; onClose?: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <AntdConfigProvider productUI>
    <PopoverFrameProvider containerSelector="#sidebar">
      <div
        id="sidebar"
        style={{ position: "relative", width: 320, height: 500 }}
      >
        <button onClick={() => setOpen(true)}>Edit value</button>
        {props.children}
      </div>
      <PopoverFrame
        show={open}
        title="Value editor"
        valuePath={["value"]}
        onClose={() => {
          setOpen(false);
          props.onClose?.();
        }}
      >
        <input aria-label="Value" defaultValue="edited" />
      </PopoverFrame>
    </PopoverFrameProvider>
    </AntdConfigProvider>
  );
}

function popoverPanel() {
  return ensure(
    document.querySelector<HTMLElement>("#props-popover"),
    "Expected the props popover",
  );
}

it("escapes the sidebar clipping container and closes on Escape", async () => {
  const onClose = vi.fn();
  render(<Editor onClose={onClose} />);
  fireEvent.click(screen.getByText("Edit value"));
  const input = await screen.findByRole("textbox", { name: "Value" });
  expect(popoverPanel().closest("#sidebar")).toBeNull();
  expect(document.body).toContainElement(popoverPanel());

  fireEvent.keyDown(input, { key: "Escape" });

  await waitFor(() => {
    expect(document.querySelector("#props-popover")).toBeNull();
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("keeps the parent popover mounted when navigating to a nested popover", async () => {
  render(
    <Editor>
      <NestedEditor />
    </Editor>,
  );
  fireEvent.click(screen.getByText("Edit value"));
  const parentInput = await screen.findByRole("textbox", { name: "Value" });
  fireEvent.change(parentInput, { target: { value: "editedName" } });
  fireEvent.click(screen.getByText("Edit nested value"));
  await screen.findByRole("textbox", { name: "Nested value" });

  const back = ensure(
    popoverPanel().querySelector<HTMLElement>(
      '[data-test-id="back-popover-frame"]',
    ),
    "Expected the back button for the nested popover",
  );
  expect(screen.getByRole("textbox", { name: "Value" })).toBe(parentInput);
  expect(parentInput).toHaveValue("editedName");

  fireEvent.click(back);

  await waitFor(() => {
    expect(
      screen.queryByRole("textbox", { name: "Nested value" }),
    ).not.toBeInTheDocument();
  });
  expect(screen.getByRole("textbox", { name: "Value" })).toBe(parentInput);
  expect(parentInput).toHaveValue("editedName");
  expect(
    popoverPanel().querySelector('[data-test-id="back-popover-frame"]'),
  ).toBeNull();
});
