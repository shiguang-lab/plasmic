import { KeyFrameStops } from "@/wab/client/components/style-controls/KeyFrameStops";
import sty from "@/wab/client/components/style-controls/KeyFrameStops.module.scss";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { KeyFrame } from "@/wab/shared/model/classes";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import $ from "jquery";
import React from "react";

vi.mock("@/wab/commons/components/XDraggable", () => ({
  XDraggable: ({
    children,
    onMouseDown,
    onStart,
    onDrag,
    onStop,
  }: {
    children?: React.ReactNode;
    onMouseDown?: () => void;
    onStart?: () => void;
    onDrag?: (event: { mouseEvent: { clientX: number; clientY: number } }) => void;
    onStop?: (event: { mouseEvent: { clientX: number; clientY: number } }) => void;
  }) => (
    <div onMouseDown={onMouseDown}>
      {children}
      <button aria-label="start-drag" onClick={() => onStart?.()} />
      <button
        aria-label="drag-to-50"
        onClick={() => onDrag?.({ mouseEvent: { clientX: 50, clientY: 0 } })}
      />
      <button
        aria-label="stop-normal"
        onClick={() => onStop?.({ mouseEvent: { clientX: 50, clientY: 0 } })}
      />
      <button
        aria-label="stop-delete"
        onClick={() => onStop?.({ mouseEvent: { clientX: 50, clientY: 100 } })}
      />
    </div>
  ),
}));

const studios: ReturnType<typeof fakeStudioCtx>["studioCtx"][] = [];
afterEach(async () => {
  cleanup();
  for (const studio of studios.splice(0)) {
    await studio.awaitEval();
    studio.dispose();
  }
  vi.restoreAllMocks();
});

async function fixture() {
  const site = createSite();
  const manager = new TplMgr({ site });
  const sequence = manager.addAnimationSequence("Entrance");
  const { studioCtx: studio } = fakeStudioCtx({
    site,
    devFlagOverrides: { ccStubs: true },
  });
  studios.push(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const first = new KeyFrame({ percentage: 0, rs: mkRuleSet({}) });
  const second = new KeyFrame({ percentage: 100, rs: mkRuleSet({}) });
  await act(async () => {
    await studio.changeUnsafe(() => {
      sequence.keyframes.push(first, second);
    });
  });
  return { studio, sequence, first, second };
}

function renderStops(
  studio: ReturnType<typeof fakeStudioCtx>["studioCtx"],
  sequence: ReturnType<TplMgr["addAnimationSequence"]>,
) {
  const onSelectKeyframe = vi.fn();
  const view = render(
    <KeyFrameStops
      studioCtx={studio}
      sequence={sequence}
      onSelectKeyframe={onSelectKeyframe}
    />,
  );
  const bar = ensure(
    view.container.querySelector<HTMLElement>(`.${sty.bar}`),
    "Expected the keyframe bar",
  );
  Object.defineProperty(bar, "offsetWidth", { configurable: true, value: 100 });
  vi.spyOn($.fn, "offset").mockReturnValue({ top: 0, left: 0 });
  return { ...view, bar, onSelectKeyframe };
}

it("reads committed keyframe membership and percentage and inserts through the original command", async () => {
  const { studio, sequence, first, second } = await fixture();
  const view = renderStops(studio, sequence);

  expect(view.container.querySelectorAll("[data-keyframe-uid]")).toHaveLength(2);
  expect(
    within(
      ensure(
        view.container.querySelector<HTMLElement>(
          `[data-keyframe-uid="${first.uid}"]`,
        ),
        "Expected the first keyframe row",
      ),
    ).getByText("0%"),
  ).toBeInTheDocument();

  fireEvent.mouseMove(ensure(view.bar.parentElement, "bar container"), {
    clientX: 50,
    clientY: 0,
  });
  expect(
    ensure(
      view.container.querySelector<HTMLElement>("[data-keyframe-ghost]"),
      "Expected the ghost keyframe",
    ),
  ).toHaveTextContent("50%");

  await act(async () => {
    await studio.changeUnsafe(() => {
      second.percentage = 50;
    });
  });
  expect(view.container.querySelector("[data-keyframe-ghost]")).toBeNull();

  await act(async () => {
    await studio.changeUnsafe(() => {
      second.percentage = 75;
    });
  });
  expect(
    ensure(
      view.container.querySelector<HTMLElement>("[data-keyframe-ghost]"),
      "Expected the ghost keyframe to return",
    ),
  ).toHaveTextContent("50%");

  fireEvent.click(view.bar, { clientX: 50, clientY: 0 });
  await act(async () => { await studio.awaitEval(); });

  expect(sequence.keyframes.map((keyframe) => keyframe.percentage)).toEqual([
    0, 50, 75,
  ]);
  expect(view.onSelectKeyframe).toHaveBeenCalledOnce();

  fireEvent.click(view.bar, { clientX: 50, clientY: 0 });
  await act(async () => { await studio.awaitEval(); });
  expect(sequence.keyframes).toHaveLength(3);
  expect(view.onSelectKeyframe).toHaveBeenCalledOnce();
});

it("keeps drag percentage, reordering and drag-delete commands on the original keyframes", async () => {
  const { studio, sequence, first, second } = await fixture();
  const view = renderStops(studio, sequence);
  const firstRow = ensure(
    view.container.querySelector<HTMLElement>(
      `[data-keyframe-uid="${first.uid}"]`,
    ),
    "Expected the first keyframe row",
  );
  const secondRow = ensure(
    view.container.querySelector<HTMLElement>(
      `[data-keyframe-uid="${second.uid}"]`,
    ),
    "Expected the second keyframe row",
  );

  fireEvent.click(within(firstRow).getByLabelText("start-drag"));
  fireEvent.click(within(firstRow).getByLabelText("drag-to-50"));
  await act(async () => { await studio.awaitEval(); });
  expect(first.percentage).toBe(50);
  expect(sequence.keyframes.map((keyframe) => keyframe.percentage)).toEqual([
    50, 100,
  ]);

  fireEvent.click(within(secondRow).getByLabelText("stop-delete"));
  await act(async () => { await studio.awaitEval(); });
  expect(sequence.keyframes.map((keyframe) => keyframe.percentage)).toEqual([
    50,
  ]);

  view.unmount();
  await act(async () => {
    await studio.changeUnsafe(() => {
      first.percentage = 60;
    });
  });
});
it("retains the rendered owner and last snapshots across a model-owner replacement", async () => {
  const { studio, sequence, first, second } = await fixture();
  const view = renderStops(studio, sequence);
  fireEvent.mouseMove(ensure(view.bar.parentElement, "bar container"), {
    clientX: 50,
    clientY: 0,
  });
  expect(
    ensure(
      view.container.querySelector<HTMLElement>("[data-keyframe-ghost]"),
      "Expected the ghost keyframe",
    ),
  ).toHaveTextContent("50%");

  const oldModels = studio.modelSnapshots;
  const newModels = new ModelSnapshots();
  const newField = vi.spyOn(newModels, "field");
  const newResolve = vi.spyOn(newModels, "resolve");
  studio.modelSnapshots = newModels;
  oldModels.dispose();

  view.rerender(
    <KeyFrameStops
      studioCtx={studio}
      sequence={sequence}
      onSelectKeyframe={view.onSelectKeyframe}
    />,
  );

  expect(newField).not.toHaveBeenCalled();
  expect(newResolve).not.toHaveBeenCalled();
  expect(view.container.querySelectorAll("[data-keyframe-uid]")).toHaveLength(2);
  expect(
    within(
      ensure(
        view.container.querySelector<HTMLElement>(
          `[data-keyframe-uid="${first.uid}"]`,
        ),
        "Expected the first keyframe row",
      ),
    ).getByText("0%"),
  ).toBeInTheDocument();
  expect(
    within(
      ensure(
        view.container.querySelector<HTMLElement>(
          `[data-keyframe-uid="${second.uid}"]`,
        ),
        "Expected the second keyframe row",
      ),
    ).getByText("100%"),
  ).toBeInTheDocument();
  expect(
    ensure(
      view.container.querySelector<HTMLElement>("[data-keyframe-ghost]"),
      "Expected the retained ghost keyframe",
    ),
  ).toHaveTextContent("50%");
});
it("rebinds a newly rendered sequence to the current owner on the same component", async () => {
  const oldFixture = await fixture();
  const newFixture = await fixture();
  const onSelectKeyframe = vi.fn();
  const view = render(
    <KeyFrameStops
      studioCtx={oldFixture.studio}
      sequence={oldFixture.sequence}
      onSelectKeyframe={onSelectKeyframe}
    />,
  );
  const configureBar = () => {
    const bar = ensure(
      view.container.querySelector<HTMLElement>(`.${sty.bar}`),
      "Expected the keyframe bar",
    );
    Object.defineProperty(bar, "offsetWidth", {
      configurable: true,
      value: 100,
    });
    vi.spyOn($.fn, "offset").mockReturnValue({ top: 0, left: 0 });
    return bar;
  };
  configureBar();

  view.rerender(
    <KeyFrameStops
      studioCtx={newFixture.studio}
      sequence={newFixture.sequence}
      onSelectKeyframe={onSelectKeyframe}
    />,
  );
  const newBar = configureBar();
  expect(
    view.container.querySelector(
      `[data-keyframe-uid="${newFixture.first.uid}"]`,
    ),
  ).not.toBeNull();
  expect(
    view.container.querySelector(
      `[data-keyframe-uid="${oldFixture.first.uid}"]`,
    ),
  ).toBeNull();

  await act(async () => {
    await newFixture.studio.changeUnsafe(() => {
      newFixture.second.percentage = 25;
    });
  });
  expect(
    within(
      ensure(
        view.container.querySelector<HTMLElement>(
          `[data-keyframe-uid="${newFixture.second.uid}"]`,
        ),
        "Expected the new second keyframe row",
      ),
    ).getByText("25%"),
  ).toBeInTheDocument();

  fireEvent.click(newBar, { clientX: 50, clientY: 0 });
  await act(async () => { await newFixture.studio.awaitEval(); });
  expect(newFixture.sequence.keyframes.map((keyframe) => keyframe.percentage)).toEqual([
    0, 25, 50,
  ]);
  expect(onSelectKeyframe).toHaveBeenCalledOnce();
});

it("does not declare fields on a closed old owner when a ghost mounts later", async () => {
  const { studio, sequence } = await fixture();
  const view = renderStops(studio, sequence);
  const oldModels = studio.modelSnapshots;
  const newModels = new ModelSnapshots();
  const oldField = vi.spyOn(oldModels, "field");
  const oldResolve = vi.spyOn(oldModels, "resolve");
  const newField = vi.spyOn(newModels, "field");
  const newResolve = vi.spyOn(newModels, "resolve");
  studio.modelSnapshots = newModels;
  oldModels.dispose();
  oldField.mockClear();
  oldResolve.mockClear();

  fireEvent.mouseMove(ensure(view.bar.parentElement, "bar container"), {
    clientX: 50,
    clientY: 0,
  });

  expect(
    ensure(
      view.container.querySelector<HTMLElement>("[data-keyframe-ghost]"),
      "Expected the retained ghost keyframe",
    ),
  ).toHaveTextContent("50%");
  expect(oldField).not.toHaveBeenCalled();
  expect(oldResolve).not.toHaveBeenCalled();
  expect(newField).not.toHaveBeenCalled();
  expect(newResolve).not.toHaveBeenCalled();
});

