import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ExperimentEvents from "@/wab/client/components/splits/ExperimentEvents";
import { ExperimentModal } from "@/wab/client/components/splits/ExperimentModal";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkGlobalVariantSplit, SplitStatus, SplitType } from "@/wab/shared/core/splits";
import { ensureKnownRandomSplitSlice, GlobalVariantSplitContent, RandomSplitSlice } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

async function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  manager.addComponent({ name: "Page", type: ComponentType.Plain });
  const group = manager.createGlobalVariantGroup("Experiment");
  const variant = manager.createGlobalVariant(group, "Variation");
  const split = mkGlobalVariantSplit({ group, variant, type: SplitType.Experiment, status: SplitStatus.New });
  split.name = "Checkout study";
  split.description = "Initial description";
  split.externalId = "root-id";
  split.slices[0].externalId = "base-id";
  split.slices[1].externalId = "variation-id";
  split.targetEvents = ["initial-event"];
  site.splits.push(split);
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  return { studio, split, group, variant };
}

it("publishes committed modal fields and multi-slice values through the existing controls without parent renders", async () => {
  const f = await fixture(), close = vi.fn();
  let parentRenders = 0;
  function Parent() { parentRenders++; return <ExperimentModal split={f.split} onClose={close} />; }
  const label = render(<StudioCtxContext.Provider value={f.studio}><Parent /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByText("Checkout study")).toBeTruthy();
    expect(screen.getByDisplayValue("Initial description")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => {
      f.split.name = "Renamed experiment";
      f.split.description = "Committed description";
      f.split.externalId = "root-new";
      f.split.slices[0].externalId = "base-new";
      f.split.slices[1].externalId = "variation-new";
      ensureKnownRandomSplitSlice(f.split.slices[0]).prob = 30;
      ensureKnownRandomSplitSlice(f.split.slices[1]).prob = 70;
      f.split.targetEvents = ["committed-event"];
      f.split.status = SplitStatus.Running;
    }); });
    expect(screen.getByText("Renamed experiment")).toBeTruthy();
    expect(screen.getByDisplayValue("Committed description")).toBeTruthy();
    expect(screen.getByDisplayValue("root-new")).toBeTruthy();
    expect(screen.getByDisplayValue("base-new")).toBeTruthy();
    expect(screen.getByDisplayValue("variation-new")).toBeTruthy();
    expect(screen.getByDisplayValue("30%")).toBeTruthy();
    expect(screen.getByDisplayValue("70%")).toBeTruthy();
    expect(parentRenders).toBe(1);
    await act(async () => { fireEvent.change(screen.getByPlaceholderText("Enter description..."), { target: { value: "Edited description" } }); });
    await waitFor(() => expect(f.split.description).toBe("Edited description"));
    expect(screen.getByDisplayValue("Edited description")).toBeTruthy();
  } finally { label.unmount(); f.studio.dispose(); }
});

it("rebinds slice fields after replacement and releases the detached slice source", async () => {
  const f = await fixture(), commits = vi.fn();
  const previous = ensureKnownRandomSplitSlice(f.split.slices[1]);
  const previousStore = f.studio.modelSnapshots.field(previous, "prob");
  const subscribe = previousStore.subscribe, detached = vi.fn();
  vi.spyOn(previousStore, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener); return () => { detached(); stop(); };
  });
  const label = render(<StudioCtxContext.Provider value={f.studio}><React.Profiler id="modal" onRender={commits}><ExperimentModal split={f.split} onClose={vi.fn()} /></React.Profiler></StudioCtxContext.Provider>);
  try {
    const replacement = new RandomSplitSlice({ uuid: "replaced-variation", name: "B", externalId: "replacement-id", prob: 60, contents: [new GlobalVariantSplitContent({ group: f.group, variant: f.variant })] });
    await act(async () => { await f.studio.changeUnsafe(() => { f.split.slices[1] = replacement; }); });
    expect(detached).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("replacement-id")).toBeTruthy();
    expect(screen.getByDisplayValue("60%")).toBeTruthy();
    const before = commits.mock.calls.length;
    await act(async () => { await f.studio.changeUnsafe(() => { previous.prob = 15; previous.externalId = "detached"; }); });
    expect(commits).toHaveBeenCalledTimes(before);
    expect(screen.queryByDisplayValue("detached")).toBeNull();
    await act(async () => { await f.studio.changeUnsafe(() => { replacement.prob = 80; replacement.externalId = "active-id"; }); });
    expect(screen.getByDisplayValue("80%")).toBeTruthy();
    expect(screen.getByDisplayValue("active-id")).toBeTruthy();
  } finally { label.unmount(); f.studio.dispose(); }
});

it("keeps readonly conversion event input unchanged when the existing controls add and edit events", () => {
  const events = Object.freeze(["initial-event"]), change = vi.fn();
  render(<ExperimentEvents events={events} changeEvents={change} />);
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  expect(change).toHaveBeenLastCalledWith(["initial-event", ""]);
  expect(events).toEqual(["initial-event"]);
  fireEvent.change(screen.getByDisplayValue("initial-event"), { target: { value: "edited-event" } });
  expect(change).toHaveBeenLastCalledWith(["edited-event"]);
  expect(events).toEqual(["initial-event"]);
});
