import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import type { RowGroupProps } from "@/wab/client/components/RowGroup";
import { DataTokenFolderRow, StyleTokenFolderRow } from "@/wab/client/components/sidebar/TokenFolderRow";
import { isTokenPanelReadOnly, type DataTokenFolder, type StyleTokenFolder } from "@/wab/client/components/sidebar/token-utils";
import { Matcher } from "@/wab/client/components/view-common";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { deepMerged } from "@/wab/commons/collections";
import type { ApiPermission, ApiUser, GetProjectResponse, UserId } from "@/wab/shared/ApiSchema";
import type { UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const rowRendered = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/RowGroup", () => ({ default: ({ style, children, menu, groupSize }: RowGroupProps) => {
  rowRendered();
  return <section aria-label="Token folder" data-count={groupSize} style={style}>{typeof menu === "function" ? menu() : menu}{children}</section>;
} }));
const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear();
});
async function setup(options?: Parameters<typeof fakeStudioCtx>[0]) {
  const result = fakeStudioCtx(options);
  studios.add(result.studioCtx);
  await waitFor(() => expect(result.studioCtx.initialRouteReady).toBe(true));
  return result;
}
function folders() {
  const actions = { onAddToken: vi.fn().mockResolvedValue(undefined), onDeleteFolder: vi.fn(), onFolderRenamed: vi.fn().mockResolvedValue(undefined) };
  const style: StyleTokenFolder = { type: "folder-token", tokenType: "Color", name: "Colors", key: "Colors", path: "Colors", count: 2, items: [], actions };
  const data: DataTokenFolder = { type: "folder-token", tokenType: "string", name: "Content", key: "Content", path: "Content", count: 3, items: [], actions };
  return { style, data, actions };
}
function response(studio: StudioCtx, uiConfig: UiConfig, perms = studio.siteInfo.perms) {
  return Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo, uiConfig }, perms, owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
}

it("updates both folder menus from real metadata and content-mode policy while isolating unrelated selectors", async () => {
  const { studioCtx: studio, api } = await setup({ siteInfo: { contentCreatorConfig: { canCreateBasics: false } } });
  const { style, data } = folders();
  const props = { matcher: new Matcher(""), indentMultiplier: 0, isOpen: false, toggleExpand: vi.fn() };
  const view = render(<StudioCtxContext.Provider value={studio}><StyleTokenFolderRow folder={style} {...props} /><DataTokenFolderRow folder={data} {...props} /></StudioCtxContext.Provider>);
  expect(screen.getAllByRole("menuitem", { name: "Add token" })).toHaveLength(2);
  const initial = studio.uiEnvironment.store.getState();
  expect(initial.tokenPanelReadOnly).toBe(isTokenPanelReadOnly(studio));
  expect(createStudioUiEnvironmentFixture().uiEnvironment.store.getState().tokenPanelReadOnly).toBe(initial.tokenPanelReadOnly);
  rowRendered.mockClear();
  api.getSiteInfo.mockResolvedValueOnce(response(studio, deepMerged(studio.getCurrentUiConfig(), { leftTabs: { fonts: "readable" } })));
  await act(async () => { await studio.refreshSiteInfo(); });
  expect(rowRendered).not.toHaveBeenCalled();
  api.getSiteInfo.mockResolvedValueOnce(response(studio, deepMerged(studio.getCurrentUiConfig(), { leftTabs: { tokens: "readable" } })));
  await act(async () => { await studio.refreshSiteInfo(); });
  expect(studio.uiEnvironment.store.getState().tokenPanelReadOnly).toBe(isTokenPanelReadOnly(studio));
  expect(screen.queryByRole("menuitem", { name: "Add token" })).toBeNull();
  api.getSiteInfo.mockResolvedValueOnce(response(studio, deepMerged(studio.getCurrentUiConfig(), { leftTabs: { tokens: "writable" } })));
  await act(async () => { await studio.refreshSiteInfo(); });
  expect(screen.getAllByRole("menuitem", { name: "Add token" })).toHaveLength(2);
  await act(async () => { studio.toggleContentEditorMode(); });
  expect(studio.uiEnvironment.store.getState().tokenPanelReadOnly).toBe(true);
  expect(screen.queryByRole("menuitem", { name: "Add token" })).toBeNull();
  await act(async () => { studio.toggleContentEditorMode(); });
  expect(screen.getAllByRole("menuitem", { name: "Add token" })).toHaveLength(2);
  const settled = studio.uiEnvironment.store.getState(), published = vi.fn();
  const stop = studio.uiEnvironment.store.subscribe(published);
  api.getSiteInfo.mockResolvedValueOnce(response(studio, studio.getCurrentUiConfig()));
  await act(async () => { await studio.refreshSiteInfo(); studio.appCtx.publishUiEnvironmentInputs(); });
  expect(studio.uiEnvironment.store.getState()).toBe(settled);
  expect(published).not.toHaveBeenCalled();
  stop(); view.unmount();
});

it("keeps style/data token commands, parent DTO replacements and actual editable-label rename behavior", async () => {
  const { studioCtx: studio } = await setup();
  const { style, data, actions } = folders(), expand = vi.fn();
  const props = { matcher: new Matcher(""), indentMultiplier: 1, isOpen: false, toggleExpand: expand };
  const contents = (folder = style) => <StudioCtxContext.Provider value={studio}><StyleTokenFolderRow folder={folder} {...props} /><DataTokenFolderRow folder={data} {...props} /></StudioCtxContext.Provider>;
  const view = render(contents());
  const [styleSection, dataSection] = screen.getAllByRole("region", { name: "Token folder" });
  fireEvent.click(within(styleSection).getByRole("menuitem", { name: "Add token" }));
  fireEvent.click(within(dataSection).getByRole("menuitem", { name: "Add token" }));
  expect(actions.onAddToken.mock.calls).toEqual([["Color", "Colors"], ["string", "Content"]]);
  expect(expand).toHaveBeenCalledTimes(2);
  fireEvent.click(within(styleSection).getByRole("menuitem", { name: "Rename Folder" }));
  const input = await within(styleSection).findByRole("textbox");
  fireEvent.change(input, { target: { value: "Palette" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(actions.onFolderRenamed).toHaveBeenCalledWith(style, "Palette"));
  const next = { ...style, name: "Palette", path: "Palette", count: 5 };
  view.rerender(contents(next));
  expect(within(styleSection).getByText("Palette")).toBeTruthy();
  expect(styleSection.getAttribute("data-count")).toBe("5");
  expect(styleSection.style.paddingLeft).toBe("22px");
  fireEvent.click(within(styleSection).getByRole("menuitem", { name: "Delete Folder" }));
  expect(actions.onDeleteFolder).toHaveBeenCalledWith(next);
});

it("publishes account-forced content policy and disposes its real owner subscription", async () => {
  const { studioCtx: studio, appCtx } = await setup({ siteInfo: { createdById: "owner" as UserId, readableByPublic: false, defaultAccessLevel: "viewer", contentCreatorConfig: { canCreateBasics: false } } });
  const contentUser = mock<ApiUser>({ id: "content-user" as UserId, email: "content@example.test" });
  const editor = mock<ApiUser>({ id: "editor-user" as UserId, email: "editor@example.test" });
  const permission = (user: ApiUser, accessLevel: ApiPermission["accessLevel"]): ApiPermission => ({ id: `permission-${user.id}`, projectId: studio.siteInfo.id, workspaceId: null, teamId: null, userId: user.id, user, email: user.email, accessLevel });
  studio.dbCtx().setSiteInfo({ ...studio.siteInfo, perms: [permission(contentUser, "content"), permission(editor, "editor")] });
  appCtx.selfInfo = contentUser; appCtx.publishUiEnvironmentInputs();
  expect(studio.contentEditorMode).toBe(true);
  expect(studio.uiEnvironment.store.getState().tokenPanelReadOnly).toBe(true);
  appCtx.selfInfo = editor; appCtx.publishUiEnvironmentInputs();
  expect(studio.contentEditorMode).toBe(false);
  expect(studio.uiEnvironment.store.getState().tokenPanelReadOnly).toBe(false);
  const settled = studio.uiEnvironment.store.getState(), published = vi.fn();
  const stop = studio.uiEnvironment.store.subscribe(published);
  studio.dispose(); studios.delete(studio);
  appCtx.selfInfo = contentUser; appCtx.publishUiEnvironmentInputs();
  expect(studio.uiEnvironment.store.getState()).toBe(settled);
  expect(published).not.toHaveBeenCalled();
  stop();
});
