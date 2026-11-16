const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  DEFAULT_EDITOR_VIEW_MENU_STATE,
  normalizeEditorViewMenuState,
  sameEditorViewMenuState,
  viewMenu,
} = require("../src/view-menu.cjs");

function createMenu({ editorViewState, invoked = [], updates = [], zoom = 0 } = {}) {
  let currentZoom = zoom;
  const errors = [];
  const presentation = {
    mode: "window",
    closeAction: "ask",
    setMode: async () => {},
    setCloseAction: () => {},
  };
  const menu = viewMenu({
    controller: {
      invoke: async (method, input) => {
        invoked.push({ method, input });
        return {
          success: true,
          state: { ...editorViewState, outlineMode: false },
        };
      },
      dispatch: async () => {},
    },
    presentation,
    getStudioWindow: () => ({
      webContents: {
        reload: () => {},
        reloadIgnoringCache: () => {},
        toggleDevTools: () => {},
        getZoomLevel: () => currentZoom,
        setZoomLevel: (value) => {
          currentZoom = value;
        },
      },
    }),
    modes: ["window", "fullscreen", "island"],
    closeActions: ["ask", "island", "quit"],
    isPackaged: true,
    platform: "darwin",
    dialog: {
      showErrorBox: (...args) => errors.push(args),
    },
    editorViewState,
    onEditorViewState: (state) => updates.push(state),
    t: (key) => key,
  });
  const byId = (id) => menu.submenu.find((entry) => entry.id === id);
  return { menu, byId, errors };
}

test("viewMenu disables editor view operations when no design editor is active", () => {
  const { menu, byId } = createMenu({ editorViewState: null });
  assert.equal(menu.id, "desktop-view");

  const editorIds = [
    "desktop-view-slot-placeholder",
    "desktop-view-container-placeholder",
    "desktop-view-multiplayer-selections",
    "desktop-view-ancestors-hover-boxes",
    "desktop-view-outline-mode",
    "desktop-view-full-page-height",
    "desktop-view-focused-mode",
    "desktop-view-auto-open-mode",
    "desktop-view-comments-overlay",
    "desktop-view-content-editor-mode",
    "desktop-view-refresh-data",
  ];
  for (const id of editorIds) {
    assert.equal(byId(id).enabled, false, `${id} should be disabled`);
  }

  assert.equal(byId("desktop-view-slot-placeholder").label, "Show placeholders for empty slots");
  assert.equal(byId("desktop-view-full-page-height").label, "Show full page height");
  assert.equal(byId("desktop-view-focused-mode").label, "Turn off design mode");
  assert.equal(byId("desktop-view-auto-open-mode").label, "Turn on auto-open mode");

  // Separators partition canvas guides, editor modes, data, app display, import, zoom, reload.
  const separatorIndices = menu.submenu
    .map((item, index) => (item.type === "separator" ? index : -1))
    .filter((index) => index >= 0);
  assert.deepEqual(separatorIndices, [6, 11, 13, 17, 19, 23]);
});

test("viewMenu adapts labels and preconditions to active editor state and invokes actions", async () => {
  const invoked = [];
  const updates = [];
  const activeFalse = {
    available: true,
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
  const offMenu = createMenu({ editorViewState: activeFalse });
  assert.equal(offMenu.byId("desktop-view-slot-placeholder").enabled, true);
  assert.equal(offMenu.byId("desktop-view-outline-mode").enabled, false);
  assert.equal(offMenu.byId("desktop-view-focused-mode").enabled, false);
  assert.equal(offMenu.byId("desktop-view-comments-overlay").enabled, false);
  assert.equal(offMenu.byId("desktop-view-content-editor-mode").enabled, false);
  assert.equal(offMenu.byId("desktop-view-slot-placeholder").label, "Show placeholders for empty slots");

  const activeTrue = {
    available: true,
    showSlotPlaceholder: true,
    showContainerPlaceholder: true,
    showMultiplayerSelections: true,
    showAncestorsHoverBoxes: true,
    hasFocusedViewCtx: true,
    outlineMode: true,
    fullPageHeight: true,
    canToggleFocusedMode: true,
    focusedMode: true,
    autoOpenMode: true,
    canShowComments: true,
    showCommentsOverlay: true,
    canChangeContentEditorMode: true,
    contentEditorMode: true,
  };
  const onMenu = createMenu({ editorViewState: activeTrue, invoked, updates });
  assert.equal(onMenu.byId("desktop-view-slot-placeholder").label, "Hide placeholders for empty slots");
  assert.equal(onMenu.byId("desktop-view-container-placeholder").label, "Hide placeholders for empty containers");
  assert.equal(onMenu.byId("desktop-view-multiplayer-selections").label, "Hide cursors and selections from other users");
  assert.equal(onMenu.byId("desktop-view-ancestors-hover-boxes").label, "Hide container outlines when hovering");
  assert.equal(onMenu.byId("desktop-view-outline-mode").label, "Hide outline mode");
  assert.equal(onMenu.byId("desktop-view-outline-mode").enabled, true);
  assert.equal(onMenu.byId("desktop-view-full-page-height").label, "Fit to viewport height");
  assert.equal(onMenu.byId("desktop-view-focused-mode").label, "Turn on design mode");
  assert.equal(onMenu.byId("desktop-view-auto-open-mode").label, "Turn off auto-open mode");
  assert.equal(onMenu.byId("desktop-view-comments-overlay").label, "Hide comments overlay");
  assert.equal(onMenu.byId("desktop-view-content-editor-mode").label, "Turn off content creator mode");

  await onMenu.byId("desktop-view-outline-mode").click();
  assert.deepEqual(invoked, [
    { method: "editorViewAction", input: { action: "toggleOutlineMode" } },
  ]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].outlineMode, false);
  assert.equal(
    sameEditorViewMenuState(
      normalizeEditorViewMenuState(null),
      DEFAULT_EDITOR_VIEW_MENU_STATE,
    ),
    true,
  );
});
