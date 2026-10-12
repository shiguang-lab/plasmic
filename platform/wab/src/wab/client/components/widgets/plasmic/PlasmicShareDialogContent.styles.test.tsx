import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { Modal } from "@/wab/client/components/widgets/Modal";
import PlasmicShareDialogContent from "@/wab/client/components/widgets/plasmic/PlasmicShareDialogContent";
import styles from "@/wab/client/components/widgets/plasmic/PlasmicShareDialogContent.module.css";
import { setLanguagePreference } from "@/wab/client/i18n";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
  setLanguagePreference("en");
  setAppearancePreference("light");
});

it("keeps the shared dialog rounded and primary action text readable in both themes", () => {
  setLanguagePreference("zh-CN");
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
  const copy = screen.getByText("复制链接", { selector: "span" });
  const arrow = ensure(screen.getByRole("button", { name: "Actions menu" }).querySelector("svg"), "Expected menu arrow");
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    expect(getComputedStyle(copy).color).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(arrow).color).toBe("rgb(255, 255, 255)");
    const surface = ensure(dialog.closest(".ant-modal-container"), "Expected native modal surface");
    expect(getComputedStyle(surface).overflow).toBe("hidden");
    expect(getComputedStyle(dialog).boxShadow).toBe("none");
  }
});
