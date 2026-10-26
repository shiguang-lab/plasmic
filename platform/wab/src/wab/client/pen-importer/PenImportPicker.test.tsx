import { setUiLocale } from "@/wab/client/i18n";
import {
  PenChoicePicker,
  PenFilePicker,
} from "@/wab/client/pen-importer/PenImportPicker";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: vi.fn(),
}));
beforeEach(async () => {
  await setUiLocale("en");
});
afterEach(cleanup);

it("accepts a design/ZIP or a directory including dependency files", () => {
  const select = vi.fn();
  render(<PenFilePicker onSelect={select} onCancel={vi.fn()} />);
  expect(
    screen.getByLabelText("Choose Pen file or ZIP", { selector: "input" }),
  ).toHaveAttribute("accept", ".pen,.zip");
  const folder = screen.getByLabelText("Choose Pen folder", {
    selector: "input",
  });
  expect(folder).toHaveAttribute("webkitdirectory");
  const files = [
    new File(["{}"], "design.pen"),
    new File(["return [];"], "button.js"),
  ];
  fireEvent.change(folder, { target: { files } });
  expect(select).toHaveBeenCalledExactlyOnceWith(files);
});

it("localizes the chooser while preserving original design names and supports cancellation", async () => {
  await setUiLocale("zh-CN");
  const cancel = vi.fn(),
    select = vi.fn();
  render(
    <PenChoicePicker
      choices={[{ id: "a", name: "Original Page" }]}
      kind="canvas"
      onSelect={select}
      onCancel={cancel}
    />,
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName(
    "选择要导入的 Pen 画布",
  );
  expect(
    screen.getByRole("button", { name: "Original Page" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(select).not.toHaveBeenCalled();
});
