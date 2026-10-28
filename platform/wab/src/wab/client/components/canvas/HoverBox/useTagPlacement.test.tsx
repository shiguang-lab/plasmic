import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { useTagPlacement } from "@/wab/client/components/canvas/HoverBox/useTagPlacement";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Box } from "@/wab/shared/geom";
import { act, render, screen } from "@testing-library/react";
import React from "react";

function setup(crowded: boolean, frameWidth = 1000, clientWidth = 1000) {
  const vc = mockDeepAuto<ViewCtx>();
  const iframe = document.createElement("iframe");
  Object.defineProperty(iframe, "clientWidth", { value: clientWidth });
  iframe.getBoundingClientRect = () => new DOMRect(0, 0, frameWidth, 700);
  vc.canvasCtx.viewport.mockReturnValue(iframe);
  vc.canvasCtx.doc.mockReturnValue(document);
  vc.viewportCtx.clipperBox.mockReturnValue(new Box(0, 0, 1000, 700));
  vc.studioCtx.canvasZoomPadding.mockReturnValue({
    left: 80,
    right: 80,
    top: 0,
    bottom: 80,
  });
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

it.each([
  [0, 1000],
  [0, 0],
])(
  "hides labels when an arena canvas is not laid out (%s / %s)",
  (frameWidth, clientWidth) => {
    const { vc } = setup(false, frameWidth, clientWidth);
    expect(
      vc.canvasCtx.getActualTargetUnderCanvasOverlay,
    ).not.toHaveBeenCalled();
    const style = screen.getByTestId("placement").style;
    expect(style.visibility).toBe("hidden");
    expect(style.pointerEvents).toBe("none");
  },
);

it("places a new node using its current label size and bounds without waiting for a frame", () => {
  const { selectNode } = setup(false);
  const style = screen.getByTestId("placement").style;
  expect(style.left).toBe("0px");
  expect(style.top).toBe("65px");

  selectNode({
    width: 50,
    labelWidth: 180,
    top: 300,
    name: "SceneSelect (Select)",
  });
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

afterEach(() =>
  document
    .querySelectorAll("[data-content-editor-mode]")
    .forEach((element) => element.remove()),
);

function toolbar(rect: DOMRect) {
  const element = document.body.appendChild(document.createElement("div"));
  element.setAttribute("data-content-editor-mode", "true");
  element.getBoundingClientRect = () => rect;
  return element;
}

it("stacks a colliding label above the content toolbar while preserving its horizontal anchor", () => {
  const mode = toolbar(new DOMRect(350, 275, 240, 28));
  const { vc, selectNode } = setup(false);
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(undefined);
  selectNode({ top: 300 });
  const style = screen.getByTestId("placement").style;
  expect(style.left).toBe("0px");
  expect(style.top).toBe("-58px");
  expect(style.visibility).toBe("visible");
  expect(mode.getBoundingClientRect().top).toBe(275);
});

it("puts the label above a wide toolbar without moving it to the toolbar's left", () => {
  toolbar(new DOMRect(120, 275, 600, 28));
  const { vc, selectNode } = setup(false);
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(undefined);
  selectNode({ top: 300 });
  const style = screen.getByTestId("placement").style;
  expect(style.left).toBe("0px");
  expect(style.top).toBe("-58px");
  expect(style.visibility).toBe("visible");
});

it("keeps a narrow column's long label aligned with the column when stacking above the toolbar", () => {
  toolbar(new DOMRect(135, 266, 240, 28));
  const { vc, selectNode } = setup(false);
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(undefined);
  selectNode({ top: 300, width: 75, labelWidth: 212, name: "ActionsColumn" });
  const style = screen.getByTestId("placement").style;
  expect(style.left).toBe("-137px");
  expect(style.top).toBe("-67px");
  expect(style.visibility).toBe("visible");
});

it("repositions the label after the toolbar moves without another selection change", async () => {
  const mode = toolbar(new DOMRect(350, 275, 240, 28));
  const { vc, selectNode } = setup(false);
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(undefined);
  selectNode({ top: 300 });
  expect(screen.getByTestId("placement").style.left).toBe("0px");
  expect(screen.getByTestId("placement").style.top).toBe("-58px");
  await act(async () => {
    mode.getBoundingClientRect = () => new DOMRect(700, 275, 200, 28);
    mode.style.left = "700px";
  });
  expect(screen.getByTestId("placement").style.left).toBe("0px");
  expect(screen.getByTestId("placement").style.top).toBe("-25px");
});

it("moves an expanded parent tree together with its label so neither covers the toolbar", async () => {
  toolbar(new DOMRect(350, 275, 240, 28));
  const { vc, selectNode } = setup(false);
  vc.canvasCtx.getActualTargetUnderCanvasOverlay.mockReturnValue(undefined);
  selectNode({ top: 300 });
  const container = screen.getByTestId("placement");
  container.getBoundingClientRect = () => new DOMRect(300, 275, 80, 25);
  await act(async () => {
    const tree = document.createElement("div");
    tree.setAttribute("data-canvas-node-tree", "");
    tree.getBoundingClientRect = () => new DOMRect(300, 230, 120, 45);
    container.prepend(tree);
  });
  expect(container.style.left).toBe("0px");
  expect(container.style.top).toBe("-58px");
  expect(container.style.visibility).toBe("visible");
});
