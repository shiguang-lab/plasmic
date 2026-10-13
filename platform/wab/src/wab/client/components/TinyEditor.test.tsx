import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { TinyEditor } from "@/wab/client/components/TinyEditor";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { act, cleanup, render } from "@testing-library/react";
import type { IAllProps } from "@tinymce/tinymce-react";
import { theme } from "antd";
import React from "react";
import type { Editor as TinyMceEditor } from "tinymce";
import { mock } from "vitest-mock-extended";

const editorProps = vi.hoisted((): { current?: IAllProps } => ({}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ api: {} }),
}));
vi.mock("@/wab/client/components/sidebar/image-asset-controls", () => ({
  getCmsImageUrl: vi.fn(),
}));
vi.mock("@tinymce/tinymce-react", () => ({
  Editor: (props: IAllProps) => {
    editorProps.current = props;
    return <div />;
  },
}));
afterEach(cleanup);

it("uses shared language packs for rich text UI while preserving business content", () => {
  const onChange = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <TinyEditor value="<p>Business 中文</p>" onChange={onChange} />
    </AntdConfigProvider>,
  );
  for (const { value } of languageOptions) {
    act(() => setLanguagePreference(value));
    expect(editorProps.current?.init?.language).toBe(value);
    expect(editorProps.current?.value).toBe("<p>Business 中文</p>");
    expect(translate(value, "Bold")).toBeTruthy();
    expect(
      translate(value, "Rich Text Area. Press ALT-0 for help."),
    ).toBeTruthy();
  }
  expect(onChange).not.toHaveBeenCalled();
});

it("updates the editable iframe theme without changing its content or replacing the editor", async () => {
  setAppearancePreference("dark");
  const onChange = vi.fn();
  const onInit = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <TinyEditor
        value="<p>Draft with 中文</p>"
        onChange={onChange}
        onInit={onInit}
      />
    </AntdConfigProvider>,
  );
  const doc = document.implementation.createHTMLDocument("Editable document");
  doc.body.innerHTML = "<p>Draft with 中文</p>";
  const editor = mock<TinyMceEditor>();
  editor.getDoc.mockReturnValue(doc);
  const event = mock<Parameters<NonNullable<IAllProps["onInit"]>>[0]>();
  await act(() => editorProps.current?.onInit?.(event, editor));
  const originalStyle = doc.getElementById("cms-editor-theme");
  expect(originalStyle).toBeTruthy();
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    expect(doc.getElementById("cms-editor-theme")).toBe(originalStyle);
    expect(originalStyle?.textContent).toContain(
      `background: ${token.colorBgContainer}`,
    );
    expect(originalStyle?.textContent).toContain(`color: ${token.colorText}`);
    expect(doc.body.innerHTML).toBe("<p>Draft with 中文</p>");
    expect(editorProps.current?.value).toBe("<p>Draft with 中文</p>");
    expect(editorProps.current?.init?.content_css).toBe(false);
  }
  expect(onChange).not.toHaveBeenCalled();
  expect(onInit).toHaveBeenCalledTimes(1);
  act(() => editorProps.current?.onEditorChange?.("<p>User edit</p>", editor));
  expect(onChange).toHaveBeenCalledWith("<p>User edit</p>");
});
