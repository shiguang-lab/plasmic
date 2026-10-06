import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { useTagPlacement } from "@/wab/client/components/canvas/HoverBox/useTagPlacement";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Box } from "@/wab/shared/geom";
import { render, screen } from "@testing-library/react";
import React from "react";

function setup(crowded: boolean, frameWidth = 1000, clientWidth = 1000) {
  const vc = mockDeepAuto<ViewCtx>();
  const iframe = document.createElement("iframe");
  Object.defineProperty(iframe, "clientWidth", { value: clientWidth });
  iframe.getBoundingClientRect = () => new DOMRect(0, 0, frameWidth, 700);
  vc.canvasCtx.viewport.mockReturnValue(iframe);
  vc.canvasCtx.doc.mockReturnValue(document);
  vc.viewportCtx.clipperBox.mockReturnValue(new Box(0, 0, 1000, 700));
  const button = document.createElement("button");
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockImplementation((_x, y) =>
    crowded || y < 100 ? button : undefined,
  );
  function Label() {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const placement = useTagPlacement(ref, 100, 1, vc);
    return (
      <div
        ref={(element) => {
          if (element)
            {element.getBoundingClientRect = () =>
              new DOMRect(100, 100, 100, 60);}
        }}
      >
        <div data-testid="placement" style={placement}>
          <div
            ref={(element) => {
              ref.current = element;
              if (element) {
                Object.defineProperty(element, "offsetWidth", { value: 80 });
                Object.defineProperty(element, "offsetHeight", { value: 20 });
              }
            }}
          >
            Selected node
          </div>
        </div>
      </div>
    );
  }
  render(<Label />);
  return vc;
}

it("checks content beneath the canvas overlay and moves the label away from a control", () => {
  const vc = setup(false);
  expect(vc.canvasCtx.getActualTargetUnderCanvasOverlay).toHaveBeenCalled();
  const style = screen.getByTestId("placement").style;
  expect(style.top).toBe("65px");
  expect(style.pointerEvents).toBe("auto");
  expect(style.visibility).toBe("visible");
});

it("hides a crowded label and lets input reach the canvas", () => {
  setup(true);
  const style = screen.getByTestId("placement").style;
  expect(style.pointerEvents).toBe("none");
  expect(style.visibility).toBe("hidden");
});

it.each([[0, 1000], [0, 0]])("hides labels when an arena canvas is not laid out (%s / %s)", (frameWidth, clientWidth) => {
  const vc = setup(false, frameWidth, clientWidth);
  expect(vc.canvasCtx.getActualTargetUnderCanvasOverlay).not.toHaveBeenCalled();
  const style = screen.getByTestId("placement").style;
  expect(style.visibility).toBe("hidden");
  expect(style.pointerEvents).toBe("none");
});
