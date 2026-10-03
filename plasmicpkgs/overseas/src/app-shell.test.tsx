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
    productName: "Test product", userName: "Test operator", breadcrumbItems: [{ title: "Current page" }], currentTime: "2026-10-03 21:30:00",
    languages: [{ value: "en", label: "English" }], appSources: [{ value: "OTHER", label: "Other market" }],
    menuItems: [{ key: "custom", label: "Custom route" }], selectedMenuKey: "custom", children: <article>Editable business content</article>,
  }));
  for (const text of ["Test product", "Test operator", "Current page", "2026-10-03 21:30:00", "English", "Other market", "Custom route", "Editable business content"])
    assert(html.includes(text), text);
  assert.match(html, /width:239px/);
  assert.match(html, /height:64px/);
  const collapsed = renderToStaticMarkup(React.createElement(shell.component, { collapsed: true }));
  assert.match(collapsed, /width:80px/);
});
