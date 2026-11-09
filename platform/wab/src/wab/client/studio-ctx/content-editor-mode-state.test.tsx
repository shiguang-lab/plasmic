import {
  createContentEditorModeStore,
  setContentEditorMode,
  useContentEditorMode,
} from "@/wab/client/studio-ctx/content-editor-mode-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `contentEditorMode` is composite: a content-creator role or the dev flag also
 * enables it. Only the toggled part was an `observable.box`, and only that part
 * is reactive.
 */

afterEach(cleanup);

function fakeStudio(contentCreator = false): StudioCtx {
  return {
    contentEditorModeStore: createContentEditorModeStore(),
    isContentEditor: () => contentCreator,
  } as unknown as StudioCtx;
}

it("reflects the toggled mode", async () => {
  const studio = fakeStudio();

  function Probe() {
    const mode = useContentEditorMode(studio);
    return <output data-testid="mode">{String(mode)}</output>;
  }

  render(<Probe />);
  expect(screen.getByTestId("mode").textContent).toBe("false");

  await act(async () => {
    studio.contentEditorModeStore.setState({ mode: true });
  });
  expect(screen.getByTestId("mode").textContent).toBe("true");
});

it("is on for a content creator regardless of the toggle", () => {
  const studio = fakeStudio(true);

  function Probe() {
    const mode = useContentEditorMode(studio);
    return <output data-testid="mode">{String(mode)}</output>;
  }

  render(<Probe />);

  expect(screen.getByTestId("mode").textContent).toBe("true");
});

it("updates only its readers when toggled", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Probe() {
    useContentEditorMode(studio);
    renders += 1;
    return null;
  }

  render(<Probe />);
  const before = renders;

  await act(async () => {
    studio.contentEditorModeStore.setState({ mode: true });
  });

  expect(renders - before).toBe(1);
});


it("publishes a mode change once and skips the same value", () => {
  const studio = fakeStudio(), changed = vi.fn();
  const stop = studio.contentEditorModeStore.subscribe(changed);
  setContentEditorMode(studio, true); setContentEditorMode(studio, true);
  expect(changed).toHaveBeenCalledTimes(1);
  setContentEditorMode(studio, false);
  expect(changed).toHaveBeenCalledTimes(2); stop();
});
