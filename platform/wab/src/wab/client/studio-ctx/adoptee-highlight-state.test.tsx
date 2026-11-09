import type { Adoptee } from "@/wab/client/Dnd";
import {
  createAdopteeHighlightStore,
  setHighlightedAdoptees,
  useHighlightedAdoptees,
} from "@/wab/client/studio-ctx/adoptee-highlight-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `highlightedAdoptees` used to be `ViewCtx._xHighlightedAdoptees`, an
 * `observable.box` read through an `<Observer>` render prop in the DnD overlay.
 */

afterEach(cleanup);

function adoptee(key: string): Adoptee {
  return {
    val: { fullKey: key },
    dom: document.createElement("div"),
    domBox: undefined,
  } as unknown as Adoptee;
}

function fakeView(): ViewCtx {
  return { adopteeHighlightStore: createAdopteeHighlightStore() } as unknown as ViewCtx;
}

it("notifies only when the adoptee list reference changes", () => {
  const view = fakeView();
  const listener = vi.fn();
  view.adopteeHighlightStore.subscribe((state) => listener(state.adoptees));

  const first = [adoptee("a")];
  setHighlightedAdoptees(view, first);
  setHighlightedAdoptees(view, first);
  const second = [adoptee("b")];
  setHighlightedAdoptees(view, second);
  setHighlightedAdoptees(view, []);

  expect(listener.mock.calls).toEqual([[first], [second], [[]]]);
});

it("re-renders the overlay when the highlighted adoptees change", async () => {
  const view = fakeView();
  let renders = 0;

  function Overlay() {
    const adoptees = useHighlightedAdoptees(view);
    renders += 1;
    return (
      <output data-testid="keys">
        {adoptees.map((a) => a.val.fullKey).join(",") || "none"}
      </output>
    );
  }

  render(<Overlay />);
  expect(screen.getByTestId("keys").textContent).toBe("none");
  const before = renders;

  await act(async () => {
    setHighlightedAdoptees(view, [adoptee("a"), adoptee("b")]);
  });

  expect(screen.getByTestId("keys").textContent).toBe("a,b");
  expect(renders - before).toBe(1);
});

it("does not re-render when the same list is written again", async () => {
  const view = fakeView();
  const list = [adoptee("a")];
  setHighlightedAdoptees(view, list);
  let renders = 0;

  function Overlay() {
    useHighlightedAdoptees(view);
    renders += 1;
    return null;
  }

  render(<Overlay />);
  const before = renders;

  await act(async () => {
    setHighlightedAdoptees(view, list);
  });

  expect(renders).toBe(before);
});

it("falls back to an empty list without a ViewCtx", () => {
  function Overlay() {
    const adoptees = useHighlightedAdoptees(undefined);
    return <output data-testid="count">{adoptees.length}</output>;
  }

  render(<Overlay />);

  expect(screen.getByTestId("count").textContent).toBe("0");
});
