import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { MenuItemContent } from "@/wab/client/components/menu-builder";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Menu } from "antd";
import * as React from "react";

afterEach(() => {
  cleanup();
  setAppearancePreference("light");
});

it("themes shortcut badges in context menus and portaled submenus when appearance changes", async () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      <WithContextMenu
        overlay={
          <Menu defaultOpenKeys={["wrap"]}>
            <Menu.Item key="fit">
              <MenuItemContent shortcut="shift+2">Zoom to fit</MenuItemContent>
            </Menu.Item>
            <Menu.SubMenu key="wrap" title="Wrap in container">
              <Menu.Item key="horizontal">
                <MenuItemContent shortcut="shift+alt+h">
                  Horizontal stack
                </MenuItemContent>
              </Menu.Item>
            </Menu.SubMenu>
          </Menu>
        }
      >
        <button>Canvas selection</button>
      </WithContextMenu>
    </AntdConfigProvider>,
  );
  fireEvent.contextMenu(screen.getByRole("button", { name: "Canvas selection" }));
  const items = [
    await screen.findByRole("menuitem", { name: /Zoom to fit/ }),
    await screen.findByRole("menuitem", { name: /Horizontal stack/ }),
  ];
  expect(items[0].closest('[role="menu"]')).not.toBe(
    items[1].closest('[role="menu"]'),
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    for (const item of items) {
      const badge = item.querySelector(".shortcut-combo");
      expect(badge).toBeTruthy();
      const style = getComputedStyle(badge as Element);
      expect(style.backgroundColor).toBe(
        appearance === "dark" ? "rgb(32, 33, 40)" : "rgb(255, 255, 255)",
      );
      expect(style.color).toBe(
        appearance === "dark" ? "rgb(237, 238, 245)" : "rgb(37, 42, 56)",
      );
      expect(style.borderColor).toBe(
        appearance === "dark" ? "#30313b" : "#e6e8ef",
      );
      expect(style.boxShadow).toBe("none");
    }
  }
});
