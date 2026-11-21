import { userEvent as browserUser } from "vitest/browser";
import styles from "./components/ui/EditorPopup.module.less";
import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import SearchInput from "@/wab/client/components/sidebar-tabs/ProjectPanel/SearchInput";
import { IconLinkButton } from "@/wab/client/components/widgets";
import Button from "@/wab/client/components/widgets/Button";
import Chip from "@/wab/client/components/widgets/Chip";
import button from "@/wab/client/plasmic/PlasmicButton.module.css";
import { PlasmicDataSourceOption } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDataSourceOption";
import { PlasmicNavWorkspaceButton } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavWorkspaceButton";
import chip from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicChip.module.css";
import { PlasmicQuickInsertItem } from "@/wab/client/plasmic/plasmic_kit_insert_panel/PlasmicQuickInsertItem";
import search from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicSearchInput.module.css";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { theme as AntdTheme } from "antd";
import * as React from "react";

// Production modules have distinct class names. Vitest's unscoped codegen
// names otherwise let unrelated controls' slot rules mask theme regressions.
function expectColor(element: Element, color: string, background = false) {
  const probe = document.createElement("div");
  probe.style.color = color;
  probe.style.backgroundColor = color;
  document.body.appendChild(probe);
  expect(
    background
      ? getComputedStyle(element).backgroundColor
      : getComputedStyle(element).color,
  ).toBe(
    background
      ? getComputedStyle(probe).backgroundColor
      : getComputedStyle(probe).color,
  );
  probe.remove();
}

afterEach(() => {
  cleanup();
  setAppearancePreference("dark");
});

function PopupActions() {

  return (
    <div className={styles.root}>
      <Button
        type="primary"
        withIcons={["startIcon", "endIcon"]}
        startIcon={<span>Start</span>}
        endIcon={<span>End</span>}
      >
        Save changes
      </Button>
      <IconLinkButton disabled>Disabled action</IconLinkButton>
    </div>
  );
}

it("keeps popup primary labels and icons paired with their fill on hover", async () => {
  render(
    <AntdConfigProvider productUI>
      <PopupActions />
    </AntdConfigProvider>,
  );
  const action = screen.getByRole("button", { name: /Save changes/ });
  const slots = [
    button.slotTargetChildren,
    button.slotTargetStartIcon,
    button.slotTargetEndIcon,
  ].map((className) =>
    ensure(action.querySelector(`.${className}`), "Expected action slot"),
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    slots.forEach((slot) => expectColor(slot, token.colorTextLightSolid));
    await browserUser.hover(action);
    slots.forEach((slot) => expectColor(slot, token.colorTextLightSolid));
    const disabled = screen.getByRole("button", { name: "Disabled action" });
    await browserUser.hover(disabled);
    expectColor(disabled, token.colorTextDisabled);
  }
});

it("keeps collapsed search and clear icons readable on hover", async () => {
  const onClear = vi.fn();
  const { container } = render(
    <AntdConfigProvider productUI>
      <SearchInput collapsed />
      <SearchInput onClear={onClear} />
    </AntdConfigProvider>,
  );
  const root = ensure(
    container.querySelector(`.${search.searchInputContainer}`),
    "Expected search control",
  );
  const icon = ensure(
    root.querySelector(`.${search.svg}`),
    "Expected search icon",
  );
  const clear = ensure(
    container.querySelector(`.${search.clearFieldIcon}`),
    "Expected clear icon",
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    const input = ensure(container.querySelector("input"), "Expected expanded search");
    fireEvent.change(input, { target: { value: "Project" } });
    await browserUser.hover(input);
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    expectColor(icon, token.colorTextSecondary);
    await browserUser.hover(root);
    expectColor(icon, token.colorText);
    await browserUser.hover(clear);
    expectColor(clear, token.colorText);
  }
  fireEvent.click(clear);
  expect(onClear).toHaveBeenCalledOnce();
});

it("themes chip removal and the color picker's surrounding surface", async () => {
  const onDelete = vi.fn();
  const { container } = render(
    <AntdConfigProvider productUI>
      <Chip onDelete={onDelete}>Selected token</Chip>
      <div className="pcr-app" data-theme="nano" data-testid="color-picker" />
    </AntdConfigProvider>,
  );
  const remove = ensure(
    container.querySelector(`.${chip.closeIcon}`),
    "Expected chip remove icon",
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    await browserUser.hover(remove);
    expectColor(remove, token.colorText);
    expectColor(
      screen.getByTestId("color-picker"),
      token.colorBgElevated,
      true,
    );
  }
  fireEvent.click(remove);
  expect(onDelete).toHaveBeenCalledOnce();
});

it("binds colored action scales through normal, hover and pressed states", async () => {
  const { container } = render(
    <AntdConfigProvider productUI>
      <Button color="red">Remove</Button>
      <Button color="green">Apply</Button>
      <Button color="purple">Create</Button>
    </AntdConfigProvider>,
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    const action = ensure(
      container.querySelector("button"),
      "Expected generated action",
    );
    const style = getComputedStyle(action);
    const expected = {
      "--token-qYuX4XAEbRt": token.colorErrorBg,
      "--token-HKVCQ5ZKovK": token.colorErrorBgHover,
      "--token-5kjtdCiiOPB": token.colorErrorBgHover,
      "--token-Y2CWh0ci95a": token.colorErrorText,
      "--token-Ift7nNWjir7": token.colorErrorTextActive,
      "--token-h-5XbcO2WhcA": token.colorSuccessBg,
      "--token-dv0BWWyaHl7H": token.colorSuccessBgHover,
      "--token-3AptjBfMqvPS": token.colorSuccessBgHover,
      "--token-AKguBXlLTkKh": token.colorSuccessTextActive,
      "--token-Cr1odk81N3Y": token.colorPrimaryBg,
      "--token-oPrqrxbKHqk": token.colorPrimaryBgHover,
      "--token-I2zAJ678hbp": token.colorPrimaryBgHover,
      "--token-ZaJGjVCo3Ue": token.colorPrimaryTextActive,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(style.getPropertyValue(name).trim(), name).toBe(value);
    }
  }
});

it.each(["insert", "selected insert", "data source", "workspace"] as const)(
  "themes the %s hover surface instead of restoring a fixed light background",
  async (kind) => {
    const { container } = render(
      <AntdConfigProvider productUI>
        {kind === "data source" ? (
          <PlasmicDataSourceOption name="Database" />
        ) : kind === "workspace" ? (
          <PlasmicNavWorkspaceButton name="Workspace" />
        ) : (
          <PlasmicQuickInsertItem isSelected={kind === "selected insert"}>
            Container
          </PlasmicQuickInsertItem>
        )}
      </AntdConfigProvider>,
    );
    const root = ensure(
      container.firstElementChild,
      "Expected generated control",
    );
    for (const appearance of ["dark", "light", "dark"] as const) {
      act(() => setAppearancePreference(appearance));
      const token = AntdTheme.getDesignToken(productTheme(appearance));
      await browserUser.hover(root);
      expectColor(
        root,
        kind === "selected insert"
          ? token.colorPrimaryBg
          : token.colorFillSecondary,
        true,
      );
    }
  },
);
