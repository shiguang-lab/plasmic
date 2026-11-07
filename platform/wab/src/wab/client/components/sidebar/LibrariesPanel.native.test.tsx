import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { LibrariesPanel } from "@/wab/client/components/sidebar/LibrariesPanel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { deepMerged } from "@/wab/commons/collections";
import { toOpaque } from "@/wab/commons/types";
import type { ApiUser, GetProjectResponse } from "@/wab/shared/ApiSchema";
import { mergeUiConfigs, type UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const importsRendered = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/insert-panel/InsertPanel", () => ({ default: ({ mode, onClose }: { mode: string; onClose: () => void }) => <button onClick={onClose}>{mode} content</button> }));
vi.mock("@/wab/client/components/sidebar/ProjectDependencies", () => ({ ProjectDependenciesPanel: () => { importsRendered(); return <div>Imported dependency list</div>; } }));
const studios = new Set<StudioCtx>();
const user = mock<ApiUser>({ id: toOpaque("library-user"), email: "library@example.test" });
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); importsRendered.mockClear();
});
async function setup() {
  const f = fakeStudioCtx({ siteInfo: { contentCreatorConfig: deepMerged(mergeUiConfigs(), { leftTabs: { imports: "hidden" } }) } });
  const studio = f.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  f.appCtx.selfInfo = user; f.appCtx.publishUiEnvironmentInputs();
  studio.openLibraries("imports");
  return { ...f, studio };
}
const contents = (studio: StudioCtx) => <StudioCtxContext.Provider value={studio}><LibrariesPanel /></StudioCtxContext.Provider>;
function response(studio: StudioCtx, uiConfig: UiConfig) {
  return Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo, uiConfig }, perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
}

it("follows real account, metadata and content-mode inputs and preserves its owner on no-op updates", async () => {
  const f = await setup();
  const view = render(contents(f.studio));
  const initial = f.studio.uiEnvironment.store.getState();
  expect(initial.hasUserInfo).toBe(true);
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  act(() => { f.appCtx.selfInfo = null; f.appCtx.publishUiEnvironmentInputs(); });
  expect(f.studio.uiEnvironment.store.getState().hasUserInfo).toBe(false);
  expect(screen.getByText("Component store")).toBeTruthy();
  expect(initial.hasUserInfo).toBe(true);
  act(() => { f.appCtx.selfInfo = user; f.appCtx.publishUiEnvironmentInputs(); });
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  act(() => { f.studio.toggleContentEditorMode(); });
  expect(screen.getByText("Component store")).toBeTruthy();
  act(() => { f.studio.toggleContentEditorMode(); });
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  f.api.getSiteInfo.mockResolvedValueOnce(response(f.studio, deepMerged(f.studio.getCurrentUiConfig(), { leftTabs: { imports: "hidden" } })));
  await act(async () => { await f.studio.refreshSiteInfo(); });
  expect(screen.getByText("Component store")).toBeTruthy();
  f.api.getSiteInfo.mockResolvedValueOnce(response(f.studio, deepMerged(f.studio.getCurrentUiConfig(), { leftTabs: { imports: "writable" } })));
  await act(async () => { await f.studio.refreshSiteInfo(); });
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  const settled = f.studio.uiEnvironment.store.getState();
  f.appCtx.publishUiEnvironmentInputs();
  expect(f.studio.uiEnvironment.store.getState()).toBe(settled);
  view.unmount(); f.studio.dispose(); studios.delete(f.studio);
  f.appCtx.selfInfo = null; f.appCtx.publishUiEnvironmentInputs();
  expect(f.studio.uiEnvironment.store.getState()).toBe(settled);
});

it("uses canonical tab commands, skips unrelated fields and detaches a replaced Studio owner", async () => {
  const first = await setup(), second = await setup();
  const view = render(contents(first.studio));
  act(() => { first.studio.setLibraryTab("store"); });
  expect(first.studio.libraryTab).toBe("store");
  expect(screen.getByRole("button", { name: "store content" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(first.studio.leftTabKey).toBeUndefined());
  expect(first.studio.libraryTab).toBe("store");
  view.rerender(contents(second.studio));
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  importsRendered.mockClear();
  act(() => { first.studio.setLibraryTab("imports"); first.appCtx.selfInfo = null; first.appCtx.publishUiEnvironmentInputs(); });
  expect(importsRendered).not.toHaveBeenCalled();
  const published = vi.fn(), stop = second.studio.libraryTabStore.subscribe(published);
  act(() => { second.studio.setLibraryTab("imports"); second.studio.setLibraryTab("imports"); });
  expect(published).not.toHaveBeenCalled();
  second.api.getSiteInfo.mockResolvedValueOnce(response(second.studio, deepMerged(second.studio.getCurrentUiConfig(), { leftTabs: { fonts: "readable" } })));
  await act(async () => { await second.studio.refreshSiteInfo(); });
  expect(importsRendered).not.toHaveBeenCalled();
  stop(); view.unmount();
  act(() => { second.studio.setLibraryTab("store"); });
  expect(importsRendered).not.toHaveBeenCalled();
});
