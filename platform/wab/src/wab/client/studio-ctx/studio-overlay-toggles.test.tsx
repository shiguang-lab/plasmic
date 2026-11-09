import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  StudioOverlayState,
  useStudioOverlayState,
} from "@/wab/client/studio-ctx/studio-overlay-state";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `showVariantsDrawer` and `showCommentsPanel` used to be standalone
 * `observable.box` fields on StudioCtx. They are overlay preferences, so they
 * now live in the existing `StudioOverlayState` store.
 */

afterEach(cleanup);

function fakeStudio(): StudioCtx {
  return { overlayState: new StudioOverlayState() } as unknown as StudioCtx;
}

it("defaults to a closed drawer", () => {
  const studio = fakeStudio();

  function Bar() {
    const open = useStudioOverlayState(studio, (state) => state.variantsDrawer);
    return <output data-testid="drawer">{open ? "open" : "closed"}</output>;
  }

  render(<Bar />);

  expect(screen.getByTestId("drawer").textContent).toBe("closed");
});

it("re-renders when the drawer is toggled through the owner", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Bar() {
    const open = useStudioOverlayState(studio, (state) => state.variantsDrawer);
    renders += 1;
    return <output data-testid="drawer">{open ? "open" : "closed"}</output>;
  }

  render(<Bar />);
  const before = renders;

  await act(async () => {
    studio.overlayState.variantsDrawer = true;
  });
  expect(screen.getByTestId("drawer").textContent).toBe("open");
  expect(renders - before).toBe(1);

  await act(async () => {
    studio.overlayState.variantsDrawer = false;
  });
  expect(screen.getByTestId("drawer").textContent).toBe("closed");
  expect(renders - before).toBe(2);
});

it("does not publish a change when the value is the same", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Bar() {
    useStudioOverlayState(studio, (state) => state.variantsDrawer);
    renders += 1;
    return null;
  }

  render(<Bar />);
  const before = renders;

  await act(async () => {
    studio.overlayState.variantsDrawer = false;
  });

  expect(renders).toBe(before);
});


it("toggles the comments panel through the same store", async () => {
  const studio = fakeStudio();

  function Panel() {
    const open = useStudioOverlayState(studio, (state) => state.commentsPanel);
    return <output data-testid="comments">{open ? "open" : "closed"}</output>;
  }

  render(<Panel />);
  expect(screen.getByTestId("comments").textContent).toBe("closed");

  await act(async () => {
    studio.overlayState.commentsPanel = true;
  });
  expect(screen.getByTestId("comments").textContent).toBe("open");
});
