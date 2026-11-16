export type EditorViewMenuAction =
  | "toggleShowSlotPlaceholder"
  | "toggleShowContainerPlaceholder"
  | "toggleShowMultiplayerSelections"
  | "toggleShowAncestorsHoverBoxes"
  | "toggleOutlineMode"
  | "toggleFullPageHeight"
  | "toggleFocusedMode"
  | "toggleAutoOpenMode"
  | "toggleShowCommentsOverlay"
  | "toggleContentEditorMode"
  | "refreshData";

export interface EditorViewMenuState {
  available: boolean;
  showSlotPlaceholder: boolean;
  showContainerPlaceholder: boolean;
  showMultiplayerSelections: boolean;
  showAncestorsHoverBoxes: boolean;
  hasFocusedViewCtx: boolean;
  outlineMode: boolean;
  fullPageHeight: boolean;
  canToggleFocusedMode: boolean;
  focusedMode: boolean;
  autoOpenMode: boolean;
  canShowComments: boolean;
  showCommentsOverlay: boolean;
  canChangeContentEditorMode: boolean;
  contentEditorMode: boolean;
}

export const INACTIVE_EDITOR_VIEW_MENU_STATE: EditorViewMenuState = {
  available: false,
  showSlotPlaceholder: false,
  showContainerPlaceholder: false,
  showMultiplayerSelections: false,
  showAncestorsHoverBoxes: false,
  hasFocusedViewCtx: false,
  outlineMode: false,
  fullPageHeight: false,
  canToggleFocusedMode: false,
  focusedMode: false,
  autoOpenMode: false,
  canShowComments: false,
  showCommentsOverlay: false,
  canChangeContentEditorMode: false,
  contentEditorMode: false,
};
