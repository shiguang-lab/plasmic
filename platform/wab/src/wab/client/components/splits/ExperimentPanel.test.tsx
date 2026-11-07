import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ExperimentPanel from "@/wab/client/components/splits/ExperimentPanel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkGlobalVariantSplit, SplitStatus, SplitType } from "@/wab/shared/core/splits";
import { GlobalVariantSplitContent, RandomSplitSlice } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

async function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  manager.addComponent({ name: "Page", type: ComponentType.Plain });
  const group = manager.createGlobalVariantGroup("Experiment");
  const variant = manager.createGlobalVariant(group, "Original");
  const second = manager.createGlobalVariant(group, "Second");
  const split = mkGlobalVariantSplit({ group, variant, type: SplitType.Experiment, status: SplitStatus.New });
  site.splits.push(split);
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  return { site, studio, split, group, variant, second };
}

it("updates committed nested variant fields and keeps the existing DOM/ref and parent props", async () => {
  const f = await fixture(), ref = React.createRef<HTMLDivElement>(), commits = vi.fn();
  let parentRenders = 0;
  function Parent() {
    parentRenders++;
    return <React.Profiler id="panel" onRender={commits}><ExperimentPanel ref={ref} split={f.split} idx={1} values={[50, 50]} changeValues={vi.fn()} /></React.Profiler>;
  }
  const label = render(<StudioCtxContext.Provider value={f.studio}><Parent /></StudioCtxContext.Provider>);
  try {
    const root = ensure(ref.current, "Expected forwarded panel root");
    expect(screen.getByDisplayValue("Original")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.variant.name = "Renamed"; }); });
    expect(screen.getByDisplayValue("Renamed")).toBeTruthy();
    expect(ref.current).toBe(root);
    expect(parentRenders).toBe(1);
    const content = ensure(f.split.slices[1].contents[0], "Missing split content");
    expect(content).toBeInstanceOf(GlobalVariantSplitContent);
    await act(async () => { await f.studio.changeUnsafe(() => {
      f.split.slices[1] = new RandomSplitSlice({ uuid: "replacement-slice", name: "B", externalId: undefined, prob: 50, contents: [new GlobalVariantSplitContent({ group: f.group, variant: f.second })] });
    }); });
    expect(screen.getByDisplayValue("Second")).toBeTruthy();
    expect(ref.current).toBe(root);
    const before = commits.mock.calls.length;
    await act(async () => { await f.studio.changeUnsafe(() => { f.variant.name = "Detached"; }); });
    expect(commits).toHaveBeenCalledTimes(before);
    expect(screen.getByDisplayValue("Second")).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByDisplayValue("Second"), { target: { value: "Edited" } }); });
    await waitFor(() => expect(f.second.name).toBe("Edited"));
    expect(screen.getByDisplayValue("Edited")).toBeTruthy();
    expect(parentRenders).toBe(1);
  } finally { label.unmount(); f.studio.dispose(); }
});

it("retains the local targeting draft across committed inputs and switches split type natively", async () => {
  const f = await fixture();
  const label = render(<StudioCtxContext.Provider value={f.studio}><ExperimentPanel split={f.split} idx={1} values={[50, 50]} changeValues={vi.fn()} /></StudioCtxContext.Provider>);
  try {
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Edit" })));
    expect(screen.getByRole("button", { name: "Stop Editing" })).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.variant.name = "While editing"; }); });
    expect(screen.getByDisplayValue("While editing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop Editing" })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Stop Editing" })));
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.split.splitType = SplitType.Segment; }); });
    expect(screen.queryByDisplayValue("While editing")).toBeNull();
    expect(screen.getByText("Record Changes for")).toBeTruthy();
  } finally { label.unmount(); f.studio.dispose(); }
});
