import {
  SidebarModal,
  SidebarModalProvider,
} from "@/wab/client/components/sidebar/SidebarModal";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

function NestedEditor() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <input aria-label="Variable name" defaultValue="hideCreated" />
      <button onClick={() => setOpen(true)}>Edit value</button>
      <SidebarModal show={open} title="Value editor" onClose={() => setOpen(false)}>
        <input aria-label="Value" defaultValue="false" />
      </SidebarModal>
    </>
  );
}

function Editor() {
  const [open, setOpen] = React.useState(false);
  return (
    <SidebarModalProvider containerSelector="#sidebar">
      <div id="sidebar" style={{ position: "relative", width: 320, height: 500 }}>
        <button onClick={() => setOpen(true)}>Edit variable</button>
      </div>
      <SidebarModal show={open} title="Variable editor" onClose={() => setOpen(false)}>
        <NestedEditor />
      </SidebarModal>
    </SidebarModalProvider>
  );
}

function frameFor(label: string) {
  return ensure(
    screen.getByRole("textbox", { name: label }).closest<HTMLElement>("[aria-hidden]"),
    "Expected a sidebar editor frame",
  );
}

function closeButton(frame: HTMLElement, action: "close" | "back") {
  return ensure(
    frame.querySelector<HTMLElement>(`[data-test-id="${action}-sidebar-modal"]`),
    "Expected the sidebar navigation button",
  );
}

it("fills its sidebar and opens in place on every reopen", async () => {
  render(<Editor />);
  for (let attempt = 0; attempt < 3; attempt++) {
    fireEvent.click(screen.getByText("Edit variable"));
    const frame = frameFor("Variable name");
    expect(frame.style.left).toBe("0%");
    const panel = ensure(frame.closest<HTMLElement>(".panel-popup"), "Expected editor panel");
    expect(panel.parentElement?.parentElement?.parentElement?.id).toBe("sidebar");
    expect(panel.style.inset).toBe("0");
    expect(panel.style.width).toBe("100%");
    expect(panel.style.height).toBe("100%");
    fireEvent.click(closeButton(frame, "close"));
    expect(document.querySelector("#sidebar-modal")).toBeNull();
    // A close must not leave an animation controller that resumes on reopen.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
});

it("keeps the parent form mounted and inert while navigating to a nested editor", async () => {
  render(<Editor />);
  fireEvent.click(screen.getByText("Edit variable"));
  const input = screen.getByRole("textbox", { name: "Variable name" });
  const parent = frameFor("Variable name");
  fireEvent.change(input, { target: { value: "editedName" } });
  fireEvent.click(screen.getByText("Edit value"));
  const child = frameFor("Value");
  expect(parent).toHaveAttribute("inert");
  expect(parent).toHaveAttribute("aria-hidden", "true");
  expect(child).not.toHaveAttribute("inert");
  await waitFor(() => {
    expect(parent.style.left).toBe("-100%");
    expect(child.style.left).toBe("0%");
  });
  fireEvent.click(closeButton(child, "back"));
  await waitFor(() => expect(parent.style.left).toBe("0%"));
  expect(screen.getByRole("textbox", { name: "Variable name" })).toBe(input);
  expect(input).toHaveValue("editedName");
  expect(parent).not.toHaveAttribute("inert");
  expect(parent).toHaveAttribute("aria-hidden", "false");
});
