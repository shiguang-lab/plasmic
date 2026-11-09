import {
  createAutoOpenStore,
  setAutoOpenedUuid,
  useAutoOpenedUuid,
} from "@/wab/client/studio-ctx/auto-open-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `autoOpenedUuid` used to be `ViewCtx._autoOpenedUuid`, an `observable.box`
 * read by two overlays. It is now a zustand store; these tests pin the
 * behaviour the overlays rely on.
 */

afterEach(cleanup);

/** Only the fields this module touches; avoids constructing a real ViewCtx. */
function fakeView(autoOpenedUuid?: string) {
  const autoOpenStore = createAutoOpenStore();
  if (autoOpenedUuid !== undefined) {
    setAutoOpenedUuid({ autoOpenStore } as unknown as ViewCtx, autoOpenedUuid);
  }
  return { autoOpenStore } as unknown as ViewCtx;
}

it("notifies only when the uuid actually changes", () => {
  const view = fakeView();
  const listener = vi.fn();
  view.autoOpenStore.subscribe((state) => listener(state.autoOpenedUuid));

  setAutoOpenedUuid(view, "a");
  setAutoOpenedUuid(view, "a");
  setAutoOpenedUuid(view, "b");
  setAutoOpenedUuid(view, undefined);

  expect(listener.mock.calls).toEqual([["a"], ["b"], [undefined]]);
});

it("re-renders the reading component when the uuid changes", async () => {
  const view = fakeView();
  let renders = 0;

  function Banner() {
    const uuid = useAutoOpenedUuid(view);
    renders += 1;
    return <output data-testid="banner">{uuid ?? "hidden"}</output>;
  }

  render(<Banner />);
  expect(screen.getByTestId("banner").textContent).toBe("hidden");
  const before = renders;

  await act(async () => {
    setAutoOpenedUuid(view, "tpl-1");
  });

  expect(screen.getByTestId("banner").textContent).toBe("tpl-1");
  expect(renders - before).toBe(1);
});

it("does not re-render when the same uuid is written again", async () => {
  const view = fakeView("tpl-1");
  let renders = 0;

  function Banner() {
    const uuid = useAutoOpenedUuid(view);
    renders += 1;
    return <output data-testid="banner">{uuid ?? "hidden"}</output>;
  }

  render(<Banner />);
  const before = renders;

  await act(async () => {
    setAutoOpenedUuid(view, "tpl-1");
  });

  expect(renders).toBe(before);
});

it("falls back to a shared empty state without a ViewCtx", () => {
  function Banner() {
    const uuid = useAutoOpenedUuid(undefined);
    return <output data-testid="empty">{uuid ?? "none"}</output>;
  }

  render(<Banner />);

  expect(screen.getByTestId("empty").textContent).toBe("none");
});
