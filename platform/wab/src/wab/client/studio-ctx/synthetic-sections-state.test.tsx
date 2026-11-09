import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  createSyntheticSectionsStore,
  showSyntheticSection,
  useSyntheticSectionShown,
} from "@/wab/client/studio-ctx/synthetic-sections-state";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `shownSyntheticSections` was an `observable.map` read while building the
 * insert panel groups and written from the add drawer.
 */

afterEach(cleanup);

function fakeStudio(): StudioCtx {
  return {
    syntheticSectionsStore: createSyntheticSectionsStore(),
  } as unknown as StudioCtx;
}

it("hides a synthetic section until it is revealed", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Section() {
    const shown = useSyntheticSectionShown(studio, "plume");
    renders += 1;
    return <output data-testid="section">{shown ? "shown" : "hidden"}</output>;
  }

  render(<Section />);
  expect(screen.getByTestId("section").textContent).toBe("hidden");
  const before = renders;

  await act(async () => {
    showSyntheticSection(studio, "plume");
  });

  expect(screen.getByTestId("section").textContent).toBe("shown");
  expect(renders - before).toBe(1);
});

it("does not re-render when the same section is revealed twice", async () => {
  const studio = fakeStudio();
  showSyntheticSection(studio, "plume");
  let renders = 0;

  function Section() {
    useSyntheticSectionShown(studio, "plume");
    renders += 1;
    return null;
  }

  render(<Section />);
  const before = renders;

  await act(async () => {
    showSyntheticSection(studio, "plume");
  });

  expect(renders).toBe(before);
});

it("keeps section keys independent", async () => {
  const studio = fakeStudio();
  let plumeRenders = 0;

  function Plume() {
    useSyntheticSectionShown(studio, "plume");
    plumeRenders += 1;
    return null;
  }

  render(<Plume />);
  const before = plumeRenders;

  await act(async () => {
    showSyntheticSection(studio, "unstyled");
  });

  expect(plumeRenders).toBe(before);
  expect(studio.syntheticSectionsStore.getState().shown.unstyled).toBe(true);
});
