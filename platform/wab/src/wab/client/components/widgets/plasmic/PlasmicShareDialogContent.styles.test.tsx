import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { Modal } from "@/wab/client/components/widgets/Modal";
import PlasmicShareDialogContent from "@/wab/client/components/widgets/plasmic/PlasmicShareDialogContent";
import styles from "@/wab/client/components/widgets/plasmic/PlasmicShareDialogContent.module.css";
import { getUiLocale, setLanguagePreference } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import React from "react";

afterEach(async () => {
  cleanup();
  await setLanguagePreference("en");
  setAppearancePreference("light");
});

it("leaves the dialog surface to Modal and keeps primary action text readable in both themes", async () => {
  await setLanguagePreference("zh-CN");
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      <Modal open footer={null} styles={{ container: { padding: 0 } }}>
        <PlasmicShareDialogContent resourceType="project" />
      </Modal>
    </AntdConfigProvider>,
  );
  expect(screen.getByText("分享此项目")).toBeTruthy();
  expect(screen.getByText("其他所有人")).toBeTruthy();
  expect(screen.queryByText("as")).toBeNull();
  const dialog = ensure(screen.getByText("分享此项目").closest(`.${styles.root}`), "Expected share dialog");
  // CSS module class names are unscoped in tests; inspect this module's rule
  // directly so other components' .root styles cannot affect the assertion.
  const contentCss = readFileSync(`${__dirname}/PlasmicShareDialogContent.module.css`, "utf8");
  const rootRule = ensure(contentCss.match(/\.root\s*\{([^}]+)\}/)?.[1], "Expected content root rule");
  expect(rootRule).not.toMatch(/(?:background|border|box-shadow)\s*[-:]/);
  const copy = screen.getByText("复制链接", { selector: "span" });
  const arrow = ensure(screen.getByRole("button", { name: translate(getUiLocale(), "{part1} menu", { part1: translate(getUiLocale(), "Actions") }) }).querySelector("svg"), "Expected menu arrow");
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    expect(getComputedStyle(copy).color).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(arrow).color).toBe("rgb(255, 255, 255)");
    const surface = ensure(dialog.closest(".ant-modal-container"), "Expected native modal surface");
    expect(getComputedStyle(surface).overflow).toBe("hidden");
  }
});
