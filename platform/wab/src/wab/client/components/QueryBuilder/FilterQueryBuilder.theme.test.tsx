import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { FilterQueryBuilder } from "@/wab/client/components/QueryBuilder/FilterQueryBuilder";
import { useQueryBuilderStyles } from "@/wab/client/components/QueryBuilder/QueryBuilder.styles";
import { setUiLocale } from "@/wab/client/i18n";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  Segmented,
  Select,
  TimePicker,
  theme as AntdTheme,
} from "antd";
import { ThemeProvider } from "antd-style";
import dayjs from "dayjs";
import { readFileSync } from "node:fs";
import * as React from "react";
import type { RuleGroupType } from "react-querybuilder";
import { compile } from "sass";

const config: QueryBuilderConfig = {
  fields: [
    { name: "text", label: "Text", datatype: "text" },
    {
      name: "number",
      label: "Number",
      datatype: "number",
      inputType: "number",
    },
    { name: "boolean", label: "Boolean", datatype: "boolean" },
    {
      name: "select",
      label: "Select",
      valueEditorType: "select",
      values: [
        { name: "open", label: "Open" },
        { name: "closed", label: "Closed" },
      ],
    },
    { name: "date", label: "Date", datatype: "date", inputType: "date" },
    { name: "time", label: "Time", datatype: "time", inputType: "time" },
  ],
};
const value: RuleGroupType = {
  id: "root",
  combinator: "and",
  rules: [
    { id: "text", field: "text", operator: "=", value: "Ada" },
    { id: "number", field: "number", operator: "=", value: 18 },
    { id: "boolean", field: "boolean", operator: "=", value: true },
    { id: "select", field: "select", operator: "=", value: "open" },
    { id: "date", field: "date", operator: "=", value: "2026-11-06" },
    { id: "time", field: "time", operator: "=", value: "18:30:00" },
  ],
};
const onChange = vi.fn();
const loadedStyles: HTMLStyleElement[] = [];
beforeAll(async () => {
  await setUiLocale("en");
  // Include the actual stylesheets that Vitest normally stubs. This catches
  // legacy property-row overrides masking Antd's native interactive states.
  for (const path of [
    "../../../styles/antd-overrides.scss",
    "./QueryBuilder.scss",
  ]) {
    const style = document.createElement("style");
    style.textContent = compile(new URL(path, import.meta.url).pathname).css;
    document.head.prepend(style);
    loadedStyles.push(style);
  }
  const vendor = document.createElement("style");
  vendor.textContent = readFileSync(
    require.resolve("react-querybuilder/dist/query-builder.css"),
    "utf8",
  );
  document.head.prepend(vendor);
  loadedStyles.push(vendor);
});
afterAll(() => loadedStyles.forEach((style) => style.remove()));
afterEach(() => {
  cleanup();
  setAppearancePreference("dark");
});
function FramedBuilder({ disabled = false }: { disabled?: boolean }) {
  const { styles } = useQueryBuilderStyles();
  return (
    <div data-testid="frame" className={`labeled-item ${styles.frame}`}>
      <FilterQueryBuilder
        config={config}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
function ReferenceControls({ children }: { children: React.ReactNode }) {
  const { styles } = useQueryBuilderStyles();
  return (
    <div data-testid="reference" className={styles.root}>
      {children}
    </div>
  );
}
function queryControl(root: ParentNode, id: string, selector: string) {
  return ensure(
    root.querySelector(`.rule[data-rule-id="${id}"] .rule-value ${selector}`),
    `Expected ${id} editor`,
  );
}
function expectSameStyle(actual: Element, reference: Element) {
  const actualStyle = getComputedStyle(actual);
  const referenceStyle = getComputedStyle(reference);
  for (const property of [
    "color",
    "background-color",
    "border-top-color",
    "border-top-width",
    "border-radius",
    "font-family",
    "box-shadow",
  ]) {
    expect(actualStyle.getPropertyValue(property), property).toBe(
      referenceStyle.getPropertyValue(property),
    );
  }
}
it("updates group colors, sizing, and every drag state with the selected theme", () => {
  const { container } = render(
    <AntdConfigProvider productUI>
      <FramedBuilder />
    </AntdConfigProvider>,
  );
  const root = ensure(
    container.querySelector(".query-builder"),
    "Expected query builder",
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    const css = getComputedStyle(root);
    expect(css.getPropertyValue("--rqb-border-color")).toBe(
      token.colorBorderSecondary,
    );
    expect(css.getPropertyValue("--rqb-background-color")).toBe(
      token.colorFillQuaternary,
    );
    expect(css.getPropertyValue("--rqb-spacing")).toBe(`${token.paddingXS}px`);
    expect(css.getPropertyValue("--rqb-border-radius")).toBe(
      `${token.borderRadiusSM}px`,
    );
    expect(css.getPropertyValue("--rqb-dnd-drop-indicator-color")).toBe(
      token.colorPrimary,
    );
    expect(css.getPropertyValue("--rqb-dnd-drop-indicator-copy-color")).toBe(
      token.colorSuccess,
    );
    expect(css.getPropertyValue("--rqb-dnd-drop-indicator-group-color")).toBe(
      token.colorInfo,
    );
    expect(css.fontSize).toBe(`${token.fontSizeSM}px`);
    expect(css.fontFamily.replace(/,\s*/g, ",")).toBe(
      token.fontFamily.replace(/,\s*/g, ","),
    );
    expect(
      getComputedStyle(screen.getByTestId("frame")).paddingBlockStart,
    ).toBe(`${token.paddingSM}px`);
  }
});
it.each([false, true])(
  "preserves native control styling inside property rows (disabled=%s)",
  (disabled) => {
    const options = [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ];
    const { container } = render(
      <AntdConfigProvider productUI>
        <FramedBuilder disabled={disabled} />
        <ReferenceControls>
          <Input disabled={disabled} size="small" value="Ada" readOnly />
          <InputNumber disabled={disabled} size="small" value={18} />
          <Segmented
            disabled={disabled}
            size="small"
            value="yes"
            options={[
              { value: "yes", label: "✓" },
              { value: "no", label: "✕" },
            ]}
          />
          <Select
            disabled={disabled}
            size="small"
            value="open"
            options={options}
            allowClear
            showSearch
          />
          <DatePicker
            disabled={disabled}
            size="small"
            value={dayjs("2026-11-06")}
          />
          <TimePicker
            disabled={disabled}
            size="small"
            value={dayjs("2026-11-06T18:30:00")}
            format="HH:mm:ss"
          />
          <Button disabled={disabled} size="small">
            Reference action
          </Button>
        </ReferenceControls>
      </AntdConfigProvider>,
    );
    const reference = screen.getByTestId("reference");
    const selectors = [
      ["text", ".ant-input"],
      ["number", ".ant-input-number"],
      ["boolean", ".ant-segmented"],
      ["select", ".ant-select"],
      ["date", ".ant-picker"],
      ["time", ".ant-picker"],
    ];
    for (const appearance of ["dark", "light", "dark"] as const) {
      act(() => setAppearancePreference(appearance));
      for (const [id, selector] of selectors) {
        const actual = queryControl(container, id, selector);
        const expected = ensure(
          reference.querySelector(
            id === "time" ? ".ant-picker:last-of-type" : selector,
          ),
          "Expected native reference control",
        );
        expectSameStyle(actual, expected);
        fireEvent.mouseOver(actual);
        actual.setAttribute("data-hover-probe", appearance);
        fireEvent.mouseOver(expected);
        expected.setAttribute("data-hover-probe", appearance);
        expectSameStyle(actual, expected);
        fireEvent.mouseOut(actual);
        fireEvent.mouseOut(expected);
      }
      const input = queryControl(container, "text", ".ant-input");
      const expectedInput = ensure(
        reference.querySelector(".ant-input"),
        "Expected reference input",
      );
      if (!disabled) {
        act(() => {
          (input as HTMLInputElement).focus();
        });
        const focusStyle = getComputedStyle(input).boxShadow;
        act(() => {
          (expectedInput as HTMLInputElement).focus();
        });
        expect(focusStyle).toBe(getComputedStyle(expectedInput).boxShadow);
        act(() => {
          (expectedInput as HTMLInputElement).blur();
        });
      }
      expectSameStyle(
        screen.getByRole("button", { name: "Add rule" }),
        screen.getByRole("button", { name: "Reference action" }),
      );
    }
  },
);
it("keeps select portals and selected options themed while switching appearance", async () => {
  const { container } = render(
    <AntdConfigProvider productUI>
      <FramedBuilder />
      <Select
        open
        size="small"
        value="open"
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
        classNames={{ popup: { root: "reference-select-popup" } }}
      />
    </AntdConfigProvider>,
  );
  fireEvent.mouseDown(
    ensure(
      queryControl(container, "select", ".ant-select").querySelector("input"),
      "Expected select trigger",
    ),
  );
  await waitFor(() =>
    expect(
      document.querySelectorAll(".ant-select-dropdown").length,
    ).toBeGreaterThanOrEqual(2),
  );
  const popup = ensure(
    [...document.querySelectorAll(".ant-select-dropdown")].find(
      (node) => !node.classList.contains("reference-select-popup"),
    ),
    "Expected query popup portal",
  );
  const reference = ensure(
    document.querySelector(".reference-select-popup"),
    "Expected native popup",
  );
  expect(container.contains(popup)).toBe(false);
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    expectSameStyle(popup, reference);
    const selected = ensure(
      popup.querySelector(".ant-select-item-option-selected"),
      "Expected selected query option",
    );
    const expected = ensure(
      reference.querySelector(".ant-select-item-option-selected"),
      "Expected selected reference option",
    );
    expectSameStyle(selected, expected);
    const option = ensure(
      popup.querySelector(".ant-select-item-option"),
      "Expected query option",
    );
    fireEvent.mouseOver(option);
    expectSameStyle(
      option,
      ensure(
        reference.querySelector(".ant-select-item-option"),
        "Expected native option",
      ),
    );
  }
});

it("honors custom typography, radius, spacing and semantic color tokens", () => {
  const custom = {
    token: {
      fontSizeSM: 17,
      borderRadiusSM: 11,
      paddingXS: 13,
      colorPrimary: "#be123c",
      colorSuccess: "#047857",
      colorInfo: "#0369a1",
      fontFamily: "monospace",
    },
  };
  const { container } = render(
    <ThemeProvider appearance="light" theme={custom}>
      <FilterQueryBuilder
        config={{ fields: [config.fields[0]] }}
        value={{ combinator: "and", rules: [value.rules[0]] }}
        onChange={onChange}
      />
    </ThemeProvider>,
  );
  const css = getComputedStyle(
    ensure(container.querySelector(".query-builder"), "Expected query builder"),
  );
  expect(css.fontSize).toBe("17px");
  expect(css.fontFamily).toBe("monospace");
  expect(css.getPropertyValue("--rqb-border-radius")).toBe("11px");
  expect(css.getPropertyValue("--rqb-spacing")).toBe("13px");
  const token = AntdTheme.getDesignToken(custom);
  expect(css.getPropertyValue("--rqb-dnd-drop-indicator-color")).toBe(
    token.colorPrimary,
  );
  expect(css.getPropertyValue("--rqb-dnd-drop-indicator-copy-color")).toBe(
    token.colorSuccess,
  );
  expect(css.getPropertyValue("--rqb-dnd-drop-indicator-group-color")).toBe(
    token.colorInfo,
  );
});
it.each(["date", "time"])(
  "keeps %s picker portals themed while switching appearance",
  async (id) => {
    const referenceDate = dayjs("2026-11-06T18:30:00");
    const popupProps = {
      open: true,
      size: "small" as const,
      value: referenceDate,
      classNames: { popup: { root: "reference-picker-popup" } },
    };
    const { container } = render(
      <AntdConfigProvider productUI>
        <FramedBuilder />
        {id === "time" ? (
          <TimePicker {...popupProps} format="HH:mm:ss" />
        ) : (
          <DatePicker {...popupProps} />
        )}
      </AntdConfigProvider>,
    );
    const input = ensure(
      queryControl(container, id, ".ant-picker").querySelector("input"),
      "Expected picker trigger",
    );
    fireEvent.mouseDown(input);
    fireEvent.focus(input);
    fireEvent.click(input);
    await waitFor(() =>
      expect(
        document.querySelectorAll(".ant-picker-dropdown").length,
      ).toBeGreaterThanOrEqual(2),
    );
    const popup = ensure(
      [...document.querySelectorAll(".ant-picker-dropdown")].find(
        (node) => !node.classList.contains("reference-picker-popup"),
      ),
      "Expected query picker portal",
    );
    const reference = ensure(
      document.querySelector(".reference-picker-popup"),
      "Expected native picker portal",
    );
    expect(container.contains(popup)).toBe(false);
    for (const appearance of ["dark", "light", "dark"] as const) {
      act(() => setAppearancePreference(appearance));
      expectSameStyle(
        ensure(
          popup.querySelector(".ant-picker-panel-container"),
          "Expected query picker surface",
        ),
        ensure(
          reference.querySelector(".ant-picker-panel-container"),
          "Expected native picker surface",
        ),
      );
      const selectedSelector =
        id === "time"
          ? ".ant-picker-time-panel-cell-selected .ant-picker-time-panel-cell-inner"
          : ".ant-picker-cell-selected .ant-picker-cell-inner";
      expectSameStyle(
        ensure(
          popup.querySelector(selectedSelector),
          "Expected selected query value",
        ),
        ensure(
          reference.querySelector(selectedSelector),
          "Expected selected native value",
        ),
      );
    }
  },
);
