import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { AntdDropdown } from "../../antd6/src/registerDropdown";
import { ActionGroup } from "../../react-ui/src/registerActionGroup";
import { AppShell } from "../src/registerAppShell";

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi
    .fn()
    .mockImplementation((media) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

test("普通 Dropdown 悬停打开；悬停和禁用项不执行业务动作，选中后关闭", async () => {
  const onAction = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AntdDropdown
      onAction={onAction}
      onOpenChange={onOpenChange}
      menuItemsJson={[
        { key: "copy", label: "复制" },
        { key: "delete", label: "删除", disabled: true },
      ]}
    >
      <button>操作菜单</button>
    </AntdDropdown>,
  );
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.mouseEnter(screen.getByRole("button", { name: "操作菜单" }));
  const menu = await screen.findByRole("menu");
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "删除" }));
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "复制" }));
  expect(onAction).toHaveBeenCalledExactlyOnceWith("copy");
  await vi.waitFor(() =>
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything()),
  );
});

test("显式 click 的 Dropdown 仅在点击后打开", async () => {
  render(
    <AntdDropdown
      trigger="click"
      menuItemsJson={[{ key: "copy", label: "复制" }]}
    >
      <button>点击菜单</button>
    </AntdDropdown>,
  );
  fireEvent.mouseEnter(screen.getByRole("button", { name: "点击菜单" }));
  await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "点击菜单" }));
  expect(await screen.findByRole("menuitem", { name: "复制" })).toBeTruthy();
});

test("ActionGroup 从触发器移入菜单保持打开，移出后关闭", async () => {
  const onAction = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ActionGroup
      onAction={onAction}
      dropdownProps={{ onOpenChange }}
      items={[
        { key: "detail", label: "详情" },
        { key: "edit", label: "编辑" },
        { key: "copy", label: "复制" },
        { key: "delete", label: "删除", disabled: true },
      ]}
    />,
  );
  const more = screen.getByRole("button", { name: /更多/ });
  fireEvent.mouseEnter(more);
  const menu = await screen.findByRole("menu");
  const popup = menu.parentElement!;
  fireEvent.mouseLeave(more, { relatedTarget: popup });
  fireEvent.mouseEnter(popup, { relatedTarget: more });
  await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
  expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.mouseLeave(popup, { relatedTarget: document.body });
  await vi.waitFor(() =>
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything()),
  );
});

test("ActionGroup 允许需求明确指定 click", async () => {
  render(
    <ActionGroup
      dropdownProps={{ trigger: ["click"] }}
      max={1}
      items={[
        { key: "copy", label: "复制" },
        { key: "delete", label: "删除" },
      ]}
    />,
  );
  const more = screen.getByRole("button", { name: /更多/ });
  fireEvent.mouseEnter(more);
  await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(more);
  expect(await screen.findByRole("menuitem", { name: "复制" })).toBeTruthy();
});

test("AppShell 的语言和账号菜单悬停打开，选中后才执行", async () => {
  const onLanguageChange = vi.fn();
  const onUserAction = vi.fn();
  render(
    <AppShell
      currentTime="2026-10-04 19:00:00"
      userName="测试管理员"
      appSources={[]}
      menuItems={[]}
      onLanguageChange={onLanguageChange}
      onUserAction={onUserAction}
    />,
  );
  fireEvent.mouseEnter(screen.getByRole("button", { name: "语言" }));
  const english = await screen.findByRole("menuitem", { name: "English" });
  expect(onLanguageChange).not.toHaveBeenCalled();
  fireEvent.click(english);
  expect(onLanguageChange).toHaveBeenCalledExactlyOnceWith("en");
  fireEvent.mouseEnter(screen.getByRole("button", { name: /测试管理员/ }));
  const profile = await screen.findByRole("menuitem", { name: "个人资料" });
  expect(onUserAction).not.toHaveBeenCalled();
  fireEvent.click(profile);
  expect(onUserAction).toHaveBeenCalledExactlyOnceWith("profile");
});
