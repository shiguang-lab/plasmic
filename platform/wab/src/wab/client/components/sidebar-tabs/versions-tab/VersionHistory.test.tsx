import { PublishButton } from "@/wab/client/components/top-bar/PublishButton";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { MainBranchId, type ApiBranch, type BranchId, type GetProjectResponse } from "@/wab/shared/ApiSchema";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RevisionsList } from "@/wab/client/components/sidebar-tabs/versions-tab/RevisionsList";
import { VersionsList } from "@/wab/client/components/sidebar-tabs/versions-tab/VersionsList";
import { VersionsTab } from "@/wab/client/components/sidebar-tabs/versions-tab";
import { deepMerged } from "@/wab/commons/collections";
import { ensure, mkUuid } from "@/wab/shared/common";
import { Matcher } from "@/wab/client/components/view-common";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ProjectRevision } from "@/wab/server/entities/Entities";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({ studio: undefined as StudioCtx | undefined, promptLoad: vi.fn(), promptVersionRevert: vi.fn(), promptRevisionRevert: vi.fn(), promptTags: vi.fn(), promptPublish: vi.fn() }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => mocks.studio }));
vi.mock("@/wab/client/api-hooks", async (original) => ({ ...(await original<typeof import("@/wab/client/api-hooks")>()), useUsersMap: () => ({ data: {} }) }));
vi.mock("@/wab/client/components/sidebar-tabs/versions-tab/utils", () => ({ promptLoad: mocks.promptLoad, promptVersionRevert: mocks.promptVersionRevert, promptRevisionRevert: mocks.promptRevisionRevert }));
vi.mock("@/wab/client/prompts", () => ({ promptTagsAndDesc: mocks.promptTags }));
vi.mock("@/wab/client/components/modals/UpgradeDepModal", () => ({ promptPublishProj: mocks.promptPublish }));
vi.mock("@/wab/client/components/ContextMenu", () => ({ WithContextMenu: ({ children, overlay }: { children: React.ReactNode; overlay: () => React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  return <section>{children}<button onClick={() => setOpen((value) => !value)}>Version actions</button>{open && overlay()}</section>;
} }));
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicVersionsListItem", () => ({ PlasmicVersionsListItem: ({ listItemContainer, versionTitle, versionNumber, versionDateTime, isSelected, versionsTagsContainer, revertBtn }: any) => <article data-test-id={listItemContainer["data-test-id"]} data-selected={isSelected}><button onClick={listItemContainer.onClick}>{versionNumber?.children}{versionTitle?.children ?? versionDateTime?.children}</button>{versionsTagsContainer?.children}{revertBtn?.props?.onClick && <button onClick={revertBtn.props.onClick}>Revert autosaved version</button>}</article> }));
vi.mock("@/wab/client/plasmic/plasmic_kit/PlasmicLeftVersionsPanel", () => ({ default: ({ publishButton, revisionsContainer, versionsContainer }: any) => <section>{!publishButton.render && <button onClick={publishButton.onClick}>Publish version</button>}{revisionsContainer}{versionsContainer}</section> }));

function release(id = "published", description = "Before"): PkgVersionInfoMeta {
  return { id, pkgId: "pkg", version: "1.0.0", tags: ["stable"], description, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), deletedAt: null, createdById: null, updatedById: null, deletedById: null, branchId: null };
}
function revision(id: string, number: number) {
  return Object.assign(mock<ProjectRevision>(), { id, revision: number, branchId: null, createdAt: new Date(`2026-01-0${number}`), createdById: null });
}
async function fixture(options?: Parameters<typeof fakeStudioCtx>[0]) {
  const result = fakeStudioCtx(options);
  mocks.studio = result.studioCtx;
  await waitFor(() => expect(result.studioCtx.initialRouteReady).toBe(true));
  return result;
}
beforeEach(() => { vi.clearAllMocks(); mocks.promptLoad.mockResolvedValue(true); mocks.promptVersionRevert.mockResolvedValue(true); mocks.promptRevisionRevert.mockResolvedValue(true); });
afterEach(async () => { await act(async () => { cleanup(); }); vi.restoreAllMocks(); });

it("updates a same-length release edit, search results and tags from native rows", async () => {
  const { studioCtx, api } = await fixture();
  const published = release();
  studioCtx.versionHistory.prependRelease(published);
  const view = render(<VersionsList studioCtx={studioCtx} matcher={new Matcher("Edited")} />);
  expect(screen.getByText("No versions match your search")).toBeTruthy();
  api.updatePkgVersion.mockResolvedValueOnce({ pkg: { ...published, description: "Edited version", tags: ["updated"], model: { root: "", map: {}, deps: [], version: "test" } } });
  await act(async () => { await studioCtx.updatePkgVersion("pkg", "1.0.0", null, { description: "Edited version", tags: ["updated"] }); });
  expect(screen.queryByText("No versions match your search")).toBeNull();
  expect(screen.getByRole("button", { name: /Edited version/ })).toBeTruthy();
  expect(screen.getByText("updated")).toBeTruthy();
  expect(studioCtx.versionHistory.store.getState().releases).toHaveLength(1);
  view.unmount(); studioCtx.dispose();
});

it("keeps release selection and navigation/revert commands tied to current API records", async () => {
  const { studioCtx, dbCtx } = await fixture();
  const published = release();
  studioCtx.versionHistory.prependRelease(published);
  const selected = vi.spyOn(studioCtx, "switchToBranchVersion").mockResolvedValue(undefined);
  vi.spyOn(studioCtx, "needsSaving").mockReturnValue(true);
  vi.spyOn(studioCtx, "canEditProject").mockReturnValue(true);
  const reverted = vi.spyOn(studioCtx, "revertTo").mockResolvedValue(undefined);
  const view = render(<VersionsList studioCtx={studioCtx} matcher={new Matcher("")} />);
  act(() => { dbCtx.setSite(studioCtx.site, undefined, published); });
  expect(view.container.querySelector("[data-test-id=publish-version-item]")?.getAttribute("data-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: /Before/ }));
  await waitFor(() => expect(selected).toHaveBeenCalledOnce());
  expect(mocks.promptLoad).toHaveBeenCalledWith("Load published version");
  const selectedRelease = ensure(selected.mock.calls[0]?.[0], "Selected published version");
  expect(selectedRelease.createdAt).toBeInstanceOf(Date);
  expect(selectedRelease).toBe(studioCtx.versionHistory.getRelease(published.id));
  fireEvent.click(screen.getByRole("button", { name: "Version actions" }));
  fireEvent.click(screen.getByText("Revert to this version"));
  await waitFor(() => expect(reverted).toHaveBeenCalledOnce());
  expect(mocks.promptVersionRevert.mock.calls[0][0]).toBe(studioCtx.versionHistory.getRelease(published.id));
  view.unmount(); studioCtx.dispose();
});

it("updates revision filtering and selected revision through real DbCtx and edit-mode producers", async () => {
  const { studioCtx, api, dbCtx } = await fixture();
  const rows = [revision("current", 4), revision("two", 2), revision("one", 1)];
  api.listUnpublishedProjectRevisions.mockResolvedValueOnce({ revisions: rows });
  await studioCtx.refreshRevisions();
  const view = render(<RevisionsList studioCtx={studioCtx} />);
  expect(screen.getByText("No Autosaved Versions")).toBeTruthy();
  act(() => { studioCtx.versionHistory.prependRelease(release()); });
  const articles = () => view.container.querySelectorAll("[data-test-id=autosaved-version-item]");
  expect(articles()).toHaveLength(2);
  act(() => { studioCtx.editMode = false; dbCtx.setSite(studioCtx.site, undefined, rows[1]); });
  expect(articles()[0].getAttribute("data-selected")).toBe("true");
  act(() => { studioCtx.editMode = true; });
  expect(articles()[0].getAttribute("data-selected")).toBe("false");
  view.unmount(); studioCtx.dispose();
});

it("updates the versions permission and publish entry point without a parent rerender", async () => {
  const { studioCtx, dbCtx } = await fixture();
  const view = render(<VersionsTab useVersionsCTA={false} dismissVersionsCTA={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Publish version" })).toBeTruthy();
  act(() => { dbCtx.setSiteInfo({ ...studioCtx.siteInfo, uiConfig: deepMerged(studioCtx.getCurrentUiConfig(), { leftTabs: { versions: "readable" } }) }); });
  expect(screen.queryByRole("button", { name: "Publish version" })).toBeNull();
  act(() => { dbCtx.setSiteInfo({ ...studioCtx.siteInfo, uiConfig: deepMerged(studioCtx.getCurrentUiConfig(), { leftTabs: { versions: "writable" } }) }); });
  expect(screen.getByRole("button", { name: "Publish version" })).toBeTruthy();
  view.unmount(); studioCtx.dispose();
});

it("updates the publish entry from actual project-name and branch producers without a parent rerender", async () => {
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.componentReuse.mockResolvedValue({available:false});
  const {studioCtx, api, dbCtx, appCtx} = await fixture({topFrameApi});
  const view = render(<AppCtxContext.Provider value={appCtx}><PublishButton enable /></AppCtxContext.Provider>);
  const primary = () => ensure(document.getElementById("topbar-publish-btn"), "Publish primary button");
  expect(primary()).toHaveProperty("disabled", false);
  fireEvent.click(primary());
  expect(topFrameApi.setShowPublishModal).toHaveBeenCalledExactlyOnceWith(true);
  async function rename(name: string) {
    api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), {
      project:{...studioCtx.siteInfo,name},perms:[],owner:undefined,latestRevisionSynced:0,hasAppAuth:false,appAuthProvider:undefined,isMainBranchProtected:false,
    }));
    await act(async () => { await studioCtx.refreshSiteInfo(); });
  }
  await rename("Plasmic Levels Demo");
  expect(primary()).toHaveProperty("disabled", true);
  await rename("Plasmic Levels Primary Copy");
  expect(primary()).toHaveProperty("disabled", false);
  const firstBranch = mock<ApiBranch>({id:mkUuid<BranchId>(),name:"Feature one"});
  const nextBranch = mock<ApiBranch>({id:mkUuid<BranchId>(),name:"Feature two"});
  act(() => { dbCtx.setSite(studioCtx.site,firstBranch,undefined); });
  fireEvent.click(screen.getByRole("button",{name:"Publish"}));
  expect(topFrameApi.setMergeModalContext).toHaveBeenLastCalledWith({subject:{toBranchId:MainBranchId,fromBranchId:firstBranch.id}});
  act(() => { dbCtx.setSite(studioCtx.site,nextBranch,undefined); });
  fireEvent.click(screen.getByRole("button",{name:"Publish"}));
  expect(topFrameApi.setMergeModalContext).toHaveBeenLastCalledWith({subject:{toBranchId:MainBranchId,fromBranchId:nextBranch.id}});
  act(() => { dbCtx.setSite(studioCtx.site,undefined,undefined); });
  expect(primary()).toHaveProperty("disabled", false);
  view.unmount(); await studioCtx.awaitEval(); studioCtx.dispose();
});
