import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerAppShell } from "./registerAppShell";

const components = new Map<string, any>();
registerAppShell({ registerComponent(component, meta) { components.set(meta.name, { component, meta }); } });

test("AppShell registers configurable shared layout, editable body and an offline thumbnail", () => {
  const shell = components.get("plasmic-overseas-app-shell")!;
  assert(shell.meta.section);
  assert.match(shell.meta.thumbnailUrl, /^data:image\/svg\+xml/);
  assert.equal(shell.meta.props.children.type, "slot");
  for (const prop of ["productName", "userName", "languages", "appSources", "menuItems"])
    assert(shell.meta.props[prop]);
  for (const state of ["collapsed", "language", "appSource", "selectedMenuKey"])
    assert(shell.meta.props[shell.meta.states[state].onChangeProp]);
  const html = renderToStaticMarkup(React.createElement(shell.component, {
    productName: "Test product", userName: "Test operator", currentTime: "2026-10-03 21:30:00",
    languages: [{ value: "en", label: "English" }], appSources: [{ value: "OTHER", label: "Other market" }],
    menuItems: [{ key: "custom", label: "Current page" }], selectedMenuKey: "custom", children: <article>Editable business content</article>,
  }));
  for (const text of ["Test product", "Test operator", "Current page", "2026-10-03 21:30:00", "English", "Other market", "Editable business content"])
    assert(html.includes(text), text);
  assert.match(html, /width:239px/);
  assert.match(html, /height:64px/);
  const collapsed = renderToStaticMarkup(React.createElement(shell.component, { collapsed: true }));
  assert.match(collapsed, /width:80px/);
});

import { PageParamsProvider } from "@plasmicapp/host";
import { findMenuPath, visibleMenuItems, ShellMenuItem } from "./menuNavigation";
const routes: ShellMenuItem[] = [
  { key: "customers", label: "客户运营", children: [
    { key: "groups", label: "客群列表", href: "/groups", children: [
      { key: "detail", label: "常规客群详情", href: "/groups/detail", hidden: true },
    ] },
  ] },
  { key: "sql", label: "SQL 圈选器", href: "/sql" },
];

test("route-derived breadcrumbs include every parent and hidden detail routes", () => {
  assert.deepEqual(findMenuPath(routes, "/groups/detail/?tab=members", "sql").map(i => i.key), ["customers", "groups", "detail"]);
  assert.deepEqual(findMenuPath(routes, "/groups-extra"), []);
  assert.deepEqual(findMenuPath(routes, "/unlisted", "groups").map(i => i.key), ["customers", "groups"]);
  assert.deepEqual(findMenuPath(routes, "/sql", "groups").map(i => i.key), ["sql"]);
  assert.deepEqual(findMenuPath(routes, undefined, "detail").map(i => i.key), ["customers", "groups", "detail"]);
  const visible = visibleMenuItems(routes);
  assert.equal(visible[0].children![0].children, undefined);
  assert.equal(routes[0].children![0].children!.length, 1);
  const shell = components.get("plasmic-overseas-app-shell")!;
  assert.equal(shell.meta.props.breadcrumbItems, undefined);
  const html = renderToStaticMarkup(<PageParamsProvider route="/groups/detail">
    <shell.component productName="经营平台" menuItems={routes} selectedMenuKey="sql" currentTime="00:00" />
  </PageParamsProvider>);
  const breadcrumb = html.match(/<nav[^>]*ant-breadcrumb[\s\S]*?<\/nav>/)![0];
  assert.match(breadcrumb, /经营平台/);assert.match(breadcrumb, /客户运营/);assert.match(breadcrumb, /客群列表/);assert.match(breadcrumb, /常规客群详情/);
  assert.match(breadcrumb, /href="\/groups"/);
  const menu = html.match(/<ul[^>]*role="menu"[\s\S]*?<\/ul>/)![0];
  assert(!menu.includes("常规客群详情"));
  assert.match(menu, /ant-menu-item-selected[^>]*[\s\S]*?客群列表/);
});

test("detail IDs inherit the longest menu route and keep the visible parent selected", () => {
  assert.deepEqual(
    findMenuPath(routes, "/groups/detail/GRP_REGULAR_1006/?tab=members", "sql").map(item => item.key),
    ["customers", "groups", "detail"],
  );
  assert.deepEqual(findMenuPath(routes, "/groups/unknown").map(item => item.key), ["customers", "groups"]);
  assert.deepEqual(findMenuPath(routes, "/groups/detail-extra").map(item => item.key), ["customers", "groups"]);
  assert.deepEqual(findMenuPath(routes, "/groups-extra/detail"), []);

  const shell = components.get("plasmic-overseas-app-shell")!;
  const html = renderToStaticMarkup(<PageParamsProvider route="/groups/detail/[id]" params={{ id: "GRP_REGULAR_1006" }}>
    <shell.component menuItems={routes} currentTime="00:00" />
  </PageParamsProvider>);
  const breadcrumb = html.match(/<nav[^>]*ant-breadcrumb[\s\S]*?<\/nav>/)![0];
  assert.match(breadcrumb, /常规客群详情/);
  const menu = html.match(/<ul[^>]*role="menu"[\s\S]*?<\/ul>/)![0];
  assert.match(menu, /ant-menu-item-selected[^>]*[\s\S]*?客群列表/);
  assert(!menu.includes("常规客群详情"));
});

test("exact routes outrank parent routes regardless of menu order, and the root only matches itself", () => {
  const items: ShellMenuItem[] = [
    { key: "home", href: "/" },
    { key: "groups", href: "/groups" },
    { key: "detail", href: "/groups/detail/?tab=overview" },
    { key: "record", href: "/groups/detail/GRP_REGULAR_1006" },
  ];
  for (const menu of [items, [...items].reverse()]) {
    assert.deepEqual(findMenuPath(menu, "/groups/detail/GRP_REGULAR_1006").map(item => item.key), ["record"]);
    assert.deepEqual(findMenuPath(menu, "/groups/detail/GRP_REGULAR_1007").map(item => item.key), ["detail"]);
    assert.deepEqual(findMenuPath(menu, "/").map(item => item.key), ["home"]);
    assert.deepEqual(findMenuPath(menu, "/unlisted"), []);
    assert.deepEqual(findMenuPath(menu, "/unlisted", "groups").map(item => item.key), ["groups"]);
  }
});
