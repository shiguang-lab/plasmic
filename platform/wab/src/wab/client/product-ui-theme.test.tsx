import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import SearchInput from "@/wab/client/components/sidebar-tabs/ProjectPanel/SearchInput";
import { useEditorPopupStyles } from "@/wab/client/components/ui/layout-styles";
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
import { theme } from "antd";
import { readFileSync } from "node:fs";
import * as React from "react";

// Production modules have distinct class names. Vitest's unscoped codegen
// names otherwise let unrelated controls' slot rules mask theme regressions.
vi.mock("@/wab/client/plasmic/PlasmicButton.module.css", () => ({
  default: new Proxy({}, { get: (_target, key) => `action-${String(key)}` }),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicChip.module.css",
  () => ({
    default: new Proxy({}, { get: (_target, key) => `chip-${String(key)}` }),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicSearchInput.module.css",
  () => ({
    default: new Proxy({}, { get: (_target, key) => `search-${String(key)}` }),
  }),
);

vi.mock(
  "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsComboSelect.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => `variants-${String(key)}` },
    ),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDataSourceOption.module.css",
  () => ({
    default: new Proxy({}, { get: (_target, key) => `source-${String(key)}` }),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavWorkspaceButton.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => `workspace-${String(key)}` },
    ),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_insert_panel/PlasmicQuickInsertItem.module.css",
  () => ({
    default: new Proxy({}, { get: (_target, key) => `insert-${String(key)}` }),
  }),
);

const generatedStyles: HTMLStyleElement[] = [];
function loadGeneratedCss(path: string, prefix: string) {
  const style = document.createElement("style");
  style.textContent = readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/:global\(([^)]+)\)/g, "$1")
    .replace(/\.([A-Za-z_][\w-]*)/g, (match, name: string) =>
      name.startsWith("__") ? match : `.${prefix}-${name}`,
    );
  document.head.prepend(style);
  generatedStyles.push(style);
}

beforeAll(() => {
  loadGeneratedCss("./plasmic/PlasmicButton.module.css", "action");
  loadGeneratedCss(
    "./plasmic/plasmic_kit_project_panel/PlasmicSearchInput.module.css",
    "search",
  );
  loadGeneratedCss(
    "./plasmic/plasmic_kit_design_system/PlasmicChip.module.css",
    "chip",
  );
  loadGeneratedCss(
    "./plasmic/plasmic_kit_dashboard/PlasmicDataSourceOption.module.css",
    "source",
  );
  loadGeneratedCss(
    "./plasmic/plasmic_kit_dashboard/PlasmicNavWorkspaceButton.module.css",
    "workspace",
  );
  loadGeneratedCss(
    "./plasmic/plasmic_kit_insert_panel/PlasmicQuickInsertItem.module.css",
    "insert",
  );
});
afterAll(() => generatedStyles.forEach((style) => style.remove()));

function hover(element: Element) {
  fireEvent.mouseOver(element);
  // jsdom tracks :hover but needs a mutation to invalidate computed styles.
  element.setAttribute("data-hover-probe", "true");
}

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
  const { styles } = useEditorPopupStyles();
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

it("keeps popup primary labels and icons paired with their fill on hover", () => {
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
    const token = theme.getDesignToken(productTheme(appearance));
    slots.forEach((slot) => expectColor(slot, token.colorTextLightSolid));
    hover(action);
    slots.forEach((slot) => expectColor(slot, token.colorTextLightSolid));
    const disabled = screen.getByRole("button", { name: "Disabled action" });
    hover(disabled);
    expectColor(disabled, token.colorTextDisabled);
  }
});

it("keeps collapsed search and clear icons readable on hover", () => {
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
    fireEvent.mouseOut(root);
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    expectColor(icon, token.colorTextSecondary);
    hover(root);
    expectColor(icon, token.colorText);
    hover(clear);
    expectColor(clear, token.colorText);
  }
  fireEvent.click(clear);
  expect(onClear).toHaveBeenCalledOnce();
});

it("themes chip removal and the color picker's surrounding surface", () => {
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
    const token = theme.getDesignToken(productTheme(appearance));
    hover(remove);
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

it("binds colored action scales through normal, hover and pressed states", () => {
  const { container } = render(
    <AntdConfigProvider productUI>
      <Button color="red">Remove</Button>
      <Button color="green">Apply</Button>
      <Button color="purple">Create</Button>
    </AntdConfigProvider>,
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
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
  (kind) => {
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
      const token = theme.getDesignToken(productTheme(appearance));
      hover(root);
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
