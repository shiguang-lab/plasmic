import {
  createCanvasLoadStore,
  useCanvasLoadError,
} from "@/wab/client/studio-ctx/canvas-load-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `canvasLoadError` was a publicly exposed `observable.box`; the host-frame
 * observer read it with `.get()`. It is now a store plus a hook.
 */

afterEach(cleanup);

function fakeStudio(): StudioCtx {
  return { canvasLoadStore: createCanvasLoadStore() } as unknown as StudioCtx;
}

it("starts without an error", () => {
  const studio = fakeStudio();

  function Observer() {
    const error = useCanvasLoadError(studio);
    return <output data-testid="error">{error ?? "none"}</output>;
  }

  render(<Observer />);

  expect(screen.getByTestId("error").textContent).toBe("none");
});

it("re-renders when the canvas reports an error", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Observer() {
    const error = useCanvasLoadError(studio);
    renders += 1;
    return <output data-testid="error">{error ?? "none"}</output>;
  }

  render(<Observer />);
  const before = renders;

  await act(async () => {
    studio.canvasLoadStore.setState({ error: "Unable to load artboard" });
  });

  expect(screen.getByTestId("error").textContent).toBe(
    "Unable to load artboard",
  );
  expect(renders - before).toBe(1);
});

it("keeps the error readable imperatively", () => {
  const studio = fakeStudio();
  studio.canvasLoadStore.setState({ error: "boom" });

  expect(studio.canvasLoadStore.getState().error).toBe("boom");
});
