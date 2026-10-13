import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import {
  CmsEnumInput,
  CmsLongTextInput,
  CmsObjectInput,
  ContentEntryFormContext,
} from "@/wab/client/components/cms/CmsInputs";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import type { ApiCmsDatabase } from "@/wab/shared/ApiSchema";
import { CmsMetaType, cmsFieldMetaDefaults } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Form, theme } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: vi.fn() }),
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({
    pathParams: { databaseId: "db1", tableId: "table1" },
  }),
}));

afterEach(cleanup);

it("shares the CMS theme with multiline fields through appearance changes", () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      <ContentEntryFormContext.Provider
        value={{
          disabled: false,
          name: ["longText"],
          typeMeta: { type: CmsMetaType.LONG_TEXT },
          database: mock<ApiCmsDatabase>(),
        }}
      >
        <CmsLongTextInput value={"First line\n第二行"} onChange={vi.fn()} />
      </ContentEntryFormContext.Provider>
    </AntdConfigProvider>,
  );
  const input = screen.getByRole("textbox");
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    expect(
      getComputedStyle(input)
        .getPropertyValue("--ant-color-bg-container")
        .trim(),
    ).toBe(token.colorBgContainer);
    expect(
      getComputedStyle(input).getPropertyValue("--ant-color-text").trim(),
    ).toBe(token.colorText);
    expect(input).toHaveValue("First line\n第二行");
  }
});

it("shows and expands readonly revision lists while keeping editing controls disabled", async () => {
  render(
    <AntdConfigProvider productUI>
      <Form
        initialValues={{
          items: [
            { label: "First revision item" },
            { label: "Second revision item" },
          ],
        }}
      >
        <ContentEntryFormContext.Provider
          value={{
            disabled: true,
            name: [],
            typeMeta: {
              type: CmsMetaType.OBJECT,
              fields: [
                {
                  ...cmsFieldMetaDefaults,
                  defaultValueByLocale: {},
                  identifier: "items",
                  label: "Items",
                  type: CmsMetaType.LIST,
                  fields: [
                    {
                      ...cmsFieldMetaDefaults,
                      defaultValueByLocale: {},
                      identifier: "label",
                      label: "Label",
                      type: CmsMetaType.TEXT,
                    },
                  ],
                },
              ],
            },
            database: mock<ApiCmsDatabase>(),
          }}
        >
          <CmsObjectInput />
        </ContentEntryFormContext.Provider>
      </Form>
    </AntdConfigProvider>,
  );
  expect(screen.getByText("Items")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Add item/ })).toBeNull();
  fireEvent.click(screen.getByText("Expand all"));
  expect(await screen.findByDisplayValue("First revision item")).toBeDisabled();
  expect(screen.getByDisplayValue("Second revision item")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: /Delete|Remove|Move/ }),
  ).toBeNull();
});

it("blocks readonly enum changes while keeping the registered values editable outside revision mode", async () => {
  const change = vi.fn();
  const field = (disabled: boolean) => (
    <AntdConfigProvider productUI>
      <ContentEntryFormContext.Provider
        value={{
          disabled,
          name: ["status"],
          typeMeta: { type: CmsMetaType.ENUM, options: ["Ready", "Draft"] },
          database: mock<ApiCmsDatabase>(),
        }}
      >
        <CmsEnumInput value="Ready" onChange={change} />
      </ContentEntryFormContext.Provider>
    </AntdConfigProvider>
  );
  const view = render(field(true));
  const readonly = screen.getByRole("button", { name: "Ready" });
  expect(readonly).toBeDisabled();
  fireEvent.click(readonly);
  expect(screen.queryByRole("listbox")).toBeNull();
  view.rerender(field(false));
  fireEvent.click(screen.getByRole("button", { name: "Ready" }));
  fireEvent.click(await screen.findByRole("option", { name: "Draft" }));
  expect(change).toHaveBeenCalledWith("Draft");
});
