import { render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import React from "react";
import { expect, test } from "vitest";
import { registerAll } from "../src";
import { AntdEmpty } from "../src/registerAdditional";

const registrations = new Map<string, { component: React.ComponentType<any>; meta: any }>();
registerAll({
  registerComponent: (component: React.ComponentType<any>, meta: any) =>
    registrations.set(meta.name.replace("plasmic-antd6-", ""), { component, meta }),
  registerGlobalContext() {},
  registerToken() {},
} as any);

test.each([
  ["alert", "description"],
  ["card", "title"],
  ["card-meta", "description"],
  ["descriptions", "title"],
  ["divider", "children"],
  ["empty", "description"],
  ["float-button", "content"],
  ["list-item-meta", "description"],
  ["result", "subTitle"],
  ["statistic", "title"],
  ["statistic-timer", "title"],
  ["modal", "title"],
  ["drawer", "title"],
  ["popover", "title"],
])("%s.%s leaves optional content to the consumer or native default", (name, slot) => {
  const prop = registrations.get(name)!.meta.props[slot];
  expect(prop.type).toBe("slot");
  expect(prop.defaultValue).toBeUndefined();
  expect(prop.hidePlaceholder).toBe(true);
});

test.each([
  { name: "alert", slot: "description", props: { title: "业务提示" }, region: ".ant-alert-description" },
  { name: "card", slot: "title", props: { children: "业务内容" }, region: ".ant-card-head" },
  { name: "descriptions", slot: "title", props: { items: [{ key: "owner", label: "负责人", children: "张三" }] }, region: ".ant-descriptions-header" },
  { name: "modal", slot: "title", props: { open: true, children: "业务内容", modalScopeClassName: "", wrapClassName: "" }, region: ".ant-modal-header" },
  { name: "drawer", slot: "title", props: { open: true, children: "业务内容" }, region: ".ant-drawer-title" },
  { name: "popover", slot: "title", props: { open: true, content: "业务内容", children: <button>打开</button> }, region: ".ant-popover-title" },
])("$name renders optional content only when supplied", ({ name, slot, props, region }) => {
  const Component = registrations.get(name)!.component;
  const view = render(<Component {...props} />);
  expect(document.querySelector(region)).toBeNull();

  view.rerender(<Component {...props} {...{ [slot]: <strong>自定义内容</strong> }} />);
  expect(document.querySelector(region)?.textContent).toBe("自定义内容");
  expect(document.querySelector(`${region} strong`)).not.toBeNull();

  view.rerender(<Component {...props} {...{ [slot]: null }} />);
  expect(document.querySelector(region)).toBeNull();
});

test("Empty uses the native locale and preserves explicit description content or removal", () => {
  const view = render(<ConfigProvider locale={zhCN}><AntdEmpty /></ConfigProvider>);
  expect(view.container.querySelector(".ant-empty-description")?.textContent).toBe(zhCN.Empty!.description);
  view.rerender(<ConfigProvider locale={zhCN}><AntdEmpty description={<strong>暂无订单</strong>} /></ConfigProvider>);
  expect(screen.getByText("暂无订单").tagName).toBe("STRONG");
  view.rerender(<ConfigProvider locale={zhCN}><AntdEmpty description={null} /></ConfigProvider>);
  expect(view.container.querySelector(".ant-empty-description")).toBeNull();
});
