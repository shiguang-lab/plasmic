import { render, screen } from "@testing-library/react";
import enUS from "antd/lib/locale/en_US.js";
import zhCN from "antd/lib/locale/zh_CN.js";
import React from "react";
import { expect, test } from "vitest";
import { AntdPopconfirm } from "../src/registerAdditional";
import { AntdConfigProvider } from "../src/registerConfigProvider";
import { AntdDatePicker } from "../src/registerDatePicker";
import { AntdModal } from "../src/registerModal";
import { AntdPagination } from "../src/registerPagination";

const modal = <AntdModal open modalScopeClassName="" wrapClassName="" />;

test("project locale updates portal confirmation buttons and pagination", () => {
  const content = (
    <>
      {modal}
      <AntdPagination total={50} />
    </>
  );
  const view = render(
    <AntdConfigProvider themeStyles={{}} removeLoading>
      {content}
    </AntdConfigProvider>,
  );
  expect(screen.getByRole("button", { name: "OK" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(screen.getByTitle("Next Page")).toBeTruthy();

  view.rerender(
    <AntdConfigProvider themeStyles={{}} removeLoading locale="zh_CN">
      {content}
    </AntdConfigProvider>,
  );
  expect(screen.getByRole("button", { name: "确 定" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "取 消" })).toBeTruthy();
  expect(screen.getByTitle("下一页")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

  view.rerender(
    <AntdConfigProvider themeStyles={{}} removeLoading locale="en_US">
      {content}
    </AntdConfigProvider>,
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(screen.getByTitle("Next Page")).toBeTruthy();
});

test("Chinese locale applies to Popconfirm without overriding business labels", () => {
  render(
    <AntdConfigProvider themeStyles={{}} removeLoading locale="zh_CN">
      <AntdPopconfirm open title="下线活动" okText="确认下线">
        <button>下线</button>
      </AntdPopconfirm>
    </AntdConfigProvider>,
  );
  expect(screen.getByRole("button", { name: "确认下线" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "取 消" })).toBeTruthy();
});

test.each([
  ["ja_JP", "キャンセル"],
  ["fr_FR", "Annuler"],
  ["de_DE", "Abbrechen"],
] as const)("%s applies its native confirmation text", (locale, cancelText) => {
  render(
    <AntdConfigProvider themeStyles={{}} removeLoading locale={locale}>
      {modal}
    </AntdConfigProvider>,
  );
  expect(screen.getByRole("button", { name: cancelText })).toBeTruthy();
});

test.each([
  ["fr_FR", "janv."],
  ["ja_JP", "1月"],
  ["de_DE", "Mär"],
] as const)("%s date controls load the corresponding month names", (locale, monthName) => {
  render(
    <AntdConfigProvider themeStyles={{}} removeLoading locale={locale}>
      <AntdDatePicker picker="month" open defaultValue="2026-10-01" />
    </AntdConfigProvider>,
  );
  expect(screen.getByText(monthName)).toBeTruthy();
});

test("Chinese date controls inherit translated placeholders and month names", () => {
  const view = render(
    <AntdConfigProvider themeStyles={{}} removeLoading locale="zh_CN">
      <AntdDatePicker />
      <AntdDatePicker picker="month" open defaultValue="2026-10-01" />
    </AntdConfigProvider>,
  );
  expect(screen.getByPlaceholderText("请选择日期")).toBeTruthy();
  expect(screen.getByText("1月")).toBeTruthy();
  view.rerender(
    <AntdConfigProvider themeStyles={{}} removeLoading locale="en_US">
      <AntdDatePicker />
      <AntdDatePicker picker="month" open defaultValue="2026-10-01" />
    </AntdConfigProvider>,
  );
  expect(screen.getByPlaceholderText("Select date")).toBeTruthy();
  expect(screen.getByText("Jan")).toBeTruthy();
});

test("native locale objects and component text overrides remain effective", () => {
  render(
    <AntdConfigProvider
      themeStyles={{}}
      removeLoading
      locale={{ ...enUS, Modal: { ...zhCN.Modal, cancelText: "暂不下线" } }}
    >
      <AntdModal open modalScopeClassName="" wrapClassName="" okText="确认下线" />
    </AntdConfigProvider>,
  );
  expect(screen.getByRole("button", { name: "确认下线" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "暂不下线" })).toBeTruthy();
});
