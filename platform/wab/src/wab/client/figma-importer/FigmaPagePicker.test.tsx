import { FigmaPagePicker } from "@/wab/client/figma-importer/FigmaPagePicker";
import { setUiLocale } from "@/wab/client/i18n";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: vi.fn(),
}));
beforeEach(async () => {
  await setUiLocale("en");
});
afterEach(cleanup);

it("shows only original page names and Cancel, and imports immediately on selection", () => {
  const select = vi.fn();
  render(
    <FigmaPagePicker
      pages={[
        { id: "a", name: "桌面设计" },
        { id: "b", name: "Mobile" },
      ]}
      onSelect={select}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName(
    "Select Figma page to import",
  );
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["桌面设计", "Mobile", "Cancel"]);
  fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
  expect(select).toHaveBeenCalledExactlyOnceWith("b");
});

it("cancels without selecting a page and localizes UI without changing page names", async () => {
  const cancel = vi.fn(),
    select = vi.fn();
  render(
    <FigmaPagePicker
      pages={[{ id: "a", name: "Desktop" }]}
      onSelect={select}
      onCancel={cancel}
    />,
  );
  await act(() => setUiLocale("zh-CN"));
  expect(screen.getByRole("dialog")).toHaveAccessibleName(
    "选择要导入的 Figma 页面",
  );
  expect(screen.getByRole("button", { name: "Desktop" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(select).not.toHaveBeenCalled();
});
