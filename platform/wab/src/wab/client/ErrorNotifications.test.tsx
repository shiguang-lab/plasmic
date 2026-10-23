import { showError } from "@/wab/client/ErrorNotifications";
import { setLanguagePreference } from "@/wab/client/i18n";
import { UserError } from "@/wab/shared/UserError";
import { act, cleanup, render, screen } from "@testing-library/react";
import { message, notification } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
  vi.restoreAllMocks();
});

it.each([
  new UserError(
    "Action cannot be completed",
    "Check the submitted values and try again.",
  ),
  new Error("Technical failure"),
])("shows %s using the default message behavior", (error) => {
  const open = vi.spyOn(message, "open").mockReturnValue(mock());
  const notice = vi.spyOn(notification, "open");
  showError(error);
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  expect(open.mock.calls[0][0].duration).toBe(4);
  open.mock.calls[0][0].onClose?.();
  expect(notice).not.toHaveBeenCalled();
});

it("localizes connectivity notices and updates mounted notice content on language changes", async () => {
  const open = vi.spyOn(message, "open").mockReturnValue(mock());
  showError(new Error("XHRStatus0Error"));
  const args = open.mock.calls[0][0];
  render(<>{args.content}</>);
  expect(screen.getByText("Temporarily disconnected")).toBeTruthy();
  await act(async () => await setLanguagePreference("zh-CN"));
  expect(screen.getByText("连接暂时中断")).toBeTruthy();
  expect(
    screen.queryByText(
      "浏览器与 Plasmic 的连接已中断，保存已暂停，连接恢复后将继续保存。",
    ),
  ).toBeNull();
  args.onClose?.();
});

it("localizes repeat counts without displaying raw technical details", async () => {
  await act(async () => await setLanguagePreference("zh-CN"));
  const open = vi.spyOn(message, "open").mockReturnValue(mock());
  const error = new Error("MyComponent{count}$&: socket error");
  showError(error);
  showError(error);
  const args = open.mock.calls[1][0];
  expect(args.duration).toBe(4);
  render(<>{args.content}</>);
  expect(screen.getByText("意外错误（出现 2 次）")).toBeTruthy();
  expect(
    screen.queryByText("Error: MyComponent{count}$&: socket error"),
  ).toBeNull();
  args.onClose?.();
});

it.each([
  new Error("STACK:" + " technical error".repeat(2000)),
  new UserError("A very long title ".repeat(200), "DETAIL:".repeat(2000)),
])("keeps long exceptions and descriptions in diagnostics instead of the toast", (error) => {
  const open = vi.spyOn(message, "open").mockReturnValue(mock());
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  showError(error, { title: "Operation failed", description: "RAW:".repeat(2000) });
  const args = open.mock.calls[0][0];
  const { container } = render(<>{args.content}</>);
  expect(container.textContent).toBe("Operation failed");
  expect(log).toHaveBeenCalledWith("Studio operation failed", expect.objectContaining({ error, description: "RAW:".repeat(2000) }));
  args.onClose?.();
});
