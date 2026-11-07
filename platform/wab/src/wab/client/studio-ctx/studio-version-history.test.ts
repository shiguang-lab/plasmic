import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import type { DbCtx } from "@/wab/client/db";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioVersionHistory } from "@/wab/client/studio-ctx/studio-version-history";
import type { ProjectRevision } from "@/wab/server/entities/Entities";
import type { BranchId } from "@/wab/shared/ApiSchema";
import type { PkgVersionInfo, PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock, mockDeep } from "vitest-mock-extended";

function release(id = "release", description = "Before"): PkgVersionInfoMeta {
  return { id, pkgId: "pkg", version: id, description, tags: ["stable"], createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), deletedAt: null, createdById: null, updatedById: null, deletedById: null, revisionId: `revision-${id}`, branchId: null };
}
function fullRelease(id = "release", description = "Before"): PkgVersionInfo {
  return { ...release(id, description), model: { root: "", map: {}, deps: [], version: "test" } };
}
function revision(id = "revision", number = 4, branchId: string | null = null) {
  return Object.assign(mock<ProjectRevision>(), { id, revision: number, branchId, createdAt: new Date("2026-01-01T00:00:00Z"), createdById: null });
}
function fixture() {
  const studio = mockDeep<StudioCtx>();
  const environment = createStudioUiEnvironmentFixture();
  const dbListeners = new Set<() => void>(), accountListeners = new Set<() => void>();
  const db = mock<DbCtx>({ revisionNum: 8, pkgVersionInfoMeta: undefined, revisionInfo: undefined });
  studio.dbCtx.mockReturnValue(db);
  db.subscribeVersionInputs.mockImplementation((listener) => { dbListeners.add(listener); return () => { dbListeners.delete(listener); }; });
  studio.appCtx.subscribeUiEnvironmentInputs.mockImplementation((listener) => { accountListeners.add(listener); return () => { accountListeners.delete(listener); }; });
  studio.getLeftTabPermission.mockReturnValue("writable");
  Object.assign(studio, { ...environment, editMode: true });
  const owner = new StudioVersionHistory(studio);
  Object.assign(studio, { versionHistory: owner });
  Object.defineProperties(studio, { releases: { get: () => owner.releases }, revisions: { get: () => owner.revisions } });
  return { studio, owner, db, environment, dbListeners, accountListeners };
}

it("publishes immutable scalar rows and preserves equal and unrelated resources", async () => {
  const { studio, owner, environment } = fixture();
  const first = release(), second = release("second");
  studio.getProjectReleases.mockResolvedValue([first, second]);
  await owner.refreshReleases();
  const initial = owner.store.getState();
  expect(initial.releases[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  expect(Object.isFrozen(initial.releases[0].tags)).toBe(true);
  expect(Object.isFrozen(initial.releases[0])).toBe(true);
  first.tags?.push("mutated input");
  first.description = "After";
  expect(initial.releases[0].tags).toEqual(["stable"]);
  expect(initial.releases[0].description).toBe("Before");
  await owner.refreshReleases();
  const changed = owner.store.getState();
  expect(changed.releases[0].description).toBe("After");
  expect(changed.releases[1]).toBe(initial.releases[1]);
  expect(changed.revisions).toBe(initial.revisions);
  expect(owner.getRelease(first.id)).not.toBe(first);
  const publish = vi.fn();
  const stop = owner.store.subscribe(publish);
  await owner.refreshReleases();
  environment.uiEnvironment.store.setState({ brand: { logoTooltip: "Unrelated" } });
  expect(owner.store.getState()).toBe(changed);
  expect(publish).not.toHaveBeenCalled();
  stop(); owner.dispose();
});

it("accepts only the latest list request, propagates failures and retains successful history", async () => {
  const { studio, owner } = fixture();
  const stale = Promise.withResolvers<PkgVersionInfoMeta[]>(), latest = Promise.withResolvers<PkgVersionInfoMeta[]>();
  studio.getProjectReleases.mockReturnValueOnce(stale.promise).mockReturnValueOnce(latest.promise);
  const first = owner.refreshReleases(), second = owner.refreshReleases();
  latest.resolve([release("latest")]); await second;
  const settled = owner.store.getState();
  stale.resolve([release("stale")]); await first;
  expect(owner.store.getState()).toBe(settled);
  const failure = new Error("Version history unavailable");
  studio.getProjectReleases.mockRejectedValueOnce(failure);
  await expect(owner.refreshReleases()).rejects.toBe(failure);
  expect(owner.store.getState()).toBe(settled);
  owner.dispose();
});

it("keeps socket additions and completed edits when an older list response arrives", async () => {
  const { studio, owner } = fixture();
  studio.getProjectReleases.mockResolvedValueOnce([release()]);
  await owner.refreshReleases();
  const pending = Promise.withResolvers<PkgVersionInfoMeta[]>();
  studio.getProjectReleases.mockReturnValueOnce(pending.promise);
  const refresh = owner.refreshReleases();
  owner.prependRelease(release("socket"));
  studio.appCtx.api.updatePkgVersion.mockResolvedValueOnce({ pkg: fullRelease("release", "Edited while loading") });
  await owner.updatePkgVersion("pkg", "release", null, { description: "Edited while loading" });
  pending.resolve([release()]); await refresh;
  expect(owner.store.getState().releases.map((row) => row.id)).toEqual(["socket", "release"]);
  expect(owner.store.getState().releases[1].description).toBe("Edited while loading");
  expect(owner.getRelease("release")).not.toHaveProperty("model");
  owner.dispose();
});

it("ignores older edit responses and keeps the current record when an edit fails", async () => {
  const { studio, owner } = fixture();
  studio.getProjectReleases.mockResolvedValueOnce([release()]); await owner.refreshReleases();
  const stale = Promise.withResolvers<{ pkg: PkgVersionInfo }>(), latest = Promise.withResolvers<{ pkg: PkgVersionInfo }>();
  studio.appCtx.api.updatePkgVersion.mockReturnValueOnce(stale.promise).mockReturnValueOnce(latest.promise);
  const oldEdit = owner.updatePkgVersion("pkg", "release", null, { description: "Old edit" });
  const newEdit = owner.updatePkgVersion("pkg", "release", null, { description: "New edit" });
  latest.resolve({ pkg: fullRelease("release", "New edit") }); await newEdit;
  const settled = owner.store.getState();
  stale.resolve({ pkg: fullRelease("release", "Old edit") }); await oldEdit;
  expect(owner.store.getState()).toBe(settled);
  const failure = new Error("Edit failed");
  studio.appCtx.api.updatePkgVersion.mockRejectedValueOnce(failure);
  await expect(owner.updatePkgVersion("pkg", "release", null, { description: "Failed" })).rejects.toBe(failure);
  expect(owner.store.getState()).toBe(settled);
  owner.dispose();
});

it("merges incremental revisions by identity and invalidates old branch requests", async () => {
  const { studio, owner, environment } = fixture();
  studio.listUnpublishedProjectRevisions.mockResolvedValueOnce([revision("four", 4)]);
  await owner.refreshRevisions();
  const pending = Promise.withResolvers<ProjectRevision[]>();
  studio.listUnpublishedProjectRevisions.mockReturnValueOnce(pending.promise);
  const refresh = owner.refreshRevisions(4);
  owner.prependRevision(revision("five", 5));
  pending.resolve([revision("five", 5)]); await refresh;
  expect(owner.store.getState().revisions.map((row) => row.id)).toEqual(["five", "four"]);
  const oldBranch = Promise.withResolvers<ProjectRevision[]>();
  studio.listUnpublishedProjectRevisions.mockReturnValueOnce(oldBranch.promise);
  const oldRefresh = owner.refreshRevisions();
  environment.uiEnvironment.store.setState({ branchId: "feature" as BranchId, branchName: "Feature" });
  const settled = owner.store.getState();
  oldBranch.resolve([revision("old-branch", 6)]); await oldRefresh;
  owner.prependRevision(revision("wrong-branch", 7));
  expect(owner.store.getState()).toBe(settled);
  studio.listUnpublishedProjectRevisions.mockResolvedValueOnce([revision("feature", 1, "feature")]);
  await owner.refreshRevisions();
  expect(owner.store.getState().revisions.map((row) => row.id)).toEqual(["feature"]);
  owner.dispose();
});

it("publishes exact version inputs and disconnects pending work on disposal", async () => {
  const { studio, owner, db, dbListeners, accountListeners } = fixture();
  Object.assign(db, { revisionNum: 9, revisionInfo: revision("selected") });
  Object.assign(studio, { editMode: false });
  dbListeners.forEach((listener) => listener());
  expect(owner.store.getState()).toMatchObject({ currentRevisionNum: 9, selectedRevisionId: "selected" });
  studio.getLeftTabPermission.mockReturnValue("readable");
  accountListeners.forEach((listener) => listener());
  expect(owner.store.getState().versionsReadOnly).toBe(true);
  const pending = Promise.withResolvers<PkgVersionInfoMeta[]>();
  studio.getProjectReleases.mockReturnValueOnce(pending.promise);
  const refresh = owner.refreshReleases();
  const settled = owner.store.getState();
  owner.dispose();
  expect(dbListeners.size).toBe(0); expect(accountListeners.size).toBe(0);
  pending.resolve([release()]); await refresh;
  owner.prependRelease(release()); owner.syncContext();
  expect(owner.store.getState()).toBe(settled);
});
