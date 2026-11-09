import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { XDraggable } from "@/wab/commons/components/XDraggable";
import classNames from "classnames";
import * as React from "react";

class ScrollMetrics {
  private current: Readonly<{ container: number; content: number; start: number; overflow: string }> | undefined;
  constructor(private readonly element: HTMLElement, private readonly axis: "horizontal" | "vertical") {}
  read = () => {
    const vertical = this.axis === "vertical", element = this.element;
    const next = { container: vertical ? element.clientHeight : element.clientWidth, content: vertical ? element.scrollHeight : element.scrollWidth, start: vertical ? element.scrollTop : element.scrollLeft, overflow: element.ownerDocument.defaultView?.getComputedStyle(element)[vertical ? "overflowY" : "overflowX"] ?? "" };
    if (!this.current || this.current.container !== next.container || this.current.content !== next.content || this.current.start !== next.start || this.current.overflow !== next.overflow) { this.current = Object.freeze(next); }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    this.element.addEventListener("scroll", listener);
    return () => this.element.removeEventListener("scroll", listener);
  };
}

export function VirtualScrollBar(props: {
  element: HTMLElement;
  axis: "horizontal" | "vertical";
  className?: string;
  barClassName?: string;
  style?: React.CSSProperties;
}) {
  const { t: uiT } = useI18n();
  const { element, className, barClassName, style, axis } = props;
  const studioCtx = useStudioCtx();
  const trackRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLDivElement>(null);
  const metricsSource = React.useMemo(() => new ScrollMetrics(element, axis), [element, axis]);
  const metrics = React.useSyncExternalStore(metricsSource.subscribe, metricsSource.read, metricsSource.read);

  const containerSizeProp =
    axis === "vertical" ? "clientHeight" : "clientWidth";
  const contentSizeProp = axis === "vertical" ? "scrollHeight" : "scrollWidth";
  const contentStartProp = axis === "vertical" ? "scrollTop" : "scrollLeft";
  const deltaProp = axis === "vertical" ? "deltaY" : "deltaX";
  const thumbPositionProp = axis === "vertical" ? "top" : "left";
  const thumbSizeProp = axis === "vertical" ? "height" : "width";

  if (
    metrics.container >= metrics.content ||
    (metrics.overflow !== "auto" && metrics.overflow !== "scroll")
  ) {
    return null;
  }

  return (
    <div
      className={classNames(
        `HoverBox__ScrollBar`,
        `HoverBox__ScrollBar--${axis}`,
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
      onMouseUp={(e) => e.preventDefault()}
      title={uiT(
        "Drag to scroll content, or use Alt/Option + wheel inside the container",
      )}
      style={style}
      ref={trackRef}
    >
      <XDraggable
        nodeRef={thumbRef}
        onDrag={(e) => {
          if (trackRef.current) {
            const maxStart =
              element[contentSizeProp] - element[containerSizeProp];
            // We scale the delta so that dragging is 1:1 with the thumb
            // and not with the content
            const delta =
              ((e.draggableData[deltaProp] / element[containerSizeProp]) *
                element[contentSizeProp]) /
              studioCtx.zoom;
            const newStart = Math.min(
              Math.max(0, element[contentStartProp] + delta),
              maxStart,
            );
            if (thumbRef.current) {
              thumbRef.current.style[thumbPositionProp] = `${
                (newStart / element[contentSizeProp]) * 100
              }%`;
            }
            element.scrollTo(axis === "vertical" ? { top: newStart } : { left: newStart });
          }
        }}
      >
        <div
          className={classNames(
            `HoverBox__ScrollBar__Thumb HoverBox__ScrollBar__Thumb--${axis}`,
            barClassName,
          )}
          style={{
            [thumbPositionProp]: `${
              (metrics.start / metrics.content) * 100
            }%`,
            [thumbSizeProp]: `${
              (metrics.container / metrics.content) * 100
            }%`,
          }}
          ref={thumbRef}
        />
      </XDraggable>
    </div>
  );
}
