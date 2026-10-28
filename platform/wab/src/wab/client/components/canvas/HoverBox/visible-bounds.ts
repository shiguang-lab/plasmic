import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox/recomputeBounds";
import { frameToScalerRect } from "@/wab/client/coords";
import { hasLayoutBox } from "@/wab/client/dom";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Box, Rect, Side } from "@/wab/shared/geom";
import $ from "jquery";
import type * as React from "react";

/**
 * Canvas overlays keep two boxes for an element:
 *
 * - `geometry`: the element's real border box. Sizes, measurements and drag
 *   computations use this.
 * - `visible`: the part of `geometry` the user can actually see after clipping
 *   by overflow ancestors and the artboard viewport. Outlines, handles and
 *   labels are drawn on this.
 *
 * Both boxes are in the coordinates of the element's own document viewport
 * (what `getBoundingClientRect` returns inside the artboard iframe).
 */
export interface ElementVisibility {
  geometry: Box;
  /** Undefined when nothing of the element is visible. */
  visible: Box | undefined;
  /** Sides whose real edge is hidden, so `visible` ends before `geometry`. */
  clippedSides: Record<Side, boolean>;
}

export const NO_CLIPPED_SIDES: Readonly<Record<Side, boolean>> = Object.freeze({
  top: false,
  right: false,
  bottom: false,
  left: false,
});

// Sub-pixel differences come from rounding in recomputeBounds; they are not
// clipping.
const CLIP_EPSILON = 0.5;

export interface Bounds {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

const UNBOUNDED: Bounds = {
  top: -Infinity,
  left: -Infinity,
  right: Infinity,
  bottom: Infinity,
};

function clipsAxis(overflow: string) {
  return (
    overflow === "hidden" ||
    overflow === "clip" ||
    overflow === "auto" ||
    overflow === "scroll"
  );
}

function containsPaint(style: CSSStyleDeclaration) {
  const contain = style.contain ?? "";
  return /\b(paint|strict|content)\b/.test(contain);
}

/** Whether `style` makes its element the containing block of fixed descendants. */
function establishesFixedContainingBlock(style: CSSStyleDeclaration) {
  const isSet = (value: string | undefined) =>
    !!value && value !== "none" && value !== "";
  return (
    isSet(style.transform) ||
    isSet(style.perspective) ||
    isSet(style.filter) ||
    isSet((style as any).backdropFilter) ||
    /\b(layout|paint|strict|content)\b/.test(style.contain ?? "") ||
    /\b(transform|perspective|filter)\b/.test(style.willChange ?? "")
  );
}

// Canvas elements belong to the artboard iframe's realm, so `instanceof`
// checks against this window's classes would fail; use structural checks.
function parentInFlatTree(elt: Element): Element | null {
  if (elt.parentElement) {
    return elt.parentElement;
  }
  const root = elt.getRootNode() as Partial<ShadowRoot>;
  return root.host ?? null;
}

function isHTMLElementLike(elt: Element): elt is HTMLElement {
  return "offsetWidth" in elt;
}

/** Padding box of `elt`, which is where its overflow is clipped. */
function paddingBox(elt: Element): Bounds | undefined {
  const rect = elt.getBoundingClientRect();
  if (!isHTMLElementLike(elt)) {
    // SVG and other non-HTML boxes have no client metrics; clip to the box.
    return rect.width || rect.height
      ? {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        }
      : undefined;
  }
  if (!elt.offsetWidth && !elt.offsetHeight) {
    // No layout metrics. A real box without them only exists in non-layout
    // DOMs (tests); use it as is. Otherwise the element has no box.
    return rect.width || rect.height
      ? {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        }
      : undefined;
  }
  // Account for ancestor transforms: client* sizes are untransformed.
  const scaleX = elt.offsetWidth ? rect.width / elt.offsetWidth : 1;
  const scaleY = elt.offsetHeight ? rect.height / elt.offsetHeight : 1;
  const left = rect.left + elt.clientLeft * scaleX;
  const top = rect.top + elt.clientTop * scaleY;
  return {
    left,
    top,
    right: left + elt.clientWidth * scaleX,
    bottom: top + elt.clientHeight * scaleY,
  };
}

/** The artboard document's visible viewport, in its own client coordinates. */
export function viewportBounds(doc: Document): Bounds | undefined {
  const root = doc.documentElement;
  const width = root?.clientWidth || doc.defaultView?.innerWidth || 0;
  const height = root?.clientHeight || doc.defaultView?.innerHeight || 0;
  if (!width || !height) {
    return undefined;
  }
  return { top: 0, left: 0, right: width, bottom: height };
}

/** One region that clips an element, and the element that owns it. */
interface ClipSource {
  /** The clipping ancestor, or the document scroller for the viewport. */
  container: Element;
  bounds: Bounds;
  clipX: boolean;
  clipY: boolean;
}

const ZERO_BOUNDS: Bounds = { top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Everything that clips `elt`, innermost first: overflow-clipping ancestors in
 * its containing block chain (by their padding boxes), then the artboard
 * viewport. Ancestors that an absolutely or fixed positioned element escapes
 * do not clip it.
 */
function clipSources(elt: Element): ClipSource[] {
  const doc = elt.ownerDocument;
  const win = doc.defaultView;
  if (!win) {
    return [];
  }
  const sources: ClipSource[] = [];

  let position = win.getComputedStyle(elt).position;
  for (
    let ancestor = parentInFlatTree(elt);
    ancestor && ancestor !== doc.body && ancestor !== doc.documentElement;
    ancestor = parentInFlatTree(ancestor)
  ) {
    const style = win.getComputedStyle(ancestor);
    const inContainingBlockChain =
      position === "fixed"
        ? establishesFixedContainingBlock(style)
        : position === "absolute"
          ? // Missing computed values (non-browser DOMs) mean `static`.
            (!!style.position && style.position !== "static") ||
            establishesFixedContainingBlock(style)
          : true;
    if (!inContainingBlockChain) {
      continue;
    }
    position = style.position;
    if (style.display === "contents" || style.display === "inline") {
      continue;
    }
    const paint = containsPaint(style);
    const clipX = paint || clipsAxis(style.overflowX || style.overflow);
    const clipY = paint || clipsAxis(style.overflowY || style.overflow);
    if (!clipX && !clipY) {
      continue;
    }
    const box = paddingBox(ancestor);
    if (!box) {
      // A clipping ancestor without a box hides everything inside it.
      sources.push({
        container: ancestor,
        bounds: ZERO_BOUNDS,
        clipX: true,
        clipY: true,
      });
      return sources;
    }
    sources.push({ container: ancestor, bounds: box, clipX, clipY });
  }

  const viewport = viewportBounds(doc);
  if (viewport) {
    sources.push({
      container: doc.scrollingElement ?? doc.documentElement,
      bounds: viewport,
      clipX: true,
      clipY: true,
    });
  }
  return sources;
}

/**
 * Region that can show `elt`: the intersection of the artboard viewport and
 * the padding boxes of overflow-clipping ancestors in its containing block
 * chain. Ancestors that an absolutely or fixed positioned element escapes do
 * not clip it.
 */
export function computeClipBounds(elt: Element): Bounds {
  const clip = { ...UNBOUNDED };
  for (const { bounds, clipX, clipY } of clipSources(elt)) {
    if (clipX) {
      clip.left = Math.max(clip.left, bounds.left);
      clip.right = Math.min(clip.right, bounds.right);
    }
    if (clipY) {
      clip.top = Math.max(clip.top, bounds.top);
      clip.bottom = Math.min(clip.bottom, bounds.bottom);
    }
  }
  return clip;
}

const SIDE_AXIS: Record<Side, "X" | "Y"> = {
  top: "Y",
  bottom: "Y",
  left: "X",
  right: "X",
};

/** How far `edge` lies beyond `bounds` on `side`; positive means hidden. */
function overshoot(edge: number, bounds: Bounds, side: Side) {
  return side === "bottom" || side === "right"
    ? edge - bounds[side]
    : bounds[side] - edge;
}

/** The laid-out element whose `side` edge is the outermost one. */
function edgeElement(elements: Element[], side: Side): Element | undefined {
  const outward = side === "bottom" || side === "right" ? 1 : -1;
  let best: Element | undefined;
  let bestEdge = -Infinity;
  for (const element of elements) {
    if (!element.isConnected || !hasLayoutBox(element as HTMLElement)) {
      continue;
    }
    const edge = element.getBoundingClientRect()[side] * outward;
    if (edge > bestEdge) {
      best = element;
      bestEdge = edge;
    }
  }
  return best;
}

/**
 * How to bring `elt`'s hidden `side` edge on screen: the innermost region
 * hiding it, and a container to scroll for that. Scrolling the hiding region
 * itself or any scroll container inside it moves the element relative to it
 * (and to every outer region), so the nearest such container that can still
 * scroll that way is used. Undefined when the edge isn't hidden or no
 * container can move it (e.g. only `overflow: hidden/clip` regions).
 */
function revealPlan(
  elt: Element,
  side: Side,
  exclude: ReadonlySet<Element> = new Set(),
) {
  const edge = elt.getBoundingClientRect()[side];
  const axis = SIDE_AXIS[side];
  const sources = clipSources(elt);
  const hiding = sources.findIndex(
    (source) =>
      (axis === "X" ? source.clipX : source.clipY) &&
      overshoot(edge, source.bounds, side) > CLIP_EPSILON,
  );
  if (hiding < 0) {
    return undefined;
  }
  for (let i = hiding; i >= 0; i--) {
    const { container } = sources[i];
    if (!exclude.has(container) && canScrollToward(container, side)) {
      return {
        hidden: overshoot(edge, sources[hiding].bounds, side),
        scroller: container,
      };
    }
  }
  return undefined;
}

/** Whether `container` can scroll further toward `side`. */
function canScrollToward(container: Element, side: Side) {
  const doc = container.ownerDocument;
  const style = doc.defaultView?.getComputedStyle(container);
  const axis = SIDE_AXIS[side];
  const overflow = style?.[`overflow${axis}`] ?? "";
  const isDocumentScroller = container === doc.scrollingElement;
  const scrollable = isDocumentScroller
    ? overflow !== "hidden" && overflow !== "clip"
    : /^(auto|scroll|overlay)$/.test(overflow);
  if (!scrollable) {
    return false;
  }
  const position = axis === "Y" ? container.scrollTop : container.scrollLeft;
  const max =
    axis === "Y"
      ? container.scrollHeight - container.clientHeight
      : container.scrollWidth - container.clientWidth;
  return side === "bottom" || side === "right"
    ? max - position > CLIP_EPSILON
    : position > CLIP_EPSILON;
}

/**
 * Whether the hidden `side` edge of `elements` (a selection's DOM roots) can
 * be brought on screen by scrolling. An edge hidden by `overflow: hidden/clip`
 * with no scroll container inside it can't be revealed.
 */
export function canRevealEdge(elements: Element[], side: Side): boolean {
  const elt = edgeElement(elements, side);
  return !!elt && !!revealPlan(elt, side);
}

/**
 * Scrolls the `side` edge of `elements` into view, `margin` pixels inside the
 * regions that hid it (as far as the containers can scroll). Inner containers
 * go first; only the edge's own axis scrolls.
 */
export function revealEdge(elements: Element[], side: Side, margin = 16) {
  const elt = edgeElement(elements, side);
  if (!elt) {
    return;
  }
  const axis = SIDE_AXIS[side];
  const outward = side === "bottom" || side === "right" ? 1 : -1;
  const scrolled = new Set<Element>();
  for (;;) {
    // Re-measure after each scroll: inner scrolling moves the edge relative
    // to the outer regions.
    const plan = revealPlan(elt, side, scrolled);
    if (!plan) {
      return;
    }
    const container = plan.scroller;
    scrolled.add(container);
    const isDocumentScroller =
      container === container.ownerDocument.scrollingElement;
    // Scroll offsets are in the container's own (untransformed) pixels.
    const rect = container.getBoundingClientRect();
    const size =
      axis === "Y"
        ? (container as HTMLElement).offsetHeight
        : (container as HTMLElement).offsetWidth;
    const scale =
      isDocumentScroller || !size
        ? 1
        : (axis === "Y" ? rect.height : rect.width) / size;
    const delta = (outward * (plan.hidden + margin)) / (scale || 1);
    container.scrollTo({
      ...(axis === "Y"
        ? { top: container.scrollTop + delta }
        : { left: container.scrollLeft + delta }),
      behavior: "instant",
    });
  }
}

/** The part of `box` inside `clip`, or undefined when none of it is. */
export function clipBox(box: Box, clip: Bounds): Box | undefined {
  const top = Math.max(box.top(), clip.top);
  const left = Math.max(box.left(), clip.left);
  const right = Math.min(box.right(), clip.right);
  const bottom = Math.min(box.bottom(), clip.bottom);
  // Zero-width/height elements (e.g. rules) are visible while they lie inside
  // the clip; elements with area need an overlap with area.
  const degenerate = box.width() === 0 || box.height() === 0;
  const empty = degenerate
    ? right < left || bottom < top
    : right <= left || bottom <= top;
  return empty ? undefined : new Box(top, left, right - left, bottom - top);
}

export function clippedSidesOf(
  geometry: Rect,
  visible: Rect | undefined,
): Record<Side, boolean> {
  if (!visible) {
    return { top: true, right: true, bottom: true, left: true };
  }
  return {
    top: visible.top - geometry.top > CLIP_EPSILON,
    left: visible.left - geometry.left > CLIP_EPSILON,
    right:
      geometry.left + geometry.width - (visible.left + visible.width) >
      CLIP_EPSILON,
    bottom:
      geometry.top + geometry.height - (visible.top + visible.height) >
      CLIP_EPSILON,
  };
}

/**
 * Computes the visible part of `geometry`, the bounds of the layout elements
 * in `$node` (as returned by `recomputeBounds`). Each element is clipped by its
 * own ancestors, since multi-root selections may sit in different scroll
 * containers.
 */
export function computeElementVisibility(
  $node: JQuery,
  geometry: Box,
): ElementVisibility {
  const visibleParts = ($node.toArray() as HTMLElement[])
    .filter(hasLayoutBox)
    // `visibility` is not clipping: a `visibility: hidden` element keeps its
    // box (and may show visible descendants), so it keeps its outline. While
    // content editing, everything outside the isolated target is excluded.
    .filter(
      (elt) =>
        !elt.ownerDocument.documentElement.hasAttribute(
          "data-plasmic-content-editor",
        ) || !!elt.closest("[data-plasmic-content-target]"),
    )
    .map((elt) =>
      clipBox(
        Box.fromRect(elt.getBoundingClientRect()),
        computeClipBounds(elt),
      ),
    )
    .filter((box): box is Box => !!box);
  const merged = Box.mergeBBs(visibleParts.map((box) => box.rect()));
  if (!merged) {
    return {
      geometry,
      visible: undefined,
      clippedSides: clippedSidesOf(geometry.rect(), undefined),
    };
  }
  const clippedSides = clippedSidesOf(geometry.rect(), merged.rect());
  // Unclipped sides use the (rounded) geometry edge, so an unclipped element
  // gets exactly its real box; clipped sides stay inside the geometry.
  const top = clippedSides.top
    ? Math.min(merged.top(), geometry.bottom())
    : geometry.top();
  const left = clippedSides.left
    ? Math.min(merged.left(), geometry.right())
    : geometry.left();
  const bottom = clippedSides.bottom
    ? Math.max(merged.bottom(), top)
    : geometry.bottom();
  const right = clippedSides.right
    ? Math.max(merged.right(), left)
    : geometry.right();
  return {
    geometry,
    visible: Box.fromRectSides({ top, left, right, bottom }),
    clippedSides,
  };
}

export interface ScalerVisibility {
  /** Real element box in scaler coordinates. */
  geometry: Rect;
  /** Visible element box in scaler coordinates; undefined when hidden. */
  visible: Rect | undefined;
  clippedSides: Record<Side, boolean>;
}

/** `computeElementVisibility` for overlays positioned in the canvas scaler. */
export function computeScalerVisibility(
  $node: JQuery,
  vc: ViewCtx,
): ScalerVisibility {
  const { geometry, visible, clippedSides } = computeElementVisibility(
    $node,
    recomputeBounds($node),
  );
  const inScope =
    !vc.studioCtx.canvasContentEditor ||
    $node
      .toArray()
      .some((element) => vc.contentEditor.containsElement(element));
  return {
    geometry: frameToScalerRect(geometry.rect(), vc),
    visible:
      inScope && visible ? frameToScalerRect(visible.rect(), vc) : undefined,
    clippedSides,
  };
}

/**
 * Style for a layer inside an overlay drawn at the visible box that must be
 * laid out against the real element box (spacing, scrollbars, column
 * controls). Parts on clipped sides are cut off; everything else, including
 * margins drawn outside the element, stays visible.
 */
export function geometryLayerStyle(
  geometry: Rect,
  visible: Rect,
  clippedSides: Record<Side, boolean>,
  zoom: number,
): React.CSSProperties {
  const top = (visible.top - geometry.top) * zoom;
  const left = (visible.left - geometry.left) * zoom;
  const bottom =
    (geometry.top + geometry.height - (visible.top + visible.height)) * zoom;
  const right =
    (geometry.left + geometry.width - (visible.left + visible.width)) * zoom;
  // Negative insets let unclipped sides paint outside the element.
  const OUTSIDE = -100000;
  const inset = (side: Side, value: number) =>
    `${clippedSides[side] ? value : OUTSIDE}px`;
  const hasClipping = Object.values(clippedSides).some((clipped) => clipped);
  return {
    position: "absolute",
    top: (geometry.top - visible.top) * zoom,
    left: (geometry.left - visible.left) * zoom,
    width: geometry.width * zoom,
    height: geometry.height * zoom,
    ...(hasClipping && {
      clipPath: `inset(${inset("top", top)} ${inset("right", right)} ${inset(
        "bottom",
        bottom,
      )} ${inset("left", left)})`,
    }),
  };
}

/**
 * Where to place or frame UI anchored on canvas elements: the visible part of
 * their box, in artboard frame coordinates. Use this for anything positioned
 * relative to an element (toolbars, zoom-to-fit, overlays) so it agrees with
 * the selection outline. Measurements and drag computations use the real box.
 *
 * Fully clipped elements fall back to their real box; elements without a
 * layout box fall back to `getBoundingClientRect`.
 */
export function getVisibleFrameRect(elements: HTMLElement | HTMLElement[]) {
  const all = Array.isArray(elements) ? elements : [elements];
  const laidOut = all.filter(hasLayoutBox);
  if (laidOut.length === 0) {
    const first = all[0];
    return first ? Box.fromRect(first.getBoundingClientRect()) : Box.zero();
  }
  const $node = $(laidOut);
  const geometry = recomputeBounds($node);
  return computeElementVisibility($node, geometry).visible ?? geometry;
}

/**
 * Like `getVisibleFrameRect`, for hit testing: a fully clipped element yields
 * an empty box at the origin instead of its real box, so it can't be targeted
 * through content drawn over it.
 */
export function getHitTestFrameRect(element: Element): Box {
  const box = Box.fromRect(element.getBoundingClientRect());
  return clipBox(box, computeClipBounds(element)) ?? Box.zero();
}
