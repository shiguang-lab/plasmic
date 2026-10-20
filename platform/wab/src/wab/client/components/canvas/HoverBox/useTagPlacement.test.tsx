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
  function Label({
    width = 100,
    labelWidth = 80,
    top = 100,
    name = "Selected node",
  }) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const placement = useTagPlacement(ref, width, 1, vc);
    return (
      <div
        ref={(element) => {
          if (element) {
            element.getBoundingClientRect = () =>
              new DOMRect(300, top, width, 60);
          }
        }}
      >
        <div data-testid="placement" style={placement}>
          <div
            ref={(element) => {
              ref.current = element;
              if (element) {
                Object.defineProperty(element, "offsetWidth", {
                  value: labelWidth,
                  configurable: true,
                });
                Object.defineProperty(element, "offsetHeight", {
                  value: 20,
                  configurable: true,
                });
              }
            }}
          >
            {name}
          </div>
        </div>
      </div>
    );
  }
  const { rerender } = render(<Label />);
  return {
    vc,
    selectNode: (props: React.ComponentProps<typeof Label>) =>
      rerender(<Label {...props} />),
  };
}

it("checks content beneath the canvas overlay and moves the label away from a control", () => {
  const { vc } = setup(false);
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
  const { vc } = setup(false, frameWidth, clientWidth);
  expect(vc.canvasCtx.getActualTargetUnderCanvasOverlay).not.toHaveBeenCalled();
  const style = screen.getByTestId("placement").style;
  expect(style.visibility).toBe("hidden");
  expect(style.pointerEvents).toBe("none");
});

it("places a new node using its current label size and bounds without waiting for a frame", () => {
  const { selectNode } = setup(false);
  const style = screen.getByTestId("placement").style;
  expect(style.left).toBe("0px");
  expect(style.top).toBe("65px");

  selectNode({ width: 50, labelWidth: 180, top: 300, name: "SceneSelect (Select)" });
  expect(style.left).toBe("-130px");
  expect(style.top).toBe("-25px");
  expect(style.visibility).toBe("visible");

  selectNode({ width: 200, labelWidth: 80, top: 100, name: "Input" });
  expect(style.left).toBe("0px");
  expect(style.top).toBe("65px");
});

it("hides a previously visible label immediately when the next node is crowded", () => {
  const { vc, selectNode } = setup(false);
  expect(screen.getByTestId("placement").style.visibility).toBe("visible");

  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(
    document.createElement("button"),
  );
  selectNode({ name: "Crowded node" });
  const style = screen.getByTestId("placement").style;
  expect(style.visibility).toBe("hidden");
  expect(style.pointerEvents).toBe("none");
});
