import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ActionGroup } from "../src/registerActionGroup";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

const deletion = {
  key: "delete", label: "删除", danger: true,
  confirm: { title: "删除初始化客群", description: "到期用户召回：删除后无法恢复。", okText: "删除" },
};

test("行操作在确认之前和取消之后都不触发业务事件", async () => {
  const onAction = vi.fn();
  render(<ActionGroup items={[deletion]} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  expect(within(popover).getByText(deletion.confirm.description)).toBeTruthy();
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(within(popover).getByRole("button", { name: /取\s*消/ }));
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const reopened = await screen.findByRole("tooltip");
  fireEvent.click(within(reopened).getByRole("button", { name: /删\s*除/ }));
  expect(onAction).toHaveBeenCalledExactlyOnceWith("delete");
});

test("更多中的操作关闭菜单后使用 Popconfirm，确认才执行", async () => {
  const onAction = vi.fn();
  render(<ActionGroup max={3} items={[
    { key: "detail", label: "详情" }, { key: "edit", label: "编辑" },
    { key: "copy", label: "复制" }, deletion,
  ]} onAction={onAction} />);
  fireEvent.mouseEnter(screen.getByRole("button", { name: /更多/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(within(popover).getByRole("button", { name: /删\s*除/ }));
  expect(onAction).toHaveBeenCalledExactlyOnceWith("delete");
});

test("确认等待期间动作被禁用后不能提交", async () => {
  const onAction = vi.fn();
  const { rerender } = render(<ActionGroup items={[deletion]} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  await screen.findByRole("tooltip");
  rerender(<ActionGroup items={[{ ...deletion, disabled: true }]} onAction={onAction} />);
  expect(onAction).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "删除" }).hasAttribute("disabled")).toBe(true);
});

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

test("点击区域外取消确认，不执行操作", async () => {
  const onAction = vi.fn();
  render(<ActionGroup items={[deletion]} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  fireEvent.click(document.body);
  // jsdom does not complete Antd CSS motion; leaving proves open became false.
  await vi.waitFor(() => expect(popover.closest(".ant-popover")?.className).toMatch(/ant-zoom-big-leave|ant-popover-hidden/));
  expect(onAction).not.toHaveBeenCalled();
});
