import { showError } from "@/wab/client/ErrorNotifications";
import { setLanguagePreference } from "@/wab/client/i18n";
import { act, cleanup, render, screen } from "@testing-library/react";
import { notification } from "antd";
import React from "react";

afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
});

it("localizes connectivity notices and updates mounted notice content on language changes", async () => {
  const open = vi
    .spyOn(notification, "open")
    .mockImplementation(() => undefined);
  showError(new Error("XHRStatus0Error"));
  const args = open.mock.calls[0][0];
  render(
    <>
      <div data-testid="message">{args.message}</div>
      <div data-testid="description">{args.description}</div>
    </>,
  );
  expect(screen.getByTestId("message").textContent).toBe(
    "Temporarily disconnected",
  );
  await act(async () => await setLanguagePreference("zh-CN"));
  expect(screen.getByText("连接暂时中断")).toBeTruthy();
  expect(
    screen.getByText(
      "浏览器与 Plasmic 的连接已中断，保存已暂停，连接恢复后将继续保存。",
    ),
  ).toBeTruthy();
  args.onClose?.();
});

it("localizes repeat counts while preserving raw technical error details", async () => {
  await act(async () => await setLanguagePreference("zh-CN"));
  const open = vi
    .spyOn(notification, "open")
    .mockImplementation(() => undefined);
  const error = new Error("MyComponent{count}$&: socket error");
  showError(error);
  showError(error);
  const args = open.mock.calls[1][0];
  render(
    <>
      <div data-testid="message">{args.message}</div>
      <div data-testid="description">{args.description}</div>
    </>,
  );
  expect(screen.getByTestId("message").textContent).toBe(
    "意外错误（出现 2 次）",
  );
  expect(
    screen.getByText("Error: MyComponent{count}$&: socket error"),
  ).toBeTruthy();
  args.onClose?.();
});
