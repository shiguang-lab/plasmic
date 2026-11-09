import type { InsertionSpec } from "@/wab/client/Dnd";
import {
  createDndInsertionStore,
  setDndTentativeInsertion,
  useDndTentativeInsertion,
} from "@/wab/client/studio-ctx/dnd-insertion-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `getDndTentativeInsertion` used to read `ViewCtx._dndTentativeInsertion`, an
 * `observable.box`. The drop markers now subscribe to a zustand store.
 */

afterEach(cleanup);

function insertion(id: string): InsertionSpec {
  return { type: "SiblingInsertion", id } as unknown as InsertionSpec;
}

function fakeView(): ViewCtx {
  return { dndInsertionStore: createDndInsertionStore() } as unknown as ViewCtx;
}

it("notifies only when the insertion changes", () => {
  const view = fakeView();
  const listener = vi.fn();
  view.dndInsertionStore.subscribe((state) =>
    listener(state.tentativeInsertion),
  );

  const first = insertion("a");
  setDndTentativeInsertion(view, first);
  setDndTentativeInsertion(view, first);
  setDndTentativeInsertion(view, insertion("b"));
  setDndTentativeInsertion(view, undefined);

  expect(listener).toHaveBeenCalledTimes(3);
  expect(listener.mock.calls[0][0]).toBe(first);
  expect(listener.mock.calls[2][0]).toBeUndefined();
});

it("re-renders the drop marker when an insertion starts and ends", async () => {
  const view = fakeView();
  let renders = 0;

  function Marker() {
    const ins = useDndTentativeInsertion(view);
    renders += 1;
    return <output data-testid="marker">{ins ? "shown" : "hidden"}</output>;
  }

  render(<Marker />);
  expect(screen.getByTestId("marker").textContent).toBe("hidden");
  const before = renders;

  await act(async () => {
    setDndTentativeInsertion(view, insertion("a"));
  });
  expect(screen.getByTestId("marker").textContent).toBe("shown");
  expect(renders - before).toBe(1);

  await act(async () => {
    setDndTentativeInsertion(view, undefined);
  });
  expect(screen.getByTestId("marker").textContent).toBe("hidden");
  expect(renders - before).toBe(2);
});

it("falls back to no insertion without a ViewCtx", () => {
  function Marker() {
    const ins = useDndTentativeInsertion(undefined);
    return <output data-testid="empty">{ins ? "shown" : "hidden"}</output>;
  }

  render(<Marker />);

  expect(screen.getByTestId("empty").textContent).toBe("hidden");
});
