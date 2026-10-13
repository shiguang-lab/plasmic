import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { PlasmicVariantsComboSelect } from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsComboSelect";
import { PlasmicVariantsMenu } from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsMenu";
import { PlasmicVariantRow } from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantRow";
import rowStyles from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantRow.module.css";
import { PlasmicVariantsGroupLabel } from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsGroupLabel";
import groupStyles from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsGroupLabel.module.css";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme } from "antd";
import * as React from "react";
import { createPortal } from "react-dom";

// Match production module scoping so unrelated generated class names cannot collide.
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsComboSelect.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => "PlasmicVariantsComboSelect_" + String(key) },
    ),
  }),
);

vi.mock(
  "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsMenu.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => "PlasmicVariantsMenu_" + String(key) },
    ),
  }),
);

vi.mock(
  "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantRow.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => "PlasmicVariantRow_" + String(key) },
    ),
  }),
);

vi.mock(
  "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsGroupLabel.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => "PlasmicVariantsGroupLabel_" + String(key) },
    ),
  }),
);

vi.mock("@/wab/client/plasmic/PlasmicButton.module.css", () => ({
  default: new Proxy(
    {},
    { get: (_target, key) => "PlasmicButton_" + String(key) },
  ),
}));

afterEach(cleanup);

it("themes the preview variant trigger and portaled menu through appearance changes", () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      <PlasmicVariantsComboSelect>highlight, night</PlasmicVariantsComboSelect>
      {createPortal(
        <PlasmicVariantsMenu
          root={(props) => <div {...props} data-testid="variant-menu" />}
          searchInput={{ readOnly: true }}
        >
          <PlasmicVariantsGroupLabel>AuditTheme</PlasmicVariantsGroupLabel>
          <PlasmicVariantRow>day</PlasmicVariantRow>
          <PlasmicVariantRow
            isRecording
            highlight
            root={(props) => <div {...props} data-testid="selected-row" />}
          >
            night
          </PlasmicVariantRow>
        </PlasmicVariantsMenu>,
        document.body,
      )}
    </AntdConfigProvider>,
  );
  const expected = document.createElement("div");
  document.body.appendChild(expected);
  const foreground = (element: Element, color: string) => {
    expected.style.color = color;
    expect(getComputedStyle(element).color).toBe(
      getComputedStyle(expected).color,
    );
  };
  const background = (element: Element, color: string) => {
    expected.style.backgroundColor = color;
    expect(getComputedStyle(element).backgroundColor).toBe(
      getComputedStyle(expected).backgroundColor,
    );
  };
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const trigger = screen.getByRole("button", { name: "highlight, night" });
    background(trigger, token.colorBgContainer);
    foreground(screen.getByText("highlight, night"), token.colorText);
    background(screen.getByTestId("variant-menu"), token.colorBgElevated);
    const search = screen.getByRole("textbox");
    foreground(search, token.colorText);
    background(search, "transparent");
    foreground(
      ensure(
        screen
          .getByText("AuditTheme")
          .closest(`.${groupStyles.slotTargetChildren}`),
        "Group text slot",
      ),
      token.colorTextSecondary,
    );
    foreground(
      ensure(
        screen.getByText("day").closest(`.${rowStyles.slotTargetChildren}`),
        "Row text slot",
      ),
      token.colorText,
    );
    foreground(
      ensure(
        screen.getByText("night").closest(`.${rowStyles.slotTargetChildren}`),
        "Selected text slot",
      ),
      token.colorErrorText,
    );
    background(screen.getByTestId("selected-row"), token.colorErrorBg);
  }
  expected.remove();
});
