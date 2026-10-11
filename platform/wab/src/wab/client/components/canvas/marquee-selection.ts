import { frameToClientRect } from "@/wab/client/coords";
import { hasLayoutBox } from "@/wab/client/dom";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { SQ, isSelectableLocked } from "@/wab/shared/core/selection";
import { ValNode } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";

/** Selectable layers in the current editing scope, optionally enclosed by a client box. */
export function getSelectableLayers(vc: ViewCtx, box?: Box): ValNode[] {
  const valState = vc.valState();
  const owner =
    vc.currentComponentCtx()?.valComponent() ?? valState.maybeValSysRoot();
  if (!owner) {
    return [];
  }
  const frameBox = Box.fromRect(
    vc.canvasCtx.viewport().getBoundingClientRect(),
  );
  const candidates = SQ(owner, valState)
    .descendantsDfsFullstack()
    .toArrayOfValNodes()
    .filter((val) => {
      if (
        val.valOwner !== owner ||
        vc.getViewOps().isRootNodeOfFrame(val.tpl) ||
        isSelectableLocked(val, valState)
      ) {
        return false;
      }
      const elements =
        vc
          .selectionDom(val, vc.sel2cloneKey(val))
          ?.toArray()
          .filter((element) => {
            const style =
              element.ownerDocument.defaultView?.getComputedStyle(element);
            return (
              hasLayoutBox(element) &&
              style?.visibility !== "hidden" &&
              style?.visibility !== "collapse" &&
              !element.closest("[data-nonselectable]")
            );
          }) ?? [];
      return (
        elements.length > 0 &&
        elements.every((element) => {
          const bounds = Box.fromRect(
            frameToClientRect(element.getBoundingClientRect(), vc),
          );
          return (
            !box || (frameBox.intersects(bounds) && box.containsBox(bounds))
          );
        })
      );
    });
  const enclosed = new Set(candidates);
  // A fully enclosed container represents its children as one selection.
  return candidates.filter(
    (val) =>
      !SQ(val, valState)
        .parents()
        .toArray()
        .some((parent) => parent instanceof ValNode && enclosed.has(parent)),
  );
}

export function selectMarquee(vc: ViewCtx, box: Box, append: boolean) {
  const selectables = getSelectableLayers(vc, box);
  vc.change(() => selectLayers(vc, selectables, append));
}

function selectLayers(vc: ViewCtx, selectables: ValNode[], append: boolean) {
  if (!append) {
    vc.setStudioFocusBySelectable(null);
  }
  for (const val of selectables) {
    // appendToMultiSelection toggles existing nodes; marquee should only add.
    if (!vc.focusedSelectables().includes(val)) {
      vc.getViewOps().tryFocusObj(val, {
        exact: true,
        anchorCloneKey: vc.sel2cloneKey(val),
        appendToMultiSelection: true,
      });
    }
  }
}

export function getMarqueeFrames(studioCtx: StudioCtx, box: Box) {
  const frames = studioCtx.currentArena
    ? getArenaFrames(studioCtx.currentArena)
    : [];
  return studioCtx.viewCtxs
    .filter((vc) => vc.isVisible() && frames.includes(vc.arenaFrame()))
    .filter((vc) =>
      box.containsBox(
        Box.fromRect(vc.canvasCtx.viewport().getBoundingClientRect()),
      ),
    )
    .map((vc) => vc.arenaFrame());
}

export function selectAllInCanvas(studioCtx: StudioCtx) {
  const vc = studioCtx.focusedViewCtx();
  if (studioCtx.focusedFrames().length || !vc) {
    studioCtx.setStudioFocusOnFrames(
      studioCtx.currentArena ? getArenaFrames(studioCtx.currentArena) : [],
    );
  } else {
    selectLayers(vc, getSelectableLayers(vc), false);
  }
}
