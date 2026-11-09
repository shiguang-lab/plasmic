import {
  createEditingTextStore,
  setEditingTextContext,
  useEditingTextContext,
} from "@/wab/client/studio-ctx/editing-text-state";
import type {
  EditingTextContext,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `editingTextContext` used to be `ViewCtx._editingTextContext`, an
 * `observable.box`. Overlays must hide while text is being edited, and the rich
 * text toolbar appears only with a context.
 */

afterEach(cleanup);

function context(label: string): EditingTextContext {
  return { label } as unknown as EditingTextContext;
}

function fakeView(): ViewCtx {
  return { editingTextStore: createEditingTextStore() } as unknown as ViewCtx;
}

it("notifies only when the context changes", () => {
  const view = fakeView();
  const listener = vi.fn();
  view.editingTextStore.subscribe((state) =>
    listener(state.editingTextContext),
  );

  const first = context("a");
  setEditingTextContext(view, first);
  setEditingTextContext(view, first);
  setEditingTextContext(view, context("b"));
  setEditingTextContext(view, null);

  expect(listener).toHaveBeenCalledTimes(3);
  expect(listener.mock.calls[0][0]).toBe(first);
  expect(listener.mock.calls[2][0]).toBeNull();
});

it("toggles a consuming overlay when editing starts and stops", async () => {
  const view = fakeView();
  let renders = 0;

  function Toolbar() {
    const editingText = useEditingTextContext(view);
    renders += 1;
    return <output data-testid="toolbar">{editingText ? "open" : "closed"}</output>;
  }

  render(<Toolbar />);
  expect(screen.getByTestId("toolbar").textContent).toBe("closed");
  const before = renders;

  await act(async () => {
    setEditingTextContext(view, context("a"));
  });
  expect(screen.getByTestId("toolbar").textContent).toBe("open");
  expect(renders - before).toBe(1);

  await act(async () => {
    setEditingTextContext(view, null);
  });
  expect(screen.getByTestId("toolbar").textContent).toBe("closed");
  expect(renders - before).toBe(2);
});

it("falls back to no context without a ViewCtx", () => {
  function Toolbar() {
    const editingText = useEditingTextContext(undefined);
    return <output data-testid="empty">{editingText ? "open" : "closed"}</output>;
  }

  render(<Toolbar />);

  expect(screen.getByTestId("empty").textContent).toBe("closed");
});
