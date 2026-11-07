import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { BranchId } from "@/wab/shared/ApiSchema";
import type { MinimalRevisionInfo, PkgVersionInfo, PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { ensure } from "@/wab/shared/common";
import { cloneDeep, isEqual, omit, uniqBy } from "lodash";
import { shallow } from "zustand/shallow";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface PublishedVersionRow {
  readonly id: string;
  readonly pkgId: string;
  readonly version: string;
  readonly description: string | undefined;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly createdById: string | null;
  readonly revisionId: string | undefined;
  readonly branchId: string | null | undefined;
}
export interface AutosavedVersionRow {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly createdById: string | null;
}
export interface StudioVersionHistoryState {
  readonly releases: readonly PublishedVersionRow[];
  readonly revisions: readonly AutosavedVersionRow[];
  readonly selectedReleaseId: string | undefined;
  readonly selectedRevisionId: string | undefined;
  readonly currentRevisionNum: number;
  readonly versionsReadOnly: boolean;
}

function shareRows<T extends { readonly id: string }>(before: readonly T[], after: readonly T[]): readonly T[] {
  const byId = new Map(before.map((row) => [row.id, row]));
  const shared = after.map((row) => {
    const previous = byId.get(row.id);
    return previous && isEqual(previous, row) ? previous : Object.freeze(row);
  });
  return before.length === shared.length && shared.every((row, index) => before[index] === row) ? before : Object.freeze(shared);
}

/** Keep events that arrived while a list request was pending. The response still
 * supplies the server's ordering for the unchanged historical rows. */
function mergeConcurrentRows<T extends { id: string }>(before: readonly T[], current: readonly T[], response: readonly T[]): readonly T[] {
  const previous = new Map(before.map((row) => [row.id, row]));
  const changes = new Map(current.filter((row) => previous.get(row.id) !== row).map((row) => [row.id, row]));
  const fetched = new Set(response.map((row) => row.id));
  return [...current.filter((row) => changes.has(row.id) && !fetched.has(row.id)), ...response.map((row) => changes.get(row.id) ?? row)];
}

/** One Studio's history source. API records are command data; UI stores contain
 * scalar rows with frozen tags and ISO dates, never mutable API objects. */
export class StudioVersionHistory {
  private commandReleases: readonly PkgVersionInfoMeta[] = [];
  private commandRevisions: readonly MinimalRevisionInfo[] = [];
  private readonly state: StoreApi<StudioVersionHistoryState>;
  readonly store: ModelFieldStore<StudioVersionHistoryState>;
  private readonly stops: (() => void)[];
  private releaseRequest = 0;
  private revisionRequest = 0;
  private readonly releaseUpdates = new Map<string, symbol>();
  private disposed = false;

  constructor(private readonly studio: StudioCtx) {
    this.state = createStore<StudioVersionHistoryState>(() => Object.freeze({ releases: Object.freeze([]), revisions: Object.freeze([]), ...this.context() }));
    this.store = this.state;
    this.stops = [
      studio.dbCtx().subscribeVersionInputs(() => this.syncContext()),
      studio.appCtx.subscribeUiEnvironmentInputs(() => this.syncContext()),
      studio.uiEnvironment.store.subscribe((next, previous) => {
        if (next.branchId !== previous.branchId) {
          this.releaseRequest++;
          this.revisionRequest++;
          this.releaseUpdates.clear();
        }
        this.syncContext();
      }),
    ];
  }

  get releases() { return this.commandReleases; }
  get revisions() { return this.commandRevisions; }
  getRelease(id: string) { return ensure(this.commandReleases.find((row) => row.id === id), "Published version is no longer in this Studio's history"); }
  getRevision(id: string) { return ensure(this.commandRevisions.find((row) => row.id === id), "Autosaved version is no longer in this Studio's history"); }

  private context() {
    const db = this.studio.dbCtx();
    return {
      selectedReleaseId: db.pkgVersionInfoMeta?.id,
      selectedRevisionId: this.studio.editMode ? undefined : db.revisionInfo?.id,
      currentRevisionNum: db.revisionNum,
      versionsReadOnly: this.studio.getLeftTabPermission("versions") === "readable",
    };
  }

  syncContext() {
    if (this.disposed) { return; }
    this.update(this.context());
  }

  private update(patch: Partial<StudioVersionHistoryState>) {
    this.state.setState((previous) => {
      const next = { ...previous, ...patch };
      return shallow(previous, next) ? previous : Object.freeze(next);
    }, true);
  }

  private setReleases(records: readonly PkgVersionInfoMeta[]) {
    const next = shareRows(this.commandReleases, records.map((record) => cloneDeep(omit(record, "model"))));
    this.commandReleases = next;
    const rows = next.map((row): PublishedVersionRow => Object.freeze({
      id: row.id, pkgId: row.pkgId, version: row.version, description: row.description,
      tags: Object.freeze(row.tags?.slice() ?? []), createdAt: new Date(row.createdAt).toISOString(),
      createdById: row.createdById, revisionId: row.revisionId, branchId: row.branchId,
    }));
    this.update({ releases: shareRows(this.state.getState().releases, rows) });
  }

  private setRevisions(records: readonly MinimalRevisionInfo[]) {
    this.commandRevisions = shareRows(this.commandRevisions, records.map((record) => cloneDeep(record)));
    const rows = this.commandRevisions.map((row): AutosavedVersionRow => Object.freeze({ id: row.id, revision: row.revision, createdAt: new Date(row.createdAt).toISOString(), createdById: row.createdById }));
    this.update({ revisions: shareRows(this.state.getState().revisions, rows) });
  }

  async refreshReleases() {
    if (this.disposed) { return; }
    const request = ++this.releaseRequest;
    const branchId = this.studio.uiEnvironment.store.getState().branchId;
    const before = this.commandReleases;
    const response = await this.studio.getProjectReleases();
    if (this.disposed || request !== this.releaseRequest || branchId !== this.studio.uiEnvironment.store.getState().branchId) { return; }
    this.setReleases(mergeConcurrentRows(before, this.commandReleases, response));
  }

  async refreshRevisions(revisionNumGt?: number) {
    if (this.disposed) { return; }
    const request = ++this.revisionRequest;
    const branchId = this.studio.uiEnvironment.store.getState().branchId;
    const before = this.commandRevisions;
    const response = await this.studio.listUnpublishedProjectRevisions(revisionNumGt);
    if (this.disposed || request !== this.revisionRequest || branchId !== this.studio.uiEnvironment.store.getState().branchId) { return; }
    const revisions = revisionNumGt ? [...response, ...this.commandRevisions] : mergeConcurrentRows(before, this.commandRevisions, response);
    this.setRevisions(uniqBy(revisions, (row) => row.id));
  }

  prependRelease(record: PkgVersionInfoMeta) {
    if (this.disposed || (record.branchId ?? null) !== this.studio.uiEnvironment.store.getState().branchId) { return; }
    this.setReleases([record, ...this.commandReleases.filter((row) => row.id !== record.id)]);
  }

  prependRevision(record: MinimalRevisionInfo) {
    if (this.disposed || (record.branchId ?? null) !== this.studio.uiEnvironment.store.getState().branchId) { return; }
    this.setRevisions([record, ...this.commandRevisions.filter((row) => row.id !== record.id)]);
  }

  async updatePkgVersion(pkgId: string, version: string, branchId: BranchId | null, toMerge: Partial<PkgVersionInfo>) {
    if (this.disposed) { return; }
    const key = JSON.stringify([pkgId, version, branchId]);
    const request = Symbol();
    this.releaseUpdates.set(key, request);
    try {
      const { pkg } = await this.studio.appCtx.api.updatePkgVersion(pkgId, version, branchId, toMerge);
      if (this.disposed || this.releaseUpdates.get(key) !== request || branchId !== this.studio.uiEnvironment.store.getState().branchId) { return; }
      this.setReleases(this.commandReleases.map((row) => row.pkgId === pkgId && row.version === version ? { ...row, ...pkg } : row));
    } finally {
      if (this.releaseUpdates.get(key) === request) { this.releaseUpdates.delete(key); }
    }
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.releaseRequest++;
    this.revisionRequest++;
    this.releaseUpdates.clear();
    this.stops.forEach((stop) => stop());
  }
}
