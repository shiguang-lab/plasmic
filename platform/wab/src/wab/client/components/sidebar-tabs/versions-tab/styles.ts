import header from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftPaneHeader.module.css";
import separator from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicListSeperator.module.css";
import item from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicVersionsListItem.module.css";
import { productPalette } from "@/wab/client/product-ui-theme.styles";
import { createStyles } from "antd-style";

export const useVersionsStyles = createStyles(({ token }) => ({
  root: {
    ...productPalette(token),
    "&&": {
      background: token.colorBgContainer,
      color: token.colorText,
      flex: 1,
      minHeight: 0,
    },
    [`& .${header.header}`]: { padding: "12px 16px", rowGap: 12 },
    [`& .${header.titleContainer}`]: { display: "none" },
    [`& .${header.descriptionContainer}`]: {
      color: token.colorTextSecondary,
      fontSize: 12,
      lineHeight: 1.6,
    },
    [`& .${header.alertContainer}`]: {
      background: token.colorWarningBg,
      padding: "10px 12px",
      borderColor: token.colorWarningBorder,
    },
    [`& .${header.slotTargetAlert}`]: {
      color: token.colorWarningText,
      fontSize: 12,
    },
    "& a": { color: token.colorPrimaryText },
    [`& .${separator.root}`]: { margin: "8px 0" },
    [`& .${separator.separatorLine}`]: {
      borderColor: token.colorBorderSecondary,
    },
    [`& .${separator.freeBox__i2Yzw}`]: {
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
      padding: "0 8px",
    },
    [`& .${separator.slotTargetChildren}`]: {
      color: token.colorTextSecondary,
      fontSize: 11,
    },
    [`& .${item.listItemContainer}:hover`]: {
      background: token.colorFillTertiary,
      boxShadow: "none",
    },
    [`& .${item.listItemContainerisSelected}`]: {
      background: token.colorPrimaryBg,
      boxShadow: `inset 2px 0 ${token.colorPrimary}`,
    },
    [`& .${item.nameAndDate}`]: {
      color: token.colorTextSecondary,
      fontSize: 12,
      lineHeight: "18px",
    },
    [`& .${item.userAndDateContainer}`]: {
      minWidth: 0,
      flexWrap: "wrap",
      rowGap: 4,
    },
    "& .dimfg": { color: token.colorTextSecondary },
  },
  search: {
    padding: "8px 16px",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    flexShrink: 0,
  },
  description: { display: "flex", flexDirection: "column", gap: 4 },
}));
