import { PageParamsProvider, PlasmicCanvasContext } from "@plasmicapp/host";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { createPreview } from "../../../platform/live-frame/src/preview";
import type { ShellMenuItem } from "../../overseas/src/menuNavigation";
import { AppShell } from "../../overseas/src/registerAppShell";

function navigation(scope: string): ShellMenuItem[] {
  return [
    { key: "customers", label: "客户运营", children: [
      { key: "groups", label: "客群列表", href: `/${scope}/groups`, children: [
        { key: "detail", label: "客群详情", href: `/${scope}/groups/detail`, hidden: true },
      ] },
    ] },
    { key: "settings", label: "配置管理", children: [
      { key: "users", label: "用户管理", href: `/${scope}/users` },
    ] },
    { key: "reports", label: "报表管理", children: [
      { key: "daily", label: "日报", href: `/${scope}/daily` },
    ] },
  ];
}

function expanded(name: string) {
  return screen.getByRole("menuitem", { name, exact: true }).getAttribute("aria-expanded");
}

function selected() {
  return document.querySelector(".ant-menu-item-selected")?.textContent;
}

test("route changes reveal the current branch, allow manual closing, and highlight hidden detail parents", () => {
  const menuItems = navigation("route");
  const shell = (route: string, currentTime = "00:00") => (
    <PageParamsProvider route={route}>
      <AppShell menuItems={menuItems} selectedMenuKey="daily" currentTime={currentTime} />
    </PageParamsProvider>
  );
  const view = render(shell("/route/groups"));
  expect(selected()).toBe("客群列表");
  expect(expanded("客户运营")).toBe("true");
  fireEvent.click(screen.getByRole("menuitem", { name: "客户运营", exact: true }));
  expect(expanded("客户运营")).toBe("false");
  view.rerender(shell("/route/groups", "00:01"));
  expect(expanded("客户运营")).toBe("false");
  view.rerender(shell("/route/users"));
  expect(selected()).toBe("用户管理");
  expect(expanded("配置管理")).toBe("true");
  view.rerender(shell("/route/groups/detail/?tab=members"));
  expect(selected()).toBe("客群列表");
  expect(expanded("客户运营")).toBe("true");
  expect(screen.queryByRole("menuitem", { name: "客群详情" })).toBeNull();
});

test("the live preview retains manually expanded menus across page remounts and returning routes", async () => {
  const menuItems = navigation("preview");
  const unmount = vi.fn();
  function Root() {
    React.useEffect(() => unmount, []);
    return <AppShell menuItems={menuItems} currentTime="00:00" />;
  }
  const view = render(<></>);
  const preview = createPreview(
    { React, PageParamsProvider },
    (name) => {
      if (name === "root") return { default: Root };
      if (name === "props") return { default: {} };
      if (name === "@plasmicapp/react-web") return {
        PlasmicDataSourceContextProvider: ({ children }: React.PropsWithChildren) => children,
      };
      throw new Error(`Unexpected preview module: ${name}`);
    },
    async (node) => { view.rerender(node); },
  );
  const navigate = (route: string) => act(async () => {
    await preview.render({
      root: "root", componentUuid: route, isPage: true, depCss: [],
      propsModule: "props", globalVariants: [], globals: {}, appUser: undefined,
      page: { route, query: {} },
    });
  });
  await navigate("/preview/groups");
  fireEvent.click(screen.getByRole("menuitem", { name: "报表管理", exact: true }));
  expect(expanded("报表管理")).toBe("true");
  for (const route of ["/preview/users", "/preview/groups", "/preview/users"]) {
    await navigate(route);
    expect(selected()).toBe(route.endsWith("users") ? "用户管理" : "客群列表");
    expect(expanded("客户运营")).toBe("true");
    expect(expanded("配置管理")).toBe("true");
    expect(expanded("报表管理")).toBe("true");
  }
  expect(unmount).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole("menuitem", { name: "报表管理", exact: true }));
  await navigate("/preview/groups");
  expect(expanded("报表管理")).toBe("false");
  expect(expanded("客户运营")).toBe("true");
});

test("collapsing the sidebar keeps expanded branches when it is restored", () => {
  render(<PageParamsProvider route="/collapse/groups">
    <AppShell menuItems={navigation("collapse")} currentTime="00:00" />
  </PageParamsProvider>);
  fireEvent.click(screen.getByRole("menuitem", { name: "配置管理", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "折叠侧栏" }));
  fireEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
  expect(expanded("客户运营")).toBe("true");
  expect(expanded("配置管理")).toBe("true");
  expect(selected()).toBe("客群列表");
});

test("menu trees and canvas instances do not share runtime expansion state", () => {
  const menuItems = navigation("isolated");
  const shell = (items = menuItems) => <PageParamsProvider route="/isolated/groups">
    <AppShell menuItems={items} currentTime="00:00" />
  </PageParamsProvider>;
  let view = render(shell());
  fireEvent.click(screen.getByRole("menuitem", { name: "报表管理", exact: true }));
  view.unmount();
  const canvas = () => <PlasmicCanvasContext.Provider value={{ componentName: "Page", globalVariants: {} }}>
    {shell()}
  </PlasmicCanvasContext.Provider>;
  view = render(canvas());
  expect(expanded("报表管理")).toBe("false");
  fireEvent.click(screen.getByRole("menuitem", { name: "配置管理", exact: true }));
  view.unmount();
  view = render(canvas());
  expect(expanded("配置管理")).toBe("false");
  view.unmount();
  view = render(shell());
  expect(expanded("报表管理")).toBe("true");
  expect(expanded("配置管理")).toBe("false");
  view.rerender(shell(navigation("another-project")));
  expect(expanded("报表管理")).toBe("false");
});

test("an explicit selection works on a page with href-less menus", () => {
  render(<PageParamsProvider route="/template">
    <AppShell menuItems={[{ key: "resources", label: "资源管理", children: [
      { key: "list", label: "资源列表" },
    ] }]} selectedMenuKey="list" currentTime="00:00" />
  </PageParamsProvider>);
  expect(selected()).toBe("资源列表");
  expect(expanded("资源管理")).toBe("true");
});

test("switching the same shell between canvas and runtime keeps their expansion independent", () => {
  const menuItems = navigation("context");
  const shell = (inCanvas: boolean) => <PlasmicCanvasContext.Provider
    value={inCanvas ? { componentName: "Page", globalVariants: {} } : false}
  >
    <PageParamsProvider route="/context/groups">
      <AppShell menuItems={menuItems} currentTime="00:00" />
    </PageParamsProvider>
  </PlasmicCanvasContext.Provider>;
  const view = render(shell(false));
  fireEvent.click(screen.getByRole("menuitem", { name: "报表管理", exact: true }));
  view.rerender(shell(true));
  expect(expanded("报表管理")).toBe("false");
  fireEvent.click(screen.getByRole("menuitem", { name: "配置管理", exact: true }));
  view.rerender(shell(false));
  expect(expanded("报表管理")).toBe("true");
  expect(expanded("配置管理")).toBe("false");
});
