import {
  XDraggable,
  XDraggableEvent,
} from "@/wab/commons/components/XDraggable";
import { ensure } from "@/wab/shared/common";
import L from "lodash";
import * as React from "react";

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface EllipseControlProps {
  ellipse: Ellipse;
  onChange: (ellipse: Ellipse) => void;
}

export function EllipseControl({ ellipse, onChange }: EllipseControlProps) {
  const svg = React.useRef<SVGSVGElement | null>(null);
  const initEllipse = React.useRef<Ellipse | null>(null);

  function getDragPcts(e: XDraggableEvent) {
    const orig = ensure(initEllipse.current);
    const area = ensure(svg.current).getBoundingClientRect();
    const dx = (e.data.deltaX / area.width) * 100;
    const dy = (e.data.deltaY / area.height) * 100;

    return { orig, dx, dy };
  }

  const handleDragCenter = (e: XDraggableEvent) => {
    const { orig, dx, dy } = getDragPcts(e);
    onChange({
      ...orig,
      cx: L.clamp(orig.cx + dx, 0, 100),
      cy: L.clamp(orig.cy + dy, 0, 100),
    });
  };

  const handleDragKnobRight = (e: XDraggableEvent) => {
    const { orig, dx, dy } = getDragPcts(e);
    onChange({
      ...orig,
      rx: L.clamp(orig.rx + dx, orig.cx, 100 - orig.cx),
    });
  };

  const handleDragKnobBottom = (e: XDraggableEvent) => {
    const { orig, dx, dy } = getDragPcts(e);
    onChange({
      ...orig,
      ry: L.clamp(orig.ry + dy, orig.cy, 100 - orig.cy),
    });
  };

  const handleDragKnobLeft = (e: XDraggableEvent) => {
    const { orig, dx, dy } = getDragPcts(e);
    onChange({
      ...orig,
      rx: L.clamp(orig.rx - dx, 0, orig.cx),
    });
  };

  const handleDragKnobTop = (e: XDraggableEvent) => {
    const { orig, dx, dy } = getDragPcts(e);
    onChange({
      ...orig,
      ry: L.clamp(orig.ry - dy, 0, orig.cy),
    });
  };

  const handleDragStart = () => {
    initEllipse.current = L.clone(ellipse);
  };

    const { cx, cy, rx, ry } = ellipse;
    const p = (x: number) => `${x}%`;
    const [px1, py1, prx, pry, right, bottom, left, top] = [
      cx,
      cy,
      rx,
      ry,
      cx + rx,
      cy + ry,
      cx - rx,
      cy - ry,
    ].map(p);

    return (
      <div className={"ellipse-control"}>
        <svg
          ref={svg}
          className={"ellipse-control__svg"}
        >
          <ellipse
            className={"ellipse-control__ellipse"}
            cx={px1}
            cy={py1}
            rx={prx}
            ry={pry}
          />
          <line
            className={"ellipse-control__line"}
            x1={left}
            y1={py1}
            x2={right}
            y2={py1}
          />
          <line
            className={"ellipse-control__line"}
            x1={px1}
            y1={top}
            x2={px1}
            y2={bottom}
          />
          <XDraggable
            onStart={handleDragStart}
            onDrag={handleDragCenter}
          >
            <circle
              className={"ellipse-control__center"}
              cx={px1}
              cy={py1}
              r={4}
            />
          </XDraggable>
          <XDraggable
            onStart={handleDragStart}
            onDrag={handleDragKnobRight}
          >
            <circle
              className={"ellipse-control__knob"}
              cx={right}
              cy={py1}
              r={4}
            />
          </XDraggable>
          <XDraggable
            onStart={handleDragStart}
            onDrag={handleDragKnobBottom}
          >
            <circle
              className={"ellipse-control__knob"}
              cx={px1}
              cy={bottom}
              r={4}
            />
          </XDraggable>
          <XDraggable
            onStart={handleDragStart}
            onDrag={handleDragKnobLeft}
          >
            <circle
              className={"ellipse-control__knob"}
              cx={left}
              cy={py1}
              r={4}
            />
          </XDraggable>
          <XDraggable
            onStart={handleDragStart}
            onDrag={handleDragKnobTop}
          >
            <circle
              className={"ellipse-control__knob"}
              cx={px1}
              cy={top}
              r={4}
            />
          </XDraggable>
        </svg>
      </div>
    );
}
