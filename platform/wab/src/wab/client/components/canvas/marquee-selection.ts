import {
  clipBox,
  computeClipBounds,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { GeometrySnapshot } from "@/wab/client/components/canvas/geometry-snapshot";
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
  const geometry = new GeometrySnapshot();
  const frameBox = Box.fromRect(geometry.getRect(vc.canvasCtx.viewport()));
  const zoom = vc.studioCtx.zoom;
  const candidates = SQ(owner, valState)
    .descendantsDfsFullstack()
    .toArrayOfValNodes()
    .filter((val) => {
      if (
        val.valOwner !== owner ||
        vc.getViewOps().isRootNodeOfFrame(val.tpl) ||
        isSelectableLocked(val, valState) ||
        (vc.studioCtx.canvasContentEditor && !vc.contentEditor.contains(val))
      ) {
        return false;
      }
      const elements =
        vc
          .selectionDom(val, vc.sel2cloneKey(val))
          ?.toArray()
          .filter((element) => {
            const style = geometry.getStyle(element);
            return (
              hasLayoutBox(element) &&
              style?.visibility !== "hidden" &&
              style?.visibility !== "collapse" &&
              !element.closest("[data-nonselectable]")
            );
          }) ?? [];
      // Judge what the user can see, like the selection outline: an element
      // partly cut off by a scroll container or the artboard is enclosed when
      // its visible part is, and fully clipped elements can't be picked.
      if (!box) {
        // No marquee (e.g. select all): every laid-out layer qualifies.
        return elements.length > 0;
      }
      const visibleBounds = elements.flatMap((element) => {
        const visible = clipBox(
          Box.fromRect(geometry.getRect(element)),
          computeClipBounds(element, geometry),
        );
        return visible
          ? [visible.scale(zoom).moveBy(frameBox.left(), frameBox.top())]
          : [];
      });
      return (
        visibleBounds.length > 0 &&
        visibleBounds.every(
          (bounds) => frameBox.intersects(bounds) && box.containsBox(bounds),
        )
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
  vc.getViewOps().focusCanvasLayers(selectables, append);
}

export function getMarqueeFrames(studioCtx: StudioCtx, box: Box) {
  if (studioCtx.canvasContentEditor) {
    return [];
  }
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
  const vc =
    (studioCtx.canvasContentEditor &&
      studioCtx.viewCtxs.find((view) => view.contentEditor.target)) ??
    studioCtx.focusedViewCtx();
  if (studioCtx.canvasContentEditor && vc) {
    selectLayers(vc, getSelectableLayers(vc), false);
    return;
  }
  if (studioCtx.focusedFrames().length || !vc) {
    studioCtx.setStudioFocusOnFrames(
      studioCtx.currentArena ? getArenaFrames(studioCtx.currentArena) : [],
    );
  } else {
    selectLayers(vc, getSelectableLayers(vc), false);
  }
}
