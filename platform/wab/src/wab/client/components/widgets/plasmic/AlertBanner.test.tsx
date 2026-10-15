import PlasmicAlertBanner from "@/wab/client/components/widgets/plasmic/PlasmicAlertBanner";
import { setLanguagePreference } from "@/wab/client/i18n";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
});

it("updates the save failure banner when the UI language changes", async () => {
  await act(async () => await setLanguagePreference("en"));
  render(<PlasmicAlertBanner variants={{ state: "saveFailed" }} />);
  expect(screen.getByText("We're having trouble saving this project.")).toBeTruthy();
  await act(async () => await setLanguagePreference("zh-CN"));
  expect(screen.getByText("项目保存遇到问题。")).toBeTruthy();
  expect(screen.getByText("系统会继续重试，但你的修改可能尚未保存。")).toBeTruthy();
  await act(async () => await setLanguagePreference("ja"));
  expect(screen.getByText("プロジェクトの保存中に問題が発生しました。")).toBeTruthy();
});

it("localizes the permission error and its reload action", async () => {
  await act(async () => await setLanguagePreference("zh-CN"));
  render(<PlasmicAlertBanner variants={{ state: "permError" }} />);
  expect(screen.getByText("无法保存。")).toBeTruthy();
  expect(screen.getByText("请重新加载项目。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "重新加载项目" })).toBeTruthy();
});
