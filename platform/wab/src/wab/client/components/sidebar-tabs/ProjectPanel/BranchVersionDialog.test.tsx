import { BranchVersionDialog } from "@/wab/client/components/sidebar-tabs/ProjectPanel/BranchVersionDialog";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: vi.fn(),
}));
vi.mock("@/wab/client/i18n", async () => {
  const { default: messages } =
    await import("@/wab/client/i18n/locales/zh-CN.json");
  return {
    useI18n: () => ({
      t: (key: string) => (messages as Record<string, string>)[key] ?? key,
    }),
  };
});
afterEach(cleanup);

test("first-version dialog explains auto-save and offers only save or cancel", () => {
  const save = vi.fn();
  render(
    <BranchVersionDialog
      hasSavedVersion={false}
      onSaveVersion={save}
      onUseLastVersion={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByText("新建分支前保存版本")).toBeTruthy();
  expect(screen.getByText(/“已保存”表示编辑内容已自动保存/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "使用上一版本" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "前往保存版本" }));
  expect(save).toHaveBeenCalledOnce();
});

test("using the old version and cancelling are separate actions", () => {
  const useLast = vi.fn();
  const cancel = vi.fn();
  render(
    <BranchVersionDialog
      hasSavedVersion
      onSaveVersion={vi.fn()}
      onUseLastVersion={useLast}
      onCancel={cancel}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(useLast).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "使用上一版本" }));
  expect(useLast).toHaveBeenCalledOnce();
});
