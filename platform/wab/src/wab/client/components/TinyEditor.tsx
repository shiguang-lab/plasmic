// TinyMCE tries to use window.matchMedia when imported, causing it to
// crash if running on node (where window.matchMedia is undefined).
// Although we are in client/, some test specs import from it and fail if
// we remove this `if`.
if (window && "matchMedia" in window) {
  const tinymce = require("tinymce/tinymce");

  require("tinymce/icons/default");
  require("tinymce/models/dom/model");
  require("tinymce/themes/silver");

  require("tinymce/plugins/advlist");
  require("tinymce/plugins/anchor");
  require("tinymce/plugins/autolink");
  require("tinymce/plugins/charmap");
  require("tinymce/plugins/code");
  require("tinymce/plugins/codesample");
  require("tinymce/plugins/fullscreen");
  require("tinymce/plugins/image");
  require("tinymce/plugins/insertdatetime");
  require("tinymce/plugins/link");
  require("tinymce/plugins/lists");
  require("tinymce/plugins/media");
  require("tinymce/plugins/preview");
  require("tinymce/plugins/searchreplace");
  require("tinymce/plugins/table");
  require("tinymce/plugins/visualblocks");
}

// @ts-ignore
import lightSkin from "!!raw-loader!tinymce/skins/ui/tinymce-5/skin.min.css";
// @ts-ignore
import darkSkin from "!!raw-loader!tinymce/skins/ui/tinymce-5-dark/skin.min.css";

// @ts-ignore
import contentCss from "!!raw-loader!../../gen/static/styles/tinymce-content-css.txt";
// @ts-ignore
import prismCss from "!!raw-loader!../../gen/static/styles/prismjs-css.txt";

import { getCmsImageUrl } from "@/wab/client/components/sidebar/image-asset-controls";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { getMessages } from "@/wab/client/i18n/locales";
import { Editor, IAllProps } from "@tinymce/tinymce-react";
import { useTheme } from "antd-style";
import * as React from "react";
import type { Editor as TinyMceEditor } from "tinymce";

type TinyEditorProps = Omit<IAllProps, "onChange"> & {
  onChange: (value: string) => void;
};

export function TinyEditor({
  value,
  onChange,
  onInit,
  ...props
}: TinyEditorProps) {
  const appCtx = useAppCtx();
  const { locale } = useI18n();
  if ("matchMedia" in window) {require("tinymce/tinymce").addI18n(locale, getMessages(locale) ?? {});}
  const token = useTheme();
  const [editor, setEditor] = React.useState<TinyMceEditor>();
  const contentTheme = `
    html, body { background: ${token.colorBgContainer}; color: ${token.colorText}; }
    body { font-family: ${token.fontFamily}; }
    a { color: ${token.colorLink}; }
    blockquote { border-left-color: ${token.colorBorder}; }
    ::selection { background: ${token.colorPrimaryBgHover}; }
  `;
  // The editable document lives in an iframe. Update its presentation in place
  // so appearance changes keep the draft, selection and editor undo history.
  React.useEffect(() => {
    if (!editor) {
      return;
    }
    const doc = editor.getDoc();
    let style = doc.getElementById("cms-editor-theme");
    if (!style) {
      style = doc.createElement("style");
      style.id = "cms-editor-theme";
      doc.head.appendChild(style);
    }
    style.textContent = contentTheme;
  }, [editor, contentTheme]);
  return (
    <div>
      <style>{`${token.isDarkMode ? darkSkin : lightSkin}
        .tox.tox-tinymce { border-color: ${token.colorBorder}; border-radius: ${token.borderRadius}px; }
        .tox .tox-editor-header, .tox .tox-toolbar-overlord,
        .tox .tox-edit-area__iframe { background: ${token.colorBgContainer}; }
        /* The bundled TinyMCE 5 skin marks toolbar backgrounds important. */
        .tox .tox-toolbar, .tox .tox-toolbar__primary, .tox .tox-toolbar__overflow {
          background: ${token.colorBgContainer} !important;
          box-shadow: inset 0 -1px ${token.colorBorder};
        }
        .tox:not([dir=rtl]) .tox-toolbar__group:not(:last-of-type),
        .tox[dir=rtl] .tox-toolbar__group:not(:last-of-type) { border-color: ${token.colorBorder}; }
        .tox .tox-tbtn { color: ${token.colorText}; }
        .tox .tox-tbtn svg { fill: ${token.colorText}; }
        .tox .tox-tbtn:hover { background: ${token.colorFillSecondary}; }
      `}</style>
      <Editor
        key={locale}
        init={{
          language: locale,
          skin: false,
          content_css: false,
          height: 500,
          width: 600,
          menubar: false,
          statusbar: false,
          content_style: `body {
              font-family: Helvetica, Arial, sans-serif;
              font-size: 13px;
              line-height: 1.42;
            }

            img {
              height: auto;
              max-width: 100%;
            }

            ${contentCss}
            ${prismCss}
            ${contentTheme}
            `,
          plugins: [
            "advlist",
            "anchor",
            "autolink",
            "charmap",
            "code",
            "codesample",
            "fullscreen",
            "image",
            "insertdatetime",
            "link",
            "lists",
            "media",
            "preview",
            "searchreplace",
            "table",
            "visualblocks",
          ],
          toolbar: [
            "undo redo | bold italic underline strikethrough | forecolor backcolor | superscript subscript | removeformat",
            "blocks | alignleft aligncenter alignright alignjustify | numlist bullist outdent indent",
            "link anchor image media | blockquote table codesample hr |  code",
          ],
          images_upload_handler: async (blobInfo) => {
            const uploaded = await appCtx.api.uploadImageFile({
              imageFile: blobInfo.blob(),
            });
            return getCmsImageUrl(uploaded);
          },
        }}
        {...props}
        onInit={(event, instance) => {
          setEditor(instance);
          onInit?.(event, instance);
        }}
        value={value}
        onEditorChange={(newValue) => onChange(newValue)}
      />
    </div>
  );
}
