import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { subscribeStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { subscribeStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { subscribeStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { subscribeStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  EditorViewMenuAction,
  EditorViewMenuState,
  INACTIVE_EDITOR_VIEW_MENU_STATE,
} from "@/wab/shared/desktop-view-menu";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { isEqual } from "lodash";
import { ok } from "neverthrow";

/** Capture the studio's current view menu flags and preconditions. */
export function readEditorViewMenuState(
  studioCtx: StudioCtx,
  enabled = !studioCtx.renderPolicy.docs,
): EditorViewMenuState {
  if (!enabled) {
    return INACTIVE_EDITOR_VIEW_MENU_STATE;
  }

  const renderPolicy = studioCtx.renderPolicy.store.getState();
  const overlay = studioCtx.overlayState.store.getState();
  const arena = studioCtx.arenaState.store.getState();
  const uiEnv = studioCtx.uiEnvironment.store.getState();
  const vc = studioCtx.focusedViewCtx();

  return {
    available: true,
    showSlotPlaceholder: renderPolicy.showSlotPlaceholder,
    showContainerPlaceholder: renderPolicy.showContainerPlaceholder,
    showMultiplayerSelections: overlay.multiplayerSelections,
    showAncestorsHoverBoxes: overlay.ancestorsHoverBoxes,
    hasFocusedViewCtx: !!vc,
    outlineMode: vc ? vc.canvasCtx.isOutlineMode() === true : false,
    fullPageHeight: renderPolicy.fullPageHeight,
    canToggleFocusedMode:
      !studioCtx.isPublishedTemplate && (arena.focusedMode || arena.kind === "component" || arena.kind === "page"),
    focusedMode: arena.focusedMode,
    autoOpenMode: renderPolicy.autoOpen,
    canShowComments: studioCtx.showComments(),
    showCommentsOverlay: overlay.commentsOverlay,
    canChangeContentEditorMode:
      !studioCtx.isPublishedTemplate && !studioCtx.isContentEditor() && !DEVFLAGS.contentEditorMode,
    contentEditorMode: uiEnv.contentEditorMode,
  };
}

/** Execute a view menu command on StudioCtx and return the resulting snapshot. */
export async function runEditorViewMenuAction(
  studioCtx: StudioCtx,
  action: EditorViewMenuAction,
): Promise<EditorViewMenuState> {
  switch (action) {
    case "toggleShowSlotPlaceholder":
      studioCtx.toggleShowSlotPlaceholder();
      break;
    case "toggleShowContainerPlaceholder":
      studioCtx.toggleShowContainerPlaceholder();
      break;
    case "toggleShowMultiplayerSelections":
      studioCtx.toggleShowMultiplayerSelections();
      break;
    case "toggleShowAncestorsHoverBoxes":
      studioCtx.toggleShowAncestorsHoverBoxes();
      break;
    case "toggleOutlineMode": {
      const vc = studioCtx.focusedViewCtx();
      if (vc) {
        vc.canvasCtx.setOutlineMode(!vc.canvasCtx.isOutlineMode());
      }
      break;
    }
    case "toggleFullPageHeight":
      studioCtx.toggleFullPageHeight();
      break;
    case "toggleFocusedMode": {
      const { kind, focusedMode } = studioCtx.arenaState.store.getState();
      if (focusedMode || kind === "component" || kind === "page") {
        await studioCtx.changeUnsafe(() => studioCtx.toggleFocusedMode());
      }
      break;
    }
    case "toggleAutoOpenMode":
      studioCtx.toggleAutoOpenMode();
      break;
    case "toggleShowCommentsOverlay":
      if (studioCtx.showComments()) {
        studioCtx.toggleShowCommentsOverlay();
      }
      break;
    case "toggleContentEditorMode":
      if (!studioCtx.isContentEditor() && !DEVFLAGS.contentEditorMode) {
        await studioCtx.change(() => {
          studioCtx.toggleContentEditorMode();
          return ok();
        });
      }
      break;
    case "refreshData":
      await studioCtx.refreshFetchedDataFromPlasmicQuery();
      await studioCtx.refreshAppUserProperties();
      break;
  }

  return readEditorViewMenuState(studioCtx);
}

/** Publish deduplicated editor view menu snapshots across studio store updates. */
export function observeEditorViewMenuState(
  studioCtx: StudioCtx,
  enabled: () => boolean,
  publish: (state: EditorViewMenuState) => void,
): () => void {
  let closed = false;
  let previous: EditorViewMenuState | undefined;
  let observedViewCtx: ViewCtx | undefined;
  let stopOutline: () => void = () => undefined;

  const sync = () => {
    if (closed) {
      return;
    }
    const next = readEditorViewMenuState(studioCtx, enabled());
    if (!previous || !isEqual(previous, next)) {
      previous = next;
      publish(next);
    }
  };

  const bindOutline = (view: ViewCtx | undefined) => {
    if (view !== observedViewCtx) {
      stopOutline();
      observedViewCtx = view;
      const nextStop = view?.canvasCtx?.subscribeOutlineMode?.(sync);
      stopOutline =
        typeof nextStop === "function" ? nextStop : () => undefined;
    }
    sync();
  };

  const stops = [
    subscribeStudioRenderPolicy(studioCtx, (state) => state, sync),
    subscribeStudioOverlayState(studioCtx, (state) => state, sync),
    subscribeStudioArena(studioCtx, (state) => state, sync),
    studioCtx.uiEnvironment.store.subscribe(sync),
    subscribeStudioSelection(studioCtx, (state) => state.view, bindOutline),
  ];

  bindOutline(studioCtx.focusedViewCtx());

  return () => {
    closed = true;
    stopOutline();
    stops.forEach((stop) => stop());
    if (!isEqual(previous, INACTIVE_EDITOR_VIEW_MENU_STATE)) {
      publish(INACTIVE_EDITOR_VIEW_MENU_STATE);
    }
  };
}
