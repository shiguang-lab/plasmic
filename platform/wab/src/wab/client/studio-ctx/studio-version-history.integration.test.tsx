import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { ProjectRevision } from "@/wab/server/entities/Entities";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import type { PkgVersionInfo, PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

function release(): PkgVersionInfoMeta {
  return { id: "published", pkgId: "pkg", version: "1.0.0", tags: ["stable"], description: "Before", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), deletedAt: null, createdById: null, updatedById: null, deletedById: null, branchId: null };
}
afterEach(async () => { await act(async () => { cleanup(); }); });

it("connects actual DbCtx installs, revision-number writes and Studio edit-mode commands", async () => {
  const { studioCtx, dbCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const owner = studioCtx.versionHistory;
  dbCtx.setSite(studioCtx.site, undefined, release());
  expect(owner.store.getState().selectedReleaseId).toBe("published");
  studioCtx.editMode = false;
  const rev = Object.assign(mock<ProjectRevision>(), { id: "selected-revision", revision: 4, createdAt: new Date("2026-01-01"), createdById: null });
  dbCtx.setSite(studioCtx.site, undefined, rev);
  expect(owner.store.getState().selectedRevisionId).toBe(rev.id);
  expect(owner.store.getState().selectedReleaseId).toBeUndefined();
  const notify = vi.fn(); const stop = owner.store.subscribe(notify);
  dbCtx.revisionNum = 9;
  expect(owner.store.getState().currentRevisionNum).toBe(9);
  expect(notify).toHaveBeenCalledOnce();
  dbCtx.revisionNum = 9;
  expect(notify).toHaveBeenCalledOnce();
  studioCtx.editMode = true;
  expect(owner.store.getState().selectedRevisionId).toBeUndefined();
  const settled = owner.store.getState();
  studioCtx.dispose();
  dbCtx.revisionNum = 10;
  expect(owner.store.getState()).toBe(settled);
  stop();
});

it("publishes real metadata permission changes without rendering release subscribers", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const rowsRendered = vi.fn();
  function Rows() {
    const rows = useStore(studioCtx.versionHistory.store, (state) => state.releases);
    return <React.Profiler id="rows" onRender={rowsRendered}><output>{rows.length}</output></React.Profiler>;
  }
  function Permission() {
    const readOnly = useStore(studioCtx.versionHistory.store, (state) => state.versionsReadOnly);
    return <output aria-label="permission">{readOnly ? "readable" : "writable"}</output>;
  }
  const view = render(<><Rows /><Permission /></>);
  rowsRendered.mockClear();
  api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), { project: { ...studioCtx.siteInfo, uiConfig: { leftTabs: { versions: "readable" } } }, perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false }));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
  expect(screen.getByLabelText("permission").textContent).toBe("readable");
  expect(rowsRendered).not.toHaveBeenCalled();
  view.unmount(); studioCtx.dispose();
});

it("routes actual Studio refresh and metadata-edit commands through native history", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const rev = Object.assign(mock<ProjectRevision>(), { id: "native-revision", revision: 5, createdAt: new Date("2026-01-01"), createdById: null });
  api.listUnpublishedProjectRevisions.mockResolvedValueOnce({ revisions: [rev] });
  await studioCtx.refreshRevisions();
  expect(studioCtx.versionHistory.store.getState().revisions[0].id).toBe(rev.id);
  const published = release();
  api.getPkgByProjectId.mockResolvedValueOnce({ pkg: { id: published.pkgId, name: "Pkg", projectId: studioCtx.siteInfo.id } });
  api.listPkgVersionsWithoutData.mockResolvedValueOnce({ pkgVersions: [published] });
  await studioCtx.versionHistory.refreshReleases();
  const updated: PkgVersionInfo = { ...published, description: "Edited", tags: ["updated"], model: { root: "", map: {}, deps: [], version: "test" } };
  api.updatePkgVersion.mockResolvedValueOnce({ pkg: updated });
  await studioCtx.updatePkgVersion(published.pkgId, published.version, null, { description: "Edited", tags: ["updated"] });
  expect(studioCtx.versionHistory.store.getState().releases[0]).toMatchObject({ description: "Edited", tags: ["updated"] });
  expect(studioCtx.releases[0]).not.toBe(published);
  expect(published.description).toBe("Before");
  expect(studioCtx.releases[0]).not.toHaveProperty("model");
  studioCtx.dispose();
});
