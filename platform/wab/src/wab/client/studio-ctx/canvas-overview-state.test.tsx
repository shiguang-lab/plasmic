import {
  createCanvasOverviewStore,
  useCanvasOverviewArena,
} from "@/wab/client/studio-ctx/canvas-overview-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { AnyArena } from "@/wab/shared/Arenas";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `canvasFocusActive` used to read `canvasOverviewViewport` (an
 * `observable.box`). The outline tab now compares the overview arena with its
 * own arena, so the hook must expose the arena, not a precomputed boolean.
 */

afterEach(cleanup);

const arenaA = { name: "A" } as unknown as AnyArena;
const arenaB = { name: "B" } as unknown as AnyArena;

function fakeStudio(): StudioCtx {
  return { canvasOverviewStore: createCanvasOverviewStore() } as unknown as StudioCtx;
}

it("reports no overview arena by default", () => {
  const studio = fakeStudio();

  function Outline() {
    const overview = useCanvasOverviewArena(studio);
    return <output data-testid="arena">{overview ? "present" : "none"}</output>;
  }

  render(<Outline />);

  expect(screen.getByTestId("arena").textContent).toBe("none");
});

it("exposes the saved arena and lets the caller compare", async () => {
  const studio = fakeStudio();

  function Outline({ arena }: { arena: AnyArena }) {
    const overview = useCanvasOverviewArena(studio);
    return (
      <output data-testid="focused">
        {overview === arena ? "focused" : "overview"}
      </output>
    );
  }

  const { rerender } = render(<Outline arena={arenaA} />);
  expect(screen.getByTestId("focused").textContent).toBe("overview");

  await act(async () => {
    studio.canvasOverviewStore.setState({
      overview: { arena: arenaA, viewport: {} as never },
    });
  });
  expect(screen.getByTestId("focused").textContent).toBe("focused");

  rerender(<Outline arena={arenaB} />);
  expect(screen.getByTestId("focused").textContent).toBe("overview");
});

it("falls back to no arena without a Studio", () => {
  function Outline() {
    const overview = useCanvasOverviewArena(undefined);
    return <output data-testid="arena">{overview ? "present" : "none"}</output>;
  }

  render(<Outline />);

  expect(screen.getByTestId("arena").textContent).toBe("none");
});
