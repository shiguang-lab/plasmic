import { theme } from "antd";
import { chromeLight } from "react-inspector";

/** Share the active control theme with query, expression, and value previews. */
export function useInspectorTheme() {
  const { token } = theme.useToken();
  return {
    ...chromeLight,
    BASE_BACKGROUND_COLOR: "transparent",
    BASE_COLOR: token.colorText,
    OBJECT_NAME_COLOR: token.colorText,
    OBJECT_VALUE_NULL_COLOR: token.colorTextSecondary,
    OBJECT_VALUE_UNDEFINED_COLOR: token.colorTextSecondary,
    OBJECT_VALUE_REGEXP_COLOR: token.colorErrorText,
    OBJECT_VALUE_STRING_COLOR: token.colorSuccessText,
    OBJECT_VALUE_SYMBOL_COLOR: token.colorSuccessText,
    OBJECT_VALUE_NUMBER_COLOR: token.colorPrimaryText,
    OBJECT_VALUE_BOOLEAN_COLOR: token.colorPrimaryText,
    OBJECT_VALUE_FUNCTION_PREFIX_COLOR: token.colorPrimaryText,
    HTML_TAG_COLOR: token.colorTextSecondary,
    HTML_TAGNAME_COLOR: token.colorPrimaryText,
    HTML_ATTRIBUTE_NAME_COLOR: token.colorText,
    HTML_ATTRIBUTE_VALUE_COLOR: token.colorSuccessText,
    HTML_COMMENT_COLOR: token.colorTextSecondary,
    HTML_DOCTYPE_COLOR: token.colorTextSecondary,
    ARROW_COLOR: token.colorTextSecondary,
    TABLE_BORDER_COLOR: token.colorBorder,
    TABLE_TH_BACKGROUND_COLOR: token.colorBgContainer,
    TABLE_TH_HOVER_COLOR: token.colorFillSecondary,
    TABLE_SORT_ICON_COLOR: token.colorTextSecondary,
    TABLE_DATA_BACKGROUND_IMAGE: "none",
  };
}
