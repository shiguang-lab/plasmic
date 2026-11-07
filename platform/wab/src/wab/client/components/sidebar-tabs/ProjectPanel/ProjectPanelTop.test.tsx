import { ensure } from "@/wab/shared/common";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { BranchPanelTop } from "@/wab/client/components/sidebar-tabs/ProjectPanel/ProjectPanelTop";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { toOpaque } from "@/wab/commons/types";
import type { ApiBranch, GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { message, notification } from "antd";
import React from "react";
import { SWRConfig } from "swr";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
const previews = new Set<PreviewCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); message.destroy(); notification.destroy(); });
  previews.forEach((preview) => preview.dispose()); previews.clear();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});
async function setup() {
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.componentReuse.mockResolvedValue({ available: false });
  const fixture = fakeStudioCtx({ topFrameApi, siteInfo: { isMainBranchProtected: false }, devFlagOverrides: { ccStubs: true } });
  const studio = fixture.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const branch = mock<ApiBranch>({ id: toOpaque<string, "BranchId">("feature"), name: "feature", status: "active" });
  fixture.api.listBranchesForProject.mockResolvedValue({ branches: [branch] });
  return { ...fixture, studio, branch };
}
function contents(f: Awaited<ReturnType<typeof setup>>, commits = vi.fn()) {
  return <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studio}><SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><React.Profiler id="branch-panel" onRender={commits}><BranchPanelTop onClose={vi.fn()} /></React.Profiler></SWRConfig></StudioCtxContext.Provider></AppCtxContext.Provider>;
}
function metadata(studio: StudioCtx, protectedMain: boolean, changes: Partial<GetProjectResponse["project"]> = {}) {
  return Object.assign(mock<GetProjectResponse>(), {
    project: { ...studio.siteInfo, ...changes }, perms: [], owner: undefined, latestRevisionSynced: 0,
    hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: protectedMain,
  });
}

it("updates the already-open main branch menu from real metadata and keeps the protection command current", async () => {
  const f = await setup(); render(contents(f));
  await screen.findByRole("button", { name: "feature" });
  fireEvent.click(screen.getByRole("button", { name: "Branch actions: main" }));
  expect(await screen.findByRole("menuitem", { name: "Protect main branch" })).toBeTruthy();
  f.api.getSiteInfo.mockResolvedValueOnce(metadata(f.studio, true));
  await act(async () => { await f.studio.refreshSiteInfo(); });
  expect(screen.getByRole("menuitem", { name: "Unprotect main branch" })).toBeTruthy();
  expect(f.studio.projectMetadataStore.getState().isMainBranchProtected).toBe(true);
  f.api.setMainBranchProtection.mockResolvedValueOnce({});
  f.api.getSiteInfo.mockResolvedValueOnce(metadata(f.studio, false));
  await act(async () => { fireEvent.click(screen.getByRole("menuitem", { name: "Unprotect main branch" })); });
  await waitFor(() => expect(f.api.setMainBranchProtection).toHaveBeenCalledWith(f.studio.siteInfo.id, false));
  await waitFor(() => expect(f.studio.projectMetadataStore.getState().isMainBranchProtected).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Branch actions: main" }));
  expect(await screen.findByRole("menuitem", { name: "Protect main branch" })).toBeTruthy();
});

it("follows actual branch installation, edit permission, live state and live owner replacement while mounted", async () => {
  const f = await setup(); render(contents(f));
  expect(await screen.findByRole("button", { name: "main" })).toHaveAttribute("aria-pressed", "true");
  Object.assign(f.appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(f.studio.site, f.studio.siteInfo.id, "test");
  f.api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await act(async () => { await f.studio["loadVersion"](undefined, true, f.branch); });
  expect(screen.getByRole("button", { name: "feature" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "main" })).toHaveAttribute("aria-pressed", "false");
  act(() => { f.studio.editMode = false; });
  expect(screen.queryByRole("button", { name: /Create new branch/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Branch actions: main" })).toBeNull();
  act(() => { f.studio.editMode = true; });
  expect(screen.getByRole("button", { name: /Create new branch/ })).toBeTruthy();
  const host = mock<HostFrameCtx>(); Object.defineProperty(host, "history", { value: f.appCtx.history });
  let installed: PreviewCtx | undefined;
  await act(async () => { installed = new PreviewCtx(host, f.studio); previews.add(installed); await installed.parseRoute(); });
  const first = ensure(installed, "Installed live owner");
  act(() => { first.isLive = true; });
  expect(screen.queryByRole("button", { name: /Create new branch/ })).toBeNull();
  let next: PreviewCtx;
  await act(async () => { next = new PreviewCtx(host, f.studio); previews.add(next); await next.parseRoute(); });
  expect(screen.getByRole("button", { name: /Create new branch/ })).toBeTruthy();
  act(() => { first.isLive = false; first.isLive = true; });
  expect(screen.getByRole("button", { name: /Create new branch/ })).toBeTruthy();
});

it("keeps narrow selectors quiet for unrelated metadata and equal refreshes", async () => {
  const f = await setup(), commits = vi.fn();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const mounted = render(contents(f, commits));
  const published = vi.fn(); const stop = f.studio.projectMetadataStore.subscribe(published);
  try {
    // The real search hook installs a 200ms initial debounce. Settle that
    // independent state update before measuring metadata selector commits.
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByRole("button", { name: "feature" })).toBeTruthy();
    commits.mockClear();
    const response = () => metadata(f.studio, false, { projectApiToken: "changed-test-token", name: "Unrelated project name" });
    f.api.getSiteInfo.mockResolvedValueOnce(response());
    await act(async () => { await f.studio.refreshSiteInfo(); });
    expect(published).toHaveBeenCalledOnce(); expect(commits).not.toHaveBeenCalled();
    const snapshot = f.studio.projectMetadataStore.getState();
    f.api.getSiteInfo.mockResolvedValueOnce(response());
    await act(async () => { await f.studio.refreshSiteInfo(); });
    expect(f.studio.projectMetadataStore.getState()).toBe(snapshot);
    expect(published).toHaveBeenCalledOnce(); expect(commits).not.toHaveBeenCalled();
  } finally { stop(); mounted.unmount(); vi.useRealTimers(); }
});
