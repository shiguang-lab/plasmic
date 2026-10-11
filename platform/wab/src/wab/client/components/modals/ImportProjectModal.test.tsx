import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ImportProjectModal } from "@/wab/client/components/modals/ImportProjectModal";
import { setLanguagePreference } from "@/wab/client/i18n";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";

function renderDialog(onSubmit: (value: string) => void, onCancel = vi.fn()) {
  return render(
    <AntdConfigProvider>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <ImportProjectModal onCancel={onCancel} onSubmit={onSubmit} />
      </ConfigProvider>
    </AntdConfigProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => setLanguagePreference("en"));
});

it("localizes the title, field and footer of the import dialog", async () => {
  act(() => setLanguagePreference("zh-CN"));
  const onCancel = vi.fn();
  const onSubmit = vi.fn();
  renderDialog(onSubmit, onCancel);
  await waitFor(() =>
    expect(screen.getByRole("dialog", { name: "导入项目" })).toBeVisible(),
  );
  expect(
    screen.getByRole("textbox", { name: "项目 ID 或 URL" }),
  ).toHaveAttribute("placeholder", "输入项目 ID 或 URL");
  expect(screen.getByRole("button", { name: /导\s*入/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("rejects blank input and submits a trimmed project URL once with Enter", async () => {
  const onSubmit = vi.fn();
  renderDialog(onSubmit);
  const input = screen.getByRole("textbox", { name: "Project ID or URL" });
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  await waitFor(() =>
    expect(screen.getByText("Please enter a project ID or URL.")).toBeVisible(),
  );
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(input, {
    target: { value: "  https://studio.example.com/projects/abc  " },
  });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      "https://studio.example.com/projects/abc",
    ),
  );
});
