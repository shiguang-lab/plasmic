import {
  createCanvasMirrorStore,
  setCanvasMirrorTarget,
  useCanvasMirrorTarget,
} from "@/wab/client/studio-ctx/canvas-mirror-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `_canvasMirrorTarget` used to be an `observable.box` written by a DOM
 * MutationObserver and read when deciding whether a frame renders.
 */

afterEach(cleanup);

function fakeView(): ViewCtx {
  return { canvasMirrorStore: createCanvasMirrorStore() } as unknown as ViewCtx;
}

it("stores the mirror target and ignores repeated writes", async () => {
  const view = fakeView();
  let renders = 0;

  function Probe() {
    const target = useCanvasMirrorTarget(view);
    renders += 1;
    return <output data-testid="target">{target ?? "none"}</output>;
  }

  render(<Probe />);
  expect(screen.getByTestId("target").textContent).toBe("none");
  const before = renders;

  await act(async () => {
    setCanvasMirrorTarget(view, "frame-1");
  });
  expect(screen.getByTestId("target").textContent).toBe("frame-1");
  expect(renders - before).toBe(1);

  await act(async () => {
    setCanvasMirrorTarget(view, "frame-1");
  });
  expect(renders - before).toBe(1);
});

it("falls back to no target without a ViewCtx", () => {
  function Probe() {
    const target = useCanvasMirrorTarget(undefined);
    return <output data-testid="target">{target ?? "none"}</output>;
  }

  render(<Probe />);

  expect(screen.getByTestId("target").textContent).toBe("none");
});
