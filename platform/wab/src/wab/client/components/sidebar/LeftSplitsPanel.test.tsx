import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import LeftSplitsPanel from "@/wab/client/components/sidebar/LeftSplitsPanel";
import ExperimentCanvasButton from "@/wab/client/components/splits/ExperimentCanvasButton";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { deepMerged } from "@/wab/commons/collections";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { SplitStatus, SplitType } from "@/wab/shared/core/splits";
import type { Split } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const modalRendered = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSplitsPanel", () => ({
  PlasmicLeftSplitsPanel: ({ root, abContent, segmentsContent, scheduledContent, newTestButton, newSegmentButton, newScheduleButton }: { root: { ref: React.Ref<HTMLDivElement> }; abContent: { render: () => React.ReactNode }; segmentsContent: { render: () => React.ReactNode }; scheduledContent: { render: () => React.ReactNode }; newTestButton: { render?: () => React.ReactNode; onClick?: () => void }; newSegmentButton: { render?: () => React.ReactNode; onClick?: () => void }; newScheduleButton: { render?: () => React.ReactNode; onClick?: () => void } }) => <div ref={root.ref}>{abContent.render()}{segmentsContent.render()}{scheduledContent.render()}{[newTestButton, newSegmentButton, newScheduleButton].map((button, index) => button.render ? button.render() : <button key={index} onClick={button.onClick}>New split {index}</button>)}</div>,
}));
vi.mock("@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentRows", () => ({ default: ({ children }: React.PropsWithChildren) => children }));
vi.mock("@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentRow", () => ({ default: ({ title, onClick, listItem }: { title: React.ReactNode; onClick: () => void; listItem: { menu?: React.ReactNode } }) => <div><button onClick={onClick}>{title}</button>{listItem.menu}</div> }));
vi.mock("@/wab/client/components/splits/ExperimentModal", () => ({ ExperimentModal: ({ split, onClose }: { split: Split; onClose: () => void }) => { modalRendered(split); return <section aria-label="Editing split"><output>{split.name}</output><button onClick={onClose}>Close split</button></section>; } }));
vi.mock("@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentCanvasButton", () => ({ PlasmicExperimentCanvasButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Open experiment</button> }));

const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); modalRendered.mockClear(); vi.restoreAllMocks();
});
function siteFixture(name: string) {
  const site = createSite(), manager = new TplMgr({ site });
  const group = manager.createGlobalVariantGroup(name);
  const variant = manager.createGlobalVariant(group, "override");
  const split = manager.addGlobalVariantSplit({ group, variant, type: SplitType.Experiment, status: SplitStatus.New });
  return { site, group, split };
}
async function setup(name = "First experiment") {
  const data = siteFixture(name);
  const fixture = fakeStudioCtx({ site: data.site, devFlagOverrides: { ccStubs: true } });
  const studio = fixture.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  return { ...fixture, ...data, studio };
}
const wrap = (studio: StudioCtx, children: React.ReactNode) => <StudioCtxContext.Provider value={studio}>{children}</StudioCtxContext.Provider>;

it("consumes actual canvas requests made before mounting, reopens after close, and follows native permission changes", async () => {
  const f = await setup();
  const view = render(wrap(f.studio, <ExperimentCanvasButton group={f.group} />));
  fireEvent.click(screen.getByRole("button", { name: "Open experiment" }));
  const pending = f.studio.forceOpenSplitStore.getState();
  expect(Object.isFrozen(pending)).toBe(true);
  expect(pending?.uid).toBe(f.split.uid);
  expect(f.studio.forceOpenSpit).toBe(f.split);
  fireEvent.click(screen.getByRole("button", { name: "Open experiment" }));
  expect(f.studio.forceOpenSplitStore.getState()).toBe(pending);
  view.rerender(wrap(f.studio, <><ExperimentCanvasButton group={f.group} /><LeftSplitsPanel /></>));
  await waitFor(() => expect(screen.getByRole("region", { name: "Editing split" })).toBeTruthy());
  expect(modalRendered).toHaveBeenLastCalledWith(f.split);
  expect(f.studio.forceOpenSplitStore.getState()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close split" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Editing split" })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Open experiment" }));
  await waitFor(() => expect(screen.getByRole("region", { name: "Editing split" })).toBeTruthy());
  expect(f.studio.forceOpenSpit).toBeNull();
  expect(screen.getAllByRole("button", { name: /New split/ })).toHaveLength(3);
  f.api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), { project: { ...f.studio.siteInfo, uiConfig: deepMerged(f.studio.getCurrentUiConfig(), { leftTabs: { splits: "readable" } }) }, perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false }));
  await act(async () => { await f.studio.refreshSiteInfo(); });
  expect(screen.queryByRole("button", { name: /New split/ })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
});

it("reads the current request when its effect starts instead of a render-time request", async () => {
  const f = await setup();
  const other = await f.studio.changeUnsafe(() => {
    const manager = f.studio.tplMgr();
    const group = manager.createGlobalVariantGroup("Current request");
    const variant = manager.createGlobalVariant(group, "override");
    return manager.addGlobalVariantSplit({ group, variant, type: SplitType.Experiment, status: SplitStatus.New });
  });
  f.studio.forceOpenSplit = f.split;
  function SetCurrentRequest() {
    React.useLayoutEffect(() => { f.studio.forceOpenSplit = other; }, []);
    return null;
  }
  render(wrap(f.studio, <><LeftSplitsPanel /><SetCurrentRequest /></>));
  await waitFor(() => expect(modalRendered).toHaveBeenLastCalledWith(other));
  expect(f.studio.forceOpenSpit).toBeNull();
});

it("detaches requests from an old Studio when the provider changes and leaves unmounted requests pending", async () => {
  const first = await setup("First owner"), second = await setup("Second owner");
  const view = render(wrap(first.studio, <LeftSplitsPanel />));
  second.studio.forceOpenSplit = second.split;
  view.rerender(wrap(second.studio, <LeftSplitsPanel />));
  await waitFor(() => expect(modalRendered).toHaveBeenLastCalledWith(second.split));
  modalRendered.mockClear();
  act(() => { first.studio.forceOpenSplit = first.split; });
  expect(first.studio.forceOpenSpit).toBe(first.split);
  expect(modalRendered).not.toHaveBeenCalled();
  view.unmount();
  act(() => { second.studio.forceOpenSplit = second.split; });
  expect(second.studio.forceOpenSpit).toBe(second.split);
  expect(modalRendered).not.toHaveBeenCalled();
});

it("clears pending refs before actual loadVersion/disposal replace or release their model owner", async () => {
  const f = await setup();
  f.studio.forceOpenSplit = f.split;
  const pending = ensure(f.studio.forceOpenSplitStore.getState(), "Pending split request");
  const oldModels = f.studio.modelSnapshots, resolved = vi.spyOn(oldModels, "resolve");
  const next = siteFixture("Replacement experiment");
  Object.assign(f.appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(next.site, f.studio.siteInfo.id, "test");
  f.api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await f.studio["loadVersion"]();
  expect(f.studio.modelSnapshots).not.toBe(oldModels);
  expect(f.studio.forceOpenSplitStore.getState()).toBeNull();
  expect(f.studio.forceOpenSpit).toBeNull();
  expect(resolved.mock.calls.some(([ref]) => ref === pending)).toBe(false);
  const view = render(wrap(f.studio, <LeftSplitsPanel />));
  expect(screen.queryByRole("region", { name: "Editing split" })).toBeNull();
  const current = ensure(f.studio.site.splits[0], "Replacement split command");
  act(() => { f.studio.forceOpenSplit = current; });
  await waitFor(() => expect(modalRendered).toHaveBeenLastCalledWith(current));
  view.unmount();
  f.studio.forceOpenSplit = current;
  f.studio.dispose(); studios.delete(f.studio);
  expect(f.studio.forceOpenSplitStore.getState()).toBeNull();
  expect(f.studio.forceOpenSpit).toBeNull();
});
