import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { deepMerged } from "@/wab/commons/collections";
import type { ApiPermission, ApiUser, GetProjectResponse, ProjectId, UserId } from "@/wab/shared/ApiSchema";
import { LEFT_TAB_UI_KEYS, type UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

afterEach(async () => { await act(async () => { cleanup(); }); });

it("captures every declared tab permission, shares equal maps and isolates the fonts selector", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const store = studioCtx.uiEnvironment.store;
  const original = store.getState().leftTabPermissions;
  expect(Object.keys(original).sort()).toEqual([...new Set(LEFT_TAB_UI_KEYS)].sort());
  expect(Object.keys(original)).toHaveLength(21);
  expect(Object.isFrozen(original)).toBe(true);
  for (const key of LEFT_TAB_UI_KEYS) { expect(original[key]).toBe(studioCtx.getLeftTabPermission(key)); }
  const defaults = createStudioUiEnvironmentFixture().uiEnvironment.store.getState().leftTabPermissions;
  expect(createStudioUiEnvironmentFixture().uiEnvironment.store.getState().contentEditorMode).toBe(false);
  expect(defaults).toEqual(original);
  expect(Object.isFrozen(defaults)).toBe(true);

  const rendered = vi.fn();
  function FontsPermission() {
    const access = useStore(store, (state) => state.leftTabPermissions.fonts);
    return <React.Profiler id="fonts" onRender={rendered}><output aria-label="fonts">{access}</output></React.Profiler>;
  }
  const view = render(<FontsPermission />);
  const response = (uiConfig: UiConfig) => Object.assign(mock<GetProjectResponse>(), { project: { ...studioCtx.siteInfo, uiConfig }, perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
  rendered.mockClear();
  api.getSiteInfo.mockResolvedValueOnce(response(deepMerged(studioCtx.getCurrentUiConfig(), { leftTabs: { fonts: "readable", images: "hidden" } })));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(screen.getByLabelText("fonts").textContent).toBe("readable");
  expect(rendered).toHaveBeenCalledOnce();
  expect(original.fonts).toBe("writable");
  expect(store.getState().leftTabPermissions.images).toBe("hidden");
  const changed = store.getState().leftTabPermissions;
  rendered.mockClear();
  api.getSiteInfo.mockResolvedValueOnce(response(deepMerged(studioCtx.getCurrentUiConfig(), { leftTabs: { versions: "readable" } })));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(store.getState().leftTabPermissions).not.toBe(changed);
  expect(rendered).not.toHaveBeenCalled();
  const settled = store.getState();
  const publish = vi.fn(); const stop = store.subscribe(publish);
  api.getSiteInfo.mockResolvedValueOnce(response(studioCtx.getCurrentUiConfig()));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  studioCtx.appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(settled);
  expect(store.getState().leftTabPermissions).toBe(settled.leftTabPermissions);
  expect(publish).not.toHaveBeenCalled();
  stop(); view.unmount(); studioCtx.dispose();
});

it("uses the actual content-editor defaults and project overrides in both modes", async () => {
  const { studioCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const store = studioCtx.uiEnvironment.store;
  expect(store.getState().leftTabPermissions.fonts).toBe("writable");
  studioCtx.toggleContentEditorMode();
  expect(store.getState().leftTabPermissions.fonts).toBe("hidden");
  expect(store.getState().leftTabPermissions.outline).toBe("writable");
  for (const key of LEFT_TAB_UI_KEYS) { expect(store.getState().leftTabPermissions[key]).toBe(studioCtx.getLeftTabPermission(key)); }
  studioCtx.toggleContentEditorMode();
  expect(store.getState().leftTabPermissions.fonts).toBe("writable");
  studioCtx.dispose();
});

it("updates forced content-role permissions from account inputs and releases the owner on disposal", async () => {
  const projectId = "permission-source" as ProjectId;
  const contentUser = mock<ApiUser>({ id: "content-user" as UserId, email: "content@example.test", displayName: "" });
  const editorUser = mock<ApiUser>({ id: "editor-user" as UserId, email: "editor@example.test", displayName: "" });
  const permission = (user: ApiUser, accessLevel: ApiPermission["accessLevel"]): ApiPermission => ({ id: `permission-${user.id}`, projectId, workspaceId: null, teamId: null, userId: user.id, user, email: user.email, accessLevel });
  const { studioCtx, appCtx, api } = fakeStudioCtx({ siteInfo: { id: projectId, createdById: "owner" as UserId, readableByPublic: false, defaultAccessLevel: "viewer", perms: [permission(contentUser, "content"), permission(editorUser, "editor")] } });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const store = studioCtx.uiEnvironment.store;
  appCtx.selfInfo = contentUser; appCtx.publishUiEnvironmentInputs();
  expect(studioCtx.contentEditorMode).toBe(true);
  expect(store.getState().contentEditorMode).toBe(true);
  expect(store.getState().leftTabPermissions.fonts).toBe("hidden");
  appCtx.selfInfo = editorUser; appCtx.publishUiEnvironmentInputs();
  expect(studioCtx.contentEditorMode).toBe(false);
  expect(store.getState().contentEditorMode).toBe(false);
  expect(store.getState().leftTabPermissions.fonts).toBe("writable");
  api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), { project: studioCtx.siteInfo, perms: [permission(contentUser, "content"), permission(editorUser, "content")], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false }));
  await studioCtx.refreshSiteInfo();
  expect(studioCtx.contentEditorMode).toBe(true);
  expect(store.getState().contentEditorMode).toBe(true);
  const metadataSettled = store.getState();
  appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(metadataSettled);
  const settled = store.getState();
  const publish = vi.fn(); const stop = store.subscribe(publish);
  studioCtx.dispose();
  appCtx.selfInfo = contentUser; appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(settled);
  expect(publish).not.toHaveBeenCalled();
  stop();
});
