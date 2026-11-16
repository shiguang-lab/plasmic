const EDITOR_VIEW_FIELDS = [
  "available",
  "showSlotPlaceholder",
  "showContainerPlaceholder",
  "showMultiplayerSelections",
  "showAncestorsHoverBoxes",
  "hasFocusedViewCtx",
  "outlineMode",
  "fullPageHeight",
  "canToggleFocusedMode",
  "focusedMode",
  "autoOpenMode",
  "canShowComments",
  "showCommentsOverlay",
  "canChangeContentEditorMode",
  "contentEditorMode",
];

const DEFAULT_EDITOR_VIEW_MENU_STATE = Object.freeze(
  Object.fromEntries(EDITOR_VIEW_FIELDS.map((field) => [field, false])),
);

function normalizeEditorViewMenuState(raw) {
  if (!raw || typeof raw !== "object" || !raw.available) {
    return DEFAULT_EDITOR_VIEW_MENU_STATE;
  }
  return Object.freeze(
    Object.fromEntries(
      EDITOR_VIEW_FIELDS.map((field) => [field, Boolean(raw[field])]),
    ),
  );
}

function sameEditorViewMenuState(left, right) {
  return EDITOR_VIEW_FIELDS.every((field) => Boolean(left?.[field]) === Boolean(right?.[field]));
}

function viewMenu({
  controller,
  presentation,
  getStudioWindow,
  modes = [],
  closeActions = [],
  isPackaged = true,
  platform = process.platform,
  dialog,
  editorViewState,
  onEditorViewState = () => {},
  t = (x) => x,
}) {
  const state = normalizeEditorViewMenuState(editorViewState);
  const active = state.available;

  const runEditorAction = (action) => async () => {
    if (!active) {
      return;
    }
    try {
      const result = await controller.invoke("editorViewAction", { action }, 30000);
      if (result?.state && typeof result.state === "object") {
        onEditorViewState(result.state);
      }
    } catch (error) {
      console.error("Desktop view operation failed", error);
      dialog?.showErrorBox(t("Operation Failed"), t("Please try again"));
    }
  };

  return {
    id: "desktop-view",
    label: t("View"),
    submenu: [
      {
        id: "desktop-view-slot-placeholder",
        label:
          active && state.showSlotPlaceholder
            ? t("Hide placeholders for empty slots")
            : t("Show placeholders for empty slots"),
        enabled: active,
        click: runEditorAction("toggleShowSlotPlaceholder"),
      },
      {
        id: "desktop-view-container-placeholder",
        label:
          active && state.showContainerPlaceholder
            ? t("Hide placeholders for empty containers")
            : t("Show placeholders for empty containers"),
        enabled: active,
        click: runEditorAction("toggleShowContainerPlaceholder"),
      },
      {
        id: "desktop-view-multiplayer-selections",
        label:
          active && state.showMultiplayerSelections
            ? t("Hide cursors and selections from other users")
            : t("Show cursors and selections from other users"),
        enabled: active,
        click: runEditorAction("toggleShowMultiplayerSelections"),
      },
      {
        id: "desktop-view-ancestors-hover-boxes",
        label:
          active && state.showAncestorsHoverBoxes
            ? t("Hide container outlines when hovering")
            : t("Show container outlines when hovering"),
        enabled: active,
        click: runEditorAction("toggleShowAncestorsHoverBoxes"),
      },
      {
        id: "desktop-view-outline-mode",
        label:
          active && state.outlineMode
            ? t("Hide outline mode")
            : t("Show outline mode"),
        enabled: !!(active && state.hasFocusedViewCtx),
        click: runEditorAction("toggleOutlineMode"),
      },
      {
        id: "desktop-view-full-page-height",
        label:
          active && state.fullPageHeight
            ? t("Fit to viewport height")
            : t("Show full page height"),
        enabled: active,
        click: runEditorAction("toggleFullPageHeight"),
      },
      { type: "separator" },
      {
        id: "desktop-view-focused-mode",
        label:
          active && state.focusedMode
            ? t("Turn on design mode")
            : t("Turn off design mode"),
        enabled: !!(active && state.canToggleFocusedMode),
        click: runEditorAction("toggleFocusedMode"),
      },
      {
        id: "desktop-view-auto-open-mode",
        label:
          active && state.autoOpenMode
            ? t("Turn off auto-open mode")
            : t("Turn on auto-open mode"),
        enabled: active,
        click: runEditorAction("toggleAutoOpenMode"),
      },
      {
        id: "desktop-view-comments-overlay",
        label:
          active && state.showCommentsOverlay
            ? t("Hide comments overlay")
            : t("Show comments overlay"),
        enabled: !!(active && state.canShowComments),
        click: runEditorAction("toggleShowCommentsOverlay"),
      },
      {
        id: "desktop-view-content-editor-mode",
        label:
          active && state.contentEditorMode
            ? t("Turn off content creator mode")
            : t("Turn on content creator mode"),
        enabled: !!(active && state.canChangeContentEditorMode),
        click: runEditorAction("toggleContentEditorMode"),
      },
      { type: "separator" },
      {
        id: "desktop-view-refresh-data",
        label: t("Refresh data"),
        enabled: active,
        click: runEditorAction("refreshData"),
      },
      { type: "separator" },
      {
        label: t("Display mode"),
        submenu: modes.map((value, index) => ({
          id: `presentation-${value}`,
          type: "radio",
          checked: presentation.mode === value,
          label: t(["Standard window", "Full screen", "Dynamic Island"][index]),
          ...(value === "island" ? { accelerator: "CmdOrCtrl+Shift+I" } : {}),
          click: () => void presentation.setMode(value).catch(console.error),
        })),
      },
      {
        label: t("When closing the main window"),
        submenu: closeActions.map((value, index) => ({
          id: `close-action-${value}`,
          type: "radio",
          checked: presentation.closeAction === value,
          label: t(["Ask every time", "Switch to Dynamic Island", "Quit Plasmic"][index]),
          click: () => presentation.setCloseAction(value),
        })),
      },
      {
        label: t("Toggle Full Screen"),
        accelerator: platform === "darwin" ? "Ctrl+Command+F" : "F11",
        click: () =>
          void presentation
            .setMode(presentation.mode === "fullscreen" ? "window" : "fullscreen")
            .catch(console.error),
      },
      { type: "separator" },
      {
        label: t("Import from the web"),
        accelerator: "CmdOrCtrl+Shift+U",
        click: () => {
          void controller.dispatch("browser", { action: "open" });
        },
      },
      { type: "separator" },
      {
        label: t("Actual Size"),
        accelerator: "CmdOrCtrl+0",
        click: () => getStudioWindow()?.webContents.setZoomLevel(0),
      },
      {
        label: t("Zoom In"),
        accelerator: "CmdOrCtrl+Plus",
        click: () => {
          const studio = getStudioWindow();
          if (studio) {
            studio.webContents.setZoomLevel(studio.webContents.getZoomLevel() + 0.5);
          }
        },
      },
      {
        label: t("Zoom Out"),
        accelerator: "CmdOrCtrl+-",
        click: () => {
          const studio = getStudioWindow();
          if (studio) {
            studio.webContents.setZoomLevel(studio.webContents.getZoomLevel() - 0.5);
          }
        },
      },
      { type: "separator" },
      {
        label: t("Reload"),
        accelerator: "CmdOrCtrl+R",
        click: () => getStudioWindow()?.webContents.reload(),
      },
      {
        label: t("Force Reload"),
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => getStudioWindow()?.webContents.reloadIgnoringCache(),
      },
      ...(!isPackaged
        ? [
            {
              id: "desktop-devtools",
              label: t("Toggle Developer Tools"),
              accelerator: "Alt+CmdOrCtrl+I",
              click: () => getStudioWindow()?.webContents.toggleDevTools(),
            },
          ]
        : []),
    ],
  };
}

module.exports = {
  DEFAULT_EDITOR_VIEW_MENU_STATE,
  normalizeEditorViewMenuState,
  sameEditorViewMenuState,
  viewMenu,
};
