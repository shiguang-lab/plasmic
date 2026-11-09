import {
  createRightPanelStore,
  useRightTabKey,
} from "@/wab/client/studio-ctx/right-panel-state";
import type {
  RightTabKey,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";

/** Runtime value of the (type-only) enum, without importing the whole Studio. */
const STYLE_TAB = "style" as RightTabKey;
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `rightTabKey` was an `observable.box`; the right pane renders it and commands
 * switch it. The store must drive the pane, and reads without a Studio must fall
 * back safely.
 */

afterEach(cleanup);

function fakeStudio(): StudioCtx {
  return { rightPanelStore: createRightPanelStore() } as unknown as StudioCtx;
}

it("switches the rendered tab when the store changes", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Pane() {
    const tab = useRightTabKey(studio);
    renders += 1;
    return <output data-testid="tab">{tab ?? "none"}</output>;
  }

  render(<Pane />);
  expect(screen.getByTestId("tab").textContent).toBe("none");
  const before = renders;

  await act(async () => {
    studio.rightPanelStore.setState({ tabKey: STYLE_TAB });
  });

  expect(screen.getByTestId("tab").textContent).toBe(STYLE_TAB);
  expect(renders - before).toBe(1);
});

it("does not re-render when the same tab is selected again", async () => {
  const studio = fakeStudio();
  studio.rightPanelStore.setState({ tabKey: STYLE_TAB });
  let renders = 0;

  function Pane() {
    useRightTabKey(studio);
    renders += 1;
    return null;
  }

  render(<Pane />);
  const before = renders;

  await act(async () => {
    studio.rightPanelStore.setState({ tabKey: STYLE_TAB });
  });

  expect(renders).toBe(before);
});

it("falls back to no tab without a Studio", () => {
  function Pane() {
    const tab = useRightTabKey(undefined);
    return <output data-testid="tab">{tab ?? "none"}</output>;
  }

  render(<Pane />);

  expect(screen.getByTestId("tab").textContent).toBe("none");
});
