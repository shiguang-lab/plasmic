import { message, notification } from "antd";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StudioUiEnvironment } from "@/wab/client/studio-ctx/studio-ui-environment";
import type { ApiBranch, ApiTeam, BranchId, GetProjectResponse, TeamId } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

const savedHostOverride = DEVFLAGS.hostUrl;
beforeEach(() => { DEVFLAGS.hostUrl = ""; });
afterEach(async () => { await act(async () => { cleanup(); message.destroy(); notification.destroy(); }); DEVFLAGS.hostUrl = savedHostOverride; });

it("publishes real metadata host changes while preserving immutable brand and unrelated selectors", async () => {
  const brand = { logoTooltip: "Project brand", logoImgSrc: "https://brand.example/logo.svg" };
  const { studioCtx, api } = fakeStudioCtx({ siteInfo: { hostUrl: "http://localhost/host", uiConfig: { brand } }, devFlagOverrides: { ccStubs: false } });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const store = studioCtx.uiEnvironment.store;
  const initial = store.getState();
  expect(initial.brand).not.toBe(brand);
  expect(Object.isFrozen(initial.brand)).toBe(true);
  brand.logoTooltip = "Mutated API input";
  expect(initial.brand?.logoTooltip).toBe("Project brand");
  brand.logoTooltip = "Project brand";
  const brandCommits = vi.fn();
  function Brand() {
    const value = useStore(store, (state) => state.brand);
    return <React.Profiler id="brand" onRender={brandCommits}><output>{value?.logoTooltip}</output></React.Profiler>;
  }
  render(<Brand />);
  brandCommits.mockClear();
  const publish = vi.fn();
  const stop = store.subscribe(publish);
  const response = () => Object.assign(mock<GetProjectResponse>(), { project: { ...studioCtx.siteInfo, hostUrl: "http://localhost/next-host", uiConfig: { brand } }, perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
  api.getSiteInfo.mockResolvedValueOnce(response());
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(store.getState().hostUrl).toBe("http://localhost/next-host");
  expect(store.getState().brand).toBe(initial.brand);
  expect(brandCommits).not.toHaveBeenCalled();
  const settled = store.getState();
  api.getSiteInfo.mockResolvedValueOnce(response());
  await studioCtx.refreshSiteInfo();
  studioCtx.appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(settled);
  expect(publish).toHaveBeenCalledOnce();
  stop();
  studioCtx.dispose();
});

it("publishes actual content-editor overrides and preserves configured brand wording", async () => {
  const { studioCtx } = fakeStudioCtx({ siteInfo: { uiConfig: { brand: { logoTooltip: "Studio identity" } }, contentCreatorConfig: { brand: { logoTooltip: "Content identity" } } } });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const store = studioCtx.uiEnvironment.store;
  const initial = store.getState();
  expect(initial.contentEditorMode).toBe(false);
  expect(initial.brand?.logoTooltip).toBe("Studio identity");
  studioCtx.toggleContentEditorMode();
  expect(store.getState().contentEditorMode).toBe(true);
  expect(store.getState().brand?.logoTooltip).toBe("Content identity");
  expect(initial.contentEditorMode).toBe(false);
  studioCtx.toggleContentEditorMode();
  expect(store.getState().contentEditorMode).toBe(false);
  expect(store.getState().brand?.logoTooltip).toBe("Studio identity");
  studioCtx.dispose();
});

it("updates parent-team branching inputs and releases its account subscription", async () => {
  const team = mock<ApiTeam>({ id: "team" as TeamId, name: "Team", parentTeamId: null, personalTeamOwnerId: null });
  const { studioCtx, appCtx } = fakeStudioCtx({ siteInfo: { teamId: team.id }, teams: [team], devFlagOverrides: { branching: false, branchingTeamIds: ["parent" as TeamId] } });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const owner = new StudioUiEnvironment(studioCtx);
  expect(owner.store.getState().showBranching).toBe(false);
  appCtx.teams = [{ ...team, parentTeamId: "parent" as TeamId }];
  appCtx.publishUiEnvironmentInputs();
  expect(owner.store.getState().showBranching).toBe(true);
  const settled = owner.store.getState();
  const publish = vi.fn();
  const stop = owner.store.subscribe(publish);
  owner.dispose();
  appCtx.teams = [team];
  appCtx.publishUiEnvironmentInputs();
  owner.sync();
  expect(owner.store.getState()).toBe(settled);
  expect(publish).not.toHaveBeenCalled();
  stop();
  studioCtx.dispose();
});

it("publishes branch host and label metadata when loadVersion installs the branch", async () => {
  const { studioCtx, dbCtx, api, appCtx } = fakeStudioCtx({ devFlagOverrides: { ccStubs: false } });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const branch = mock<ApiBranch>({ id: "branch" as BranchId, name: "Before", hostUrl: "https://before.example/" });
  dbCtx.setSite(studioCtx.site, branch, undefined);
  studioCtx.uiEnvironment.sync();
  Object.assign(appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(studioCtx.site, studioCtx.siteInfo.id, "test");
  api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await act(async () => { await studioCtx["loadVersion"](undefined, false, { ...branch, name: "After", hostUrl: "https://after.example/" }); });
  expect(studioCtx.uiEnvironment.store.getState()).toMatchObject({ branchId: branch.id, branchName: "After", hostUrl: "https://after.example/" });
  studioCtx.dispose();
});
