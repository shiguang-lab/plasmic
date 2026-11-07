import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { assert, ensure, mkUuid } from "@/wab/shared/common";
import type {
  DesktopDraft,
  DesktopDraftSession,
  DesktopDraftStatus,
  DesktopDraftSummary,
} from "@/wab/shared/desktop-drafts";
import isEqual from "lodash/isEqual";
import { shallow } from "zustand/shallow";
import { createStore } from "zustand/vanilla";

type DraftContent = Omit<DesktopDraft, "id" | "savedAt" | "format">;

export function canRestoreDraft(draft: DesktopDraft, remote: DraftContent) {
  return (
    draft.format === 1 &&
    draft.baseRevision === remote.baseRevision &&
    draft.modelVersion === remote.modelVersion &&
    draft.hostlessDataVersion === remote.hostlessDataVersion &&
    draft.bundle.version === remote.bundle.version
  );
}

export interface DesktopDraftState {
  readonly initializing: boolean;
  readonly enabled: boolean;
  readonly drafts: readonly Readonly<DesktopDraftSummary>[];
  readonly dialogOpen: boolean;
  readonly status: Readonly<DesktopDraftStatus> | null;
}

export const initialDesktopDraftState: DesktopDraftState = {
  initializing: true,
  enabled: false,
  drafts: [],
  dialogOpen: false,
  status: null,
};

export class DesktopDraftController {
  private readonly state = createStore<DesktopDraftState>(
    () => initialDesktopDraftState,
  );
  // Keep writes in controller actions; React subscribes to individual fields.
  readonly store: Pick<
    typeof this.state,
    "getState" | "getInitialState" | "subscribe"
  > = this.state;
  session: DesktopDraftSession | undefined;
  private writing = 0;
  private error: string | undefined;
  private savedAt: number | undefined;
  private savedSequence = -1;
  private queued:
    { id: string; sequence: number; revision: number } | undefined;
  private id = mkUuid();
  private sequenceOffset = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private pending: Promise<void> = Promise.resolve();
  private stopped = false;
  private checkpoint: DesktopDraft | undefined = undefined;
  private savedBaseRevision = -1;

  constructor(
    private readonly api: Pick<
      TopFrameApi,
      | "openDesktopDrafts"
      | "readDesktopDraft"
      | "writeDesktopDraft"
      | "removeDesktopDraft"
    >,
    private readonly content: () => DraftContent,
    private readonly dirty: () => boolean,
    private readonly sequence: () => number,
    private readonly revision: () => number,
    private readonly restore: (draft: DesktopDraft) => Promise<void>,
  ) {}

  private publish(patch: Partial<DesktopDraftState> = {}) {
    if (this.stopped) {
      return;
    }
    this.state.setState((previous) => {
      const next = { ...previous, ...patch };
      const status: DesktopDraftStatus | null = !next.enabled
        ? null
        : {
            state: next.drafts.length
              ? "conflict"
              : !this.dirty()
                ? "synced"
                : this.hasCurrentBackup
                  ? "local"
                  : this.error
                    ? "error"
                    : this.writing
                      ? "saving"
                      : "pending",
            savedAt: this.savedAt,
            error: this.error,
            pendingDrafts: next.drafts.length,
          };
      next.status = shallow(previous.status, status) ? previous.status : status;
      return shallow(previous, next) ? previous : next;
    }, true);
  }

  setDialogOpen(open: boolean) {
    this.publish({ dialogOpen: open });
  }

  async initialize(userId: string, projectId: string, branchId: string | null) {
    try {
      const session = await this.api.openDesktopDrafts(
        userId,
        projectId,
        branchId,
      );
      if (!session) {
        return;
      }
      this.session = session;
      this.publish({ enabled: true });
      if (session.drafts.length === 0) {
        return;
      }
      const remote = this.content();
      const drafts: DesktopDraftSummary[] = [];
      for (const summary of session.drafts) {
        const draft = await this.api.readDesktopDraft(
          session.handle,
          summary.id,
        );
        if (!draft) {
          continue;
        }
        // Also handles a committed save whose HTTP response was lost. A higher
        // revision alone cannot prove that the remote contains this draft.
        if (isEqual(draft.bundle, remote.bundle)) {
          await this.api.removeDesktopDraft(
            session.handle,
            draft.id,
            draft.sequence,
          );
        } else {
          drafts.push(summary);
        }
      }
      this.publish({ drafts });
      if (drafts.length === 1) {
        const draft = await this.api.readDesktopDraft(
          session.handle,
          ensure(drafts[0], "Missing draft").id,
        );
        if (draft && !draft.needsAttention && canRestoreDraft(draft, remote)) {
          await this.restore(draft);
          this.id = draft.id;
          this.sequenceOffset = draft.sequence - this.sequence() + 1;
          this.publish({ drafts: [] });
          this.changed();
        }
      }
      for (const summary of this.store.getState().drafts) {
        const draft = await this.read(summary);
        if (draft && !draft.needsAttention) {
          await this.api.writeDesktopDraft(
            session.handle,
            JSON.stringify({ ...draft, needsAttention: true }),
          );
          this.publish({
            drafts: this.store
              .getState()
              .drafts.map((item) =>
                item.id === summary.id
                  ? { ...item, needsAttention: true }
                  : item,
              ),
          });
        }
      }
      this.setDialogOpen(this.store.getState().drafts.length > 0);
    } catch (error) {
      // An unavailable Desktop store is visible; never claim local protection.
      this.error = String(error);
      this.publish({ enabled: true });
    } finally {
      this.publish({ initializing: false });
    }
  }

  changed() {
    if (!this.store.getState().enabled || this.stopped) {
      return;
    }
    this.publish();
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, 500);
  }

  async flush(): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.store.getState().enabled) {
      return true;
    }
    if (!this.session) {
      return false;
    }
    this.publish();
    if (!this.dirty() || this.stopped) {
      await this.pending;
      return !this.error;
    }
    if (this.hasCurrentBackup && !this.error) {
      await this.pending;
      return true;
    }
    if (
      this.queued?.id === this.id &&
      this.queued.sequence === this.currentSequence &&
      this.queued.revision === this.revision()
    ) {
      await this.pending;
      return !this.error && this.hasCurrentBackup;
    }
    if (this.savedSequence >= this.currentSequence) {
      this.sequenceOffset = this.savedSequence + 1 - this.sequence();
    }
    const session = this.session;
    let draft: DesktopDraft;
    try {
      draft = {
        ...this.content(),
        sequence: this.currentSequence,
        format: 1,
        id: this.id,
        savedAt: Date.now(),
      };
    } catch (error) {
      this.error = String(error);
      this.publish();
      return false;
    }
    const queued = {
      id: draft.id,
      sequence: draft.sequence,
      revision: draft.baseRevision,
    };
    this.queued = queued;
    this.writing++;
    this.publish();
    this.pending = this.pending.then(async () => {
      try {
        // A string avoids cloning the full model graph through both Comlink
        // and Electron IPC. The main process still parses and validates it.
        await this.api.writeDesktopDraft(session.handle, JSON.stringify(draft));
        if (draft.id === this.id) {
          this.savedSequence = draft.sequence;
          this.savedAt = draft.savedAt;
          this.error = undefined;
          this.savedBaseRevision = draft.baseRevision;
          this.checkpoint = draft;
        }
      } catch (error) {
        this.error = String(error);
      } finally {
        this.writing--;
        if (this.queued === queued) {
          this.queued = undefined;
        }
        this.publish();
      }
    });
    await this.pending;
    return !this.error && this.hasCurrentBackup;
  }

  private get currentSequence() {
    return this.sequence() + this.sequenceOffset;
  }

  saveToken() {
    return { id: this.id, sequence: this.currentSequence };
  }

  async acknowledged(token: { id: string; sequence: number }) {
    this.publish();
    if (!this.session) {
      return;
    }
    await this.pending;
    try {
      await this.api.removeDesktopDraft(
        this.session.handle,
        token.id,
        token.sequence,
      );
      if (this.dirty()) {
        this.changed();
      }
    } catch (error) {
      this.error = String(error);
      this.publish();
    }
  }

  // Before replacing a model, keep the checkpoint as a separately recoverable
  // draft. Subsequent edits and acknowledgements belong to a new file.
  async markConflict(useCheckpoint = false) {
    if (!this.dirty() || !this.store.getState().enabled) {
      return;
    }
    if (!useCheckpoint && !(await this.flush())) {
      throw new Error(this.error || "Local draft backup failed");
    }
    await this.pending;
    const checkpoint = ensure(
      this.checkpoint,
      "Local draft backup unavailable",
    );
    const { projectId, projectName, branchId, baseRevision, sequence } =
      checkpoint;
    await this.api.writeDesktopDraft(
      ensure(this.session, "Missing draft session").handle,
      JSON.stringify({ ...checkpoint, needsAttention: true }),
    );
    this.publish({
      drafts: [
        ...this.store.getState().drafts.filter((draft) => draft.id !== this.id),
        {
          projectId,
          projectName,
          branchId,
          baseRevision,
          sequence,
          id: this.id,
          savedAt: checkpoint.savedAt,
          needsAttention: true,
        },
      ],
      dialogOpen: true,
    });
  }

  async protect(useCheckpoint = false) {
    if (!this.dirty() || !this.store.getState().enabled) {
      return;
    }
    await this.markConflict(useCheckpoint);
    this.id = mkUuid();
    this.sequenceOffset = 0;
    this.savedSequence = -1;
    this.checkpoint = undefined;
    this.publish();
  }

  async read(summary: DesktopDraftSummary) {
    return this.api.readDesktopDraft(
      ensure(this.session, "Draft session unavailable").handle,
      summary.id,
    );
  }

  async reconcileRemote(bundle: DesktopDraft["bundle"]) {
    if (!this.session) {
      return;
    }
    for (const summary of [...this.store.getState().drafts]) {
      try {
        const draft = await this.read(summary);
        if (draft && isEqual(draft.bundle, bundle)) {
          await this.discard(summary);
        }
      } catch (error) {
        this.error = String(error);
        this.publish();
      }
    }
    this.setDialogOpen(this.store.getState().drafts.length > 0);
  }

  async discard(summary: DesktopDraftSummary) {
    assert(
      !this.isCurrentDraft(summary),
      "Switch to the remote version before discarding the active draft",
    );
    const removed = await this.api.removeDesktopDraft(
      ensure(this.session, "Draft session unavailable").handle,
      summary.id,
      summary.sequence,
    );
    if (!removed) {
      throw new Error(
        "The local draft changed. Reopen the project before discarding it.",
      );
    }
    const drafts = this.store.getState().drafts;
    const remaining = drafts.filter((draft) => draft.id !== summary.id);
    if (remaining.length !== drafts.length) {
      this.publish({ drafts: remaining });
    }
  }

  isCurrentDraft(summary: DesktopDraftSummary) {
    return summary.id === this.id;
  }

  get hasCurrentBackup() {
    return (
      this.store.getState().enabled &&
      this.savedSequence >= this.currentSequence &&
      this.savedBaseRevision === this.revision()
    );
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.stopped = true;
  }
}
