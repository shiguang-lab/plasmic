import { assert } from "@/wab/shared/common";
import { normalizeError, showError } from "@/wab/client/ErrorNotifications";
import { showTemporaryInfo } from "@/wab/client/components/quick-modals";
import { setLanguagePreference } from "@/wab/client/i18n";
import { UserError } from "@/wab/shared/UserError";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { message, notification } from "antd";
import copy from "copy-to-clipboard";
import React from "react";
import { mock } from "vitest-mock-extended";
import { runInNewContext } from "vm";

vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryInfo: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("copy-to-clipboard", () => ({ default: vi.fn().mockReturnValue(true) }));

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

it("shows the specific exception and localizes repeat counts without displaying the stack", async () => {
  await act(async () => await setLanguagePreference("zh-CN"));
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  const error = new Error("MyComponent{count}$&: socket error");
  showError(error);
  showError(error);
  const args = open.mock.calls[1][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected a message configuration");
  expect(args.duration).toBe(4);
  render(<>{args.content}</>);
  expect(screen.getByText("意外错误（出现 2 次）")).toBeTruthy();
  expect(screen.getByText("Error: MyComponent{count}$&: socket error")).toBeTruthy();
  expect(screen.getByRole("button", { name: "查看详情" })).toBeTruthy();
  expect(screen.queryByText(error.stack ?? "missing stack")).toBeNull();
  args.onClose?.();
});

it("counts different exceptions separately even when their headings match", () => {
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  showError(new TypeError("Cannot read table column"));
  showError(new Error("Canvas frame has no state"));
  showError(new TypeError("Cannot read table column"));
  const args = open.mock.calls.map(([value]) => {
    assert(value !== null && typeof value === "object" && "content" in value, "Expected a message configuration");
    return value;
  });
  expect(args[0].key).not.toBe(args[1].key);
  expect(args[2].key).toBe(args[0].key);
  render(<>{args[1].content}{args[2].content}</>);
  expect(screen.getByText("Unexpected error (2 occurrences)")).toBeTruthy();
  expect(screen.getByText("Unexpected error")).toBeTruthy();
  args.forEach((value) => value.onClose?.());
});

it.each([
  new Error("STACK:" + " technical error".repeat(2000)),
  new UserError("A very long title ".repeat(200), "DETAIL:".repeat(2000)),
])("keeps the toast brief and exposes the complete exception and description in details", async (error) => {
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  const log = vi.spyOn(console, "error").mockReturnValue(undefined);
  showError(error, { title: "Operation failed", description: "RAW:".repeat(2000) });
  const args = open.mock.calls[0][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected a message configuration");
  const toast = render(<>{args.content}</>);
  expect(screen.getByText("Operation failed")).toBeTruthy();
  expect(toast.container.textContent?.length).toBeLessThan(400);
  expect(toast.container.textContent).not.toContain("RAW:");
  expect(log).toHaveBeenCalledWith("Studio operation failed", expect.objectContaining({ error, description: "RAW:".repeat(2000) }));
  fireEvent.click(screen.getByRole("button", { name: "View details" }));
  await waitFor(() => expect(showTemporaryInfo).toHaveBeenCalledOnce());
  const modal = vi.mocked(showTemporaryInfo).mock.calls[0][0];
  toast.unmount();
  const { container } = render(<>{modal.title}{modal.content}</>);
  const details = container.querySelector("pre");
  expect(details?.textContent).toContain(error.message);
  expect(details?.textContent).toContain(error.stack);
  expect(details?.textContent).toContain("RAW:".repeat(2000));
  if (error instanceof UserError) {
    expect(details?.textContent).toContain(error.description);
  }
  fireEvent.click(screen.getByRole("button", { name: "Copy details" }));
  expect(copy).toHaveBeenCalledWith(details?.textContent);
  expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
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

it("keeps the actual details dialog open after the toast disappears and closes it normally", async () => {
  vi.mocked(showTemporaryInfo).mockImplementationOnce(async (opts) => {
    const actual = await vi.importActual<typeof import("@/wab/client/components/quick-modals")>("@/wab/client/components/quick-modals");
    return actual.showTemporaryInfo(opts);
  });
  const open = vi.spyOn(message, "error").mockReturnValue(mock());
  showError(new TypeError("Cannot read table column"));
  const args = open.mock.calls[0][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected a message configuration");
  const toast = render(<>{args.content}</>);
  fireEvent.click(screen.getByRole("button", { name: "View details" }));
  await screen.findByRole("dialog", { name: "Error details" });
  toast.unmount();
  expect(screen.getByRole("dialog", { name: "Error details" }).textContent).toContain("TypeError: Cannot read table column");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  args.onClose?.();
});
