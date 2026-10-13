import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import {
  CmsLongTextInput,
  ContentEntryFormContext,
} from "@/wab/client/components/cms/CmsInputs";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import type { ApiCmsDatabase } from "@/wab/shared/ApiSchema";
import { CmsMetaType } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

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
