import {
  createFindReferencesStore,
  useFindReferencesTarget,
} from "@/wab/client/studio-ctx/find-references-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { Component } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * Three `observable.box` fields on StudioCtx fed one modal in the left pane.
 * They are now a single store; only `useFindReferencesTarget` subscribes.
 */

afterEach(cleanup);

function component(name: string): Component {
  return { name } as unknown as Component;
}

function fakeStudio(): StudioCtx {
  return { findReferencesStore: createFindReferencesStore() } as unknown as StudioCtx;
}

it("returns the component target when set", () => {
  const studio = fakeStudio();
  studio.findReferencesStore.setState({ component: component("Button") });

  function Probe() {
    const target = useFindReferencesTarget(studio);
    return <output data-testid="target">{target?.name ?? "none"}</output>;
  }

  render(<Probe />);

  expect(screen.getByTestId("target").textContent).toBe("Button");
});

it("falls back to the style token, then the data token", () => {
  const studio = fakeStudio();
  studio.findReferencesStore.setState({
    styleToken: { name: "brand" } as never,
    dataToken: { name: "session" } as never,
  });

  function Probe() {
    const target = useFindReferencesTarget(studio);
    return <output data-testid="target">{target?.name ?? "none"}</output>;
  }

  render(<Probe />);

  expect(screen.getByTestId("target").textContent).toBe("brand");
});

it("opens and closes the modal as the target changes", async () => {
  const studio = fakeStudio();

  function Modal() {
    const target = useFindReferencesTarget(studio);
    return <output data-testid="modal">{target ? "open" : "closed"}</output>;
  }

  render(<Modal />);
  expect(screen.getByTestId("modal").textContent).toBe("closed");

  await act(async () => {
    studio.findReferencesStore.setState({ component: component("Button") });
  });
  expect(screen.getByTestId("modal").textContent).toBe("open");

  await act(async () => {
    studio.findReferencesStore.setState({ component: undefined });
  });
  expect(screen.getByTestId("modal").textContent).toBe("closed");
});
