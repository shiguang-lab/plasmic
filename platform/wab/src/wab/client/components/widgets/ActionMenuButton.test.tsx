import ActionMenuButton from "@/wab/client/components/widgets/ActionMenuButton";
import { fireEvent, render, screen } from "@testing-library/react";
import { Menu } from "antd";
import React from "react";
import { expect, it, vi } from "vitest";

it("names both real buttons when the tooltip contains rich content", async () => {
  const onClick = vi.fn();
  render(
    <ActionMenuButton
      aria-label="Code"
      tooltip={
        <>
          <strong>Code integration</strong>
          <span>Project information</span>
        </>
      }
      menu={
        <Menu>
          <Menu.Item key="docs">Docs</Menu.Item>
        </Menu>
      }
      onClick={onClick}
    >
      Code
    </ActionMenuButton>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Code" }));
  expect(onClick).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Code menu" }));
  expect(await screen.findByRole("menuitem", { name: "Docs" })).toBeTruthy();
});
