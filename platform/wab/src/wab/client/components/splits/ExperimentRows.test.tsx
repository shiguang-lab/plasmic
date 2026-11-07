import LeftSplitsPanel from "@/wab/client/components/sidebar/LeftSplitsPanel";
import { ExperimentRows } from "@/wab/client/components/splits/ExperimentRows";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ModelSnapshots, type ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { ensure } from "@/wab/shared/common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { SplitStatus, SplitType } from "@/wab/shared/core/splits";
import { Split } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

const rowRender = vi.hoisted(() => vi.fn());
const modalRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSplitsPanel", () => ({
  PlasmicLeftSplitsPanel: ({ abContent, segmentsContent, scheduledContent }: { abContent: { render: () => React.ReactNode }; segmentsContent: { render: () => React.ReactNode }; scheduledContent: { render: () => React.ReactNode } }) => <div><section aria-label="Experiments">{abContent.render()}</section><section aria-label="Segments">{segmentsContent.render()}</section><section aria-label="Scheduled">{scheduledContent.render()}</section></div>,
}));
vi.mock("@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentRows", () => ({ default: ({ children }: React.PropsWithChildren) => children }));
vi.mock("@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentRow", () => ({
  default: ({ title, status, onClick, listItem }: { title: React.ReactNode; status: React.ReactNode; onClick: () => void; listItem: { menu?: React.ReactNode } }) => {
    rowRender();
    return <div><button onClick={onClick}>{title}</button><output>{status}</output>{listItem.menu}</div>;
  },
}));
vi.mock("@/wab/client/components/splits/ExperimentModal", () => ({ ExperimentModal: ({ split }: { split: Split }) => { modalRender(split); return <output aria-label="Current split">{split.name}</output>; } }));
afterEach(() => { cleanup(); rowRender.mockClear(); modalRender.mockClear(); });

function createSplit(name: string, splitType = SplitType.Experiment) {
  return new Split({ uuid: name, name, splitType, status: SplitStatus.New, slices: [], targetEvents: [], externalId: undefined, description: undefined });
}
function fixture() {
  const site = createSite();
  const first = createSplit("First");
  const second = createSplit("Second", SplitType.Segment);
  site.splits.push(first, second);
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { site: { value: site }, modelSnapshots: { value: models } });
  const native = createStudioUiEnvironmentFixture();
  native.uiEnvironment.store.setState((state) => ({ leftTabPermissions: Object.freeze({ ...state.leftTabPermissions, splits: "readable" }) }));
  Object.assign(studio, native, { forceOpenSplitStore: createStore<ModelRef<Split> | null>(() => null) });
  for (const key of ["forceOpenSpit", "forceOpenSplit"]) {
    Object.defineProperty(studio, key, ensure(Object.getOwnPropertyDescriptor(StudioCtx.prototype, key), "Native split request command"));
  }
  studio.getLeftTabPermission.mockReturnValue("readable");
  const commit = (fn: () => void) => act(() => { models.sync(recorder.withRecording(fn).changes); });
  return { site, first, second, models, studio, commit, dispose: () => { recorder.dispose(); models.dispose(); } };
}

it("updates the actual panel's native split collection and only the matching row fields", async () => {
  const f = fixture();
  const view = render(<StudioCtxContext.Provider value={f.studio}><LeftSplitsPanel /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("region", { name: "Experiments" }).textContent).toContain("First");
    const renders = rowRender.mock.calls.length;
    f.commit(() => { f.first.description = "No row change"; });
    expect(rowRender).toHaveBeenCalledTimes(renders);
    f.commit(() => { f.first.name = "Renamed"; f.first.status = SplitStatus.Running; });
    expect(screen.getByRole("region", { name: "Experiments" }).textContent).toContain("Renamedrunning");
    f.commit(() => { f.first.splitType = SplitType.Schedule; });
    expect(screen.getByRole("region", { name: "Experiments" }).textContent).toBe("");
    expect(screen.getByRole("region", { name: "Scheduled" }).textContent).toContain("Renamed");
    const third = createSplit("Third");
    f.commit(() => { f.site.splits.push(third); });
    expect(screen.getByRole("button", { name: "Third" })).toBeTruthy();
    f.commit(() => { f.site.splits.splice(f.site.splits.indexOf(third), 1); });
    expect(screen.queryByRole("button", { name: "Third" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Renamed" }));
    await waitFor(() => expect(modalRender).toHaveBeenLastCalledWith(f.first));
  } finally { view.unmount(); f.dispose(); }
});

it("keeps delete and focus commands bound to the actual split identity", () => {
  const f = fixture();
  const clicked = vi.fn();
  const deleted = vi.fn();
  const refs = f.models.field(f.site, "splits").getState();
  const view = render(<StudioCtxContext.Provider value={f.studio}><ExperimentRows splits={refs} type={SplitType.Experiment} onClick={clicked} onDelete={deleted} /></StudioCtxContext.Provider>);
  try {
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    expect(clicked).toHaveBeenLastCalledWith(f.first);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(deleted).toHaveBeenLastCalledWith(f.first);
    const renders = rowRender.mock.calls.length;
    f.commit(() => { f.second.name = "Hidden rename"; f.second.status = SplitStatus.Stopped; });
    expect(rowRender).toHaveBeenCalledTimes(renders);
    view.rerender(<StudioCtxContext.Provider value={f.studio}><ExperimentRows splits={refs} type={SplitType.Experiment} onClick={clicked} /></StudioCtxContext.Provider>);
    expect(screen.queryByRole("menuitem")).toBeNull();
  } finally { view.unmount(); f.dispose(); }
});
