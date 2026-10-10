import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { MenuItemContent } from "@/wab/client/components/menu-builder";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { plasmicIFrameMouseDownEvent } from "@/wab/client/definitions/events";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Menu } from "antd";
import * as React from "react";

afterEach(cleanup);
it("Escape closes the open menu, updates its trigger state and returns keyboard focus", async () => {
  const changed = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <IFrameAwareDropdownMenu
        onVisibleChange={changed}
        menu={
          <Menu>
            <Menu.Item key="fit">Fit all</Menu.Item>
          </Menu>
        }
      >
        <button>Zoom</button>
      </IFrameAwareDropdownMenu>
    </AntdConfigProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Zoom" });
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(true));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(false));
  expect(document.activeElement).toBe(trigger);
});
it("a canvas iframe click closes the menu without pulling focus back", async () => {
  const changed = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <IFrameAwareDropdownMenu
        onVisibleChange={changed}
        menu={
          <Menu>
            <Menu.Item key="fit">Fit all</Menu.Item>
          </Menu>
        }
      >
        <button>Zoom</button>
      </IFrameAwareDropdownMenu>
      <input aria-label="Canvas focus" />
    </AntdConfigProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(true));
  const canvasFocus = screen.getByRole("textbox", { name: "Canvas focus" });
  canvasFocus.focus();
  fireEvent(document, new Event(plasmicIFrameMouseDownEvent));
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(false));
  expect(document.activeElement).toBe(canvasFocus);
});

it("uses themed Scrollbars and shortcut labels in the dropdown and its separately mounted submenu", async () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      <IFrameAwareDropdownMenu
        menu={
          <Menu defaultOpenKeys={["wrap"]}>
            <Menu.Item key="free">
              <MenuItemContent shortcut="shift+a">Free layout</MenuItemContent>
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
        <button>Layer actions</button>
      </IFrameAwareDropdownMenu>
    </AntdConfigProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Layer actions" }));
  const rootItem = await screen.findByRole("menuitem", { name: /Free layout/ });
  const subItem = await screen.findByRole("menuitem", {
    name: /Horizontal stack/,
  });
  const rootScroll = rootItem.closest(".studio-scrollbar");
  const subScroll = subItem.closest(".studio-scrollbar");
  expect(rootScroll).toBeTruthy();
  expect(subScroll).toBeTruthy();
  expect(rootScroll).not.toBe(subScroll);
  for (const item of [rootItem, subItem]) {
    expect(
      getComputedStyle(item.closest('[role="menu"]') as Element).overflow,
    ).toBe("visible");
    expect(
      getComputedStyle(item.closest(".studio-scrollbar") as Element).maxHeight,
    ).toBe("80vh");
    const badge = item.querySelector(".shortcut-combo");
    expect(badge).toBeTruthy();
    expect(getComputedStyle(badge as Element).backgroundColor).toBe(
      "rgb(32, 33, 40)",
    );
    expect(getComputedStyle(badge as Element).color).toBe("rgb(237, 238, 245)");
  }
});
