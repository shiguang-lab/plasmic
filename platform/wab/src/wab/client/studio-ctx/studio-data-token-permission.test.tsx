import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { isDataTokenPanelReadOnly } from "@/wab/client/components/sidebar/token-utils";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { deepMerged, type DeepMergeable } from "@/wab/commons/collections";
import { toOpaque } from "@/wab/commons/types";
import type { ApiPermission, ApiUser, GetProjectResponse, ProjectId } from "@/wab/shared/ApiSchema";
import type { UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear();
});
async function setup(options?: Parameters<typeof fakeStudioCtx>[0]) {
  const f = fakeStudioCtx(options); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  return f;
}

it("uses the unique data-token helper for actual metadata inputs while keeping unrelated selectors silent", async () => {
  const { studioCtx: studio, api } = await setup();
  const store = studio.uiEnvironment.store, initial = store.getState();
  expect(initial.dataTokenPanelReadOnly).toBe(isDataTokenPanelReadOnly(studio));
  expect(initial.dataTokenPanelReadOnly).toBe(false);
  expect(createStudioUiEnvironmentFixture().uiEnvironment.store.getState().dataTokenPanelReadOnly).toBe(false);
  const rendered = vi.fn();
  function Permission() {
    const readOnly = useStore(store, (state) => state.dataTokenPanelReadOnly);
    return <React.Profiler id="data-token-policy" onRender={rendered}><output aria-label="Data token read only">{String(readOnly)}</output></React.Profiler>;
  }
  render(<Permission />);
  const update = async (patch: DeepMergeable<UiConfig>) => {
    api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo, uiConfig: deepMerged(studio.getCurrentUiConfig(), patch) }, perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false }));
    await act(async () => { await studio.refreshSiteInfo(); });
    expect(store.getState().dataTokenPanelReadOnly).toBe(isDataTokenPanelReadOnly(studio));
  };
  await update({ canCreateBasics: { dataToken: false } });
  expect(screen.getByLabelText("Data token read only").textContent).toBe("true");
  expect(store.getState().tokenPanelReadOnly).toBe(false);
  expect(initial.dataTokenPanelReadOnly).toBe(false);
  await update({ canCreateBasics: { dataToken: true } });
  expect(screen.getByLabelText("Data token read only").textContent).toBe("false");
  await update({ leftTabs: { dataTokens: "readable" } });
  expect(screen.getByLabelText("Data token read only").textContent).toBe("true");
  await update({ leftTabs: { dataTokens: "writable" } });
  rendered.mockClear();
  await update({ leftTabs: { fonts: "readable" } });
  expect(rendered).not.toHaveBeenCalled();
  const settled = store.getState(), published = vi.fn(), stop = store.subscribe(published);
  await update({});
  studio.appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(settled);
  expect(published).not.toHaveBeenCalled();
  stop();
});

it("tracks actual content mode and account-role inputs and stops publishing after disposal", async () => {
  const projectId: ProjectId = toOpaque("data-policy-project");
  const editor = mock<ApiUser>({ id: toOpaque("editor"), email: "editor@example.test", displayName: "" });
  const content = mock<ApiUser>({ id: toOpaque("content"), email: "content@example.test", displayName: "" });
  const permission = (user: ApiUser, accessLevel: ApiPermission["accessLevel"]): ApiPermission => ({ id: `permission-${user.id}`, projectId, workspaceId: null, teamId: null, userId: user.id, user, email: user.email, accessLevel });
  const { studioCtx: studio, appCtx } = await setup({ siteInfo: { id: projectId, createdById: toOpaque("owner"), readableByPublic: false, defaultAccessLevel: "viewer", contentCreatorConfig: { canCreateBasics: false }, perms: [permission(editor, "editor"), permission(content, "content")] } });
  appCtx.selfInfo = editor; appCtx.publishUiEnvironmentInputs();
  expect(studio.uiEnvironment.store.getState().dataTokenPanelReadOnly).toBe(false);
  studio.toggleContentEditorMode();
  expect(studio.uiEnvironment.store.getState().dataTokenPanelReadOnly).toBe(true);
  studio.toggleContentEditorMode();
  expect(studio.uiEnvironment.store.getState().dataTokenPanelReadOnly).toBe(false);
  appCtx.selfInfo = content; appCtx.publishUiEnvironmentInputs();
  expect(studio.contentEditorMode).toBe(true);
  expect(studio.uiEnvironment.store.getState().dataTokenPanelReadOnly).toBe(true);
  appCtx.selfInfo = editor; appCtx.publishUiEnvironmentInputs();
  expect(studio.contentEditorMode).toBe(false);
  expect(studio.uiEnvironment.store.getState().dataTokenPanelReadOnly).toBe(false);
  const settled = studio.uiEnvironment.store.getState(), published = vi.fn(), stop = studio.uiEnvironment.store.subscribe(published);
  studio.dispose(); studios.delete(studio);
  appCtx.selfInfo = content; appCtx.publishUiEnvironmentInputs();
  expect(studio.uiEnvironment.store.getState()).toBe(settled);
  expect(published).not.toHaveBeenCalled();
  stop();
});
