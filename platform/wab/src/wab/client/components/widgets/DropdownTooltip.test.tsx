import { DropdownTooltip } from "@/wab/client/components/widgets/DropdownTooltip";
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

it("hides the hint while the menu is open and closes after choosing an item", async () => {
  const createPage = vi.fn();
  render(
    <DropdownTooltip
      title="新建页面、组件或画板组"
      trigger={["click"]}
      popupRender={() => (
        <Menu>
          <Menu.Item key="page" onClick={createPage}>
            新建页面
          </Menu.Item>
        </Menu>
      )}
    >
      <button>新建</button>
    </DropdownTooltip>,
  );
  const trigger = screen.getByRole("button", { name: "新建" });
  fireEvent.mouseEnter(trigger);
  await screen.findByRole("tooltip");
  expect(screen.getByRole("tooltip").textContent).toBe(
    "新建页面、组件或画板组",
  );
  fireEvent.click(trigger);
  await screen.findByRole("menuitem");
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  fireEvent.click(screen.getByRole("menuitem", { name: "新建页面" }));
  expect(createPage).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("menuitem")).toBeNull());
});
