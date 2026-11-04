import { assert } from "@/wab/shared/common";
import { normalizeError, showError } from "@/wab/client/ErrorNotifications";
import { setLanguagePreference } from "@/wab/client/i18n";
import { UserError } from "@/wab/shared/UserError";
import { HttpError, NetworkError } from "@/wab/shared/ApiErrors/ApiError";
import { act, cleanup, render, screen } from "@testing-library/react";
import { message, notification } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";
import { runInNewContext } from "vm";

beforeEach(() => {
  vi.clearAllMocks();
});

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
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  const notice = vi.spyOn(notification, "open");
  showError(error);
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  const args = open.mock.calls[0][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected a message configuration");
  expect(args.duration).toBe(4);
  args.onClose?.();
  expect(notice).not.toHaveBeenCalled();
});

it("localizes connectivity notices and updates mounted notice content on language changes", async () => {
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  showError(new Error("XHRStatus0Error"));
  const args = open.mock.calls[0][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected a message configuration");
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

it("keeps technical details in the console without a details interaction", () => {
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  const log = vi.spyOn(console, "error").mockReturnValue(undefined);
  const error = new HttpError(503, "RAW:".repeat(2000));
  error.request = { method: "GET", url: "/api/v1/projects" };
  showError(error, { title: "Failed to load projects" });
  const args = open.mock.calls[0][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected message");
  const view = render(<>{args.content}</>);
  expect(view.container.textContent).toBe("Service unavailable");
  expect(screen.queryByRole("button")).toBeNull();
  const record = JSON.parse(log.mock.calls[0][0].slice("Studio operation failed ".length));
  expect(record.message).toBe(error.message);
  expect(record.stack).toBe(error.stack);
  expect(record.request).toEqual(error.request);
  args.onClose?.();
});

it("preserves the name, message and original stack of an exception from another frame", () => {
  const error = runInNewContext('new TypeError("Cannot read table column")') as Error;
  expect(error instanceof Error).toBe(false);
  const normalized = normalizeError(error);
  expect(normalized).toBeInstanceOf(Error);
  expect(normalized.name).toBe("TypeError");
  expect(normalized.message).toBe(error.message);
  expect(normalized.stack).toBe(error.stack);
});
