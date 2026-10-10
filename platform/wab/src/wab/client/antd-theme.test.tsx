import { AntdConfigProvider } from "@/wab/client/antd-theme";
import {
  setAppearancePreference,
  usesProductTheme,
} from "@/wab/client/ui-theme";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme } from "antd";
import { useTheme } from "antd-style";
import * as React from "react";
import { createPortal } from "react-dom";

function ThemeProbe() {
  const { token } = theme.useToken();
  const style = useTheme();
  return (
    <output
      data-testid="theme"
      data-antd-bg={token.colorBgContainer}
      data-style-bg={style.colorBgContainer}
    />
  );
}
afterEach(cleanup);
it("updates Ant Design and antd-style together, while auth keeps its original theme", () => {
  setAppearancePreference("dark");
  const { rerender } = render(
    <AntdConfigProvider productUI>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  const probe = screen.getByTestId("theme");
  expect(probe.dataset.antdBg).toBe("#202128");
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
  expect(
    document.documentElement.style.getPropertyValue("--studio-loading-surface"),
  ).toBe("#202128");
  expect(probe.dataset.styleBg).toBe(probe.dataset.antdBg);
  act(() => setAppearancePreference("light"));
  expect(probe.dataset.antdBg).toBe("#ffffff");
  expect(document.documentElement.dataset.uiAppearance).toBe("light");
  expect(
    document.documentElement.style.getPropertyValue("--studio-loading-surface"),
  ).toBe("#ffffff");
  expect(probe.dataset.styleBg).toBe(probe.dataset.antdBg);
  act(() => setAppearancePreference("dark"));
  rerender(
    <AntdConfigProvider productUI={false}>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  expect(probe.dataset.antdBg).toBe("#fff");
  expect(probe.dataset.styleBg).toBe(probe.dataset.antdBg);
});
it.each([
  "/login",
  "/login/",
  "/register",
  "/auth/plasmic-init/token",
  "/authorize",
  "/logout",
])("excludes auth route %s from product appearance", (path) => {
  expect(usesProductTheme(path)).toBe(false);
});

it("keeps portal theme bindings until the last product root closes", () => {
  setAppearancePreference("dark");
  const baseline = document.body.className;
  const shell = render(
    <AntdConfigProvider productUI>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  const productClasses = document.body.className;
  expect(productClasses).not.toBe(baseline);
  const modal = render(
    <AntdConfigProvider productUI>
      <div>Independent modal</div>
    </AntdConfigProvider>,
  );
  modal.unmount();
  expect(document.body.className).toBe(productClasses);
  shell.rerender(
    <AntdConfigProvider productUI={false}>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  expect(document.body.className).toBe(baseline);
});

it("themes legacy editor controls rendered in a portal", () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      {createPortal(
        <div className="panel-dim-block" data-testid="image-picker">
          <div className="templated-string-input" data-testid="page-title">
            Title
          </div>
          <textarea
            className="textbox image-paster"
            data-testid="image-paste"
          />
        </div>,
        document.body,
      )}
    </AntdConfigProvider>,
  );
  expect(
    getComputedStyle(screen.getByTestId("page-title")).backgroundColor,
  ).toBe("rgb(32, 33, 40)");
  expect(getComputedStyle(screen.getByTestId("page-title")).color).toBe(
    "rgb(237, 238, 245)",
  );
  expect(
    getComputedStyle(screen.getByTestId("image-picker")).backgroundColor,
  ).toBe("rgb(21, 22, 27)");
  expect(getComputedStyle(screen.getByTestId("image-paste")).color).toBe(
    "rgb(237, 238, 245)",
  );
  act(() => setAppearancePreference("light"));
  expect(
    getComputedStyle(screen.getByTestId("page-title")).backgroundColor,
  ).toBe("rgb(255, 255, 255)");
  expect(getComputedStyle(screen.getByTestId("page-title")).color).toBe(
    "rgb(37, 42, 56)",
  );
});
