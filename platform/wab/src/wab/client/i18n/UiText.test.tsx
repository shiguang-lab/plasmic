import { setLanguagePreference } from "@/wab/client/i18n";
import { translateUiLabel } from "@/wab/client/i18n/locales";
import { UiText } from "@/wab/client/i18n/UiText";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
  act(() => setLanguagePreference("en"));
});
it("updates static messages even below a memoized view", () => {
  act(() => setLanguagePreference("en"));
  const View = React.memo(() => (
    <>
      <UiText message="Code" /> / <UiText message="Share" />
    </>
  ));
  render(<View />);
  expect(screen.getByText("Code / Share")).toBeTruthy();
  act(() => setLanguagePreference("zh-CN"));
  expect(screen.getByText("代码 / 分享")).toBeTruthy();
  act(() => setLanguagePreference("ja"));
  expect(screen.getByText("コード / 共有")).toBeTruthy();
});
it("localizes display metadata while retaining unknown labels and all input values", () => {
  const options = [
    { value: "flex-start", label: "Start" },
    { value: "my-widget", label: "MyWidget" },
  ];
  const localized = options.map((option) => ({
    ...option,
    label: translateUiLabel("zh-CN", option.label),
  }));
  expect(localized).toEqual([
    { value: "flex-start", label: "起始" },
    { value: "my-widget", label: "MyWidget" },
  ]);
  expect(options[0].label).toBe("Start");
});

it("preserves rich placeholders, literal user names and actions when the locale changes", () => {
  const onClick = vi.fn();
  const name = "<script>{variant}$&</script>";
  const view = render(
    <UiText
      message="The {name} is overwritten in variant {variant}."
      values={{
        name: <strong>{name}</strong>,
        variant: <button onClick={onClick}>MyVariant</button>,
      }}
    />,
  );
  expect(view.container.querySelector("script")).toBeNull();
  const button = screen.getByRole("button", { name: "MyVariant" });
  act(() => setLanguagePreference("zh-CN"));
  expect(view.container.textContent).toBe(
    name + " 已被变体 MyVariant 中的设置覆盖。",
  );
  expect(screen.getByRole("button", { name: "MyVariant" })).toBe(button);
  act(() => button.click());
  expect(onClick).toHaveBeenCalledOnce();
});
