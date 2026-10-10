import cmsLeftTabs from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsLeftTabs.module.css";
import cmsTopBar from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsTopBar.module.css";
import { productPalette } from "@/wab/client/product-ui-theme.styles";
import { createStyles } from "antd-style";

export const useCmsLayoutStyles = createStyles(({ token }) => ({
  root: {
    ...productPalette(token),
    background: token.colorBgLayout,
    color: token.colorText,
    [`& .${cmsTopBar.root}`]: {
      height: 56,
      flexShrink: 0,
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
    },
    [`& .${cmsLeftTabs.root}`]: {
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
    },
  },
  loading: {
    width: "100%",
    padding: 32,
    background: token.colorBgLayout,
    color: token.colorText,
  },
  entries: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: 240,
    height: "100%",
    minHeight: 0,
    flexShrink: 0,
    padding: 16,
    background: token.colorBgContainer,
    color: token.colorText,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
  },
  entryList: { flex: 1, minHeight: 0, overflowY: "auto" },
}));
