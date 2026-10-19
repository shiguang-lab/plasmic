import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { PlasmicDataPicker } from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPicker";
import pickerStyles from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPicker.module.css";
import { PlasmicDataPickerCodeEditorLayout } from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPickerCodeEditorLayout";
import codeStyles from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPickerCodeEditorLayout.module.css";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme } from "antd";
import * as React from "react";
import { createPortal } from "react-dom";

// Preserve distinct generated class names, as in the production CSS build.
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPicker.module.css",
  () => ({
    default: new Proxy({}, { get: (_target, key) => `picker-${String(key)}` }),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPickerCodeEditorLayout.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => `picker-code-${String(key)}` },
    ),
  }),
);

afterEach(() => {
  cleanup();
  setAppearancePreference("dark");
});

it("themes the portaled code picker, context panel and preview through appearance changes", () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      {createPortal(
        <PlasmicDataPicker
          codeEditing
          codeEditor={{
            render: () => (
              <PlasmicDataPickerCodeEditorLayout
                codeEditor={
                  <textarea aria-label="Expression" defaultValue="user.name" />
                }
                codePreview="Example"
                env="Context"
              />
            ),
          }}
        />,
        document.body,
      )}
    </AntdConfigProvider>,
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const expected = document.createElement("div");
    expected.style.backgroundColor = token.colorBgContainer;
    expected.style.color = token.colorText;
    expected.style.borderColor = token.colorBorderSecondary;
    document.body.appendChild(expected);
    const probe = getComputedStyle(expected);
    for (const className of [
      pickerStyles.footer,
      codeStyles.envPanelContainer,
      codeStyles.previewPanel,
    ]) {
      const element = ensure(
        document.querySelector(`.${className}`),
        "Expected picker panel",
      );
      expect(getComputedStyle(element).backgroundColor).toBe(
        probe.backgroundColor,
      );
      expect(getComputedStyle(element).borderColor).toBe(probe.borderColor);
    }
    const picker = ensure(
      document.querySelector(`.${pickerStyles.root}`),
      "Expected picker root",
    );
    expected.style.backgroundColor = token.colorBgElevated;
    expect(getComputedStyle(picker).backgroundColor).toBe(
      getComputedStyle(expected).backgroundColor,
    );
    expect(getComputedStyle(picker).color).toBe(probe.color);
    expect(screen.getByRole("textbox", { name: "Expression" })).toHaveProperty(
      "value",
      "user.name",
    );
    expected.remove();
  }
});
