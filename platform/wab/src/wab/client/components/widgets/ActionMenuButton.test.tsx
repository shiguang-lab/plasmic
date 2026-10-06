import ActionMenuButton from "@/wab/client/components/widgets/ActionMenuButton";
import { fireEvent, render, screen } from "@testing-library/react";
import { Menu } from "antd";
import React from "react";
import { expect, it, vi } from "vitest";

it("names both real buttons when the tooltip contains rich content", async () => {
  const onClick = vi.fn();
  render(
    <ActionMenuButton
      aria-label="代码集成"
      tooltip={
        <>
          <strong>接入代码</strong>
          <span>项目说明</span>
        </>
      }
      menu={
        <Menu>
          <Menu.Item key="docs">文档</Menu.Item>
        </Menu>
      }
      onClick={onClick}
    >
      Code
    </ActionMenuButton>,
  );
  fireEvent.click(screen.getByRole("button", { name: "代码集成" }));
  expect(onClick).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "代码集成菜单" }));
  expect(await screen.findByRole("menuitem", { name: "文档" })).toBeTruthy();
});
