import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createStudioModeFixture } from "@/wab/client/__testonly__/studio-mode";
import ViewAsButton from "@/wab/client/components/app-auth/ViewAsButton";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ApiAppUser, ApiPermission, ApiUser, GetProjectResponse, ProjectId, UserId } from "@/wab/shared/ApiSchema";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

const mocks = vi.hoisted(() => ({ studio: undefined as StudioCtx | undefined, manage: vi.fn(), labelRendered: vi.fn(), appUsers: undefined as { appUsers: ApiAppUser[] } | undefined, track: vi.fn(), propsModal: { open: vi.fn(), close: vi.fn() } }));
vi.mock("@/wab/client/contexts/StudioContexts", async (original) => ({ ...(await original<typeof import("@/wab/client/contexts/StudioContexts")>()), useStudioCtx: () => mocks.studio }));
vi.mock("@/wab/client/contexts/AppContexts", async (original) => ({ ...(await original<typeof import("@/wab/client/contexts/AppContexts")>()), useTopFrameApi: () => ({ setShowAppAuthModal: mocks.manage }) }));
vi.mock("@/wab/client/components/app-auth/app-auth-contexts", async (original) => ({ ...(await original<typeof import("@/wab/client/components/app-auth/app-auth-contexts")>()), useAppUsers: () => ({ appUsers: mocks.appUsers }), useAppRoles: () => ({ roles: [] }), useAppCurrentUserOpConfig: () => ({ config: undefined, mutate: vi.fn() }) }));
vi.mock("@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker", async (original) => ({ ...(await original<typeof import("@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker")>()), useDataSourceOpExprBottomModal: () => mocks.propsModal }));
vi.mock("@/wab/client/components/widgets", async (original) => ({ ...(await original<typeof import("@/wab/client/components/widgets")>()), IFrameAwareDropdownMenu: ({ children, menu, onVisibleChange }: { children: React.ReactNode; menu: React.ReactNode; onVisibleChange: (visible: boolean) => void }) => <section>{children}<button onClick={() => onVisibleChange(false)}>Close user menu</button>{menu}</section> }));
vi.mock("@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicViewAsButton", () => ({ PlasmicViewAsButton: ({ children }: { children: React.ReactNode }) => <React.Profiler id="view-as-label" onRender={mocks.labelRendered}><button>{children}</button></React.Profiler> }));
vi.mock("@/wab/client/tracking", () => ({ trackEvent: mocks.track }));

const user = mock<ApiUser>({ id: "editor" as UserId, email: "editor@example.test" });
function permission(projectId: ProjectId, target = user): ApiPermission {
  return { id: "editor-permission", projectId, workspaceId: null, teamId: null, userId: target.id, email: target.email, user: target, accessLevel: "editor" };
}
function appUser(email: string, roleName = "Editor"): ApiAppUser {
  return { email, properties: {}, customProperties: {}, roleId: "role", roleName, roleOrder: 1, roleIds: ["role"], roleNames: [roleName], isLoggedIn: true };
}
async function setup(hasAppAuth = true) {
  const result = fakeStudioCtx({ siteInfo: { hasAppAuth } });
  mocks.studio = result.studioCtx;
  await waitFor(() => expect(result.studioCtx.initialRouteReady).toBe(true));
  return result;
}
function response(studio: StudioCtx, hasAppAuth: boolean, perms: ApiPermission[] = []) {
  return Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo }, perms, owner: undefined, latestRevisionSynced: 0, hasAppAuth, appAuthProvider: undefined, isMainBranchProtected: false });
}
beforeEach(() => { vi.clearAllMocks(); mocks.appUsers = { appUsers: [appUser("reader@example.test")] }; });
afterEach(async () => { await act(async () => { cleanup(); }); vi.restoreAllMocks(); });

it("publishes real auth and permission metadata, account inputs and no-op snapshots", async () => {
  const { studioCtx, api, appCtx } = await setup(false);
  appCtx.selfInfo = user;
  appCtx.publishUiEnvironmentInputs();
  const store = studioCtx.uiEnvironment.store;
  expect(store.getState()).toMatchObject({ hasAppAuth: false, isProjectEditor: false });
  const brandRendered = vi.fn();
  function Brand() {
    const brand = useStore(store, (state) => state.brand);
    return <React.Profiler id="brand" onRender={brandRendered}><output>{brand?.logoTooltip}</output></React.Profiler>;
  }
  const view = render(<Brand />);
  brandRendered.mockClear();
  api.getSiteInfo.mockResolvedValueOnce(response(studioCtx, true, [permission(studioCtx.siteInfo.id)]));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(store.getState()).toMatchObject({ hasAppAuth: true, isProjectEditor: true });
  expect(brandRendered).not.toHaveBeenCalled();
  studioCtx.editMode = false;
  expect(store.getState().isProjectEditor).toBe(true);
  appCtx.selfInfo = mock<ApiUser>({ id: "viewer" as UserId, email: "viewer@example.test" });
  appCtx.publishUiEnvironmentInputs();
  expect(store.getState().isProjectEditor).toBe(false);
  const settled = store.getState();
  const publish = vi.fn(); const stop = store.subscribe(publish);
  appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(settled);
  expect(publish).not.toHaveBeenCalled();
  const failure = new Error("Metadata refresh failed");
  api.getSiteInfo.mockRejectedValueOnce(failure);
  await expect(studioCtx.refreshSiteInfo()).rejects.toBe(failure);
  expect(store.getState()).toBe(settled);
  view.unmount(); studioCtx.dispose();
  appCtx.selfInfo = user; appCtx.publishUiEnvironmentInputs();
  expect(store.getState()).toBe(settled);
  stop();
});

it("updates auth visibility and editor actions from actual metadata and account changes", async () => {
  const { studioCtx, api, appCtx } = await setup(false);
  const view = render(<ViewAsButton />);
  expect(screen.queryByRole("button", { name: "Viewing as anonymous" })).toBeNull();
  appCtx.selfInfo = user;
  api.getSiteInfo.mockResolvedValueOnce(response(studioCtx, true, [permission(studioCtx.siteInfo.id)]));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(screen.getByRole("button", { name: "Viewing as anonymous" })).toBeTruthy();
  fireEvent.click(screen.getByText("Manage users & settings"));
  expect(mocks.manage).toHaveBeenCalledWith(true);
  expect(screen.getByText("User properties")).toBeTruthy();
  act(() => { appCtx.selfInfo = null; appCtx.publishUiEnvironmentInputs(); });
  expect(screen.queryByText("Manage users & settings")).toBeNull();
  expect(screen.queryByText("User properties")).toBeNull();
  expect(screen.getByRole("button", { name: "Viewing as anonymous" })).toBeTruthy();
  api.getSiteInfo.mockResolvedValueOnce(response(studioCtx, false));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(screen.queryByRole("button", { name: "Viewing as anonymous" })).toBeNull();
  view.unmount(); studioCtx.dispose();
});

it("keeps user selection, anonymous logout and the email/external-id label bound to native commands", async () => {
  const { studioCtx } = await setup();
  const view = render(<ViewAsButton />);
  fireEvent.click(screen.getByText("reader@example.test"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Viewing as reader@example.test" })).toBeTruthy());
  expect(studioCtx.currentAppUser).toMatchObject({ email: "reader@example.test", isLoggedIn: true, roleId: "role", roleName: "Editor", roleIds: ["role"] });
  expect(studioCtx.appCtx.api.addStorageItem).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("reader@example.test"));
  fireEvent.click(screen.getByText("View as anonymous user"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Viewing as anonymous" })).toBeTruthy());
  expect(studioCtx.currentAppUser.isLoggedIn).toBe(false);
  await act(async () => { await studioCtx.logAsAppUser({ ...studioCtx.currentAppUser, isLoggedIn: true, externalId: "external-viewer" }); });
  expect(screen.getByRole("button", { name: "Viewing as external-viewer" })).toBeTruthy();
  view.unmount(); studioCtx.dispose();
});

it("subscribes to the installed preview owner and rebinds when that owner changes", async () => {
  const { studioCtx, api, appCtx } = await setup();
  appCtx.selfInfo = user;
  api.getSiteInfo.mockResolvedValueOnce(response(studioCtx, true, [permission(studioCtx.siteInfo.id)]));
  await studioCtx.refreshSiteInfo();
  const first = createStudioModeFixture(false), second = createStudioModeFixture(true);
  studioCtx.previewCtx = first.previewOwnerStore.getState();
  const view = render(<ViewAsButton />);
  expect(screen.getByText("User properties")).toBeTruthy();
  act(() => { studioCtx.previewCtx = second.previewOwnerStore.getState(); });
  expect(screen.queryByText("User properties")).toBeNull();
  act(() => { first.previewOwnerStore.getState()?.store.setState({ isLive: true }); });
  expect(screen.queryByText("User properties")).toBeNull();
  act(() => { second.previewOwnerStore.getState()?.store.setState({ isLive: false }); });
  expect(screen.getByText("User properties")).toBeTruthy();
  view.unmount(); studioCtx.previewCtx = undefined; studioCtx.dispose();
});

it("keeps labels on narrow user selectors and preserves search reset behavior", async () => {
  const { studioCtx } = await setup();
  const view = render(<ViewAsButton />);
  await act(async () => undefined);
  mocks.labelRendered.mockClear();
  await act(async () => { await studioCtx.logAsAppUser({ ...studioCtx.currentAppUser, properties: { irrelevant: "value" } }); });
  expect(mocks.labelRendered).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText("Search emails"), { target: { value: "missing" } });
  expect(screen.getByText("User not found")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close user menu" }));
  expect((screen.getByPlaceholderText("Search emails") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("reader@example.test")).toBeTruthy();
  view.unmount(); studioCtx.dispose();
});
