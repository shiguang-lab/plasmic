import button from "@/wab/client/plasmic/PlasmicButton.module.css";
import componentView from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicComponentView.module.css";
import docs from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPortal.module.css";
import branch from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPortalBranch.module.css";
import header from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPortalHeader.module.css";
import { productPalette } from "@/wab/client/product-ui-theme.styles";
import { createStyles } from "antd-style";

export const useDocsLayoutStyles = createStyles(({ token }) => ({
  root: {
    ...productPalette(token),
    color: token.colorText,
    "&&": { background: token.colorBgLayout, color: token.colorText },
    [`& .${componentView.freeBox__wsP0Q}, & .${componentView.freeBox__vapgF}`]:
      { background: token.colorBgContainer },
    [`& .${header.root}`]: {
      height: 56,
      flexShrink: 0,
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
    },
    [`& .${header.root} .${button.root}, & .${header.root} .${button.slotTargetChildren}`]:
      { color: token.colorText },
    [`& .${branch.slotTargetSlot}`]: { color: token.colorTextSecondary },
    [`& .${docs.body}`]: { background: token.colorBgLayout },
    [`& .${docs.sidebar}`]: {
      width: 240,
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
    },
    [`& .${docs.itemsContainer}`]: {
      overflowY: "auto",
      scrollbarColor: `${token.colorBorder} transparent`,
    },
    "@media (max-width: 1100px)": { [`& .${docs.sidebar}`]: { width: 200 } },
  },
}));
