import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import responsivenessPanel from "@/wab/client/components/sidebar-tabs/ResponsivenessPanel/ResponsivenessPanel.module.scss";
import sidebarSection from "@/wab/client/components/sidebar/SidebarSection.module.scss";
import button from "@/wab/client/plasmic/PlasmicButton.module.css";
import iconButton from "@/wab/client/plasmic/PlasmicIconButton.module.css";
import fontsPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftFontsPanel.module.css";
import imagesPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftImagesPanel.module.css";
import mixinsPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftMixinsPanel.module.css";
import panelHeader from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftPaneHeader.module.css";
import searchPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftSearchPanel.module.css";
import versionsPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftVersionsPanel.module.css";
import panelTextbox from "@/wab/client/plasmic/plasmic_kit/PlasmicTextbox.module.css";
import navButton from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavButton.module.css";
import separator from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavSeparator.module.css";
import navTeam from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavTeamButton.module.css";
import navSection from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavTeamSection.module.css";
import navWorkspace from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavWorkspaceButton.module.css";
import actionButton from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicActionMenuButton.module.css";
import insertPanel from "@/wab/client/plasmic/plasmic_kit_insert_panel/PlasmicInsertPanel.module.css";
import listBottomFade from "@/wab/client/plasmic/plasmic_kit_insert_panel/PlasmicListBottomFade.module.css";
import storeCard from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicAddDrawerCardItem.module.css";
import animationsPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftAnimationSequencesPanel.module.css";
import componentsPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftComponentsPanel.module.css";
import expressionsPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftExprsSearchPanel.module.css";
import dataTokensPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftGeneralDataTokensPanel.module.css";
import tokensPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftGeneralTokensPanel.module.css";
import issuesPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftLintIssuesPanel.module.css";
import leftPane from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftPane.module.css";
import splitsPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSplitsPanel.module.css";
import leftTabButton from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftTabButton.module.css";
import themesPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftThemesPanel.module.css";
import navigation from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicNavigationDropdown.module.css";
import outlinePanel from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicOutlineTab.module.css";
import navigationSearch from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicSearchInput.module.css";
import rowItem from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicRowItem.module.css";
import textboxLike from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicTextboxLike.module.css";
import topBar from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar.module.css";
import { productPalette } from "@/wab/client/product-ui-theme.styles";
import { createStyles } from "antd-style";

// Popovers render outside the editor root, so generated controls need the same
// palette at the portal boundary as their counterparts inside the editor.
export const useEditorPopupStyles = createStyles(({ token }) => ({
  menuScroll: {
    maxHeight: "80vh",
    borderRadius: token.borderRadiusSM,
    background: token.colorBgElevated,
    boxShadow: token.boxShadowSecondary,
    "& .ant-dropdown-menu": {
      maxHeight: "none",
      overflow: "visible",
      boxShadow: "none",
    },
  },
  root: {
    ...productPalette(token),
    color: token.colorText,
    "& .shortcut-combo": {
      background: token.colorBgContainer,
      color: token.colorText,
      border: `1px solid ${token.colorBorderSecondary}`,
      boxShadow: "none",
      padding: "2px 5px",
      minWidth: 18,
      textAlign: "center",
    },
    "& button": {
      color: token.colorText,
      fontSize: 13,
      minHeight: 36,
      borderRadius: token.borderRadius,
    },
    "& button:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "& button[aria-expanded=true]": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
    },
    "& button:hover": { background: token.colorFillSecondary },
    "& .editor-management-menu": {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      gap: 4,
      borderTop: `1px solid ${token.colorBorder}`,
      paddingTop: 8,
    },
    "& .editor-management-menu button": {
      width: "100%",
      height: 36,
      justifyContent: "flex-start",
      flexDirection: "row",
      gap: 8,
    },
    [`& .${leftTabButton.slotTargetLabel}`]: {
      color: token.colorText,
      fontSize: 13,
    },
    [`& .${button.slotTargetChildren}`]: { color: token.colorText },
  },
}));

export const useApplicationLayoutStyles = createStyles(({ token }) => ({
  root: {
    height: "100vh",
    overflow: "hidden",
    color: token.colorText,
    background: token.colorBgLayout,
    fontFamily: token.fontFamily,
    "& > div": { marginTop: 56 },
    "--ui-surface": token.colorBgContainer,
    "--ui-bg": token.colorBgLayout,
    "--ui-border": token.colorBorder,
    "--ui-text": token.colorText,
    "--ui-muted": token.colorTextSecondary,
    "--ui-accent": token.colorPrimary,
    "--ui-hover": token.colorFillSecondary,
    "--ui-selected": token.colorPrimaryBg,
  },
  header: {
    background: token.colorBgContainer,
    color: token.colorText,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    boxShadow: "none",
    height: 56,
    lineHeight: "normal",
    padding: 0,
    "&&": { background: token.colorBgContainer, height: 56, padding: 0 },
  },
  wrapper: {
    background: token.colorBgLayout,
    flexDirection: "row",
    minHeight: 0,
  },
  sidebar: {
    background: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
    color: token.colorText,
    "& [data-plasmic-name=nav]": { background: "transparent" },
    [`& .${navButton.slotTargetChildren}, & .${navTeam.slotTargetName}, & .${navWorkspace.slotTargetName}`]:
      { color: token.colorText },
    [`& .${navButton.slotTargetStartIcon}, & .${navWorkspace.slotTargetIcon}`]:
      { color: token.colorTextSecondary },
    [`& .${navButton.root}:hover, & .${navTeam.root}:hover, & .${navWorkspace.root}:hover`]:
      { background: token.colorFillSecondary },
    [`& .${navButton.rootselected}, & .${navTeam.rootselected}, & .${navWorkspace.rootselected}`]:
      { background: token.colorPrimaryBg },
    [`& .${navSection.root}`]: { background: "transparent" },
    [`& .${separator.freeBox}`]: { background: token.colorBorderSecondary },
    "& a, & button": { color: token.colorTextSecondary },
    "& a:hover, & button:hover": {
      color: token.colorText,
      background: token.colorFillSecondary,
    },
  },
  main: { background: token.colorBgLayout, color: token.colorText },
}));

export const useEditorLayoutStyles = createStyles(({ token }) => ({
  root: {
    // Editor DOM also mounts in the separate canvas host document.
    ...productPalette(token),
    color: token.colorText,
    background: token.colorBgLayout,
    "& .SidebarSection__Container": { borderColor: token.colorBorderSecondary },
    [`& .${sidebarSection.headerTitle}, & .${sidebarSection.headerTitleActive}`]:
      { color: token.colorText },
    [`& .${textboxLike.slotTargetChildrencolor_purple}`]: {
      color: token.colorPrimaryText,
    },
    [`& .${textboxLike.controlContainercolor_purple}`]: {
      background: token.colorPrimaryBg,
    },
    [`& .${topBar.root} .${button.root}, & .${topBar.root} .${button.freeBox}, & .${topBar.root} .${button.startIconContainer}, & .${topBar.root} .${button.endIconContainer}`]:
      { color: token.colorText },
    [`& .${topBar.root} .${actionButton.actionButton}, & .${topBar.root} .${actionButton.menuButton}`]:
      { color: token.colorText },
    "& .tpltree__nodeLabel__name": { color: token.colorText },
    "& .tpltree__nodeLabel__summary, & .tpltree__label--hidden .tpltree__nodeLabel__name":
      { color: token.colorTextSecondary },
    "& .tpltree__label:hover": { background: token.colorFillTertiary },
    "& .tpltree__label--hovered": { boxShadow: "none" },
    "& .tpltree__label--focused-descendant": {
      background: token.colorFillQuaternary,
    },
    "& .tpltree__label--drilled-descendant": {
      background: token.colorPrimaryBg,
    },
    "& .tpltree__label--focused, & .tpltree__label--focused:hover, & .tpltree__label--drilled-descendant.tpltree__label--focused":
      {
        background: token.colorPrimaryBg,
        boxShadow: `inset 2px 0 ${token.colorPrimary}`,
        color: token.colorText,
      },
    "& .tpltree__label--focused .tpltree__nodeLabel__summary": {
      color: token.colorText,
    },
    "& .tpltree__label__action-icon, & .tpltree__label__menu": {
      width: 24,
      height: 24,
      padding: 0,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 6,
      background: "transparent",
      color: token.colorTextSecondary,
      "&:hover": {
        background: token.colorFillSecondary,
        color: token.colorText,
      },
    },
    "& .tpltree__label__menu": { display: "inline-flex" },
    [`& .tpltree__label__menu .${iconButton.slotTargetChildren}`]: {
      color: "inherit",
    },
    "& .tpltree__label__action-icon svg, & .tpltree__label__menu svg": {
      width: 16,
      height: 16,
      color: "inherit",
    },
    [`& .${button.slotTargetChildrentype_primary}, & .${actionButton.slotTargetChildrentype_primary}`]:
      { color: token.colorTextLightSolid },
    "& .value-preview": { color: token.colorPrimaryText },
    "& .value-preview--error": { color: token.colorErrorText },
    "& .value-preview--loading": { color: token.colorTextSecondary },
    "& .dimfg, & .panel-section__title": { color: token.colorTextSecondary },
    "@media (max-width: 1100px)": {
      "& .canvas-editor--left-panel-open .canvas-editor__right-pane": {
        display: "none",
      },
    },
    "& .canvas-editor__hsplit": { position: "relative", minHeight: 0 },
    "& .canvas-editor__top-bar": {
      position: "absolute",
      top: 16,
      left: 16,
      right: 16,
      height: 48,
      zIndex: 40,
      pointerEvents: "none",
      background: "transparent",
    },
    [`& .canvas-editor__top-bar .${topBar.root}`]: {
      height: 48,
      paddingRight: 0,
      justifyContent: "space-between",
      background: "transparent",
      border: 0,
      pointerEvents: "none",
    },
    [`& .canvas-editor__top-bar .${topBar.left}, & .canvas-editor__top-bar .${topBar.right}`]:
      {
        width: "auto",
        height: 48,
        padding: "0 8px",
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        boxShadow: token.boxShadowSecondary,
        pointerEvents: "auto",
      },
    [`& .canvas-editor__top-bar .${topBar.left}`]: {
      flexShrink: 1,
      minWidth: 0,
    },
    [`& .canvas-editor__top-bar .${topBar.right}`]: { flexShrink: 0 },
    "& .editor-brand-mark": { fill: token.colorPrimary },
    "& .editor-brand-label": { color: token.colorText },
    [`& .canvas-editor__top-bar .${topBar.titleSegment}`]: {
      height: 32,
      gap: 0,
      minWidth: 0,
      flexShrink: 1,
      overflow: "visible",
      alignItems: "center",
    },
    [`& .canvas-editor__top-bar .${topBar.titleSegment} .${topBar.saveIndicator}`]:
      { marginLeft: 6, flexShrink: 0 },
    "& .editor-project-title": {
      display: "inline-flex",
      alignItems: "center",
      height: 32,
      minWidth: 0,
      maxWidth: "30vw",
      padding: "0 0 0 8px",
      gap: 8,
      color: token.colorText,
      fontSize: 13,
      fontWeight: 600,
      lineHeight: "20px",
      borderRadius: 7,
      boxShadow: "none",
    },
    "& .editor-project-title > span:not(.ant-btn-icon)": {
      minWidth: 0,
      overflow: "hidden",
    },
    "& .editor-project-title .ant-btn-icon": {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
    },
    "& .editor-project-title svg": {
      width: 18,
      height: 18,
      flexShrink: 0,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      color: token.colorTextSecondary,
      transform: "translateY(-1px)",
    },
    "& .editor-project-title:disabled": {
      color: token.colorText,
      background: "transparent",
      cursor: "default",
    },
    "& .editor-project-title:not(:disabled):hover, & .editor-project-trigger:hover":
      {
        background: token.colorFillSecondary,
        color: token.colorText,
      },
    "& .editor-project-title:focus-visible, & .editor-project-trigger:focus-visible":
      {
        outline: `2px solid ${token.colorPrimary}`,
        outlineOffset: 2,
      },
    "& .editor-project-trigger[aria-expanded=true]": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
    },
    "& .editor-project-name": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& .editor-primary-actions": {
      display: "flex",
      alignItems: "center",
      gap: 3,
    },
    "& .editor-primary-actions .ant-btn": {
      height: 32,
      borderRadius: 7,
      fontSize: 12,
      boxShadow: "none",
    },
    "& .editor-primary-actions .ant-btn[aria-expanded=true]": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
      borderColor: token.colorPrimary,
    },
    "& .editor-primary-actions .ant-btn:focus-visible, & #left-tab-strip button:focus-visible":
      { outline: `2px solid ${token.colorPrimary}`, outlineOffset: 2 },
    "& .canvas-editor__left-pane button:focus-visible, & .canvas-editor__right-pane button:focus-visible":
      { outline: `2px solid ${token.colorPrimary}`, outlineOffset: -2 },
    "& .editor-primary-actions svg, & .editor-history-controls svg": {
      width: 17,
      height: 17,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    "& .editor-history-controls": {
      display: "flex",
      alignItems: "center",
      gap: 2,
      paddingRight: 0,
    },
    "& .editor-history-controls .ant-btn": {
      width: 32,
      height: 32,
      padding: 0,
      borderRadius: 7,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "none",
    },
    "& .editor-history-controls .ant-btn:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "& .editor-primary-actions #view-menu": {
      width: "auto",
      padding: "0 10px",
      gap: 6,
    },
    "& .editor-primary-actions #view-menu .editor-view-chevron": {
      width: 12,
      height: 12,
    },
    "& .editor-primary-actions .editor-icon-action": {
      width: 32,
      height: 32,
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 7,
    },
    "& .editor-primary-actions .editor-icon-action:hover:not(:disabled), & .editor-history-controls .ant-btn:hover:not(:disabled)":
      {
        background: token.colorFillTertiary,
        color: token.colorText,
      },
    "& .editor-primary-actions .editor-icon-action:disabled, & .editor-history-controls .ant-btn:disabled":
      {
        opacity: 0.35,
      },
    "& .editor-code-controls": {
      display: "flex",
      alignItems: "center",
      gap: 2,
    },
    "& .editor-code-controls > .editor-code-options": { width: 22, padding: 2 },
    "& .editor-action-divider": {
      width: 1,
      height: 18,
      background: token.colorBorderSecondary ?? token.colorBorder,
      margin: "0 4px",
      flexShrink: 0,
    },
    "& .editor-history-divider": {
      width: 1,
      height: 22,
      flexShrink: 0,
      background: token.colorBorder,
    },
    "& .editor-history-action": {
      width: 28,
      height: 32,
      padding: 5,
      borderRadius: 7,
    },
    "& .editor-history-action svg": {
      width: 18,
      height: 18,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
    },
    "& .editor-project-trigger": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 32,
      padding: 6,
      flexShrink: 0,
      color: token.colorTextSecondary,
      borderRadius: 7,
      boxShadow: "none",
    },
    "& .editor-project-trigger svg": {
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
    },
    "& .editor-rail-divider": {
      width: 24,
      height: 1,
      flexShrink: 0,
      alignSelf: "center",
      background: token.colorBorder,
      margin: "9px 0",
    },

    "& .resource-panel-library-actions": {
      flexShrink: 0,
      padding: "12px",
      borderTop: `1px solid ${token.colorBorderSecondary}`,
    },
    [`& .canvas-editor__left-pane .${button.root}`]: {
      color: token.colorText,
      "&:hover:not(:disabled)": { background: token.colorFillSecondary },
      "&:focus-visible": {
        outline: `2px solid ${token.colorPrimary}`,
        outlineOffset: 2,
      },
    },
    [`& .canvas-editor__left-pane .${button.slotTargetChildrentype_secondary}`]:
      {
        color: token.colorText,
      },
    "& .editor-panel-header": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px",
      height: 48,
      flexShrink: 0,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    },
    "& .editor-issues-panel": {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      background: token.colorBgContainer,
      color: token.colorText,
    },
    "& .editor-issues-panel .ant-empty": { color: token.colorTextSecondary },
    "& .editor-navigation-tabs": { flex: 1, minWidth: 0, marginRight: 12 },
    "& .editor-navigation-tabs .ant-tabs-nav": { margin: 0 },
    "& .editor-navigation-tabs .ant-tabs-nav::before": { border: 0 },
    "& .editor-navigation-tabs .ant-tabs-nav-list": {
      padding: 3,
      gap: 4,
      background: token.colorFillTertiary,
      borderRadius: token.borderRadius,
      width: "100%",
    },
    "& .editor-navigation-tabs .ant-tabs-tab + .ant-tabs-tab": { margin: 0 },
    "& .editor-navigation-tabs .ant-tabs-tab-active": {
      background: token.colorBgContainer,
      boxShadow: token.boxShadowTertiary,
    },
    "& .editor-navigation-tabs .ant-tabs-ink-bar": { display: "none" },
    "& .editor-inspector-tabs": { flex: 1, minHeight: 0 },
    "& .editor-inspector-tabs > .ant-tabs-nav": {
      margin: 0,
      padding: "0 12px",
      flexShrink: 0,
    },
    "& .editor-inspector-tabs .ant-tabs-tab": { padding: "12px 0" },
    "& .editor-inspector-tabs > .ant-tabs-body-holder": {
      minHeight: 0,
      overflow: "hidden",
    },
    "& .editor-inspector-tabs .ant-tabs-body, & .editor-inspector-tabs .ant-tabs-content":
      { height: "100%" },
    "& .editor-inspector-tabs .ant-tabs-content > .vlist-scrollable-descendant":
      { height: "100%" },
    [`& .canvas-editor__right-pane .${sidebarSection.headerRoot}`]: {
      minHeight: 40,
    },
    "& .canvas-editor__right-pane .SidebarSection__Body:not(.SidebarSection__Body__NoBottomPadding):not(.SidebarSection__Body__EmptyBody)":
      { paddingBottom: 12 },
    [`& .canvas-editor__right-pane .${sidebarSection.headerTitle}`]: {
      color: token.colorText,
    },
    "& .canvas-editor__right-pane .SidebarSection__Container:not(.SidebarSection__Container--NoBorder)":
      { borderColor: token.colorBorderSecondary },
    "& .canvas-editor__left-pane .right-panel-input-background__no-height, & .canvas-editor__left-pane .dropdown-container":
      {
        background: token.colorFillQuaternary,
        color: token.colorText,
        borderRadius: 7,
        minHeight: 32,
      },
    "& .canvas-editor__left-pane .dropdown-pill": {
      background: token.colorFillSecondary,
      color: token.colorText,
    },
    "& .canvas-editor__left-pane .dropdown-input-container input": {
      color: token.colorText,
      background: "transparent",
    },
    "& .canvas-editor__left-pane .ant-radio-button-wrapper": {
      background: "transparent",
      color: token.colorTextSecondary,
      "&:hover": { color: token.colorPrimaryText },
    },
    "& .canvas-editor__left-pane .ant-radio-button-wrapper-checked": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
    },
    [`& .canvas-editor__left-pane .${responsivenessPanel.contentRoot} p`]: {
      marginBottom: 12,
      lineHeight: 1.6,
      color: token.colorTextSecondary,
    },
    [`& .canvas-editor__left-pane .${responsivenessPanel.deleteIconCol} svg`]: {
      color: token.colorTextSecondary,
      "&:hover": { color: token.colorError },
    },
    [`& .canvas-editor__left-pane .${responsivenessPanel.warningIconCustomVariant}, & .canvas-editor__left-pane .${responsivenessPanel.warningIconBaseVariant}`]:
      {
        color: token.colorWarning,
      },
    "& .editor-panel-title": {
      flex: 1,
      marginLeft: 8,
      color: token.colorText,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& .editor-navigation-tabs .ant-tabs-tab": {
      padding: "4px 12px",
      flex: 1,
      justifyContent: "center",
      borderRadius: token.borderRadiusSM,
      fontSize: 13,
    },
    "& .editor-page-navigation": {
      overflow: "hidden",
      minHeight: 0,
      height: "100%",
    },
    "& .editor-navigation-root": {
      height: "100%",
      minHeight: 0,
      alignItems: "stretch",
    },
    "& .editor-navigation-tree": { flex: 1, minHeight: 0 },
    "& .editor-document-label": { minWidth: 0, overflow: "hidden" },
    "& .editor-document-label > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& .editor-document-label .dimfg": {
      color: token.colorTextSecondary,
      fontSize: 12,
    },
    [`& .editor-page-navigation .${navigation.freeBox__n0S7B}`]: {
      flex: 1,
      minHeight: 0,
      overflow: "hidden",
    },
    [`& .editor-page-navigation .${navigation.freeBox__qEfvh}`]: {
      flexShrink: 0,
      padding: 12,
      rowGap: 10,
    },
    "& .editor-page-navigation .shortcut-combo": {
      background: token.colorFillSecondary,
      color: token.colorTextSecondary,
      boxShadow: "none",
      border: `1px solid ${token.colorBorderSecondary}`,
    },
    "& .editor-page-navigation .bt-dim": {
      borderTopColor: token.colorBorderSecondary,
    },
    [`& .canvas-editor__left-pane .${navigationSearch.searchInputContainer}`]: {
      height: 34,
      minHeight: 34,
      borderColor: token.colorBorder,
      background: token.colorBgLayout,
      "&:hover": { boxShadow: `0 0 0 1px ${token.colorBorder}` },
      "&:focus-within": {
        boxShadow: `0 0 0 2px ${token.colorPrimaryBg}`,
        borderColor: token.colorPrimary,
      },
    },
    [`& .canvas-editor__left-pane .${navigationSearch.searchInput}`]: {
      color: token.colorText,
    },
    [`& .canvas-editor__left-pane .${navigationSearch.svg}`]: {
      color: token.colorTextSecondary,
    },
    [`& .canvas-editor__left-pane .${navigationSearch.searchInput}::placeholder`]:
      { color: token.colorTextPlaceholder },
    [`& .canvas-editor__left-pane .${navigationSearch.clearFieldIcon}`]: {
      color: token.colorTextSecondary,
    },
    [`& .canvas-editor__left-pane .${outlinePanel.freeBox__k743O}`]: {
      margin: "0 12px",
    },
    [`& .canvas-editor__left-pane .${outlinePanel.freeBox__qdVl}`]: {
      margin: "0 12px",
      alignItems: "center",
    },
    [`& .editor-page-navigation .${navigation.text}`]: {
      fontSize: 12,
      fontWeight: 400,
      padding: 0,
      color: token.colorTextSecondary,
    },
    [`& .editor-page-navigation .${navigation.root}`]: {
      height: "100%",
      minHeight: 0,
      background: token.colorBgContainer,
      color: token.colorText,
      borderRadius: 0,
      transition: "none",
    },
    [`& .editor-page-navigation .${button.slotTargetChildren}`]: {
      color: token.colorText,
    },
    "& .editor-page-navigation .editor-navigation-current": {
      boxShadow: `inset 2px 0 ${token.colorPrimary}`,
      background: token.colorPrimaryBg,
    },
    [`& .editor-page-navigation .${rowItem.freeBox}`]: { gap: 4 },
    [`& .editor-page-navigation .${rowItem.freeBox} button`]: {
      width: 24,
      height: 24,
      padding: 0,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 6,
      background: "transparent",
      color: token.colorTextSecondary,
      "&:hover": {
        background: token.colorFillTertiary,
        color: token.colorText,
      },
      "&:active": { background: token.colorFillSecondary },
      "&:focus-visible": {
        outline: `2px solid ${token.colorPrimary}`,
        outlineOffset: 2,
      },
    },
    [`& .editor-page-navigation .${rowItem.freeBox} .${iconButton.slotTargetChildren}`]:
      {
        color: "inherit",
      },
    [`& .editor-page-navigation .${rowItem.freeBox} button svg`]: {
      width: 16,
      height: 16,
      color: "inherit",
    },
    [`& .editor-page-navigation .${rowItem.root}:hover .${rowItem.menuButton}.__wab_instance.__wab_instance`]:
      {
        display: "inline-flex",
      },
    "@media (max-width: 800px)": {
      [`& .canvas-editor__top-bar .${topBar.projectTitle}`]: { maxWidth: 140 },
    },
    [`& .canvas-editor__left-pane-container .${leftPane.root}`]: {
      background: "transparent",
      border: 0,
    },
    "& .canvas-editor__top-pane__floating-elements-container": {
      paddingTop: 82,
    },
    "& #left-tab-strip": {
      width: 56,
      height: "auto",
      maxHeight: "100%",
      padding: "6px 5px",
      alignSelf: "flex-start",
      border: `1px solid ${token.colorBorder}`,
      borderRadius: token.borderRadiusLG,
      boxShadow: token.boxShadowSecondary,
      background: token.colorBgContainer,
    },
    [`& #left-tab-strip .${leftTabButton.root}`]: {
      flexDirection: "column",
      justifyContent: "center",
      width: 44,
      height: 46,
      padding: "4px 2px",
      gap: 2,
    },
    [`& #left-tab-strip .${leftTabButton.slotTargetLabel}`]: {
      fontSize: 10,
      lineHeight: "12px",
      textAlign: "center",
      maxWidth: 42,
      overflow: "hidden",
      display: "block",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      color: token.colorTextSecondary,
    },
    "& #left-tab-strip button[aria-current='true']": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
    },
    [`& #left-tab-strip button[aria-current='true'] .${leftTabButton.slotTargetLabel}`]:
      { color: token.colorPrimaryText },
    "& #left-tab-strip button:disabled": { opacity: 0.4, cursor: "default" },
    "& .canvas-editor__left-pane-container": { zIndex: 20 },
    "@media (prefers-reduced-motion: reduce)": {
      [[
        fontsPanel,
        imagesPanel,
        mixinsPanel,
        versionsPanel,
        tokensPanel,
        dataTokensPanel,
        componentsPanel,
        expressionsPanel,
        themesPanel,
        splitsPanel,
        issuesPanel,
        animationsPanel,
      ]
        .map((panel) => `& .canvas-editor__left-pane .${panel.root}`)
        .join(", ")]: {
        background: token.colorBgContainer,
        color: token.colorText,
        minHeight: 0,
      },
      [`& .canvas-editor__left-pane .${panelHeader.header}`]: {
        padding: "12px 16px",
        rowGap: 12,
        borderColor: token.colorBorderSecondary,
      },
      [`& .canvas-editor__left-pane .${panelHeader.descriptionContainer}`]: {
        color: token.colorTextSecondary,
        fontSize: 12,
        lineHeight: 1.6,
      },
      [`& .canvas-editor__left-pane .${panelHeader.slotTargetTitle}`]: {
        color: token.colorText,
        fontSize: 13,
        lineHeight: "20px",
      },
      "& .canvas-editor__left-pane a": { color: token.colorPrimaryText },
      "& .canvas-editor__left-pane a:hover": { color: token.colorPrimaryHover },
      [`& .canvas-editor__left-pane .${searchPanel.searchPanel}`]: {
        height: "auto",
        minHeight: 56,
        padding: "10px 12px",
        gap: 6,
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      },
      [`& .canvas-editor__left-pane .${searchPanel.searchPanel} .${panelTextbox.root}`]:
        {
          flex: 1,
          minWidth: 0,
          minHeight: 34,
          borderRadius: 7,
          background: token.colorBgLayout,
          boxShadow: `inset 0 0 0 1px ${token.colorBorder}`,
        },
      [`& .canvas-editor__left-pane .${searchPanel.searchPanel} .${panelTextbox.root}:focus-within`]:
        {
          boxShadow: `inset 0 0 0 1px ${token.colorPrimary}, 0 0 0 2px ${token.colorPrimaryBg}`,
        },
      [`& .canvas-editor__left-pane .${searchPanel.searchPanel} input`]: {
        background: "transparent",
        color: token.colorText,
        fontSize: 13,
        lineHeight: "20px",
        minHeight: 32,
      },
      "& .canvas-editor__left-pane input::placeholder": {
        color: token.colorTextPlaceholder,
      },
      [`& .canvas-editor__left-pane .${searchPanel.searchPanel} svg`]: {
        color: token.colorTextSecondary,
      },
      "& .canvas-editor__left-pane .dimfg": { color: token.colorTextSecondary },
    },
    [[
      fontsPanel,
      imagesPanel,
      mixinsPanel,
      versionsPanel,
      tokensPanel,
      dataTokensPanel,
      componentsPanel,
      expressionsPanel,
      themesPanel,
      splitsPanel,
      issuesPanel,
      animationsPanel,
    ]
      .map((panel) => `& .canvas-editor__left-pane .${panel.root}`)
      .join(", ")]: {
      background: token.colorBgContainer,
      color: token.colorText,
      minHeight: 0,
    },
    [`& .canvas-editor__left-pane .${panelHeader.header}`]: {
      padding: "12px 16px",
      rowGap: 12,
      borderColor: token.colorBorderSecondary,
    },
    [`& .canvas-editor__left-pane .${panelHeader.descriptionContainer}`]: {
      color: token.colorTextSecondary,
      fontSize: 12,
      lineHeight: 1.6,
    },
    [`& .canvas-editor__left-pane .${panelHeader.slotTargetTitle}`]: {
      color: token.colorText,
      fontSize: 13,
      lineHeight: "20px",
    },
    "& .canvas-editor__left-pane a": { color: token.colorPrimaryText },
    "& .canvas-editor__left-pane a:hover": { color: token.colorPrimaryHover },
    [`& .canvas-editor__left-pane .${searchPanel.searchPanel}`]: {
      height: "auto",
      minHeight: 56,
      padding: "10px 12px",
      gap: 6,
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
    },
    [`& .canvas-editor__left-pane .${searchPanel.searchPanel} .${panelTextbox.root}`]:
      {
        flex: 1,
        minWidth: 0,
        minHeight: 34,
        borderRadius: 7,
        background: token.colorBgLayout,
        boxShadow: `inset 0 0 0 1px ${token.colorBorder}`,
      },
    [`& .canvas-editor__left-pane .${searchPanel.searchPanel} .${panelTextbox.root}:focus-within`]:
      {
        boxShadow: `inset 0 0 0 1px ${token.colorPrimary}, 0 0 0 2px ${token.colorPrimaryBg}`,
      },
    [`& .canvas-editor__left-pane .${searchPanel.searchPanel} input`]: {
      background: "transparent",
      color: token.colorText,
      fontSize: 13,
      lineHeight: "20px",
      minHeight: 32,
    },
    "& .canvas-editor__left-pane input::placeholder": {
      color: token.colorTextPlaceholder,
    },
    [`& .canvas-editor__left-pane .${searchPanel.searchPanel} svg`]: {
      color: token.colorTextSecondary,
    },
    "& .canvas-editor__left-pane .dimfg": { color: token.colorTextSecondary },
    "& .canvas-editor__left-pane": {
      animation: "none",
      border: `1px solid ${token.colorBorder}`,
      borderRadius: token.borderRadiusLG,
      overflow: "hidden",
      maxWidth: "calc(100vw - 96px)",
      background: token.colorBgContainer,
    },
    [`& .${leftPane.root}, & .${topBar.root}`]: {
      background: token.colorBgContainer,
      color: token.colorText,
      borderColor: token.colorBorder,
    },
    "& .canvas-editor__right-pane": {
      position: "absolute",
      right: 16,
      top: 82,
      bottom: 72,
      width: 320,
      maxWidth: "calc(100% - 24px)",
      border: `1px solid ${token.colorBorder}`,
      borderRadius: token.borderRadiusLG,
      zIndex: 20,
    },
    "& .canvas-editor--panels-hidden .canvas-editor__left-pane, & .canvas-editor--panels-hidden .canvas-editor__right-pane":
      { display: "none" },
    [`& .${sidebarSection.collapsingToggleLabel}`]: {
      background: token.colorFillSecondary,
      color: token.colorTextSecondary,
    },
    [`& .${sidebarSection.collapsingToggleLabel}:hover`]: {
      background: `${token.colorPrimaryBg} !important`,
      color: token.colorPrimaryText,
    },
    "& .hilite-tabs": {
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
      color: token.colorText,
    },
    "& .hilite-tab--active::after, & .hilite-tab:hover::after, & .hilite-tab:focus::after":
      { background: token.colorPrimary },
    "& .hilite-tab--active": {
      color: token.colorPrimary,
      borderColor: token.colorPrimary,
    },
    "& .canvas-editor__right-pane, & .canvas-editor__right-stack-pane, & .canvas-editor__right-float-pane":
      {
        background: token.colorBgContainer,
        borderColor: token.colorBorder,
        color: token.colorText,
      },
    "& .canvas-editor__canvas-scrollbar": {
      backgroundColor: token.colorBgLayout,
      backgroundImage: `radial-gradient(circle, ${token.colorBorder} 0.75px, transparent 1px)`,
      backgroundSize: "20px 20px",
    },
    "& .canvas-editor__right-pane__scroll": {
      scrollbarColor: `${token.colorBorder} transparent`,
    },
  },
}));

export const useAuthenticatedLayoutStyles = createStyles(({ token }) => ({
  root: {
    minHeight: "100vh",
    background: token.colorBgLayout,
    color: token.colorText,
    fontFamily: token.fontFamily,
    "& .normal-layout__top-bar": {
      height: 56,
      background: token.colorBgContainer,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    },
    "& .normal-layout-content": { paddingInline: 24 },
    "& .normal-layout-content--top-bar": { alignItems: "center" },
  },
}));

export const useResourcePanelStyles = createStyles(({ token }) => ({
  root: {
    height: "100%",
    "&:not(:has(.resource-panel-content))": {
      background: "transparent",
      border: 0,
      boxShadow: "none",
      pointerEvents: "none",
    },
    animation: "none",
    ...productPalette(token),
    width: "100%",
    maxWidth: "100%",
    background: token.colorBgContainer,
    color: token.colorText,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    overflow: "hidden",
    boxShadow: token.boxShadowSecondary,
    "&[data-component-store=true]": { borderRadius: token.borderRadiusLG },
    [`&[data-component-store=true] .${insertPanel.contentContainer}`]: {
      margin: "0 12px 8px",
      width: "calc(100% - 24px)",
    },
    "&[data-component-store=true] .resource-panel-search": {
      padding: "0 20px 12px",
    },
    "&[data-component-store=true] .resource-panel-library-actions": {
      padding: "12px 20px",
      justifyContent: "flex-end",
    },
    [`&[data-component-store=true] .${insertPanel.freeBox__ocvSo}`]: {
      flexDirection: "column",
    },
    [`&[data-component-store=true] .${storeCard.freeBox__e9Vri}`]: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 16,
    },
    [`&[data-component-store=true] .${storeCard.freeBox__dwpaf}`]: {
      width: 64,
      height: 64,
      flex: "0 0 64px",
    },
    [`&[data-component-store=true] .${storeCard.titleBox}`]: {
      flex: 1,
      alignItems: "flex-start",
    },
    [`&[data-component-store=true] .${storeCard.slotTargetTitle}`]: {
      color: token.colorText,
      textAlign: "left",
      fontSize: 13,
    },
    "&[data-component-store=true] img[src$='/unstyled.png']": {
      background: token.colorWhite,
      borderRadius: 8,
      padding: 8,
    },
    "&[data-component-store=true] .resource-panel-sections": {
      width: "100%",
      padding: "0 20px 12px",
      flexShrink: 0,
      borderRight: 0,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      "& .ant-select": { maxWidth: 220 },
    },
    "& .resource-panel-library-actions": {
      padding: 12,
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      flexShrink: 0,
    },
    "& .resource-panel-content": {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    },
    "& .ant-tabs-nav": { margin: 0, padding: "0 12px", flexShrink: 0 },
    [`& .${insertPanel.root}`]: {
      flex: 1,
      minHeight: 0,
      height: "auto",
      background: token.colorBgContainer,
      border: 0,
    },
    [`& .${insertPanel.freeBox__ocvSo}`]: {
      background: token.colorBgContainer,
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
    },
    [`& .${insertPanel.contentContainer}`]: { flex: 1, minHeight: 0 },
    "& .resource-panel-upload": { padding: "8px 12px", flexShrink: 0 },
    "& .resource-panel-search": {
      [`& .${panelTextbox.root}`]: {
        minHeight: 36,
        borderRadius: 8,
        background: token.colorBgLayout,
        boxShadow: `inset 0 0 0 1px ${token.colorBorder}`,
        "&:focus-within": {
          boxShadow: `inset 0 0 0 1px ${token.colorPrimary}, 0 0 0 2px ${token.colorPrimaryBg}`,
        },
        [`& .${panelTextbox.textbox}`]: {
          border: 0,
          borderRadius: "inherit",
          outline: "none",
          boxShadow: "none",
          background: "transparent",
          color: token.colorText,
          "&:focus": { outline: "none", boxShadow: "none" },
        },
      },

      padding: "8px 12px",
      flexShrink: 0,
      display: "flex",
      gap: 4,
      alignItems: "center",
      "& > div:first-child": { flex: 1, minWidth: 0 },
    },
    "& .resource-panel-hint": {
      margin: 12,
      padding: 12,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadius,
      background: token.colorFillQuaternary,
      fontSize: token.fontSizeSM,
      flexShrink: 0,
    },
    "& .resource-panel-heading": {
      padding: "0 12px",
      height: 48,
      flexShrink: 0,
    },
    "& .resource-panel-sections": { padding: "8px 12px", flexShrink: 0 },
    "& .resource-panel-content > div:last-child": { minHeight: 0 },
    [`& .${listBottomFade.root}`]: {
      background: `linear-gradient(0deg, ${token.colorBgContainer} 0%, transparent 100%)`,
    },
    "& .ant-empty": { margin: "40px 16px", color: token.colorTextSecondary },
    "& .resource-panel-empty-results": {
      position: "relative",
      height: "100%",
      minHeight: 0,
      "& > .ant-empty": { position: "absolute", inset: 0 },
    },
    [`& .${insertPanel.searchContainer}, & .${insertPanel.sectionsContainer}`]:
      { borderColor: token.colorBorderSecondary },
  },
}));

export const useProjectBrowserStyles = createStyles(({ token }) => ({
  root: {
    padding: 32,
    color: token.colorText,
    background: token.colorBgLayout,
  },
  toolbar: { margin: "24px 0" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 320px))",
    gap: 24,
    [`& .${dashboard.thumbnail}`]: {
      background: `linear-gradient(135deg, ${token.colorBgContainer}, ${token.colorFillSecondary})`,
    },
  },
  list: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
    [`& .${dashboard.projectCard}`]: {
      flexDirection: "row",
      "&:hover": { transform: "none" },
    },
    [`& .${dashboard.thumbnail}`]: {
      width: 120,
      flexShrink: 0,
      borderBottom: 0,
      borderRight: `1px solid ${token.colorBorderSecondary}`,
    },
    [`& .${dashboard.content}`]: { flex: 1, minWidth: 0 },
  },
  loadingCard: {
    padding: 24,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
  },
}));
