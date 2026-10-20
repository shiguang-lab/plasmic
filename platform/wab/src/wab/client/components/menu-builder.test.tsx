import { TextAndShortcut } from "@/wab/client/components/menu-builder";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

test.each([
  ["command+enter", "⌘Enter"],
  ["ctrl+enter", "Ctrl+Enter"],
  ["l", "L"],
  ["command+shift+z", "⌘⇧Z"],
  ["ctrl+shift+z", "Ctrl+Shift+Z"],
  ["esc", "Esc"],
])(
  "shows readable tooltip keys for %s without keycap styling",
  (combo, label) => {
    const { container } = render(
      <TextAndShortcut variant="tooltip" shortcut={combo}>
        Preview
      </TextAndShortcut>,
    );
    expect(container.textContent).toBe(`Preview${label}`);
    expect(container.querySelector(".shortcut-combo")).toBeNull();
    expect(screen.getByText("Preview")).toBeTruthy();
  },
);

test("keeps keycap presentation for menu shortcuts", () => {
  const { container } = render(
    <TextAndShortcut shortcut="command+enter">Edit</TextAndShortcut>,
  );
  expect(container.querySelector(".shortcut-combo")?.textContent).toBe("⌘+↵");
});
