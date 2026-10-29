import type { LocalEditSession } from "@/wab/client/copilot/local-edit-session";

/** The UI reads a snapshot; execution and authenticated requests stay in the top frame. */
export type AiSessionView = Pick<
  LocalEditSession,
  | "tasks"
  | "visibleTasks"
  | "activeRun"
  | "blockingTask"
  | "activeThreadId"
  | "branchId"
  | "activeThread"
  | "threads"
  | "threadFilter"
  | "threadListBefore"
  | "threadListLoading"
  | "historyLoading"
  | "scrollTop"
  | "newThread"
  | "selectThread"
  | "searchThreads"
  | "updateThread"
  | "setThreadAttachments"
  | "error"
  | "syncError"
  | "before"
  | "draft"
  | "selectedModel"
  | "running"
  | "subscribe"
  | "snapshot"
  | "canStop"
  | "canUndo"
  | "run"
  | "stop"
  | "loadEarlier"
  | "locate"
  | "reconcile"
  | "retry"
  | "undo"
>;

export type AiSessionSnapshot = Pick<
  AiSessionView,
  | "tasks"
  | "activeThreadId"
  | "branchId"
  | "activeThread"
  | "threads"
  | "threadFilter"
  | "threadListBefore"
  | "threadListLoading"
  | "historyLoading"
  | "scrollTop"
  | "error"
  | "syncError"
  | "before"
  | "draft"
  | "selectedModel"
  | "running"
> & { stoppable: string[]; undoable: string[] };

type ActionName =
  | "run"
  | "stop"
  | "loadEarlier"
  | "locate"
  | "reconcile"
  | "retry"
  | "undo"
  | "newThread"
  | "selectThread"
  | "searchThreads"
  | "updateThread"
  | "setThreadAttachments";
export type AiSessionAction =
  | {
      [K in ActionName]: { type: K; args: Parameters<AiSessionView[K]> };
    }[ActionName]
  | { type: "draft"; value: AiSessionView["draft"]; threadId: string }
  | { type: "scroll"; value: number; threadId: string }
  | { type: "model"; value: string | undefined };

export function snapshotAiSession(session: AiSessionView): AiSessionSnapshot {
  return {
    tasks: session.tasks,
    activeThreadId: session.activeThreadId,
    branchId: session.branchId,
    activeThread: session.activeThread,
    threads: session.threads,
    threadFilter: session.threadFilter,
    threadListBefore: session.threadListBefore,
    threadListLoading: session.threadListLoading,
    historyLoading: session.historyLoading,
    scrollTop: session.scrollTop,
    error: session.error,
    syncError: session.syncError,
    before: session.before,
    draft: session.draft,
    selectedModel: session.selectedModel,
    running: session.running,
    stoppable: session.tasks
      .filter((task) => session.canStop(task))
      .map((task) => task.id),
    undoable: session.tasks
      .flatMap((task) => task.records)
      .filter((record) => session.canUndo(record))
      .map((record) => record.id),
  };
}

export async function applyAiSessionAction(
  session: LocalEditSession,
  action: AiSessionAction,
) {
  switch (action.type) {
    case "draft":
      session.setThreadDraft(action.threadId, action.value);
      return;
    case "scroll":
      session.setThreadScroll(action.threadId, action.value);
      return;
    case "model":
      session.selectedModel = action.value;
      return;
    case "run":
      return session.run(...action.args);
    case "stop":
      return session.stop(...action.args);
    case "loadEarlier":
      return session.loadEarlier(...action.args);
    case "locate":
      return session.locate(...action.args);
    case "reconcile":
      return session.reconcile(...action.args);
    case "retry":
      return session.retry(...action.args);
    case "undo":
      return session.undo(...action.args);
    case "newThread":
      return session.newThread(...action.args);
    case "selectThread":
      return session.selectThread(...action.args);
    case "searchThreads":
      return session.searchThreads(...action.args);
    case "updateThread":
      return session.updateThread(...action.args);
    case "setThreadAttachments":
      return session.setThreadAttachments(...action.args);
  }
}
