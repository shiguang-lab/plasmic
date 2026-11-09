import { subscribeContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { subscribeFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { subscribeStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { subscribeFocusedViewSelection, subscribeStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox";
import {
  computeElementVisibility,
  viewportBounds,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { hasLayoutBox } from "@/wab/client/dom";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { maybe } from "@/wab/shared/common";
import { Box, Pt, Side, horizontalSides } from "@/wab/shared/geom";
import { subscribeViewport } from "@/wab/client/studio-ctx/viewport-state";
import * as React from "react";

export interface MeasureToolViewProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  showPx?: boolean; // Show a label of pixel distance
  isDashed: boolean; // Dashed line
  // The real distance, when the drawn segment was clipped to what is visible.
  label?: number;
}

/**
 * An element as the measure tool sees it: distances are measured between the
 * real (`box`) edges, while lines are anchored on the part that is visible
 * (`visible`), like the selection outline.
 */
export interface MeasuredBox {
  box: Box;
  visible: Box;
}

/**
 * Lines between two elements, in scaler coordinates. Labels carry the real
 * distance; the drawn segments are cut to `viewport` (the artboard's visible
 * area), and lines entirely outside it are dropped.
 */
export function computeMeasureLines(
  src: MeasuredBox,
  dst: MeasuredBox,
  viewport: Box | undefined,
): MeasureToolViewProps[] {
  const lines = src.box.containsBox(dst.box)
    ? drawContains(src.box, dst.box, dst.visible)
    : dst.box.containsBox(src.box)
      ? drawContains(dst.box, src.box, src.visible)
      : src.box.overlapsBox(dst.box)
        ? drawOverlapping(src, dst)
        : drawNonoverlapping(src.box, dst.box, src.visible);
  return viewport
    ? lines.flatMap((line) => clipLine(line, viewport) ?? [])
    : lines;
}

/** Draw measurement lines if b1 fully contains b2 */
function drawContains(
  b1: Box,
  b2: Box,
  b2Visible: Box,
): MeasureToolViewProps[] {
  return sides((side) => [
    {
      // side represents a side of b2; the line sits on the middle of the
      // visible part of b2 so it stays on screen with its outline.
      x1: horizontalSides.includes(side) ? b2.getSide(side) : b2Visible.xmid(),
      y1: horizontalSides.includes(side) ? b2Visible.ymid() : b2.getSide(side),
      x2: horizontalSides.includes(side) ? b1.getSide(side) : b2Visible.xmid(),
      y2: horizontalSides.includes(side) ? b2Visible.ymid() : b1.getSide(side),
      showPx: true,
      isDashed: false,
    },
  ]);
}

/**
 * If neither box full encloses the other, but intersects,
 * calculate the union and intersection first
 **/
function drawOverlapping(
  b1: MeasuredBox,
  b2: MeasuredBox,
): MeasureToolViewProps[] {
  const outerBox = b1.box.merge(b2.box.rect());
  const innerBox = b1.box.intersection(b2.box, true);
  if (!innerBox) {
    return [];
  }
  const innerVisible =
    b1.visible.intersection(b2.visible, true) ??
    innerBox.intersection(b1.visible, true) ??
    innerBox;
  return drawContains(outerBox, innerBox, innerVisible);
}

/** Draw lines and guides for 2 disjoint boxes */
function drawNonoverlapping(
  src: Box,
  dst: Box,
  srcVisible: Box,
): MeasureToolViewProps[] {
  const result: MeasureToolViewProps[] = [];
  const srcYmid = srcVisible.ymid();
  const srcXmid = srcVisible.xmid();
  // Solid horizontal lines
  const rightOf = src.left() > dst.right();
  if (src.left() > dst.right() || src.right() < dst.left()) {
    result.push({
      x1: rightOf ? src.left() : src.right(),
      y1: srcYmid,
      x2: rightOf ? dst.right() : dst.left(),
      y2: srcYmid,
      showPx: true,
      isDashed: false,
    });
    // Dashed vertical lines
    if (srcYmid > dst.bottom() || srcYmid < dst.top()) {
      result.push({
        x1: rightOf ? dst.right() : dst.left(),
        y1: srcYmid,
        x2: rightOf ? dst.right() : dst.left(),
        y2: srcYmid > dst.bottom() ? dst.bottom() : dst.top(),
        showPx: false,
        isDashed: true,
      });
    }
  }

  // Solid vertical lines
  const below = src.top() > dst.bottom();
  if (src.top() > dst.bottom() || src.bottom() < dst.top()) {
    result.push({
      x1: srcXmid,
      y1: below ? src.top() : src.bottom(),
      x2: srcXmid,
      y2: below ? dst.bottom() : dst.top(),
      showPx: true,
      isDashed: false,
    });
    // Dashed horizontal lines
    if (srcXmid > dst.right() || srcXmid < dst.left()) {
      result.push({
        x1: srcXmid,
        y1: below ? dst.bottom() : dst.top(),
        x2: srcXmid > dst.right() ? dst.right() : dst.left(),
        y2: below ? dst.bottom() : dst.top(),
        showPx: false,
        isDashed: true,
      });
    }
  }
  return result;
}

/** Cuts an axis-aligned line to `viewport`, keeping its real length as label. */
function clipLine(
  line: MeasureToolViewProps,
  viewport: Box,
): MeasureToolViewProps | undefined {
  const label = Math.floor(
    Math.sqrt((line.x1 - line.x2) ** 2 + (line.y1 - line.y2) ** 2),
  );
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);
  if (line.y1 === line.y2) {
    if (line.y1 < viewport.top() || line.y1 > viewport.bottom()) {
      return undefined;
    }
    const x1 = clamp(line.x1, viewport.left(), viewport.right());
    const x2 = clamp(line.x2, viewport.left(), viewport.right());
    return x1 === x2 && line.x1 !== line.x2
      ? undefined
      : { ...line, x1, x2, label };
  }
  if (line.x1 === line.x2) {
    if (line.x1 < viewport.left() || line.x1 > viewport.right()) {
      return undefined;
    }
    const y1 = clamp(line.y1, viewport.top(), viewport.bottom());
    const y2 = clamp(line.y2, viewport.top(), viewport.bottom());
    return y1 === y2 && line.y1 !== line.y2
      ? undefined
      : { ...line, y1, y2, label };
  }
  return line;
}

export function MeasureToolView({
  viewProps,
  zoom,
}: {
  viewProps: MeasureToolViewProps[];
  zoom: number;
}) {
  return (
    <div>
      {viewProps.map((p, index) => {
        const dx = p.x1 - p.x2;
        const dy = p.y1 - p.y2;
        // In radians, direction starting at 3 o'clock specified by
        // https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/rotate
        const angle = Math.PI + Math.atan2(dy, dx);
        const len = Math.floor(Math.sqrt(dx * dx + dy * dy));
        const left = p.x1;
        const top = p.y1;
        return (
          <div key={"measuretool-container" + index}>
            <div
              key={"measuretool-line" + index}
              className={"MeasureTool__Line"}
              data-original-width={len}
              data-original-height={0}
              data-original-transform={`rotate(${angle}rad)`}
              style={{
                left: left,
                top: top,
                width: zoom * len,
                height: 0,
                transform: `scale(${1 / zoom}) rotate(${angle}rad)`,
                borderStyle: p.isDashed ? "dashed" : "solid",
              }}
            >
              {p.showPx && (
                <div
                  key={"measuretool-label" + index}
                  className={"MeasureTool__Label"}
                  style={{
                    transform: `translate(-50%, -50%) rotate(-${angle}rad)`,
                  }}
                >
                  {p.label ?? Math.floor(len)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function sides(
  fn: (side: Side) => MeasureToolViewProps[],
): MeasureToolViewProps[] {
  const result: MeasureToolViewProps[] = [];
  return result.concat(fn("left"), fn("right"), fn("top"), fn("bottom"));
}

type MeasureSnapshot = { viewProps: MeasureToolViewProps[]; zoom: number } | null;

function readMeasureSnapshot(studio: StudioCtx): MeasureSnapshot {
          const sc = studio;
          const vc = sc.focusedViewCtx();
          if (!vc || vc.disposeSignal.aborted || vc.studioCtx !== sc || !sc.arenaState.isCurrentLifetime(vc.modelLifetime)) { return null; }
  const activeView = vc;
  function frameOffset() {
    const frameBox = activeView.studioCtx.getArenaFrameScalerRect(activeView.arenaFrame());
    return { left: frameBox?.left ?? 0, top: frameBox?.top ?? 0 };
  }

  /**
   * Given a DOM element, compute its real and visible scaler boxes
   **/
  function makeBox($dom: JQuery): MeasuredBox {
    const { left, top } = frameOffset();
    const boxInFrame = recomputeBounds($dom);
    const { visible } = computeElementVisibility($dom, boxInFrame);
    return {
      box: boxInFrame.moveBy(left, top),
      // A fully clipped element still measures from its real box; its lines
      // are then cut to the artboard like any other.
      visible: (visible ?? boxInFrame).moveBy(left, top),
    };
  }

  /** The artboard's visible area in scaler coordinates. */
  function viewportBox(): Box | undefined {
    const { left, top } = frameOffset();
    const doc = activeView.canvasCtx.$doc()[0];
    const bounds = doc && viewportBounds(doc);
    return bounds && Box.fromRectSides(bounds).moveBy(left, top);
  }

          // eslint-disable-next-line @typescript-eslint/no-shadow
          const $focusedDomElt = maybe(vc, (vc) => vc.focusedDomElt());
          // eslint-disable-next-line @typescript-eslint/no-shadow
          const $target = maybe(vc, (vc) => vc.$measureToolDomElt());
          // Only display MeasureTool lines if we know the
          // 2 unique elements we want a line between
          if (
            sc.isResizeDragging ||
            !vc ||
            !$focusedDomElt ||
            $focusedDomElt.length !== 1 ||
            !$focusedDomElt[0].isConnected ||
            !hasLayoutBox($focusedDomElt[0]) ||
            !$target ||
            (sc.canvasContentEditor && (!$focusedDomElt
              .toArray()
              .every((elt) => vc.contentEditor.containsElement(elt)) ||
            (!($target instanceof Pt) &&
              !$target
                .toArray()
                .every((elt) => vc.contentEditor.containsElement(elt))))) ||
            (!($target instanceof Pt) && $focusedDomElt.is($target))
          ) {
            return null;
          }

          const src = makeBox($focusedDomElt);
          const dst: MeasuredBox | undefined =
            $target instanceof Pt
              ? { box: $target.toZeroBox(), visible: $target.toZeroBox() }
              : maybe(
                  vc.getViewOps().getFinalFocusable($target).focusedDom,
                  (dom) => makeBox(dom),
                );

          const viewProps = !dst
            ? []
            : computeMeasureLines(src, dst, viewportBox());

          return { viewProps, zoom: sc.zoom };
}

function subscribeMeasureInputs(studio: StudioCtx, notify: () => void) {
    let closed = false;
    let stopGeometry: (() => void) | undefined;
    let stopRuntime: (() => void) | undefined;
    let stopHeight: (() => void) | undefined;
    let stopAbort: (() => void) | undefined;
    const update = () => { if (!closed) { notify(); } };
    const watchGeometry = () => {
      stopGeometry?.(); stopGeometry = undefined;
      const view = studio.focusedViewCtx();
      if (!view || view.disposeSignal.aborted || !studio.arenaState.isCurrentLifetime(view.modelLifetime)) { update(); return; }
      // An initialized CanvasCtx owns one document until its view retires.
      const doc = view.canvasCtx.$doc()[0];
      if (doc) {
        const resize = new ResizeObserver(update);
        resize.observe(doc.documentElement);
        view.focusedDomElt()?.toArray().forEach((element) => resize.observe(element));
        const target = view.$measureToolDomElt();
        if (target && !(target instanceof Pt)) { target.toArray().forEach((element) => resize.observe(element)); }
        doc.addEventListener("scroll", update, true);
        const style = view.styleChanged.add(update), frames = studio.framesChanged.add(update);
        stopGeometry = () => { resize.disconnect(); doc.removeEventListener("scroll", update, true); style.detach(); frames.detach(); };
      }
      update();
    };
    const watchOwner = () => {
      stopRuntime?.(); stopHeight?.(); stopAbort?.();
      stopRuntime = stopHeight = stopAbort = undefined;
      const view = studio.focusedViewCtx();
      if (view && !view.disposeSignal.aborted && studio.arenaState.isCurrentLifetime(view.modelLifetime)) {
        stopRuntime = view.csEvaluator.renderStatusStore.subscribe(watchGeometry);
        stopHeight = subscribeFrameHeights(studio, [view.arenaFrame()], update);
        view.disposeSignal.addEventListener("abort", watchOwner, { once: true });
        stopAbort = () => view.disposeSignal.removeEventListener("abort", watchOwner);
      }
      watchGeometry();
    };
    const stopOwner = subscribeStudioSelection(studio, (state) => state.view, watchOwner);
    const stopDoms = subscribeFocusedViewSelection(studio, (state) => state.doms, watchGeometry);
    const stopMeasure = subscribeFocusedViewSelection(studio, (state) => state.measure, watchGeometry);
    const stopViewport = subscribeViewport(studio, (state) => state, update);
    const stopScope = subscribeContentEditorScope(studio, update);
    const stopResize = subscribeStudioOverlayState(studio, (state) => state.resizeDragging, update);
    watchOwner();
    return () => {
      closed = true; stopGeometry?.(); stopRuntime?.(); stopHeight?.(); stopAbort?.();
      stopOwner(); stopDoms(); stopMeasure(); stopViewport(); stopResize(); stopScope();
    };
}

/** Owns DOM observation and publishes one immutable geometry snapshot per event. */
class MeasureInputs {
  private value: MeasureSnapshot;
  constructor(private studio: StudioCtx) { this.value = readMeasureSnapshot(studio); }
  getSnapshot = () => this.value;
  subscribe = (notify: () => void) => subscribeMeasureInputs(this.studio, () => {
    this.value = readMeasureSnapshot(this.studio);
    notify();
  });
}

export function MeasureTool() {
  const studio = useStudioCtx();
  const inputs = React.useMemo(() => new MeasureInputs(studio), [studio]);
  const snapshot = React.useSyncExternalStore(inputs.subscribe, inputs.getSnapshot, inputs.getSnapshot);
  return snapshot && <MeasureToolView {...snapshot} />;
}
