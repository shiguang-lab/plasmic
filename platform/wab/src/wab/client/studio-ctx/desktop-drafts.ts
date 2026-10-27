import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { assert, ensure, mkUuid } from "@/wab/shared/common";
import type { DesktopDraft, DesktopDraftSession, DesktopDraftStatus, DesktopDraftSummary } from "@/wab/shared/desktop-drafts";
import isEqual from "lodash/isEqual";
import { makeAutoObservable, observable, runInAction } from "mobx";

type DraftContent = Omit<DesktopDraft, "id" | "savedAt" | "format">;

export function canRestoreDraft(draft: DesktopDraft, remote: DraftContent) {
  return draft.format === 1 && draft.baseRevision === remote.baseRevision &&
    draft.modelVersion === remote.modelVersion &&
    draft.hostlessDataVersion === remote.hostlessDataVersion &&
    draft.bundle.version === remote.bundle.version;
}

export class DesktopDraftController {
  session: DesktopDraftSession | undefined = undefined;
  initializing = true;
  enabled = false;
  writing = false;
  error: string | undefined = undefined;
  savedAt: number | undefined = undefined;
  savedSequence = -1;
  drafts: DesktopDraftSummary[] = [];
  dialogOpen = false;
  private id = mkUuid();
  private sequenceOffset = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private pending: Promise<void> = Promise.resolve();
  private stopped = false;
  private checkpoint: DesktopDraft | undefined = undefined;
  private savedBaseRevision = -1;

  constructor(
    private readonly api: Pick<TopFrameApi, "openDesktopDrafts" | "readDesktopDraft" | "writeDesktopDraft" | "removeDesktopDraft">,
    private readonly content: () => DraftContent,
    private readonly dirty: () => boolean,
    private readonly sequence: () => number,
    private readonly revision: () => number,
    private readonly restore: (draft: DesktopDraft) => Promise<void>,
  ) {
    makeAutoObservable<this, "api" | "content" | "dirty" | "sequence" | "revision" | "restore" | "pending" | "timer" | "checkpoint">(this, {
      api: false, content: false, dirty: false, sequence: false, revision: false, restore: false, pending: false, timer: false, checkpoint: false,
      session: observable.ref,
    }, { autoBind: true });
  }

  async initialize(userId: string, projectId: string, branchId: string | null) {
    try {
      const session = await this.api.openDesktopDrafts(userId, projectId, branchId);
      if (!session) {return;}
      runInAction(() => { this.session = session; this.enabled = true; });
      const remote = this.content();
      const drafts: DesktopDraftSummary[] = [];
      for (const summary of session.drafts) {
        const draft = await this.api.readDesktopDraft(session.handle, summary.id);
        if (!draft) {continue;}
        // Also handles a committed save whose HTTP response was lost. A higher
        // revision alone cannot prove that the remote contains this draft.
        if (isEqual(draft.bundle, remote.bundle)) {
          await this.api.removeDesktopDraft(session.handle, draft.id, draft.sequence);
        } else {
          drafts.push(summary);
        }
      }
      runInAction(() => { this.drafts = drafts; });
      if (drafts.length === 1) {
        const draft = await this.api.readDesktopDraft(session.handle, ensure(drafts[0], "Missing draft").id);
        if (draft && !draft.needsAttention && canRestoreDraft(draft, remote)) {
          await this.restore(draft);
          runInAction(() => {
            this.id = draft.id;
            this.sequenceOffset = draft.sequence - this.sequence() + 1;
            this.drafts = [];
          });
          this.changed();
        }
      }
      for (const summary of this.drafts) {
        const draft = await this.read(summary);
        if (draft && !draft.needsAttention) {
          await this.api.writeDesktopDraft(session.handle, { ...draft, needsAttention: true });
          runInAction(() => { summary.needsAttention = true; });
        }
      }
      runInAction(() => { this.dialogOpen = this.drafts.length > 0; });
    } catch (error) {
      // An unavailable Desktop store is visible; never claim local protection.
      runInAction(() => { this.enabled = true; this.error = String(error); });
    } finally {
      runInAction(() => { this.initializing = false; });
    }
  }

  changed() {
    if (!this.enabled || this.stopped || this.timer) {return;}
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 500);
  }

  async flush(): Promise<boolean> {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    if (!this.enabled) {return true;}
    if (!this.session) {return false;}
    if (!this.dirty() || this.stopped) { await this.pending; return !this.error; }
    if (this.hasCurrentBackup && !this.error) { await this.pending; return true; }
    if (this.savedSequence >= this.currentSequence) {
      this.sequenceOffset = this.savedSequence + 1 - this.sequence();
    }
    const session = this.session;
    let draft: DesktopDraft;
    try {
      draft = { ...this.content(), sequence: this.currentSequence, format: 1, id: this.id, savedAt: Date.now() };
    } catch (error) {
      runInAction(() => { this.error = String(error); });
      return false;
    }
    runInAction(() => { this.writing = true; });
    this.pending = this.pending.then(async () => {
      try {
        await this.api.writeDesktopDraft(session.handle, draft);
        runInAction(() => {
          if (draft.id === this.id) {
            this.savedSequence = draft.sequence; this.savedAt = draft.savedAt; this.error = undefined;
            this.savedBaseRevision = draft.baseRevision; this.checkpoint = draft;
          }
        });
      } catch (error) {
        runInAction(() => { this.error = String(error); });
      }
    });
    await this.pending;
    runInAction(() => { this.writing = false; });
    return !this.error && this.hasCurrentBackup;
  }

  private get currentSequence() { return this.sequence() + this.sequenceOffset; }

  saveToken() { return { id: this.id, sequence: this.currentSequence }; }

  async acknowledged(token: { id: string; sequence: number }) {
    if (!this.session) {return;}
    await this.pending;
    try {
      await this.api.removeDesktopDraft(this.session.handle, token.id, token.sequence);
      if (this.dirty()) {this.changed();}
    } catch (error) { runInAction(() => { this.error = String(error); }); }
  }

  // Before replacing a model, keep the checkpoint as a separately recoverable
  // draft. Subsequent edits and acknowledgements belong to a new file.
  async markConflict(useCheckpoint = false) {
    if (!this.dirty() || !this.enabled) {return;}
    if (!useCheckpoint && !(await this.flush())) {throw new Error(this.error || "Local draft backup failed");}
    await this.pending;
    const checkpoint = ensure(this.checkpoint, "Local draft backup unavailable");
    const { projectId, projectName, branchId, baseRevision, sequence } = checkpoint;
    await this.api.writeDesktopDraft(ensure(this.session, "Missing draft session").handle, { ...checkpoint, needsAttention: true });
    runInAction(() => {
      this.drafts = [...this.drafts.filter(draft => draft.id !== this.id), { projectId, projectName, branchId, baseRevision, sequence, id: this.id, savedAt: checkpoint.savedAt, needsAttention: true }];
      this.dialogOpen = true;
    });
  }

  async protect(useCheckpoint = false) {
    if (!this.dirty() || !this.enabled) {return;}
    await this.markConflict(useCheckpoint);
    runInAction(() => {
      this.id = mkUuid(); this.sequenceOffset = 0; this.savedSequence = -1; this.checkpoint = undefined;
    });
  }

  async read(summary: DesktopDraftSummary) {
    return this.api.readDesktopDraft(ensure(this.session, "Draft session unavailable").handle, summary.id);
  }

  async reconcileRemote(bundle: DesktopDraft["bundle"]) {
    if (!this.session) {return;}
    for (const summary of [...this.drafts]) {
      try {
        const draft = await this.read(summary);
        if (draft && isEqual(draft.bundle, bundle)) {await this.discard(summary);}
      } catch (error) { runInAction(() => { this.error = String(error); }); }
    }
    runInAction(() => { this.dialogOpen = this.drafts.length > 0; });
  }

  async discard(summary: DesktopDraftSummary) {
    assert(!this.isCurrentDraft(summary), "Switch to the remote version before discarding the active draft");
    const removed = await this.api.removeDesktopDraft(ensure(this.session, "Draft session unavailable").handle, summary.id, summary.sequence);
    if (!removed) {throw new Error("The local draft changed. Reopen the project before discarding it.");}
    runInAction(() => { this.drafts = this.drafts.filter(draft => draft.id !== summary.id); });
  }

  isCurrentDraft(summary: DesktopDraftSummary) { return summary.id === this.id; }

  get status(): DesktopDraftStatus | null {
    if (!this.enabled) {return null;}
    return {
      state: this.drafts.length ? "conflict" : !this.dirty() ? "synced" :
        this.hasCurrentBackup ? "local" : this.error ? "error" : this.writing ? "saving" : "pending",
      savedAt: this.savedAt, error: this.error, pendingDrafts: this.drafts.length,
    };
  }

  get hasCurrentBackup() {
    return this.enabled && this.savedSequence >= this.currentSequence && this.savedBaseRevision === this.revision();
  }

  dispose() {
    if (this.timer) {clearTimeout(this.timer);}
    this.stopped = true;
  }
}
