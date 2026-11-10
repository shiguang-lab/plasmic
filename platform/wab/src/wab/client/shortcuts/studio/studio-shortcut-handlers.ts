import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { bindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { STUDIO_SHORTCUTS } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { TOOLS_SHORTCUT_GROUP, VIEW_SHORTCUT_GROUP } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { canHandleStudioModelInput } from "@/wab/client/studio-ctx/studio-input";
import { hasStudioCommandBarrier, hasStudioEscapeLayer } from "@/wab/client/hooks/useStudioEscape";
import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { assert, mod } from "@/wab/shared/common";
import { getSiteArenas } from "@/wab/shared/core/sites";
import { LeftTabKey } from "@/wab/shared/ui-config-utils";
import L from "lodash";

const modelCommands = new Set<string>([
  ...TOOLS_SHORTCUT_GROUP.shortcuts.map(shortcut => shortcut.action),
  ...VIEW_SHORTCUT_GROUP.shortcuts.map(shortcut => shortcut.action).filter(action =>
    !["TOGGLE_PREVIEW_MODE", "PRESENT", "TOGGLE_INTERACTIVE_MODE", "TOGGLE_FOCUSED_MODE", "PREV_ARENA", "NEXT_ARENA"].includes(action)),
  "UNDO", "REDO", "DESELECT",
]);

/** Application commands remain available; model commands require real surface focus. */
export function shouldHandleStudioShortcut(studioCtx: StudioCtx) {
  return (_event: KeyboardEvent, element: Element, action?: string): boolean => {
    // Issue 1: Don't handle if not in dev mode
    if (!studioCtx.isDevMode || isAnyModalOpen() || hasStudioCommandBarrier() || (_event.key === "Escape" && hasStudioEscapeLayer())) {
      return false;
    }

    // Issue 2: Don't handle if focus is in <body> but not in <div.studio>
    // <body>                   // YES
    //   <div class="studio" /> // YES
    //   <div class="popup" />  // NO
    // </body>
    if (document.body !== element && document.body.contains(element)) {
      const studioEl = document.body.querySelector("div.studio");
      if (studioEl && !studioEl.contains(element)) {
        return false;
      }
    }

    return !action || !modelCommands.has(action) || canHandleStudioModelInput(studioCtx);
  };
}

export function shouldHandleModelShortcut(studioCtx: StudioCtx) {
  const allowed = shouldHandleStudioShortcut(studioCtx);
  const applicationCommands = new Set(["SHOW_ADD_DRAWER", "SHOW_VARIANTS_DRAWER", "PRESENT", "TOGGLE_PREVIEW_MODE"]);
  return (event: KeyboardEvent, element: Element, action: string) =>
    allowed(event, element, action) && (applicationCommands.has(action) || canHandleStudioModelInput(studioCtx));
}

/**
 * Binds shortcut handlers that only require a `StudioCtx`.
 * More shortcut handlers can be found in `ViewEditor`.
 */
export function bindStudioShortcutHandlers(studioCtx: StudioCtx) {
  const toggleLeftTab = (tabKey: LeftTabKey) => {
    if (studioCtx.leftTabKey === tabKey) {
      studioCtx.switchLeftTab(undefined);
    } else {
      studioCtx.switchLeftTab(tabKey);
    }
  };

  const switchArenaByDelta = (sc: StudioCtx, delta: number) => {
    return sc.changeUnsafe(() => {
      const currentArena = sc.currentArena!;
      const allArenas = getSiteArenas(sc.site);
      let index = allArenas.indexOf(currentArena);
      index = mod(index + delta, allArenas.length);
      let incomingArena = allArenas[index];
      if (sc.isLiveMode) {
        // In live mode, we can't switch to an arena without frames
        for (const _ of L.range(allArenas.length)) {
          if (getArenaFrames(incomingArena).length === 0) {
            index = mod(index + delta, allArenas.length);
            incomingArena = allArenas[index];
          } else {
            break;
          }
        }
        assert(
          getArenaFrames(incomingArena).length !== 0,
          "incomingArena should have at least one frame.",
        );
      }
      sc.switchToArena(incomingArena);
    });
  };

  return bindShortcutHandlers(
    document.body,
    STUDIO_SHORTCUTS,
    {
      SAVE: async (e) => {
        e.preventDefault();
        await studioCtx.save();
      },
      UNDO: async (e) => {
        e.preventDefault();
        return studioCtx.undo();
      },
      REDO: async (e) => {
        e.preventDefault();
        return studioCtx.redo();
      },
      RECT: async () => {
        if (studioCtx.currentArenaEmpty) {
          return;
        }
        return studioCtx.changeUnsafe(() => {
          studioCtx.setPointerState("rect");
        });
      },
      STACK: async () => {
        if (studioCtx.currentArenaEmpty) {
          return;
        }
        return studioCtx.changeUnsafe(() => {
          studioCtx.setPointerState("stack");
        });
      },
      HORIZ_STACK: async () => {
        if (studioCtx.currentArenaEmpty) {
          return;
        }
        return studioCtx.changeUnsafe(() => {
          studioCtx.setPointerState("hstack");
        });
      },
      VERT_STACK: async () => {
        if (studioCtx.currentArenaEmpty) {
          return;
        }
        return studioCtx.changeUnsafe(() => {
          studioCtx.setPointerState("vstack");
        });
      },
      TEXT: async () => {
        if (studioCtx.currentArenaEmpty) {
          return;
        }
        return studioCtx.changeUnsafe(() => {
          studioCtx.setPointerState("text");
        });
      },
      ZOOM_IN: async (e) => {
        e.preventDefault();
        return studioCtx.changeUnsafe(() => {
          studioCtx.tryZoomWithDirection(1);
        });
      },
      ZOOM_OUT: async (e) => {
        e.preventDefault();
        return studioCtx.changeUnsafe(() => {
          studioCtx.tryZoomWithDirection(-1);
        });
      },
      ZOOM_RESET: async (e) => {
        e.preventDefault();
        return studioCtx.changeUnsafe(() => {
          studioCtx.tryZoomWithScale(1);
        });
      },
      ZOOM_TO_FIT: async () => {
        return studioCtx.changeUnsafe(() => {
          studioCtx.tryZoomToFitArena();
        });
      },
      ZOOM_TO_SELECTION: async () => {
        return studioCtx.tryZoomToFitSelection();
      },
      FOCUS_FRAME: async () => {
        return studioCtx.changeUnsafe(() => {
          studioCtx.centerFocusedFrame();
        });
      },
      FOCUS_NEXT_FRAME: async () => {
        return studioCtx.changeUnsafe(() => {
          if (!studioCtx.isLiveMode) {
            studioCtx.focusNextFrame();
          }
        });
      },
      FOCUS_PREV_FRAME: async () => {
        return studioCtx.changeUnsafe(() => {
          if (!studioCtx.isLiveMode) {
            studioCtx.focusPrevFrame();
          }
        });
      },
      TOGGLE_FOCUSED_MODE: async () => {
        return studioCtx.changeUnsafe(() => studioCtx.toggleFocusedMode());
      },
      TOGGLE_INTERACTIVE_MODE: async () => {
        return studioCtx.changeUnsafe(() => {
          studioCtx.toggleInteractiveMode();
        });
      },
      TOGGLE_COPILOT_CHAT: async () => {
        if (studioCtx.chatCopilotEnabled()) {
          studioCtx.toggleCopilotChat();
        }
      },
      SWITCH_TO_TREE_TAB: async () => {
        return studioCtx.changeUnsafe(() => {
          toggleLeftTab("outline");
        });
      },
      SEARCH_PROJECT_ARENAS: async () => {
        return studioCtx.changeUnsafe(() => {
          studioCtx.showProjectPanel();
          studioCtx.focusOnProjectSearchInput();
        });
      },
      SWITCH_TO_LINT_TAB: async () => {
        return studioCtx.changeUnsafe(() => {
          toggleLeftTab("lint");
        });
      },
      CLOSE_LEFT_PANEL: async () => {
        return studioCtx.changeUnsafe(() => {
          if (!studioCtx.leftTabKey) {
            studioCtx.restoreLastLeftTab();
          } else {
            studioCtx.switchLeftTab(undefined);
          }
        });
      },
      SWITCH_TO_DESIGN_TAB: async () => {
        return studioCtx.changeUnsafe(() =>
          studioCtx.switchRightTab(RightTabKey.style),
        );
      },
      SWITCH_TO_INTERACTIONS_TAB: async () => {
        return studioCtx.changeUnsafe(() =>
          studioCtx.switchRightTab(RightTabKey.interactions),
        );
      },
      SWITCH_TO_COMPONENT_TAB: async () => {
        return studioCtx.changeUnsafe(() =>
          studioCtx.switchRightTab(RightTabKey.component),
        );
      },
      SHOW_SHORTCUTS: () => {
        studioCtx.toggleShortcutsModal();
      },
      OUTLINE_MODE: () => {
        const vc = studioCtx.focusedViewCtx();
        if (vc) {
          vc.canvasCtx.setOutlineMode(!vc.canvasCtx.isOutlineMode());
        }
      },
      TOGGLE_FULL_PAGE_HEIGHT: () => {
        studioCtx.toggleFullPageHeight();
      },
      DESELECT: async () => {
        const sc = studioCtx;
        if (sc.app.isDragging()) {
          // Let the drag handlers handle the escape event.
        } else if (sc.showStackOfParents) {
          // Just hide the parent stack
          sc.setShowStackOfParents(false);
        } else {
          await sc.changeUnsafe(() => {
            if (sc.freestyleState()) {
              sc.setPointerState("move");
            } else if (sc.dragInsertState()) {
              sc.setDragInsertState(undefined);
            } else {
              const contentView = sc.viewCtxs.find((view) => view.contentEditor.target);
              if (contentView) {
                contentView.contentEditor.exit();
                return;
              }
              const vc = sc.focusedViewCtx();
              if (vc) {
                vc.setStudioFocusBySelectable(null);
                vc.setViewCtxHoverBySelectable(null);
                if (vc.currentComponentCtx()) {
                  vc.setCurrentComponentCtx(null);
                }
              }
              sc.setStudioFocusOnFrame({ frame: undefined, autoZoom: false });
            }
          });
        }
      },
      PREV_ARENA: () => {
        return switchArenaByDelta(studioCtx, -1);
      },
      NEXT_ARENA: () => {
        return switchArenaByDelta(studioCtx, 1);
      },
      RENAME_ELEMENT: (e) => {
        e.preventDefault();
        studioCtx.tryStartRenamingFocused();
      },
      SHOW_ADD_DRAWER: async (e) => {
        e.preventDefault();
        const sc = studioCtx;
        return sc.changeUnsafe(() => sc.setShowAddDrawer(true));
      },
      SHOW_VARIANTS_DRAWER: async (e) => {
        e.preventDefault();
        const sc = studioCtx;
        return sc.changeUnsafe(() => sc.setShowVariantsDrawer(true));
      },
      TOGGLE_VARIANTS_RECORDING: (e) => {
        e.preventDefault();
        const sc = studioCtx;
        const vc = sc.focusedViewCtx();
        if (vc) {
          vc.change(() => {
            const vcontroller = makeVariantsController(vc.studioCtx);
            if (vcontroller) {
              vcontroller.onToggleTargetingOfActiveVariants();
            }
          });
        }
      },
      TOGGLE_PREVIEW_MODE: async () => {
        return studioCtx.changeUnsafe(() => studioCtx.toggleDevControls());
      },
    },
    shouldHandleStudioShortcut(studioCtx),
  );
}
