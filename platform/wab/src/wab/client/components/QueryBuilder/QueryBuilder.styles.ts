import { createStyles } from "antd-style";

export const useQueryBuilderStyles = createStyles(({ token }) => ({
  root: {
    "--rqb-spacing": `${token.paddingXS}px`,
    "--rqb-border-width": `${token.lineWidth}px`,
    "--rqb-border-style": token.lineType,
    "--rqb-border-radius": `${token.borderRadiusSM}px`,
    "--rqb-border-color": token.colorBorderSecondary,
    "--rqb-background-color": token.colorFillQuaternary,
    "--rqb-base-color": token.colorText,
    "--rqb-dnd-drop-indicator-color": token.colorPrimary,
    "--rqb-dnd-drop-indicator-width": `${token.lineWidthBold}px`,
    "--rqb-dnd-drop-indicator-copy-color": token.colorSuccess,
    "--rqb-dnd-drop-indicator-copy-width": `${token.lineWidthBold}px`,
    "--rqb-dnd-drop-indicator-group-color": token.colorInfo,
    "--rqb-dnd-drop-indicator-group-width": `${token.lineWidthBold}px`,
    "--rqb-branch-color": token.colorBorderSecondary,
    "--rqb-branch-radius": `${token.borderRadiusSM}px`,
    "--rqb-branch-width": `${token.lineWidth}px`,
    color: token.colorText,
    fontFamily: token.fontFamily,
    fontSize: token.fontSizeSM,
    lineHeight: token.lineHeight,
  },
  frame: {
    width: "100%",
    marginBlock: token.marginXS,
    paddingBlockStart: token.paddingSM,
    paddingBlockEnd: token.paddingLG,
    borderBlock: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
  },
}));
