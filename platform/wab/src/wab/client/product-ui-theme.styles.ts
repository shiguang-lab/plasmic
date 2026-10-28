import canvasFrame from "@/wab/client/components/canvas/CanvasFrame/CanvasFrame.module.scss";
import definedIndicator from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
import textbox from "@/wab/client/plasmic/plasmic_kit/PlasmicTextbox.module.css";
import addCommentMarker from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicAddCommentMarker.module.css";
import markdownHints from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicMarkdownHintsPopoverContent.module.css";
import publishFlow from "@/wab/client/plasmic/plasmic_kit_continuous_deployment/PlasmicPublishFlowDialog.module.css";
import dataSourceOption from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDataSourceOption.module.css";
import navWorkspace from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicNavWorkspaceButton.module.css";
import copilotPrompt from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicCopilotPromptDialog.module.css";
import dataPicker from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPicker.module.css";
import dataPickerCode from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPickerCodeEditorLayout.module.css";
import actionMenu from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicActionMenuButton.module.css";
import chip from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicChip.module.css";
import dropdownOverlay from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicDropdownOverlay.module.css";
import select from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect.module.css";
import selectOption from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect__Option.module.css";
import selectOverlay from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect__Overlay.module.css";
import textarea from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicTextarea.module.css";
import tooltip from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicTooltip.module.css";
import findReferences from "@/wab/client/plasmic/plasmic_kit_find_references_modal/PlasmicFindReferencesModal.module.css";
import quickInsert from "@/wab/client/plasmic/plasmic_kit_insert_panel/PlasmicQuickInsertItem.module.css";
import activitiesPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftActivitiesPanel.module.css";
import leftSettingsPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSettingsPanel.module.css";
import presets from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicPresetsSelector.module.css";
import diffs from "@/wab/client/plasmic/plasmic_kit_merge_flow/PlasmicDiffs.module.css";
import mergeFlow from "@/wab/client/plasmic/plasmic_kit_merge_flow/PlasmicMergeFlow.module.css";
import branchPanel from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicBranchPanel.module.css";
import searchInput from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicSearchInput.module.css";
import dimTokenSelector from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicDimTokenSelector.module.css";
import styleSelectOption from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Option.module.css";
import styleOptionGroup from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__OptionGroup.module.css";
import styleSelectOverlay from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Overlay.module.css";
import styleTooltip from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicTooltip.module.css";
import variantsComboSelect from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsComboSelect.module.css";
import variantsMenu from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsMenu.module.css";
import userMentions from "@/wab/client/plasmic/plasmic_kit_user_mentions/PlasmicUserMentionsPopoverContent.module.css";
import variantRow from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantRow.module.css";
import variantsBar from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsBar.module.css";
import variantsDrawer from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsDrawer.module.css";
import variantsGroupLabel from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsGroupLabel.module.css";
import button from "@/wab/client/plasmic/PlasmicButton.module.css";
import iconButton from "@/wab/client/plasmic/PlasmicIconButton.module.css";
import type { GlobalToken } from "antd";
import { createStyles, type CSSObject } from "antd-style";

const labeledItemRoots = [".labeled-item", '[data-plasmic-role="labeled-item"]'];
const labeledItemAntdInputs = labeledItemRoots
  .flatMap((root) => [
    `& ${root} .ant-input`,
    `& ${root} .ant-input-number-input`,
  ])
  .join(", ");
const labeledItemAntdFields = [
  ...labeledItemRoots.flatMap((root) => [
    `& ${root} .ant-input`,
    `& ${root} .ant-input-number`,
    `& ${root} .ant-select.textboxlike .ant-select-selector`,
  ]),
  "& .tag-select .ant-select.textboxlike .ant-select-selector",
].join(", ");
const hoverOf = (selectors: string) =>
  selectors
    .split(", ")
    .map((selector) => `${selector}:hover`)
    .join(", ");
const placeholderOf = (selectors: string) =>
  selectors
    .split(", ")
    .map((selector) => `${selector}::placeholder`)
    .join(", ");

// These tokens belong to the product's generated UI library. Scoped binding
// keeps the shared application/editor palette out of business iframe documents.
export const productPalette = (token: GlobalToken): CSSObject => ({
  // Inherited by portals as well as the Studio shell; never injected into canvas documents.
  "--ui-surface": token.colorBgContainer,
  "--ui-elevated": token.colorBgElevated,
  "--ui-bg": token.colorBgLayout,
  "--ui-border": token.colorBorder,
  "--ui-border-subtle": token.colorBorderSecondary,
  "--ui-text": token.colorText,
  "--ui-muted": token.colorTextSecondary,
  "--ui-placeholder": token.colorTextPlaceholder,
  "--ui-disabled": token.colorTextDisabled,
  "--token-MJxs_G7Sqa": token.colorTextDisabled,
  "--plasmic-token-textboxdisabled": token.colorTextDisabled,
  "--ui-accent": token.colorPrimary,
  "--ui-accent-text": token.colorPrimaryText,
  "--ui-hover": token.colorFillSecondary,
  "--ui-fill": token.colorFillTertiary,
  "--ui-selected": token.colorPrimaryBg,
  "--ui-on-accent": token.colorTextLightSolid,
  "--ui-error": token.colorErrorText,
  "--ui-error-bg": token.colorErrorBg,
  "--ui-error-border": token.colorErrorBorder,
  "--ui-success": token.colorSuccessText,
  "--ui-success-bg": token.colorSuccessBg,
  "--ui-success-hover": token.colorSuccessBgHover,
  "--ui-warning": token.colorWarningText,
  "--ui-warning-bg": token.colorWarningBg,
  "--ui-warning-border": token.colorWarningBorder,
  "& .right-pane__mask": {
    background: "rgba(0, 0, 0, 0.15)",
  },
  "& .panel-popup": {
    background: token.colorBgElevated,
    color: token.colorText,
    boxShadow: token.boxShadowSecondary,
  },
  // Select portals can carry their own generated token classes. Bind their
  // actual surfaces and option states so local defaults cannot restore white.
  [`& .${styleSelectOverlay.main}, & .${selectOverlay.main}, & .${dropdownOverlay.root}`]:
    {
      background: token.colorBgElevated,
      color: token.colorText,
      boxShadow: token.boxShadowSecondary,
    },
  [`& .${styleSelectOption.root}, & .${styleSelectOption.slotTargetChildren}, & .${selectOption.root}, & .${selectOption.slotTargetChildren}`]:
    {
      color: token.colorText,
    },
  [`& .${styleSelectOption.rootisSelected}, & .${selectOption.rootisSelected}`]:
    {
      background: token.colorPrimaryBg,
    },
  [`& .${styleSelectOption.slotTargetChildrenisSelected}, & .${selectOption.slotTargetChildrenisSelected}`]:
    {
      color: token.colorPrimaryText,
    },
  [`& .${styleSelectOption.rootisHighlighted}, & .${selectOption.rootisHighlighted}`]:
    {
      background: token.colorFillSecondary,
    },
  [`& .${styleSelectOption.slotTargetChildrenisUnsetOption}, & .${selectOption.slotTargetChildrenisUnsetOption}`]:
    {
      color: token.colorTextPlaceholder,
    },
  [`& .${quickInsert.root}:hover:hover, & .${dataSourceOption.root}:hover:hover, & .${navWorkspace.root}:hover:hover`]:
    { background: token.colorFillSecondary },
  [`& .${quickInsert.rootisSelected}, & .${quickInsert.rootisSelected}:hover:hover`]:
    { background: token.colorPrimaryBg },
  [`& .${quickInsert.slotTargetChildrenisSelected}, & .${quickInsert.slotTargetIconisSelected}`]:
    { color: token.colorPrimaryText },
  [`& .${markdownHints.root}, & .${userMentions.root}, & .${findReferences.root}, & .${variantsDrawer.root}, & .${mergeFlow.freeBox___5XViU}, & .${mergeFlow.freeBox___8VwQ3}, & .${diffs.freeBox__bU0WY}, & .${publishFlow.root}`]:
    {
      background: token.colorBgElevated,
      color: token.colorText,
    },
  [`& .${branchPanel.root}, & .${activitiesPanel.root}, & .${publishFlow.addActionsContainer}, & .${publishFlow.freeBox__uIv1}, & .${publishFlow.addWebsitePanel}, & .${publishFlow.addGithubPanel}, & .${publishFlow.addWebhooksPanel}`]:
    {
      background: token.colorBgContainer,
      color: token.colorText,
    },
  [`& .${userMentions.separator}`]: { borderColor: token.colorBorderSecondary },
  [`& .${userMentions.svg}`]: { color: token.colorTextSecondary },
  [`& .${variantsBar.freeBoxisFocused}, & .${variantsBar.dropdownTrigger}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [`& .${variantsBar.root} .${variantsBar.dropdownTrigger}:hover`]: {
    background: token.colorFillSecondary,
  },
  [`& .${variantsComboSelect.button}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [`& .${variantsComboSelect.button}:hover`]: {
    background: token.colorFillSecondary,
  },
  [`& .${variantsComboSelect.button}:focus:focus`]: {
    boxShadow: `0 0 0 2px ${token.colorPrimaryBorder}`,
  },
  [`& .${variantsComboSelect.button} .${button.slotTargetChildren}`]: {
    color: token.colorText,
  },
  [`& .${variantsComboSelect.button} .${button.slotTargetEndIcon}`]: {
    color: token.colorTextSecondary,
  },
  [`& .${variantsMenu.root}`]: {
    background: token.colorBgElevated,
    color: token.colorText,
    boxShadow: token.boxShadowSecondary,
  },
  [`& .${variantsMenu.freeBox}`]: {
    borderColor: token.colorBorderSecondary,
  },
  [`& .${variantsMenu.svg}, & .${variantsGroupLabel.slotTargetChildren}`]: {
    color: token.colorTextSecondary,
  },
  [`& .${variantsMenu.searchInput}`]: {
    background: "transparent",
    color: token.colorText,
  },
  [`& .${variantsMenu.searchInput}::placeholder`]: {
    color: token.colorTextPlaceholder,
  },
  [`& .${variantRow.slotTargetChildren}`]: { color: token.colorText },
  [`& .${variantRow.slotTargetChildrenisBase}, & .${variantRow.svgisBase}`]: {
    color: token.colorPrimaryText,
  },
  [`& .${variantRow.slotTargetChildrenisRecording}`]: {
    color: token.colorErrorText,
  },
  [`& .${variantRow.roothighlight}`]: { background: token.colorFillSecondary },
  [`& .${variantRow.roothighlight_isBase}`]: {
    background: token.colorPrimaryBg,
  },
  [`& .${variantRow.roothighlight_isRecording}`]: {
    background: token.colorErrorBg,
  },
  [`& .${presets.root}, & .${styleOptionGroup.root}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [`& .${styleOptionGroup.separator}`]: {
    borderColor: token.colorBorderSecondary,
  },
  [`& .${styleOptionGroup.slotTargetTitle}`]: {
    color: token.colorTextSecondary,
  },
  "& .fg, & .text-set": { color: token.colorText },
  "& .non-link-btn": { color: token.colorText },
  "& .non-link-btn:disabled, & .non-link-btn--disabled": {
    color: token.colorTextDisabled,
  },
  "& .icon-link-btn": { color: token.colorTextSecondary },
  "& .icon-link-btn:hover:not(:disabled)": { color: token.colorText },
  "& .icon-link-btn--active, & .icon-link-btn--active:hover": {
    color: token.colorPrimaryText,
  },
  "& .icon-link-btn:disabled, & .icon-link-btn--disabled, & .icon-link-btn--disabled:hover":
    { color: token.colorTextDisabled },
  "& .SectionSeparator, & .Separator": {
    background: token.colorBorderSecondary,
  },
  "& .dimfg, & .panel-section__title": { color: token.colorTextSecondary },
  "& .dimdimfg": { color: token.colorTextTertiary },
  "& .value-preview": { color: token.colorPrimaryText },
  "& .value-preview--error": { color: token.colorErrorText },
  "& .value-preview--loading": { color: token.colorTextSecondary },
  [`& .${copilotPrompt.promptDialog}`]: {
    background: token.colorBgElevated,
    color: token.colorText,
  },
  "& .modal, & .code-preview-inner, & .canvas-editor__right-stack-pane, & .canvas-editor__right-float-pane, & .sidebar-header-section__content, & .vertical-fill-table .ant-table-tbody":
    {
      background: token.colorBgContainer,
      color: token.colorText,
    },
  "& .code-preview, & .vertical-fill-table .ant-table-container": {
    borderColor: token.colorBorderSecondary,
  },
  [`& .${dataPicker.root}`]: {
    background: token.colorBgElevated,
    color: token.colorText,
  },
  [`& .${dataPicker.header}, & .${dataPicker.footer}, & .${dataPicker.freeBox___3RfRi}, & .${dataPickerCode.envPanelContainer}, & .${dataPickerCode.envToggleButton}, & .${dataPickerCode.previewPanel}`]:
    {
      borderColor: token.colorBorderSecondary,
    },
  [`& .${dataPicker.footer}, & .${dataPickerCode.envPanelContainer}, & .${dataPickerCode.previewPanel}`]:
    {
      background: token.colorBgContainer,
    },
  [`& .${dataPickerCode.envLabelText}, & .${dataPickerCode.svg__ckpYw}`]: {
    color: token.colorTextSecondary,
  },
  "& .textbox, & .select-dropdown__button, & .dropdown-container": {
    background: token.colorBgContainer,
    color: token.colorText,
    borderColor: token.colorBorder,
  },
  "& .textbox::placeholder, & .dropdown-input-container input::placeholder": {
    color: token.colorTextPlaceholder,
  },
  "& .textbox:disabled": { color: token.colorTextDisabled },
  "& .textbox.textbox--transparent, & .textbox.textbox--seamless, & .dropdown-input-container input":
    {
      background: "transparent",
      color: token.colorText,
    },
  "& .dropdown-container--bordered": {
    boxShadow: `inset 0 0 0 1px ${token.colorBorder}`,
  },
  "& .dropdown-container--bordered:hover": {
    boxShadow: `inset 0 0 0 1px ${token.colorPrimaryBorder}`,
  },
  "& .dropdown-pill, & .dropdown-pill--inline-block, & .fixed-mixins-pill": {
    background: token.colorFillSecondary,
    color: token.colorText,
  },
  "& .dropdown-pill--selected, & .dropdown-pill--selected .icon-link-btn, & .dropdown-pill--selected .icon-link-btn:hover":
    {
      background: token.colorPrimary,
      color: token.colorTextLightSolid,
    },
  "& .no-selector-placeholder, & .xmultiselect-arrow": {
    color: token.colorTextSecondary,
  },
  "& .pcr-app[data-theme]": {
    background: token.colorBgElevated,
    color: token.colorText,
  },
  "& .pcr-app .pcr-interaction .pcr-result": {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [`& .${definedIndicator.DefinedIndicator}`]: {
    boxShadow: "none",
    opacity: 0.65,
  },
  [`& .${definedIndicator.DefinedIndicatorContainer}:hover .${definedIndicator.DefinedIndicator}`]:
    {
      opacity: 1,
    },
  "& .tpltree__label__indicator": { opacity: 0.65 },
  "& .tpltree__label__indicator:hover": { opacity: 1 },
  "& .defined-indicator__source-stack, & .defined-indicator__source-icon": {
    background: token.colorBgElevated,
  },
  "& .defined-indicator__source": {
    color: token.colorTextSecondary,
    padding: "4px 0",
    alignItems: "center",
  },
  "& .defined-indicator__source > button": {
    width: 24,
    minWidth: 24,
    height: 24,
    minHeight: 24,
    flexShrink: 0,
    padding: 0,
    marginLeft: 8,
    alignSelf: "center",
  },
  "& .defined-indicator__source--target": { color: token.colorText },
  "& .defined-indicator__source-name": {
    minWidth: 64,
    maxWidth: "40%",
    flexShrink: 0,
    color: token.colorTextSecondary,
  },
  "& .defined-indicator__source-value": {
    minWidth: 0,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    overflow: "visible",
    textOverflow: "clip",
  },
  "& .defined-indicator__source-stack__line-container__line, & .defined-indicator__prop":
    {
      borderColor: token.colorBorderSecondary,
    },
  "& .defined-indicator__edit-button": {
    background: token.colorFillTertiary,
    color: token.colorText,
  },
  "& .defined-indicator__edit-button:hover": {
    background: token.colorFillSecondary,
  },
  "& .right-panel-input-background, & .right-panel-input-background__no-height, & .code-editor-input, & .generic-prop-editor .code-editor-input":
    {
      background: token.colorBgContainer,
      color: token.colorText,
    },
  "& .right-panel-input-background:hover, & .right-panel-input-background__no-height:hover, & .code-editor-input:hover, & .generic-prop-editor .code-editor-input:hover, & .right-panel-input-background-selected":
    {
      background: token.colorFillTertiary,
    },
  "& .code-chip-like, & .templated-string-input .code-chip, & .code-editor-input .text-set":
    {
      background: token.colorSuccessBg,
      color: token.colorSuccessText,
    },
  "& .code-chip-like:hover, & .templated-string-input .code-chip:hover, & .code-editor-input .text-set:hover":
    {
      background: token.colorSuccessBgHover,
    },
  "& .templated-string-input .code-chip.right-panel-input-background-selected":
    {
      background: token.colorPrimary,
      color: token.colorTextLightSolid,
    },
  "& .templated-string-input .code-chip.right-panel-input-background-selected:hover":
    {
      background: token.colorPrimaryHover,
      color: token.colorTextLightSolid,
    },
  "& .text-unset": { color: token.colorTextPlaceholder },
  "& .text-inherited": { color: token.colorTextSecondary },
  "& .multi-select-prop-pill": {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  "& .img-thumb-border": { borderColor: token.colorBorder },
  "& .img-thumb--placeholder": {
    background: token.colorFillSecondary,
    color: token.colorTextSecondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  [`& .${canvasFrame.artboardSelectionHandle}`]: {
    "--artboard-handle-background": token.colorBgElevated,
    "--artboard-handle-foreground": token.colorTextSecondary,
  },
  [`& .${leftSettingsPanel.root}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  // Primary actions need a solid foreground independent of the surface token.
  [`& .${button.root}.${button.roottype_primary} .${button.slotTargetChildren}, & .${button.root}.${button.roottype_primary} .${button.slotTargetStartIcon}, & .${button.root}.${button.roottype_primary} .${button.slotTargetEndIcon}, & .${button.root}.${button.rootcolor_darkRed} .${button.slotTargetChildren}`]:
    { color: token.colorTextLightSolid },
  [`& .${button.root}.${button.rootcolor_darkRed} .${button.slotTargetStartIcon}, & .${button.root}.${button.rootcolor_darkRed} .${button.slotTargetEndIcon}`]:
    { color: token.colorTextLightSolid },
  [`& .${actionMenu.slotTargetChildrentype_primary}, & .${iconButton.slotTargetChildrentype_primary}, & .${iconButton.roottype_primary}:hover .${iconButton.slotTargetChildrentype_primary}, & .${iconButton.roottype_primary}:active .${iconButton.slotTargetChildrentype_primary}`]:
    {
      color: token.colorTextLightSolid,
    },
  // Tooltip foregrounds must stay paired with their backgrounds; the shared
  // white palette token also serves ordinary surfaces and changes in dark mode.
  [`& .${tooltip.freeBox}, & .${styleTooltip.floatingWindow}`]: {
    background: token.colorBgSpotlight,
    color: token.colorTextLightSolid,
  },
  [`& .${tooltip.slotTargetContent}, & .${styleTooltip.slotTargetChildren}`]: {
    color: token.colorTextLightSolid,
  },
  [`& .${addCommentMarker.svg}`]: {
    color: token.colorTextLightSolid,
  },
  "& .CanvasFrame__Config": {
    background: token.colorBgElevated,
    color: token.colorTextSecondary,
  },
  "& .CanvasFrame__Config:hover": {
    background: token.colorFillSecondary,
    color: token.colorText,
  },
  "& .labeled-item__label": { color: token.colorText },
  "& .btn-link": { color: token.colorText },
  "& .btn-link:disabled": { color: token.colorTextDisabled },
  "& .form-control, & .textboxlike, & .templated-string-input, & .image-paster":
    {
      background: token.colorBgContainer,
      color: token.colorText,
      borderColor: token.colorBorder,
    },
  "& .templated-string-input:hover": { background: token.colorFillTertiary },
  // antd-overrides.scss gives property-row antd inputs a fixed light fill.
  // Host custom controls (e.g. table Pagination/Scroll) render real antd
  // inputs there, so bind those surfaces to the theme like other row controls.
  [labeledItemAntdFields]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [hoverOf(labeledItemAntdFields)]: { background: token.colorFillTertiary },
  [placeholderOf(labeledItemAntdInputs)]: {
    color: token.colorTextPlaceholder,
  },
  "& .templated-string-input:focus, & .image-paster:focus": {
    borderColor: token.colorPrimary,
  },
  "& .image-paster::placeholder": { color: token.colorTextPlaceholder },
  "& .panel-dim-block": {
    background: token.colorBgLayout,
    color: token.colorText,
  },
  "& .file-uploader": { borderColor: token.colorBorder },
  "& .file-uploader:hover": { background: token.colorFillTertiary },
  "& .file-uploader .fake-upload": { color: token.colorTextSecondary },
  [`& .${searchInput.searchInputContainer} .${searchInput.svg}, & .${searchInput.searchInputContainer} .${searchInput.clearFieldIcon}`]:
    { color: token.colorTextSecondary },
  [`& .${searchInput.searchInputContainer}:hover .${searchInput.svg}, & .${searchInput.searchInputContainer} .${searchInput.clearFieldIcon}:hover, & .${chip.root} .${chip.closeIcon}:hover, & .${chip.root} .${chip.closeIcon}:active`]:
    { color: token.colorText },
  "& .plasmic_tokens_95xp9cYcv7HrNWpFWWhbcv": {
    "--token-iR8SeEwQZ": token.colorBgContainer,
    "--token-9jh0BkCENS": token.colorBgContainer,
    "--token-p-rw5DRJTx": token.colorBgLayout,
    "--token-O4S7RMTqZ3": token.colorFillQuaternary,
    "--token-bV4cCeIniS6": token.colorFillTertiary,
    "--token-Ik3bdE1e1Uy": token.colorFillSecondary,
    "--token-hoA5qaM-91G": token.colorBorderSecondary,
    "--token-VBhAy2b-S": token.colorBorderSecondary,
    "--token-eBt2ZgqRUCz": token.colorBorder,
    "--token-PTyaboLP9ZK": token.colorTextQuaternary,
    "--token-fVn5vRhXJxQ": token.colorTextTertiary,
    "--token-qKhMu66CwSx": token.colorTextSecondary,
    "--token-UunsGa2Y3t3": token.colorTextSecondary,
    "--token-0IloF6TmFvF": token.colorText,
    "--token-dqEx_KxIoYV": token.colorPrimaryBg,
    "--token-qP8a3gYPq7fd": token.colorPrimary,
    "--token-HKVCQ5ZKovK": token.colorErrorBgHover,
    "--token-Le11TVejD2x2": token.colorError,
    "--token-5kjtdCiiOPB": token.colorErrorBgHover,
    "--token-ElMeFHrIrKT": token.colorText,
    "--token-h3n_6qpT3Tc4": token.colorFillTertiary,
    "--token-D666zt2IZPL": token.colorPrimary,
    "--token-mu3x63xzJRW": token.colorPrimaryHover,
    "--token-VUsIDivgUss": token.colorPrimaryText,
    "--token-yqAf_E0HIjU": token.colorPrimaryBg,
    "--token-JfSQu2FXX0v": token.colorPrimaryBorder,
    "--token-WqsKGtAj1ZMI": token.colorPrimary,
    "--token-iRjO5KzKh1e_": token.colorBgElevated,
    "--token-S8OnTYk9S2Q": token.colorError,
    "--token-SJeRSg5mW91": token.colorErrorBg,
    "--token-pH5HkOAVcYh": token.colorErrorBorder,
    "--token-oI9RmKl5Rl_y": token.colorSuccess,
    "--token-qEDJedw9WWX8": token.colorSuccessBg,
    "--token-LsPj_iMMTYwZ": token.colorSuccessBorder,
    "--token-DEbwNasuLfjs": token.colorWarning,
    "--token-WsutfVbnQWpY": token.colorWarningBg,
    "--token-680C9kW9i_xC": token.colorWarningBorder,
    "--token-N-GFU-C_NPxa": token.colorWarningText,
    // Legacy colored actions use the whole scale in their hover/pressed states.
    "--token-qYuX4XAEbRt": token.colorErrorBg,
    "--token-iDpByWoW0eF": token.colorError,
    "--token-Y2CWh0ci95a": token.colorErrorText,
    "--token-Ift7nNWjir7": token.colorErrorTextActive,
    "--token-yUAjM3D7ZnY": token.colorErrorBorder,
    "--token-RhvOnhv_xIi": token.colorPrimaryBgHover,
    "--token-iP3LxEvLa0xh": token.colorText,
    "--token-krbUYvO2lx2": token.colorPrimaryTextActive,
    "--token-h-5XbcO2WhcA": token.colorSuccessBg,
    "--token-dv0BWWyaHl7H": token.colorSuccessBgHover,
    "--token-3AptjBfMqvPS": token.colorSuccessBgHover,
    "--token-GEBK7U4Am62W": token.colorSuccess,
    "--token-hIvqQBCxyWwX": token.colorSuccessText,
    "--token-AKguBXlLTkKh": token.colorSuccessTextActive,
    "--token-n4S9_H7k9rsR": token.colorSuccessBorder,
    "--token-Cr1odk81N3Y": token.colorPrimaryBg,
    "--token-oPrqrxbKHqk": token.colorPrimaryBgHover,
    "--token-I2zAJ678hbp": token.colorPrimaryBgHover,
    "--token-Izr3_jwKAp1": token.colorPrimary,
    "--token-UCbZU41E8Mj": token.colorPrimaryText,
    "--token-ZaJGjVCo3Ue": token.colorPrimaryTextActive,
  },
  "& .plasmic_tokens_dyzP6dbCdycwJpqiR2zkwe": {
    "--token-CWv8jfhWh": token.colorBorderSecondary,
    "--token-aUCjnzhayS": token.colorBgContainer,
    "--token-nadNyMOsLjl": token.colorTextSecondary,
    "--token-0KXajUKTVZC": token.colorText,
    "--token-dBnk53GtPsb": token.colorTextTertiary,
    "--token-B77WAT17jl8": token.colorBorder,
    "--token-pryzRkTNOFd": token.colorBgLayout,
    "--token-7bUFmc-GkpN": token.colorFillSecondary,
    "--token-6-fKAK7Ga33": token.colorPrimary,
    "--token-2H3KashplBE": token.colorPrimaryHover,
    "--token-txY5tRAWqAc": token.colorPrimaryText,
  },
  "& .plasmic_tokens_fpbcKyXdMTvY59T4C5fjcC": {
    "--token-0vHxN11ixM": token.colorBorderSecondary,
    "--token-t68i-MG5Bw": token.colorTextSecondary,
    "--token-pCMcQv3xBc": token.colorText,
    "--token-tqZN8CQTuKc": token.colorTextTertiary,
    "--token-HgOUo1yKGd7": token.colorBorderSecondary,
    "--token-p7qUpYIr0s0": token.colorBgLayout,
    "--token-NxA0xIzktpH": token.colorTextSecondary,
    "--token-NcVkVEFwiIx": token.colorText,
    "--token-fFqkXw6j9cb": token.colorBorder,
    "--token-XH9PcvIOG8Q": token.colorPrimaryText,
    "--token-QMdL41TrGn5": token.colorErrorBg,
    "--token-ogRzOcay4E5": token.colorWarningBg,
    "--token-590x3zVVS2z": token.colorError,
    "--token-koLTWNKDmAp": token.colorSuccess,
    "--token-6QEhTkH8umI": token.colorError,
    "--token-MUeFl9R6QY0": token.colorSuccessText,
    "--token-QrwPbjkKitC": token.colorErrorText,
    "--token-BvJVLj75Y27": token.colorErrorText,
    "--token-uNUqZL6OMn5": token.colorWarningText,
    "--token-CYqwMJchyYA": token.colorTextTertiary,
  },
  [`& .${select.trigger}, & .${select.contentContainer}, & .${select.slotTargetSelectedContent}`]:
    { color: token.colorText },
  [`& .${select.trigger}`]: {
    background: token.colorBgContainer,
    borderColor: token.colorBorder,
  },
  [`& .${select.slotTargetSelectedContentshowPlaceholder}`]: {
    color: token.colorTextPlaceholder,
  },
  [`& .${textbox.rootwhiteBackground}`]: { background: token.colorBgContainer },
  [`& .${textbox.textbox}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
    borderRadius: "inherit",
  },
  [`& .${textbox.textboxdisabled}`]: {
    background: token.colorBgContainerDisabled,
    color: token.colorTextDisabled,
  },
  [`& .${dimTokenSelector.textboxdisabled}`]: {
    color: token.colorTextDisabled,
  },
  [`& .${textarea.rootwhiteBackground}, & .${textarea.textarea}`]: {
    background: token.colorBgContainer,
    color: token.colorText,
  },
  [`& .${textarea.textareadisabled}`]: {
    background: token.colorBgContainerDisabled,
    color: token.colorTextDisabled,
  },
  "& .plasmic_tokens_gYEVvAzCcLMHDVPvuYxkFh": {
    "--token-MJxs_G7Sqa": token.colorTextDisabled,
    "--plasmic-token-textboxdisabled": token.colorTextDisabled,
    "--token-4f35RzFNq": token.colorTextTertiary,
    "--plasmic-token-text-unset": token.colorTextTertiary,
  },
  "& .plasmic_tokens_tXkSR39sgCDWSitZxC5xFV": {
    "--token-iCBCh1BQyu-W": token.colorFillQuaternary,
    "--token-11LpBV8ry6Ok": token.colorFillSecondary,
  },
});

export const useProductThemeStyles = createStyles(
  (_context, token: GlobalToken) => ({
    root: productPalette(token),
  }),
);
