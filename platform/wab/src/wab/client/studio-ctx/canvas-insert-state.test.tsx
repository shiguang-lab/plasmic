import {
  createCanvasInsertStore,
  useDragInsertState,
  useFreestyleState,
} from "@/wab/client/studio-ctx/canvas-insert-state";
import type {
  DragInsertState,
  FreestyleState,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `_freestyleState` and `_dragInsertState` were two `observable.box` fields on
 * StudioCtx. Both are read while rendering the canvas, so each needs its own
 * reactive selector.
 */

afterEach(cleanup);

function freestyle(label: string): FreestyleState {
  return { spec: { label } } as unknown as FreestyleState;
}

function fakeStudio(): StudioCtx {
  return { canvasInsertStore: createCanvasInsertStore() } as unknown as StudioCtx;
}

it("renders the free-style mode and clears it", async () => {
  const studio = fakeStudio();

  function Overlay() {
    const state = useFreestyleState(studio);
    return (
      <output data-testid="mode">{state?.spec.label.toString() ?? "none"}</output>
    );
  }

  render(<Overlay />);
  expect(screen.getByTestId("mode").textContent).toBe("none");

  await act(async () => {
    studio.canvasInsertStore.setState({ freestyle: freestyle("box") });
  });
  expect(screen.getByTestId("mode").textContent).toBe("box");

  await act(async () => {
    studio.canvasInsertStore.setState({ freestyle: undefined });
  });
  expect(screen.getByTestId("mode").textContent).toBe("none");
});

it("keeps the two insertion modes isolated", async () => {
  const studio = fakeStudio();
  let freestyleRenders = 0;

  function Freestyle() {
    useFreestyleState(studio);
    freestyleRenders += 1;
    return null;
  }

  render(<Freestyle />);
  const before = freestyleRenders;

  await act(async () => {
    studio.canvasInsertStore.setState({
      dragInsert: {} as DragInsertState,
    });
  });

  expect(freestyleRenders).toBe(before);
});

it("exposes the drag insert state", () => {
  const studio = fakeStudio();
  const dragInsert = {} as DragInsertState;
  studio.canvasInsertStore.setState({ dragInsert });

  function Overlay() {
    const state = useDragInsertState(studio);
    return <output data-testid="drag">{state ? "dragging" : "idle"}</output>;
  }

  render(<Overlay />);

  expect(screen.getByTestId("drag").textContent).toBe("dragging");
});
